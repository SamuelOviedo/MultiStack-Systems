import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MockInstance } from "vitest";
import {
  ADS_ROUTES,
  getAdsTagId,
  getContactSendTo,
  hasAuthCredentialsInUrl,
  hasStoredSession,
  hasUnsafeClickIdsInUrl,
  isAdsRoute,
  sanitizePageLocation,
  sanitizeReferrer,
} from "@/lib/analytics";

type Analytics = typeof import("@/lib/analytics");

// Identificadores de PRUEBA: nunca los reales de la cuenta de Google Ads.
const TAG_ID = "AW-1000000000";
const SEND_TO = "AW-1000000000/PRUEBA";
const GTAG_SRC = `https://www.googletagmanager.com/gtag/js?id=${TAG_ID}`;
/** Origen de jsdom bajo Vitest. Las funciones puras reciben la URL completa y no dependen de él. */
const ORIGIN = window.location.origin;
// Caracteres no ASCII construidos por código: así se distinguen del ASCII a simple vista.
const N_TILDE = String.fromCharCode(0xf1); // ñ
const FULLWIDTH_LETTERS = String.fromCharCode(0xff21, 0xff22, 0xff23); // ＡＢＣ
const FULLWIDTH_DIGITS = String.fromCharCode(0xff11).repeat(10); // １１１１１１１１１１
const GOOGLE_REFERRER = "https://www.google.com/search?q=x";
/** Forma típica de un gclid real, con valor de PRUEBA: 90 caracteres con letras, dígitos, guion y guion bajo. */
const TYPICAL_CLICK_ID = "Cj0KCQiA0eO8BhDfARIsAL6xmuSDEEZqY_tF6nLDmTK-J4hm2Nq7rP1sUvWxYzaB3_-xY9_Qw-ErTy_UiOp-AsDfGh";
/** Un gclid con un correo y un espacio dentro (%40 y %20): gtag.js lo enviaría tal cual. */
const DIRTY_CLICK_ID = "PRUEBA%40example.com%20SUCIO";
/** Las siete claves que gtag.js lee de la URL por su cuenta (query y, si faltan, fragmento). */
const GTAG_CLICK_KEYS = ["gclid", "gbraid", "wbraid", "dclid", "gclsrc", "gad_source", "gad_campaignid"];

interface AdsEnv {
  id: string | undefined;
  label: string | undefined;
}

const TEST_ENV: AdsEnv = { id: TAG_ID, label: SEND_TO };

/** Módulo nuevo (estado en cero) con las dos variables fijadas siempre, porque Vitest carga el .env del desarrollador; `undefined` la deja sin definir. */
async function loadConfigured(env: AdsEnv = TEST_ENV): Promise<Analytics> {
  vi.stubEnv("VITE_GADS_ID", env.id);
  vi.stubEnv("VITE_GADS_CONTACT_LABEL", env.label);
  vi.resetModules();
  return import("@/lib/analytics");
}

const setUrl = (url: string): void => window.history.pushState({}, "", url);

function setReferrer(value: string): void {
  Object.defineProperty(document, "referrer", { configurable: true, get: () => value });
}

const scriptTags = (): HTMLScriptElement[] => Array.from(document.querySelectorAll("script"));

/** Entradas del dataLayer como arreglos: gtag las empuja como objetos Arguments. */
const layerEntries = (): unknown[][] => (window.dataLayer ?? []).map((entry) => Array.from(entry as ArrayLike<unknown>));

const eventsOf = (name: string): unknown[][] => layerEntries().filter((entry) => entry[0] === "event" && entry[1] === name);

const pageViews = (): Array<{ page_location: string; page_referrer: string }> =>
  eventsOf("page_view").map((entry) => entry[2] as { page_location: string; page_referrer: string });

function watchConsole(): () => number {
  const spies: MockInstance[] = [
    vi.spyOn(console, "log"),
    vi.spyOn(console, "info"),
    vi.spyOn(console, "warn"),
    vi.spyOn(console, "error"),
    vi.spyOn(console, "debug"),
  ];
  spies.forEach((spy) => spy.mockImplementation(() => undefined));
  return () => spies.reduce((total, spy) => total + spy.mock.calls.length, 0);
}

function resetPage(): void {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  localStorage.clear();
  scriptTags().forEach((script) => script.remove());
  Reflect.deleteProperty(window, "gtag");
  Reflect.deleteProperty(window, "dataLayer");
  Reflect.deleteProperty(document, "referrer");
  setUrl("/");
}

beforeEach(resetPage);
afterEach(resetPage);

describe("isAdsRoute", () => {
  it("ADS_ROUTES son exactamente las cuatro rutas públicas donde se carga la etiqueta", () => {
    expect([...ADS_ROUTES]).toEqual(["/", "/paginas-web", "/politica-de-privacidad", "/terminos-del-servicio"]);
  });

  it.each([
    "/",
    "/paginas-web",
    "/paginas-web/",
    "/politica-de-privacidad",
    "/politica-de-privacidad/",
    "/terminos-del-servicio",
    "/terminos-del-servicio/",
  ])("acepta %j", (pathname) => {
    expect(isAdsRoute(pathname)).toBe(true);
  });

  it.each([
    "/client/x",
    "/client/abc/",
    "/dashboard",
    "/dashboard/tickets",
    "/dashboard/project/1",
    "/solicitudes",
    "/login",
    "/signup",
    "/auth/callback",
    "/auth/reset-password",
    "/auth/update-password",
    "/ruta-inexistente",
    "//paginas-web",
    "/paginas-web//",
    "//",
    "/Paginas-Web",
    "/PAGINAS-WEB/",
    "/%70aginas-web",
    "/paginas-web;x=1",
    "/paginas-web-x",
    "/paginas-web/extra",
    "/politica-de-privacidad/extra",
    "/paginas-web?x=1",
    "/paginas-web#x",
    "paginas-web",
    " /paginas-web",
    "/paginas-web ",
    "",
  ])("rechaza %j (coincidencia exacta, nunca por prefijo)", (pathname) => {
    expect(isAdsRoute(pathname)).toBe(false);
  });

  it("rechaza todo lo que no sea una cadena", () => {
    for (const value of [null, undefined, {}, 5, true, ["/"], () => "/"]) {
      expect(isAdsRoute(value)).toBe(false);
    }
  });
});

describe("getAdsTagId", () => {
  it.each([
    [TAG_ID, TAG_ID],
    [`  ${TAG_ID}  `, TAG_ID],
    ["AW-123456", "AW-123456"],
    ["AW-123456789012345", "AW-123456789012345"],
  ])("acepta %j", (value, expected) => {
    vi.stubEnv("VITE_GADS_ID", value);
    expect(getAdsTagId()).toBe(expected);
  });

  it.each([
    "AW-12345",
    "AW-1234567890123456",
    "aw-1000000000",
    "G-123456",
    "GTM-ABCDEF",
    "AW-1000000000;",
    "AW-1000000000 AW-2000000000",
    "AW-1000000000/PRUEBA",
    "AW-",
    "",
    "   ",
    `AW-${FULLWIDTH_DIGITS}`,
    `https://www.googletagmanager.com/gtag/js?id=${TAG_ID}`,
  ])("rechaza %j", (value) => {
    vi.stubEnv("VITE_GADS_ID", value);
    expect(getAdsTagId()).toBeNull();
  });

  it("variable sin definir: null", () => {
    vi.stubEnv("VITE_GADS_ID", undefined);
    expect(getAdsTagId()).toBeNull();
  });
});

