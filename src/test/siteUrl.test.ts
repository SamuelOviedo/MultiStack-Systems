import { describe, it, expect, afterEach, vi } from "vitest";
import { getSiteOrigin, getAuthEmailRedirectUrl } from "@/lib/siteUrl";

/** Temporarily replaces window.location (jsdom) without `any`. */
function withLocation<T>(location: { hostname: string; origin: string }, run: () => T): T {
  const original = window.location;
  Reflect.deleteProperty(window, "location");
  Reflect.set(window, "location", location);
  try {
    return run();
  } finally {
    Reflect.set(window, "location", original);
  }
}

describe("getSiteOrigin — with VITE_SITE_URL set", () => {
  it("returns a non-empty string", () => {
    expect(getSiteOrigin()).toBeTypeOf("string");
    expect(getSiteOrigin().length).toBeGreaterThan(0);
  });

  it("does not end with a slash", () => {
    expect(getSiteOrigin().endsWith("/")).toBe(false);
  });

  it("strips trailing slash from env var (deployed host)", () => {
    vi.stubEnv("VITE_SITE_URL", "https://multistacksystems.com/");
    const result = withLocation({ hostname: "multistacksystems.com", origin: "https://multistacksystems.com" }, getSiteOrigin);
    vi.unstubAllEnvs();
    expect(result).toBe("https://multistacksystems.com");
  });

  it("on localhost the local origin wins over VITE_SITE_URL (OAuth must return to the origin that stores the session)", () => {
    vi.stubEnv("VITE_SITE_URL", "https://multistacksystems.com");
    const result = withLocation({ hostname: "localhost", origin: "http://localhost:8080" }, getSiteOrigin);
    vi.unstubAllEnvs();
    expect(result).toBe("http://localhost:8080");
  });
});

describe("getSiteOrigin — without VITE_SITE_URL (fallback logic)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each(["", "   "])("returns the www production origin when host is not localhost (VITE_SITE_URL %j)", (value) => {
    vi.stubEnv("VITE_SITE_URL", value);
    const result = withLocation({ hostname: "myapp.vercel.app", origin: "https://myapp.vercel.app" }, getSiteOrigin);
    expect(result).toBe("https://www.multistacksystems.com");
  });

  it("returns localhost origin when host is localhost", () => {
    vi.stubEnv("VITE_SITE_URL", "");
    const result = withLocation({ hostname: "localhost", origin: "http://localhost:5173" }, getSiteOrigin);
    expect(result).toBe("http://localhost:5173");
  });
});

describe("getAuthEmailRedirectUrl", () => {
  it("ends with /solicitudes", () => {
    expect(getAuthEmailRedirectUrl().endsWith("/solicitudes")).toBe(true);
  });

  it("is an absolute URL or valid path", () => {
    expect(getAuthEmailRedirectUrl()).toMatch(/\/solicitudes$/);
  });

  it("without VITE_SITE_URL, outside localhost, uses the www fallback with a single slash", () => {
    vi.stubEnv("VITE_SITE_URL", "");
    const result = withLocation({ hostname: "myapp.vercel.app", origin: "https://myapp.vercel.app" }, getAuthEmailRedirectUrl);
    vi.unstubAllEnvs();
    expect(result).toBe("https://www.multistacksystems.com/solicitudes");
  });
});

describe("getAuthEmailRedirectUrl — paquete solicitado (lista blanca, sin redirecciones abiertas)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const SITE = "https://www.multistacksystems.com";

  /** Fuera de localhost y con VITE_SITE_URL vacío: el origen es el de producción con www. */
  const inProduction = (packageId?: string) => {
    vi.stubEnv("VITE_SITE_URL", "");
    return withLocation({ hostname: "myapp.vercel.app", origin: "https://myapp.vercel.app" }, () =>
      getAuthEmailRedirectUrl(packageId),
    );
  };

  it.each(["combo-emprendedor", "estandar"])("con el id %s vuelve a /solicitudes?paquete=<id>", (id) => {
    expect(inProduction(id)).toBe(`${SITE}/solicitudes?paquete=${id}`);
  });

  it("sin id vuelve a /solicitudes, como siempre", () => {
    expect(inProduction()).toBe(`${SITE}/solicitudes`);
    expect(inProduction(undefined)).toBe(`${SITE}/solicitudes`);
  });

  it.each([
    "../x",
    "combo-emprendedor&next=//evil",
    "",
    "combo-emprendedor ",
    "COMBO-EMPRENDEDOR",
    "combo-emprendedor#access_token=x",
    "https://evil.example/solicitudes",
    "//evil.example",
    "otro-paquete",
  ])("un id fuera de la lista blanca (%j) se ignora: ni ruta, ni parámetros, ni host nuevos", (id) => {
    expect(inProduction(id)).toBe(`${SITE}/solicitudes`);
  });

  it("un valor que no es texto (llamada sin tipos) también se ignora", () => {
    for (const value of [null, 42, {}, ["combo-emprendedor"]]) {
      expect(inProduction(value as unknown as string)).toBe(`${SITE}/solicitudes`);
    }
  });

  it("el destino solo tiene el origen del sitio, la ruta /solicitudes y, como mucho, el parámetro paquete", () => {
    for (const id of ["combo-emprendedor", "../x", "combo-emprendedor&next=//evil", undefined]) {
      const url = new URL(inProduction(id));
      expect(url.origin).toBe(SITE);
      expect(url.pathname).toBe("/solicitudes");
      expect(url.hash).toBe("");
      expect([...url.searchParams.keys()].filter((key) => key !== "paquete")).toEqual([]);
    }
  });

  it("en localhost usa el origen local, con o sin paquete", () => {
    const local = { hostname: "localhost", origin: "http://localhost:8080" };
    expect(withLocation(local, () => getAuthEmailRedirectUrl("combo-emprendedor"))).toBe(
      "http://localhost:8080/solicitudes?paquete=combo-emprendedor",
    );
    expect(withLocation(local, () => getAuthEmailRedirectUrl())).toBe("http://localhost:8080/solicitudes");
  });
});