describe("getContactSendTo", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_GADS_ID", TAG_ID);
  });

  it.each([
    [SEND_TO, SEND_TO],
    [`  ${SEND_TO}  `, SEND_TO],
    ["AW-1000000000/abcd", "AW-1000000000/abcd"],
    ["AW-1000000000/ab-_CD9", "AW-1000000000/ab-_CD9"],
    [`AW-1000000000/${"a".repeat(64)}`, `AW-1000000000/${"a".repeat(64)}`],
  ])("acepta %j", (label, expected) => {
    vi.stubEnv("VITE_GADS_CONTACT_LABEL", label);
    expect(getContactSendTo()).toBe(expected);
  });

  it.each([
    ["otro ID distinto del de la etiqueta", "AW-2000000000/PRUEBA"],
    ["parte de etiqueta de 3 caracteres", "AW-1000000000/abc"],
    ["parte de etiqueta de 65 caracteres", `AW-1000000000/${"a".repeat(65)}`],
    ["con espacio", "AW-1000000000/ab cd"],
    ["con punto", "AW-1000000000/ab.cd"],
    ["con punto y coma", "AW-1000000000/PRUEBA;"],
    ["con marcado HTML", "AW-1000000000/<script>"],
    ["con ñ", `AW-1000000000/${N_TILDE}andu`],
    ["con una segunda barra", "AW-1000000000/PRUEBA/extra"],
    ["sin barra", "AW-1000000000PRUEBA"],
    ["solo la etiqueta", "PRUEBA"],
    ["barra sin etiqueta", "AW-1000000000/"],
    ["prefijo en minúsculas", "aw-1000000000/PRUEBA"],
    ["vacía", ""],
  ])("rechaza una etiqueta %s", (_case, label) => {
    vi.stubEnv("VITE_GADS_CONTACT_LABEL", label);
    expect(getContactSendTo()).toBeNull();
  });

  it("sin ID de etiqueta (VITE_GADS_ID vacío o sin definir) no hay destino aunque la etiqueta esté bien formada", () => {
    vi.stubEnv("VITE_GADS_CONTACT_LABEL", SEND_TO);
    vi.stubEnv("VITE_GADS_ID", "");
    expect(getContactSendTo()).toBeNull();
    vi.stubEnv("VITE_GADS_ID", undefined);
    expect(getContactSendTo()).toBeNull();
  });

  it("variable sin definir: null", () => {
    vi.stubEnv("VITE_GADS_CONTACT_LABEL", undefined);
    expect(getContactSendTo()).toBeNull();
  });
});

describe("sanitizePageLocation", () => {
  const SITE = "https://www.multistacksystems.com";

  it("deja origin + ruta + gclid y descarta token y hash", () => {
    expect(sanitizePageLocation("http://localhost:3000/paginas-web?gclid=PRUEBA&token=X#access_token=Y")).toBe(
      "http://localhost:3000/paginas-web?gclid=PRUEBA",
    );
  });

  it("conserva gclid, gbraid y wbraid en orden de aparición y solo la primera ocurrencia de cada clave", () => {
    expect(sanitizePageLocation(`${SITE}/paginas-web?utm=x&wbraid=W1&gclid=C1&gclid=C2&gbraid=G1#h`)).toBe(
      `${SITE}/paginas-web?wbraid=W1&gclid=C1&gbraid=G1`,
    );
  });

  it("si la primera ocurrencia de una clave es inválida no rescata la segunda", () => {
    expect(sanitizePageLocation(`${SITE}/?gclid=%41&gclid=BBB`)).toBe(`${SITE}/`);
  });

  it("acepta un valor de 512 caracteres y los caracteres ~ . = - _ del identificador", () => {
    const longest = "a".repeat(512);
    expect(sanitizePageLocation(`${SITE}/?gclid=${longest}`)).toBe(`${SITE}/?gclid=${longest}`);
    expect(sanitizePageLocation(`${SITE}/?gclid=Cj0K_a~b.c-d=`)).toBe(`${SITE}/?gclid=Cj0K_a~b.c-d=`);
  });

  it.each([
    ["valor con %xx", "?gclid=%41BC"],
    ["valor con +", "?gclid=a+b"],
    ["clave con corchetes", "?gclid[]=A"],
    ["clave en mayúsculas", "?GCLID=A"],
    ["valor vacío", "?gclid="],
    ["clave sin =", "?gclid"],
    ["valor de 513 caracteres", `?gclid=${"a".repeat(513)}`],
    ["valor con ñ", `?gclid=${N_TILDE}andu`],
    ["valor con letras de ancho completo", `?gclid=${FULLWIDTH_LETTERS}`],
    ["valor con espacio", "?gclid=a b"],
    ["valor con punto y coma", "?gclid=A;token=SECRET"],
    ["valor con salto de línea codificado", "?gclid=A%0aB"],
    ["valor con comillas y ángulos", '?gclid="<A>"'],
  ])("descarta un identificador de clic inválido: %s", (_case, query) => {
    expect(sanitizePageLocation(`${SITE}/paginas-web${query}`)).toBe(`${SITE}/paginas-web`);
  });

  it("ninguna otra clave de la query sale: ni utm, ni token, ni correo, ni credenciales de auth", () => {
    const href = `${SITE}/?utm_source=google&token=SECRET&email=a@b.c&code=SECRETCODE&access_token=SECRET2&gclid=PRUEBA`;
    expect(sanitizePageLocation(href)).toBe(`${SITE}/?gclid=PRUEBA`);
  });

  it("el hash se descarta siempre, también con tokens de Supabase", () => {
    expect(sanitizePageLocation(`${SITE}/#access_token=SECRET&refresh_token=SECRET2&type=recovery`)).toBe(`${SITE}/`);
    expect(sanitizePageLocation(`${SITE}/paginas-web?gclid=A#contacto`)).toBe(`${SITE}/paginas-web?gclid=A`);
    expect(sanitizePageLocation(`${SITE}/paginas-web#?gclid=ENELHASH`)).toBe(`${SITE}/paginas-web`);
  });

  it("deja fuera del resultado las credenciales usuario:clave@", () => {
    const result = sanitizePageLocation("https://usuario:clave@www.multistacksystems.com/paginas-web?gclid=A");
    expect(result).toBe(`${SITE}/paginas-web?gclid=A`);
    expect(result).not.toMatch(/usuario|clave|@/);
  });

  it.each([
    ["javascript:", "javascript:alert(1)//?gclid=A"],
    ["data:", "data:text/html,<script>alert(1)</script>"],
    ["blob:", `blob:${SITE}/0d6c1f6e-0000-4000-8000-000000000000`],
    ["file:", "file:///paginas-web?gclid=A"],
    ["ftp:", "ftp://www.multistacksystems.com/paginas-web"],
    ["about:blank", "about:blank"],
    ["cadena vacía", ""],
    ["ruta relativa", "/paginas-web?gclid=A"],
    ["texto cualquiera", "no es una url"],
  ])("devuelve cadena vacía para %s", (_case, href) => {
    expect(sanitizePageLocation(href)).toBe("");
  });

  it.each([
    "/client/abc",
    "/client/abc?gclid=A",
    "/dashboard",
    "/dashboard/project/1",
    "/solicitudes",
    "/login",
    "/signup",
    "/auth/callback#access_token=SECRET",
    "/auth/reset-password",
    "/auth/update-password",
    "/ruta-inexistente",
    "/Paginas-Web",
    "/%70aginas-web?gclid=A",
    "/paginas-web;x=1",
    "//paginas-web",
    "/paginas-web//",
    "/paginas-web/extra",
  ])("devuelve cadena vacía para una ruta no permitida: %s", (path) => {
    expect(sanitizePageLocation(`${SITE}${path}`)).toBe("");
  });

  it("conserva la barra final y el puerto", () => {
    expect(sanitizePageLocation("http://localhost:3000/paginas-web/?gclid=A")).toBe("http://localhost:3000/paginas-web/?gclid=A");
    expect(sanitizePageLocation("https://staging.example.test:8443/politica-de-privacidad/")).toBe(
      "https://staging.example.test:8443/politica-de-privacidad/",
    );
    expect(sanitizePageLocation("http://localhost:3000")).toBe("http://localhost:3000/");
  });

  describe("fuzz con semilla fija (2 000 URLs hostiles)", () => {
    // Gramática de salida: origin http(s) sin credenciales + ruta permitida + como máximo
    // gclid/gbraid/wbraid (una vez cada uno) con valores [A-Za-z0-9_.~=-]{1,512}, sin hash.
    const CLICK_PAIR = "(?:gclid|gbraid|wbraid)=[A-Za-z0-9_.~=-]{1,512}";
    const ALLOWED_PATH = "(?:/|/paginas-web/?|/politica-de-privacidad/?|/terminos-del-servicio/?)";
    const SAFE_OUTPUT = new RegExp(`^https?://[^/?#@\\s]+${ALLOWED_PATH}(?:\\?${CLICK_PAIR}(?:&${CLICK_PAIR}){0,2})?$`);

    /** PRNG propio (mulberry32): la secuencia es la misma en cualquier máquina. */
    function mulberry32(seed: number): () => number {
      let state = seed | 0;
      return () => {
        state = (state + 0x6d2b79f5) | 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }

    const WEB_ORIGINS = [
      "http://localhost:3000",
      "https://www.multistacksystems.com",
      "https://www.multistacksystems.com:8443",
      "HTTPS://WWW.MULTISTACKSYSTEMS.COM",
      "https://usuario:clave@www.multistacksystems.com",
      "http://u:p@[::1]:5173",
      "https://xn--pgina-vta.example.test",
    ];
    const HOSTILE_ORIGINS = [
      "javascript:",
      "data:text/html,",
      "blob:https://www.multistacksystems.com",
      "file://",
      "ftp://ftp.example.test",
      "about:blank#",
      "//example.test",
      "https:",
      "",
    ];
    const ALLOWED_PATHS = ["/", "/paginas-web", "/paginas-web/", "/politica-de-privacidad", "/terminos-del-servicio/", "/"];
    const OTHER_PATHS = [
      "/client/TOKEN",
      "/dashboard",
      "/auth/callback",
      "//paginas-web",
      "/paginas-web//",
      "/Paginas-Web",
      "/%70aginas-web",
      "/paginas-web;x=1",
      "/paginas-web/../client/TOKEN",
      "/paginas-web/./",
      "/\\paginas-web",
      "",
    ];
    const CLICK_KEYS = ["gclid", "gbraid", "wbraid"];
    const OTHER_KEYS = ["GCLID", "gclid[]", "gclid%20", "%67clid", "token", "utm_source", "access_token", "code", ""];
    const GOOD_VALUES = ["PRUEBA", "Cj0KCQ_abc-DEF.123~x=", "a=b=c", "9", "x".repeat(512)];
    const BAD_VALUES = [
      "%41BC",
      "a+b",
      "",
      "A B",
      "A%0aB",
      "A\nB",
      `${N_TILDE}andu`,
      FULLWIDTH_LETTERS,
      "'\"<>",
      "A;B",
      "x".repeat(513),
    ];
    const SEPARATORS = ["&", "&", "&", "&", ";", "&&", "?"];
    const HASHES = ["", "", "#", "#contacto", "#access_token=SECRET&type=recovery", "#?gclid=ENELHASH", "#/client/TOKEN"];

    function hostileHref(rand: () => number): string {
      const pick = <T>(items: readonly T[]): T => items[Math.floor(rand() * items.length)];
      let query = "";
      if (rand() < 0.8) {
        const count = 1 + Math.floor(rand() * 5);
        const parts: string[] = [];
        for (let i = 0; i < count; i++) {
          const key = rand() < 0.6 ? pick(CLICK_KEYS) : pick(OTHER_KEYS);
          parts.push(rand() < 0.9 ? `${key}=${rand() < 0.55 ? pick(GOOD_VALUES) : pick(BAD_VALUES)}` : key);
        }
        query = `?${parts.map((part, i) => (i === 0 ? part : `${pick(SEPARATORS)}${part}`)).join("")}`;
      }
      const path = rand() < 0.7 ? pick(ALLOWED_PATHS) : pick(OTHER_PATHS);
      const origin = rand() < 0.75 ? pick(WEB_ORIGINS) : pick(HOSTILE_ORIGINS);
      return `${origin}${path}${query}${pick(HASHES)}`;
    }

    it("la salida es siempre vacía o cumple la gramática segura, y es estable al volver a sanear", () => {
      const rand = mulberry32(20261020);
      let empty = 0;
      let kept = 0;
      let withClickId = 0;
      for (let i = 0; i < 2000; i++) {
        const href = hostileHref(rand);
        const output = sanitizePageLocation(href);
        if (output === "") {
          empty++;
          continue;
        }
        kept++;
        expect(output, `entrada: ${JSON.stringify(href)}`).toMatch(SAFE_OUTPUT);
        expect(output).not.toContain("#");
        const [base, query = ""] = output.split("?");
        const parsed = new URL(href);
        expect(base).toBe(parsed.origin + parsed.pathname);
        const outputPairs = query.split("&").filter(Boolean);
        const keys = outputPairs.map((pair) => pair.split("=")[0]);
        expect(new Set(keys).size).toBe(keys.length);
        // Cada pareja conservada es la PRIMERA de su clave en la query de entrada, y el orden es el de aparición.
        const inputPairs = parsed.search.slice(1).split("&");
        for (const pair of outputPairs) {
          const key = pair.split("=")[0];
          expect(pair, `entrada: ${JSON.stringify(href)}`).toBe(inputPairs.find((candidate) => candidate.split("=")[0] === key));
        }
        const positions = outputPairs.map((pair) => inputPairs.indexOf(pair));
        expect(positions).toEqual([...positions].sort((a, b) => a - b));
        if (keys.length > 0) withClickId++;
        expect(sanitizePageLocation(output)).toBe(output);
      }
      // Que no sea una prueba vacía: la mezcla debe dar salidas descartadas, conservadas y con click-ids.
      const stats = JSON.stringify({ empty, kept, withClickId });
      expect(empty, stats).toBeGreaterThan(200);
      expect(kept, stats).toBeGreaterThan(400);
      expect(withClickId, stats).toBeGreaterThan(200);
    });
  });
});

describe("sanitizeReferrer", () => {
  const OWN = "http://localhost:3000";

  it("un referrer propio con ruta o token se descarta", () => {
    expect(sanitizeReferrer(`${OWN}/client/TOKEN`, OWN)).toBe("");
    expect(sanitizeReferrer(`${OWN}/dashboard?x=1#h`, OWN)).toBe("");
    expect(sanitizeReferrer(`${OWN}/`, OWN)).toBe("");
  });

  it("uno externo con ruta, query y hash se reduce a su origen", () => {
    expect(sanitizeReferrer("https://x.com/ruta/larga?q=secreto&token=X#fragmento", OWN)).toBe("https://x.com/");
    expect(sanitizeReferrer(GOOGLE_REFERRER, OWN)).toBe("https://www.google.com/");
  });

  it("deja fuera las credenciales y conserva el puerto del origen externo", () => {
    expect(sanitizeReferrer("https://usuario:clave@x.com:8443/ruta", OWN)).toBe("https://x.com:8443/");
  });

  it("otro subdominio del sitio cuenta como externo: sale su origen, nunca la ruta ni el token", () => {
    const result = sanitizeReferrer("https://multistacksystems.com/client/TOKEN?x=1#h", "https://www.multistacksystems.com");
    expect(result).toBe("https://multistacksystems.com/");
    expect(result).not.toContain("TOKEN");
  });

  it("android-app://… y otros esquemas que no son http(s) se descartan", () => {
    expect(sanitizeReferrer("android-app://com.google.android.gm/", OWN)).toBe("");
    expect(sanitizeReferrer("javascript:alert(1)", OWN)).toBe("");
    expect(sanitizeReferrer("data:text/html,x", OWN)).toBe("");
  });

  it("si el origen propio no se puede interpretar no se envía nada", () => {
    expect(sanitizeReferrer("https://x.com/ruta", "no es una url")).toBe("");
    expect(sanitizeReferrer("https://x.com/ruta", "")).toBe("");
    expect(sanitizeReferrer("https://x.com/ruta", "/relativo")).toBe("");
  });

  it("un referrer vacío o inválido da cadena vacía", () => {
    expect(sanitizeReferrer("", OWN)).toBe("");
    expect(sanitizeReferrer("no es una url", OWN)).toBe("");
  });
});

describe("hasAuthCredentialsInUrl", () => {
  it.each(["/#access_token=x&type=recovery", "/?ERROR=x", "/?%63ode=x"])(
    "detecta credenciales en %s",
    (url) => {
      setUrl(url);
      expect(hasAuthCredentialsInUrl()).toBe(true);
    },
  );

  it.each(["/paginas-web?gclid=A&code=x", "/paginas-web?gclid=A#access_token=x"])("detecta también %s", (url) => {
    setUrl(url);
    expect(hasAuthCredentialsInUrl()).toBe(true);
  });

  // Las trece claves de auth de Supabase (flujo implícito, PKCE, enlaces de correo y errores), cada una sola.
  it.each(
    [
      "access_token",
      "refresh_token",
      "provider_token",
      "provider_refresh_token",
      "token_hash",
      "token_type",
      "expires_in",
      "expires_at",
      "code",
      "error",
      "error_code",
      "error_description",
      "type",
    ].flatMap((key) => [`/?${key}=x`, `/#${key}=x`]),
  )("detecta la clave de auth sola en %s", (url) => {
    setUrl(url);
    expect(hasAuthCredentialsInUrl()).toBe(true);
  });

  it.each(["/#contacto", "/?gclid=A", "/?utm_source=x", "/?token=X", "/paginas-web?gclid=A&utm_source=x#contacto", "/"])(
    "no se activa con %s",
    (url) => {
      setUrl(url);
      expect(hasAuthCredentialsInUrl()).toBe(false);
    },
  );

  it("si la URL no se puede inspeccionar falla cerrado (true)", () => {
    vi.stubGlobal(
      "URLSearchParams",
      class {
        constructor() {
          throw new Error("no se puede inspeccionar");
        }
      },
    );
    expect(hasAuthCredentialsInUrl()).toBe(true);
  });
});

describe("hasUnsafeClickIdsInUrl", () => {
  it("el gclid típico de prueba tiene 90 caracteres válidos", () => {
    expect(TYPICAL_CLICK_ID).toHaveLength(90);
    expect(TYPICAL_CLICK_ID).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it.each([
    ["gclid típico de 90 caracteres (letras, dígitos, - y _)", `/paginas-web/?gclid=${TYPICAL_CLICK_ID}`],
    ["gclid de 512 caracteres (el límite válido)", `/?gclid=${"a".repeat(512)}`],
    [
      "los siete parámetros con valores válidos a la vez",
      `/?gclid=${TYPICAL_CLICK_ID}&gbraid=G_1&wbraid=W-2&dclid=D.3&gclsrc=aw.ds&gad_source=1&gad_campaignid=99`,
    ],
    ["valor vacío con =", "/?gclid="],
    ["valor vacío sin =", "/?gclid"],
    ["varios valores vacíos", "/?gclid=&gbraid=&wbraid&dclid="],
    ["escape que decodifica a un carácter válido (%41BC es ABC)", "/?gclid=%41BC"],
    ["escape que decodifica a ~ (%7E)", "/?gclid=a%7Eb"],
    ["= ~ . - _ son válidos", "/?gclid=Cj0K_a~b.c-d=="],
    ["clave repetida con ambos valores válidos", `/?gclid=${TYPICAL_CLICK_ID}&gclid=OTRO_VALIDO`],
    ["URL sin query (/paginas-web/)", "/paginas-web/"],
    ["solo un ancla", "/#contacto"],
    ["fragmento con valor vacío", "/#gclid="],
    ["otros parámetros no cuentan aquí (correo, utm, token)", "/?email=a@b.co&utm_source=g%20h&token=X"],
    ["claves parecidas pero no exactas (gclid[], xgclid, gclid_)", "/?gclid[]=bad%20x&xgclid=bad%20x&gclid_=bad%20x"],
  ])("false: %s", (_case, url) => {
    setUrl(url);
    expect(hasUnsafeClickIdsInUrl()).toBe(false);
  });

  // gtag.js solo lee las claves exactas y en minúsculas: con otra capitalización no hay nada que bloquear.
  it.each([
    ["GCLID con un correo y un espacio dentro", `/paginas-web/?GCLID=${DIRTY_CLICK_ID}`],
    ["Gclid", "/?Gclid=bad%20x"],
    ["gClid", "/?gClid=bad%20x"],
    ["GBRAID", "/?GBRAID=bad%20x"],
    ["Gad_Source", "/?Gad_Source=bad%20x"],
    ["clave codificada que decodifica a mayúscula (%47clid)", "/?%47clid=bad%20x"],
    ["GCLID en el fragmento", "/#GCLID=bad%20x"],
  ])("false (otra capitalización): %s", (_case, url) => {
    setUrl(url);
    expect(hasUnsafeClickIdsInUrl()).toBe(false);
  });

  it.each([
    ["gclid con @ y espacio (%40 y %20)", `/paginas-web/?gclid=${DIRTY_CLICK_ID}`],
    ["gclid de 600 caracteres", `/paginas-web/?gclid=${"G".repeat(600)}`],
    ["gclid de 513 caracteres (uno sobre el límite)", `/?gclid=${"a".repeat(513)}`],
    ["solo una @ (%40)", "/?gclid=a%40b"],
    ["una barra", "/?gad_campaignid=1/2"],
    ["clave repetida, la segunda inválida", `/?gclid=${TYPICAL_CLICK_ID}&gclid=bad%20value`],
    ["clave repetida, la primera inválida", `/?gclid=bad%20value&gclid=${TYPICAL_CLICK_ID}`],
    ["varias claves, solo una inválida", "/?gclid=OK_1&gbraid=bad%20x&wbraid=OK_2"],
    ["+ se decodifica como espacio", "/?gclid=a+b"],
    ["%2B se decodifica como +", "/?gclid=a%2Bb"],
    ["%25 se decodifica como %", "/?gclid=100%25"],
    ["escape mal formado (%E0%A4%A)", "/?gclid=%E0%A4%A"],
    ["escape inválido (%zz)", "/?gclid=%zz"],
    ["salto de línea codificado (%0A)", "/?gclid=abc%0A"],
    ["letra no ASCII", `/?gclid=${N_TILDE}andu`],
    ["valor de solo espacios (%20): no es vacío", "/?gclid=%20"],
    ["clave codificada (%67clid)", "/?%67clid=bad%20x"],
    ["fragmento de 600 caracteres", `/#gclid=${"G".repeat(600)}`],
    ["query válida y fragmento inválido", "/?gclid=OK#gclid=bad%20x"],
    ["query inválida y fragmento válido", "/?gclid=bad%20x#gclid=OK"],
  ])("true: %s", (_case, url) => {
    setUrl(url);
    expect(hasUnsafeClickIdsInUrl()).toBe(true);
  });

  it.each(GTAG_CLICK_KEYS.flatMap((key) => [`/?${key}=bad%20x`, `/#${key}=bad%20x`]))("true: valor inválido en %s", (url) => {
    setUrl(url);
    expect(hasUnsafeClickIdsInUrl()).toBe(true);
  });

  it.each(GTAG_CLICK_KEYS.flatMap((key) => [`/?${key}=OK_1.2~3-4`, `/#${key}=OK_1.2~3-4`]))("false: valor válido en %s", (url) => {
    setUrl(url);
    expect(hasUnsafeClickIdsInUrl()).toBe(false);
  });

  describe("falla cerrado (true) si la URL no se puede inspeccionar", () => {
    it("sin window", () => {
      vi.stubGlobal("window", undefined);
      let result: boolean;
      try {
        result = hasUnsafeClickIdsInUrl();
      } finally {
        vi.unstubAllGlobals();
      }
      expect(result).toBe(true);
    });

    it("con un window.location que lanza", () => {
      vi.stubGlobal("window", {
        get location(): Location {
          throw new Error("sin location");
        },
      });
      let result: boolean;
      try {
        result = hasUnsafeClickIdsInUrl();
      } finally {
        vi.unstubAllGlobals();
      }
      expect(result).toBe(true);
    });

    it("con un URLSearchParams que lanza", () => {
      setUrl("/?gclid=OK_1");
      vi.stubGlobal(
        "URLSearchParams",
        class {
          constructor() {
            throw new Error("no se puede analizar");
          }
        },
      );
      expect(hasUnsafeClickIdsInUrl()).toBe(true);
    });
  });
});

describe("hasStoredSession", () => {
  it("es true con la clave de sesión de supabase-js (sb-<ref>-auth-token), esté en el lugar que esté", () => {
    localStorage.setItem("a-theme", "dark");
    localStorage.setItem("sb-abc-auth-token", "PRUEBA");
    localStorage.setItem("z-lang", "es");
    expect(hasStoredSession()).toBe(true);
  });

  it.each(["sb-abc-auth-token-code-verifier", "sb-abc-user", "theme", "sb-abc-auth-token-extra", "xsb-abc-auth-token"])(
    "es false con la sola clave %s",
    (key) => {
      localStorage.setItem(key, "PRUEBA");
      expect(hasStoredSession()).toBe(false);
    },
  );

  it("es false con el almacenamiento vacío", () => {
    expect(hasStoredSession()).toBe(false);
  });

  it("es false si localStorage lanza", () => {
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new DOMException("bloqueado", "SecurityError");
    });
    expect(hasStoredSession()).toBe(false);
  });

  it("solo mira los nombres de las claves: nunca lee valores", () => {
    localStorage.setItem("sb-abc-auth-token", "PRUEBA");
    localStorage.setItem("otra", "PRUEBA");
    const getItem = vi.spyOn(Storage.prototype, "getItem");
    expect(hasStoredSession()).toBe(true);
    localStorage.clear();
    localStorage.setItem("theme", "dark");
    expect(hasStoredSession()).toBe(false);
    expect(getItem).not.toHaveBeenCalled();
  });
});

describe("syncAdsTag · sin etiqueta válida no hace nada", () => {
  it.each([
    ["sin variables (vacías)", "", ""],
    ["sin variables (sin definir)", undefined, undefined],
    ["ID vacío", "", SEND_TO],
    ["ID con espacios", "   ", SEND_TO],
    ["ID de Google Analytics (G-)", "G-123456", SEND_TO],
    ["ID demasiado corto", "AW-12345", SEND_TO],
    ["ID demasiado largo", "AW-1234567890123456", SEND_TO],
    ["ID en minúsculas", "aw-1000000000", SEND_TO],
    ["ID con punto y coma", "AW-1000000000;", SEND_TO],
    ["ID con dígitos de ancho completo", `AW-${FULLWIDTH_DIGITS}`, SEND_TO],
  ])("%s: ni script, ni gtag, ni dataLayer, ni mensajes en la consola", async (_case, id, label) => {
    const consoleCalls = watchConsole();
    const analytics = await loadConfigured({ id, label });
    analytics.syncAdsTag("/");
    analytics.syncAdsTag("/paginas-web");
    analytics.trackContactConversion();
    expect(scriptTags()).toHaveLength(0);
    expect(window.gtag).toBeUndefined();
    expect(window.dataLayer).toBeUndefined();
    expect(consoleCalls()).toBe(0);
  });
});

describe("syncAdsTag · carga en rutas permitidas", () => {
  it("en «/» crea exactamente un script async con la URL de gtag.js", async () => {
    const analytics = await loadConfigured();
    analytics.syncAdsTag("/");
    const scripts = scriptTags();
    expect(scripts).toHaveLength(1);
    expect(scripts[0].src).toBe(GTAG_SRC);
    expect(scripts[0].async).toBe(true);
    expect(scripts[0].parentElement).toBe(document.head);
    expect(typeof window.gtag).toBe("function");
  });

  it("el dataLayer lleva, en orden, js, config y event page_view, todos como objetos Arguments", async () => {
    const analytics = await loadConfigured();
    analytics.syncAdsTag("/");
    expect(window.dataLayer).toHaveLength(3);
    for (const entry of window.dataLayer ?? []) {
      expect(Object.prototype.toString.call(entry)).toBe("[object Arguments]");
    }
    const [js, config, view] = layerEntries();
    expect(js[0]).toBe("js");
    expect(js[1]).toBeInstanceOf(Date);
    expect(config[0]).toBe("config");
    expect(config[1]).toBe(TAG_ID);
    expect(view.slice(0, 2)).toEqual(["event", "page_view"]);
  });

  it("el config apaga el page_view automático y la personalización, y lleva page_location y page_referrer saneados", async () => {
    const analytics = await loadConfigured();
    analytics.syncAdsTag("/");
    expect(layerEntries()[1]).toEqual([
      "config",
      TAG_ID,
      {
        send_page_view: false,
        allow_enhanced_conversions: false,
        allow_ad_personalization_signals: false,
        page_location: `${ORIGIN}/`,
        page_referrer: "",
      },
    ]);
    expect(layerEntries()[2]).toEqual(["event", "page_view", { page_location: `${ORIGIN}/`, page_referrer: "" }]);
  });

  it("un ID con espacios alrededor se recorta: el script, el config y la conversión usan los valores limpios", async () => {
    const analytics = await loadConfigured({ id: `  ${TAG_ID}  `, label: `  ${SEND_TO}  ` });
    analytics.syncAdsTag("/");
    analytics.trackContactConversion();
    expect(scriptTags()).toHaveLength(1);
    expect(scriptTags()[0].src).toBe(GTAG_SRC);
    expect(layerEntries()[1][1]).toBe(TAG_ID);
    expect((eventsOf("conversion")[0][2] as { send_to: string }).send_to).toBe(SEND_TO);
  });

  it("con /paginas-web?gclid=PRUEBA&utm_source=x&token=X#contacto solo sale el gclid, en el config y en el page_view", async () => {
    setUrl("/paginas-web?gclid=PRUEBA&utm_source=x&token=X#contacto");
    const analytics = await loadConfigured();
    analytics.syncAdsTag("/paginas-web");
    const expected = `${ORIGIN}/paginas-web?gclid=PRUEBA`;
    expect((layerEntries()[1][2] as { page_location: string }).page_location).toBe(expected);
    expect(pageViews()).toEqual([{ page_location: expected, page_referrer: "" }]);
    const everything = JSON.stringify(layerEntries());
    expect(everything).not.toMatch(/utm_source|token|contacto/);
  });

  it.each(["/", "/paginas-web", "/paginas-web/", "/politica-de-privacidad", "/terminos-del-servicio"])(
    "%s: un script, un config y un page_view con la URL saneada",
    async (path) => {
      setUrl(path);
      const analytics = await loadConfigured();
      analytics.syncAdsTag(path);
      expect(scriptTags()).toHaveLength(1);
      expect(eventsOf("page_view")).toHaveLength(1);
      expect(layerEntries().filter((entry) => entry[0] === "config")).toHaveLength(1);
      expect(pageViews()[0].page_location).toBe(`${ORIGIN}${path}`);
    },
  );

  it("conserva las entradas de un dataLayer que ya existía y añade las suyas detrás", async () => {
    const previous = { event: "otro-evento" };
    window.dataLayer = [previous];
    const analytics = await loadConfigured();
    analytics.syncAdsTag("/");
    expect(window.dataLayer?.[0]).toBe(previous);
    expect(window.dataLayer).toHaveLength(4);
    expect(layerEntries().slice(1).map((entry) => entry[0])).toEqual(["js", "config", "event"]);
  });

  it("dos llamadas seguidas con la misma ruta producen un solo page_view, un solo config y un solo script", async () => {
    const analytics = await loadConfigured();
    analytics.syncAdsTag("/");
    analytics.syncAdsTag("/");
    expect(eventsOf("page_view")).toHaveLength(1);
    expect(layerEntries().filter((entry) => entry[0] === "config")).toHaveLength(1);
    expect(scriptTags()).toHaveLength(1);
  });

  it("cada cambio de ruta permitida añade su page_view sin repetir config ni script", async () => {
    const analytics = await loadConfigured();
    analytics.syncAdsTag("/");
    setUrl("/paginas-web");
    analytics.syncAdsTag("/paginas-web");
    setUrl("/");
    analytics.syncAdsTag("/");
    expect(pageViews().map((view) => view.page_location)).toEqual([`${ORIGIN}/`, `${ORIGIN}/paginas-web`, `${ORIGIN}/`]);
    expect(layerEntries().filter((entry) => entry[0] === "config")).toHaveLength(1);
    expect(scriptTags()).toHaveLength(1);
  });

  it("si el script ya estaba en la página no lo duplica", async () => {
    const existing = document.createElement("script");
    existing.src = GTAG_SRC;
    document.head.appendChild(existing);
    const analytics = await loadConfigured();
    analytics.syncAdsTag("/");
    expect(scriptTags()).toHaveLength(1);
  });

  it("nunca lanza: ruta que no es cadena o gtag que falla", async () => {
    const analytics = await loadConfigured();
    expect(() => analytics.syncAdsTag(undefined as unknown as string)).not.toThrow();
    expect(() => analytics.syncAdsTag(null as unknown as string)).not.toThrow();
    expect(scriptTags()).toHaveLength(0);
    analytics.syncAdsTag("/");
    window.gtag = () => {
      throw new Error("gtag roto");
    };
    setUrl("/paginas-web");
    expect(() => analytics.syncAdsTag("/paginas-web")).not.toThrow();
  });
});

describe("syncAdsTag · rutas no permitidas", () => {
  it.each([
    "/client/SECRET",
    "/client/abc/",
    "/dashboard",
    "/dashboard/tickets",
    "/dashboard/project/1",
    "/solicitudes",
    "/login",
    "/signup",
    "/auth/callback",
    "/auth/reset-password",
    "/auth/update-password",
    "/ruta-inexistente",
  ])("%s: ni script, ni gtag, ni dataLayer", async (path) => {
    const analytics = await loadConfigured();
    setUrl(path);
    analytics.syncAdsTag(path);
    expect(scriptTags()).toHaveLength(0);
    expect(window.gtag).toBeUndefined();
    expect(window.dataLayer).toBeUndefined();
  });

  it("después de cargar en «/», cualquier ruta no permitida deja el dataLayer y el DOM como estaban", async () => {
    const analytics = await loadConfigured();
    analytics.syncAdsTag("/");
    const before = layerEntries().length;
    for (const path of ["/client/SECRET", "/dashboard", "/solicitudes", "/login", "/signup", "/auth/callback", "/ruta-inexistente"]) {
      setUrl(`${path}?gclid=ZZZ#access_token=SECRET`);
      analytics.syncAdsTag(path);
    }
    expect(layerEntries()).toHaveLength(before);
    expect(scriptTags()).toHaveLength(1);
    expect(JSON.stringify(layerEntries())).not.toMatch(/SECRET|ZZZ|client|dashboard|login/);
  });
});

describe("syncAdsTag · page_referrer", () => {
  it("primera visita: un referrer externo se reduce a su origen, en el config y en el page_view", async () => {
    setReferrer(GOOGLE_REFERRER);
    const analytics = await loadConfigured();
    analytics.syncAdsTag("/");
    expect((layerEntries()[1][2] as { page_referrer: string }).page_referrer).toBe("https://www.google.com/");
    expect(pageViews()).toEqual([{ page_location: `${ORIGIN}/`, page_referrer: "https://www.google.com/" }]);
  });

  it("primera visita: un referrer propio con /client/TOKEN sale vacío", async () => {
    setReferrer(`${ORIGIN}/client/TOKEN`);
    const analytics = await loadConfigured();
    analytics.syncAdsTag("/");
    expect(pageViews()).toEqual([{ page_location: `${ORIGIN}/`, page_referrer: "" }]);
    expect(JSON.stringify(layerEntries())).not.toContain("TOKEN");
  });

  it("segunda visita permitida: page_referrer es la page_location saneada de la anterior", async () => {
    setReferrer(GOOGLE_REFERRER);
    setUrl("/?gclid=PRUEBA&token=X#h");
    const analytics = await loadConfigured();
    analytics.syncAdsTag("/");
    setUrl("/paginas-web");
    analytics.syncAdsTag("/paginas-web");
    expect(pageViews()).toEqual([
      { page_location: `${ORIGIN}/?gclid=PRUEBA`, page_referrer: "https://www.google.com/" },
      { page_location: `${ORIGIN}/paginas-web`, page_referrer: `${ORIGIN}/?gclid=PRUEBA` },
    ]);
  });

  it("tras una visita a una ruta no permitida el page_referrer es vacío, no el referrer de entrada", async () => {
    setReferrer(GOOGLE_REFERRER);
    const analytics = await loadConfigured();
    analytics.syncAdsTag("/");
    setUrl("/login");
    analytics.syncAdsTag("/login");
    setUrl("/paginas-web");
    analytics.syncAdsTag("/paginas-web");
    expect(pageViews()[1]).toEqual({ page_location: `${ORIGIN}/paginas-web`, page_referrer: "" });
  });

  it("una ruta no permitida como PRIMERA visita, seguida de «/», sale con page_referrer vacío", async () => {
    setReferrer(GOOGLE_REFERRER);
    setUrl("/login");
    const analytics = await loadConfigured();
    analytics.syncAdsTag("/login");
    expect(scriptTags()).toHaveLength(0);
    setUrl("/");
    analytics.syncAdsTag("/");
    expect(pageViews()).toEqual([{ page_location: `${ORIGIN}/`, page_referrer: "" }]);
    expect((layerEntries()[1][2] as { page_referrer: string }).page_referrer).toBe("");
  });

  it("volver a la misma ruta tras salir de las permitidas cuenta como una visita nueva", async () => {
    const analytics = await loadConfigured();
    analytics.syncAdsTag("/");
    setUrl("/dashboard");
    analytics.syncAdsTag("/dashboard");
    setUrl("/");
    analytics.syncAdsTag("/");
    expect(pageViews()).toEqual([
      { page_location: `${ORIGIN}/`, page_referrer: "" },
      { page_location: `${ORIGIN}/`, page_referrer: "" },
    ]);
  });
});

describe("syncAdsTag · guardas (credenciales de auth, sesión guardada, navegador fuera de la lista blanca)", () => {
  it.each(["?code=x", "#access_token=x&type=recovery", "#error=x"])(
    "arranque en frío en «/» con %s: ni script ni eventos",
    async (suffix) => {
      setUrl(`/${suffix}`);
      const analytics = await loadConfigured();
      analytics.syncAdsTag("/");
      expect(scriptTags()).toHaveLength(0);
      expect(window.gtag).toBeUndefined();
      expect(window.dataLayer).toBeUndefined();
    },
  );

  it.each(["?code=x", "#access_token=x&type=recovery", "#error=x"])(
    "con la etiqueta ya cargada, llegar a una ruta permitida con %s no añade eventos",
    async (suffix) => {
      const analytics = await loadConfigured();
      analytics.syncAdsTag("/");
      const before = layerEntries().length;
      setUrl(`/paginas-web${suffix}`);
      analytics.syncAdsTag("/paginas-web");
      analytics.trackContactConversion();
      expect(layerEntries()).toHaveLength(before);
      expect(scriptTags()).toHaveLength(1);
    },
  );

  it("al quedar sin credenciales la medición se reanuda, con page_referrer vacío", async () => {
    const analytics = await loadConfigured();
    analytics.syncAdsTag("/");
    setUrl("/paginas-web?code=x");
    analytics.syncAdsTag("/paginas-web");
    setUrl("/paginas-web");
    analytics.syncAdsTag("/paginas-web");
    expect(pageViews()).toEqual([
      { page_location: `${ORIGIN}/`, page_referrer: "" },
      { page_location: `${ORIGIN}/paginas-web`, page_referrer: "" },
    ]);
  });

  it("con una sesión de Supabase guardada (sb-abc-auth-token) no se carga la etiqueta", async () => {
    localStorage.setItem("sb-abc-auth-token", "PRUEBA");
    const analytics = await loadConfigured();
    analytics.syncAdsTag("/");
    expect(scriptTags()).toHaveLength(0);
    expect(window.gtag).toBeUndefined();
    expect(window.dataLayer).toBeUndefined();
  });

  it("si la sesión aparece con la etiqueta ya cargada, no se envían más eventos", async () => {
    const analytics = await loadConfigured();
    analytics.syncAdsTag("/");
    const before = layerEntries().length;
    localStorage.setItem("sb-abc-auth-token", "PRUEBA");
    setUrl("/paginas-web");
    analytics.syncAdsTag("/paginas-web");
    analytics.trackContactConversion();
    expect(layerEntries()).toHaveLength(before);
  });

  it("al quitarse la sesión guardada la medición se reanuda: misma ruta, visita nueva con page_referrer vacío", async () => {
    setReferrer(GOOGLE_REFERRER);
    setUrl("/paginas-web");
    const analytics = await loadConfigured();
    analytics.syncAdsTag("/paginas-web");
    localStorage.setItem("sb-abc-auth-token", "PRUEBA");
    analytics.syncAdsTag("/paginas-web");
    localStorage.clear();
    analytics.syncAdsTag("/paginas-web");
    expect(pageViews()).toEqual([
      { page_location: `${ORIGIN}/paginas-web`, page_referrer: "https://www.google.com/" },
      { page_location: `${ORIGIN}/paginas-web`, page_referrer: "" },
    ]);
  });

  it("otras claves de Supabase (code-verifier) no cuentan como sesión", async () => {
    localStorage.setItem("sb-abc-auth-token-code-verifier", "PRUEBA");
    const analytics = await loadConfigured();
    analytics.syncAdsTag("/");
    expect(scriptTags()).toHaveLength(1);
  });

  it("si localStorage lanza, carga con normalidad", async () => {
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new DOMException("bloqueado", "SecurityError");
    });
    const analytics = await loadConfigured();
    analytics.syncAdsTag("/");
    expect(scriptTags()).toHaveLength(1);
    expect(pageViews()).toEqual([{ page_location: `${ORIGIN}/`, page_referrer: "" }]);
  });

  it("nunca lee valores de localStorage", async () => {
    localStorage.setItem("sb-abc-auth-token", "PRUEBA");
    const getItem = vi.spyOn(Storage.prototype, "getItem");
    const analytics = await loadConfigured();
    analytics.syncAdsTag("/");
    analytics.trackContactConversion();
    expect(getItem).not.toHaveBeenCalled();
  });

  it("si la URL no se puede inspeccionar falla cerrado: no se carga nada", async () => {
    vi.stubGlobal(
      "URLSearchParams",
      class {
        constructor() {
          throw new Error("no se puede inspeccionar");
        }
      },
    );
    const analytics = await loadConfigured();
    analytics.syncAdsTag("/");
    expect(scriptTags()).toHaveLength(0);
    expect(window.dataLayer).toBeUndefined();
  });

  it("ruta del router permitida pero navegador en una ruta no permitida (pushState sin avisar): sin eventos", async () => {
    const analytics = await loadConfigured();
    setUrl("/client/SECRET");
    analytics.syncAdsTag("/");
    expect(scriptTags()).toHaveLength(0);
    expect(window.gtag).toBeUndefined();
    expect(window.dataLayer).toBeUndefined();
  });

  it("lo mismo con la etiqueta ya cargada: un cierre viejo del router no genera eventos", async () => {
    const analytics = await loadConfigured();
    analytics.syncAdsTag("/");
    const before = layerEntries().length;
    setUrl("/client/SECRET");
    analytics.syncAdsTag("/");
    analytics.syncAdsTag("/paginas-web");
    expect(layerEntries()).toHaveLength(before);
    expect(JSON.stringify(layerEntries())).not.toMatch(/SECRET|client/);
  });

  it("un desvío sin avisar al router cuenta como salida: al volver hay un page_view nuevo con page_referrer vacío", async () => {
    setReferrer(GOOGLE_REFERRER);
    const analytics = await loadConfigured();
    analytics.syncAdsTag("/");
    setUrl("/client/SECRET");
    analytics.syncAdsTag("/");
    setUrl("/");
    analytics.syncAdsTag("/");
    expect(pageViews()).toEqual([
      { page_location: `${ORIGIN}/`, page_referrer: "https://www.google.com/" },
      { page_location: `${ORIGIN}/`, page_referrer: "" },
    ]);
  });

  it("el primer cierre del router llega con el navegador ya fuera de la lista blanca: la entrada externa no se reutiliza después", async () => {
    setReferrer(GOOGLE_REFERRER);
    setUrl("/client/SECRET");
    const analytics = await loadConfigured();
    analytics.syncAdsTag("/");
    setUrl("/paginas-web");
    analytics.syncAdsTag("/paginas-web");
    expect(pageViews()).toEqual([{ page_location: `${ORIGIN}/paginas-web`, page_referrer: "" }]);
  });
});

describe("syncAdsTag y trackContactConversion · click-ids con forma no válida en la URL", () => {
  /** [descripción, ruta del router, URL del navegador] */
  const DIRTY_URLS: Array<[string, string, string]> = [
    ["gclid con @ y espacio", "/paginas-web", `/paginas-web?gclid=${DIRTY_CLICK_ID}`],
    ["gclid de 600 caracteres", "/paginas-web", `/paginas-web?gclid=${"G".repeat(600)}`],
    ["gclid de 513 caracteres", "/", `/?gclid=${"a".repeat(513)}`],
    ["gad_source inválido", "/paginas-web/", "/paginas-web/?gad_source=a%20b"],
    ["gad_campaignid inválido", "/politica-de-privacidad", "/politica-de-privacidad?gad_campaignid=1/2"],
    ["wbraid inválido", "/terminos-del-servicio", "/terminos-del-servicio?wbraid=bad%40x"],
    ["click-id inválido en el fragmento", "/paginas-web", "/paginas-web#gclid=bad%20x"],
    ["clave codificada (%67clid)", "/", "/?%67clid=bad%20x"],
    ["clave repetida con la segunda inválida", "/paginas-web", "/paginas-web?gclid=OK_1&gclid=bad%20value"],
  ];

  it.each(DIRTY_URLS)(
    "arranque en frío (%s): ni script, ni gtag, ni dataLayer, ni conversión, ni consola",
    async (_case, route, url) => {
      setReferrer(GOOGLE_REFERRER);
      setUrl(url);
      const consoleCalls = watchConsole();
      const analytics = await loadConfigured();
      analytics.syncAdsTag(route);
      analytics.trackContactConversion();
      expect(scriptTags()).toHaveLength(0);
      expect(window.gtag).toBeUndefined();
      expect(window.dataLayer).toBeUndefined();
      expect(consoleCalls()).toBe(0);
    },
  );

  it.each(DIRTY_URLS)(
    "con la etiqueta ya cargada (%s): sin eventos nuevos, sin conversión y sin consola",
    async (_case, route, url) => {
      const analytics = await loadConfigured();
      analytics.syncAdsTag("/");
      const before = layerEntries().length;
      const consoleCalls = watchConsole();
      setUrl(url);
      analytics.syncAdsTag(route);
      analytics.trackContactConversion();
      expect(layerEntries()).toHaveLength(before);
      expect(eventsOf("conversion")).toHaveLength(0);
      expect(scriptTags()).toHaveLength(1);
      expect(consoleCalls()).toBe(0);
    },
  );

  it("el valor dudoso no aparece en ninguna entrada del dataLayer", async () => {
    setReferrer(GOOGLE_REFERRER);
    const analytics = await loadConfigured();
    analytics.syncAdsTag("/");
    setUrl(`/paginas-web?gclid=${DIRTY_CLICK_ID}`);
    analytics.syncAdsTag("/paginas-web");
    analytics.trackContactConversion();
    expect(JSON.stringify(layerEntries())).not.toMatch(/example\.com|SUCIO|gclid/);
  });

  it("al volver a una URL limpia se retoma: page_view con page_referrer vacío (misma ruta) y la conversión vuelve a disparar", async () => {
    setReferrer(GOOGLE_REFERRER);
    setUrl("/paginas-web?gclid=OK_1");
    const analytics = await loadConfigured();
    analytics.syncAdsTag("/paginas-web");
    setUrl(`/paginas-web?gclid=${DIRTY_CLICK_ID}`);
    analytics.syncAdsTag("/paginas-web");
    analytics.trackContactConversion();
    expect(eventsOf("conversion")).toHaveLength(0);
    expect(pageViews()).toHaveLength(1);

    setUrl("/paginas-web?gclid=OK_2");
    analytics.syncAdsTag("/paginas-web");
    analytics.trackContactConversion();
    expect(pageViews()).toEqual([
      { page_location: `${ORIGIN}/paginas-web?gclid=OK_1`, page_referrer: "https://www.google.com/" },
      { page_location: `${ORIGIN}/paginas-web?gclid=OK_2`, page_referrer: "" },
    ]);
    expect(eventsOf("conversion")).toEqual([
      ["event", "conversion", { send_to: SEND_TO, page_location: `${ORIGIN}/paginas-web?gclid=OK_2`, page_referrer: "" }],
    ]);
    expect(scriptTags()).toHaveLength(1);
  });

  it("si la primera visita queda bloqueada, la siguiente limpia sale con page_referrer vacío aunque haya referrer externo", async () => {
    setReferrer(GOOGLE_REFERRER);
    setUrl(`/paginas-web?gclid=${DIRTY_CLICK_ID}`);
    const analytics = await loadConfigured();
    analytics.syncAdsTag("/paginas-web");
    expect(scriptTags()).toHaveLength(0);
    setUrl("/");
    analytics.syncAdsTag("/");
    expect(pageViews()).toEqual([{ page_location: `${ORIGIN}/`, page_referrer: "" }]);
    expect((layerEntries()[1][2] as { page_referrer: string }).page_referrer).toBe("");
  });

  it("gclid válido típico (90 caracteres): carga normal, page_location lo conserva y la conversión dispara", async () => {
    setReferrer(GOOGLE_REFERRER);
    setUrl(`/paginas-web/?gclid=${TYPICAL_CLICK_ID}`);
    const consoleCalls = watchConsole();
    const analytics = await loadConfigured();
    analytics.syncAdsTag("/paginas-web/");
    analytics.trackContactConversion();
    const location = `${ORIGIN}/paginas-web/?gclid=${TYPICAL_CLICK_ID}`;
    expect(scriptTags()).toHaveLength(1);
    expect((layerEntries()[1][2] as { page_location: string }).page_location).toBe(location);
    expect(pageViews()).toEqual([{ page_location: location, page_referrer: "https://www.google.com/" }]);
    expect(eventsOf("conversion")).toEqual([
      ["event", "conversion", { send_to: SEND_TO, page_location: location, page_referrer: "https://www.google.com/" }],
    ]);
    expect(consoleCalls()).toBe(0);
  });

  it.each([511, 512])("gclid de %i caracteres: carga normal y la app lo conserva", async (length) => {
    const gclid = "a".repeat(length);
    setUrl(`/?gclid=${gclid}`);
    const analytics = await loadConfigured();
    analytics.syncAdsTag("/");
    expect(scriptTags()).toHaveLength(1);
    expect(pageViews()).toEqual([{ page_location: `${ORIGIN}/?gclid=${gclid}`, page_referrer: "" }]);
  });

  it("los valores vacíos no bloquean: la etiqueta carga y page_location sale sin query", async () => {
    setUrl("/paginas-web/?gclid=&gbraid");
    const analytics = await loadConfigured();
    analytics.syncAdsTag("/paginas-web/");
    expect(scriptTags()).toHaveLength(1);
    expect(pageViews()).toEqual([{ page_location: `${ORIGIN}/paginas-web/`, page_referrer: "" }]);
  });

  it("otra capitalización (GCLID=…) no bloquea: gtag no la lee y la app tampoco la envía", async () => {
    setUrl(`/paginas-web?GCLID=${DIRTY_CLICK_ID}`);
    const analytics = await loadConfigured();
    analytics.syncAdsTag("/paginas-web");
    expect(scriptTags()).toHaveLength(1);
    expect(pageViews()).toEqual([{ page_location: `${ORIGIN}/paginas-web`, page_referrer: "" }]);
    expect(JSON.stringify(layerEntries())).not.toMatch(/example\.com|SUCIO/);
  });

  it("otros parámetros con valores raros (utm, correo) no bloquean la etiqueta", async () => {
    setUrl("/?utm_source=a%20b&email=a@b.co");
    const analytics = await loadConfigured();
    analytics.syncAdsTag("/");
    expect(scriptTags()).toHaveLength(1);
    expect(pageViews()).toEqual([{ page_location: `${ORIGIN}/`, page_referrer: "" }]);
  });

  it("trackContactConversion sola (gtag presente): no dispara con un gad_campaignid inválido y sí con uno válido", async () => {
    setUrl("/paginas-web/?gad_campaignid=1/2");
    const analytics = await loadConfigured();
    const calls: unknown[][] = [];
    window.gtag = (...args: unknown[]) => {
      calls.push(args);
    };
    analytics.trackContactConversion();
    expect(calls).toHaveLength(0);
    setUrl("/paginas-web/?gad_campaignid=12");
    analytics.trackContactConversion();
    expect(calls.map((call) => call[1])).toEqual(["conversion"]);
  });
});

describe("trackContactConversion", () => {
  it("tras syncAdsTag('/') envía un evento conversion con exactamente send_to, page_location y page_referrer", async () => {
    const analytics = await loadConfigured();
    analytics.syncAdsTag("/");
    const before = layerEntries().length;
    analytics.trackContactConversion();
    expect(layerEntries()).toHaveLength(before + 1);
    expect(Object.prototype.toString.call(window.dataLayer?.[before])).toBe("[object Arguments]");
    const conversions = eventsOf("conversion");
    expect(conversions).toHaveLength(1);
    const params = conversions[0][2] as Record<string, unknown>;
    expect(Object.keys(params).sort()).toEqual(["page_location", "page_referrer", "send_to"]);
    expect(params).toEqual({ send_to: SEND_TO, page_location: `${ORIGIN}/`, page_referrer: "" });
  });

  it("la page_location va saneada y el page_referrer es el del page_view de la visita actual", async () => {
    setReferrer(GOOGLE_REFERRER);
    const analytics = await loadConfigured();
    analytics.syncAdsTag("/");
    setUrl("/paginas-web?gclid=PRUEBA&token=X#contacto");
    analytics.syncAdsTag("/paginas-web");
    analytics.trackContactConversion();
    expect(eventsOf("conversion")[0][2]).toEqual({
      send_to: SEND_TO,
      page_location: `${ORIGIN}/paginas-web?gclid=PRUEBA`,
      page_referrer: `${ORIGIN}/`,
    });
  });

  it("reutiliza el page_referrer del page_view: no lo recalcula aunque document.referrer cambie", async () => {
    setReferrer(GOOGLE_REFERRER);
    const analytics = await loadConfigured();
    analytics.syncAdsTag("/");
    setReferrer("https://otro.example.test/ruta?q=1");
    analytics.trackContactConversion();
    const params = eventsOf("conversion")[0][2] as { page_referrer: string };
    expect(params.page_referrer).toBe("https://www.google.com/");
    expect(params.page_referrer).toBe(pageViews()[0].page_referrer);
  });

  it("con page_referrer vacío lo envía igualmente (la clave está presente)", async () => {
    setReferrer(`${ORIGIN}/client/TOKEN`);
    const analytics = await loadConfigured();
    analytics.syncAdsTag("/");
    setReferrer("https://www.google.com/");
    analytics.trackContactConversion();
    const params = eventsOf("conversion")[0][2] as Record<string, unknown>;
    expect(params).toHaveProperty("page_referrer", "");
  });

  it("sin gtag inicializado no hace nada", async () => {
    const analytics = await loadConfigured();
    analytics.trackContactConversion();
    expect(window.gtag).toBeUndefined();
    expect(window.dataLayer).toBeUndefined();
    expect(scriptTags()).toHaveLength(0);
  });

  it.each(["/client/SECRET", "/dashboard", "/solicitudes", "/login", "/signup", "/auth/callback", "/ruta-inexistente"])(
    "en %s (ruta no permitida) no envía nada",
    async (path) => {
      const analytics = await loadConfigured();
      analytics.syncAdsTag("/");
      const before = layerEntries().length;
      setUrl(path);
      analytics.trackContactConversion();
      expect(layerEntries()).toHaveLength(before);
    },
  );

  it.each([
    ["de otra cuenta", "AW-2000000000/PRUEBA"],
    ["vacía", ""],
    ["mal formada", "AW-1000000000/ab"],
    ["sin definir", undefined],
  ])("con una etiqueta de conversión %s la etiqueta carga pero la conversión no se envía", async (_case, label) => {
    const analytics = await loadConfigured({ id: TAG_ID, label });
    analytics.syncAdsTag("/");
    analytics.trackContactConversion();
    expect(eventsOf("page_view")).toHaveLength(1);
    expect(eventsOf("conversion")).toHaveLength(0);
  });

  it("si la etiqueta de conversión cambia a otra cuenta después de cargar, tampoco se envía", async () => {
    const analytics = await loadConfigured();
    analytics.syncAdsTag("/");
    vi.stubEnv("VITE_GADS_CONTACT_LABEL", "AW-2000000000/PRUEBA");
    analytics.trackContactConversion();
    expect(eventsOf("conversion")).toHaveLength(0);
  });

  it("si gtag lanza, trackContactConversion no lanza", async () => {
    const analytics = await loadConfigured();
    analytics.syncAdsTag("/");
    window.gtag = () => {
      throw new Error("gtag roto");
    };
    expect(() => analytics.trackContactConversion()).not.toThrow();
  });

  it("si el dataLayer no tiene push, trackContactConversion no lanza", async () => {
    const analytics = await loadConfigured();
    analytics.syncAdsTag("/");
    window.dataLayer = {} as unknown as unknown[];
    expect(() => analytics.trackContactConversion()).not.toThrow();
  });

  it("si gtag desaparece o deja de ser una función, no envía ni lanza", async () => {
    const analytics = await loadConfigured();
    analytics.syncAdsTag("/");
    const before = layerEntries().length;
    window.gtag = {} as unknown as typeof window.gtag;
    expect(() => analytics.trackContactConversion()).not.toThrow();
    Reflect.deleteProperty(window, "gtag");
    expect(() => analytics.trackContactConversion()).not.toThrow();
    expect(layerEntries()).toHaveLength(before);
  });
});
