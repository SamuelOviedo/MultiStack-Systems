import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PACKAGE_INTENT_KEY,
  PACKAGE_INTENT_TTL_MS,
  clearPackageIntent,
  isPackageId,
  packageRequestPath,
  readPackageIntent,
  rememberPackageIntent,
} from "@/lib/packageIntent";
import { PACKAGES } from "@/lib/webPackages";

const NOW = 1_800_000_000_000;
const stored = (): unknown => JSON.parse(window.localStorage.getItem(PACKAGE_INTENT_KEY) ?? "null");
const put = (value: unknown): void => window.localStorage.setItem(PACKAGE_INTENT_KEY, JSON.stringify(value));

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("packageIntent · constantes y lista blanca", () => {
  it("la clave es ms.paquete-solicitado y la caducidad son 24 horas", () => {
    expect(PACKAGE_INTENT_KEY).toBe("ms.paquete-solicitado");
    expect(PACKAGE_INTENT_TTL_MS).toBe(24 * 60 * 60 * 1000);
  });

  it("la lista blanca son exactamente los ids de PACKAGES", () => {
    expect(PACKAGES.map((pkg) => pkg.id)).toEqual(["estandar", "combo-emprendedor"]);
    for (const pkg of PACKAGES) expect(isPackageId(pkg.id), pkg.id).toBe(true);
  });

  it.each(["", " ", "admin", "ESTANDAR", "estandar ", "combo", "__proto__", "constructor", "toString", "../estandar"])(
    "«%s» no es un id de paquete",
    (value) => {
      expect(isPackageId(value)).toBe(false);
    },
  );

  it.each([null, undefined, 0, 1, true, {}, [], ["estandar"]])("%j tampoco (no es una cadena)", (value) => {
    expect(isPackageId(value)).toBe(false);
  });

  it("packageRequestPath arma /solicitudes?paquete=<id>", () => {
    expect(packageRequestPath("combo-emprendedor")).toBe("/solicitudes?paquete=combo-emprendedor");
    expect(packageRequestPath("estandar")).toBe("/solicitudes?paquete=estandar");
  });
});

describe("packageIntent · guardar y leer", () => {
  it("guarda solo { id, exp } con la caducidad a 24 horas, y nada más en el almacenamiento", () => {
    rememberPackageIntent("combo-emprendedor", NOW);

    expect(stored()).toEqual({ id: "combo-emprendedor", exp: NOW + PACKAGE_INTENT_TTL_MS });
    expect(Object.keys(stored() as object).sort()).toEqual(["exp", "id"]);
    expect(window.localStorage).toHaveLength(1);
    expect(window.localStorage.key(0)).toBe(PACKAGE_INTENT_KEY);
  });

  it("sin la hora explícita usa Date.now", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    try {
      rememberPackageIntent("estandar");
      expect(stored()).toEqual({ id: "estandar", exp: NOW + PACKAGE_INTENT_TTL_MS });
      expect(readPackageIntent()).toBe("estandar");
    } finally {
      vi.useRealTimers();
    }
  });

  it.each(PACKAGES.map((pkg) => pkg.id))("lo guardado (%s) se lee sin URL", (id) => {
    rememberPackageIntent(id, NOW);

    expect(readPackageIntent(undefined, NOW + 1000)).toBe(id);
    expect(readPackageIntent("", NOW + 1000)).toBe(id);
    expect(readPackageIntent("?otro=1", NOW + 1000)).toBe(id);
  });

  it("sin nada en la URL ni guardado devuelve null", () => {
    expect(readPackageIntent()).toBeNull();
    expect(readPackageIntent("?paquete=")).toBeNull();
  });

  it("un id fuera de la lista blanca no se guarda", () => {
    rememberPackageIntent("admin", NOW);
    rememberPackageIntent("", NOW);

    expect(window.localStorage.getItem(PACKAGE_INTENT_KEY)).toBeNull();
  });

  it("un segundo clic reemplaza la intención anterior", () => {
    rememberPackageIntent("estandar", NOW);
    rememberPackageIntent("combo-emprendedor", NOW + 5);

    expect(readPackageIntent(undefined, NOW + 10)).toBe("combo-emprendedor");
  });

  it("clearPackageIntent borra la intención y no falla si no hay nada", () => {
    rememberPackageIntent("estandar", NOW);
    clearPackageIntent();
    expect(window.localStorage.getItem(PACKAGE_INTENT_KEY)).toBeNull();
    expect(readPackageIntent(undefined, NOW)).toBeNull();

    expect(() => clearPackageIntent()).not.toThrow();
  });
});

describe("packageIntent · prioridad de la URL", () => {
  it("?paquete=<id> gana sobre lo guardado, con o sin el «?» inicial", () => {
    rememberPackageIntent("estandar", NOW);

    expect(readPackageIntent("?paquete=combo-emprendedor", NOW + 1)).toBe("combo-emprendedor");
    expect(readPackageIntent("paquete=combo-emprendedor", NOW + 1)).toBe("combo-emprendedor");
    expect(readPackageIntent("?x=1&paquete=combo-emprendedor&y=2", NOW + 1)).toBe("combo-emprendedor");
  });

  it("la URL funciona aunque no haya nada guardado, y leerla no escribe nada", () => {
    expect(readPackageIntent("?paquete=estandar")).toBe("estandar");
    expect(window.localStorage.getItem(PACKAGE_INTENT_KEY)).toBeNull();
  });

  it("la URL vale aunque lo guardado haya caducado, y no borra lo guardado", () => {
    put({ id: "estandar", exp: NOW - 1 });

    expect(readPackageIntent("?paquete=combo-emprendedor", NOW)).toBe("combo-emprendedor");
    expect(window.localStorage.getItem(PACKAGE_INTENT_KEY)).not.toBeNull();
  });

  it.each(["?paquete=admin", "?paquete=", "?paquete=ESTANDAR", "?paquete=estandar%20", "?paquete=%3Cscript%3E", "?paquete[]=estandar"])(
    "%s se ignora y cae a lo guardado",
    (search) => {
      rememberPackageIntent("combo-emprendedor", NOW);

      expect(readPackageIntent(search, NOW + 1)).toBe("combo-emprendedor");
    },
  );

  it("con un valor inválido en la URL y nada guardado devuelve null", () => {
    expect(readPackageIntent("?paquete=admin")).toBeNull();
  });

  it("con el parámetro repetido manda el primero", () => {
    expect(readPackageIntent("?paquete=estandar&paquete=combo-emprendedor")).toBe("estandar");
    expect(readPackageIntent("?paquete=admin&paquete=estandar")).toBeNull();
  });
});

describe("packageIntent · caducidad y datos inválidos", () => {
  it("vale hasta un instante antes de las 24 horas y caduca a las 24 horas exactas", () => {
    rememberPackageIntent("estandar", NOW);

    expect(readPackageIntent(undefined, NOW + PACKAGE_INTENT_TTL_MS - 1)).toBe("estandar");
    expect(window.localStorage.getItem(PACKAGE_INTENT_KEY)).not.toBeNull();

    expect(readPackageIntent(undefined, NOW + PACKAGE_INTENT_TTL_MS)).toBeNull();
    expect(window.localStorage.getItem(PACKAGE_INTENT_KEY)).toBeNull();
  });

  it("lo caducado se borra al leerlo (no queda basura en el almacenamiento)", () => {
    put({ id: "estandar", exp: NOW - 60_000 });

    expect(readPackageIntent(undefined, NOW)).toBeNull();
    expect(window.localStorage.getItem(PACKAGE_INTENT_KEY)).toBeNull();
  });

  it.each([
    ["JSON roto", "{no es json"],
    ["texto suelto", "estandar"],
    ["null", "null"],
    ["un número", "42"],
    ["un arreglo", '["estandar"]'],
  ])("%s se descarta y se borra", (_label, raw) => {
    window.localStorage.setItem(PACKAGE_INTENT_KEY, raw);

    expect(readPackageIntent(undefined, NOW)).toBeNull();
    expect(window.localStorage.getItem(PACKAGE_INTENT_KEY)).toBeNull();
  });

  it.each([
    ["id fuera de la lista blanca", { id: "admin", exp: NOW + 1000 }],
    ["sin id", { exp: NOW + 1000 }],
    ["sin exp", { id: "estandar" }],
    ["exp como texto", { id: "estandar", exp: String(NOW + 1000) }],
    ["exp nula", { id: "estandar", exp: null }],
    ["exp más lejos que las 24 horas", { id: "estandar", exp: NOW + PACKAGE_INTENT_TTL_MS + 1 }],
  ])("%s se descarta y se borra", (_label, value) => {
    put(value);

    expect(readPackageIntent(undefined, NOW)).toBeNull();
    expect(window.localStorage.getItem(PACKAGE_INTENT_KEY)).toBeNull();
  });
});

describe("packageIntent · almacenamiento que falla", () => {
  it("rememberPackageIntent no lanza si setItem lanza (cuota llena, modo privado)", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError", "QuotaExceededError");
    });

    expect(() => rememberPackageIntent("combo-emprendedor", NOW)).not.toThrow();
  });

  it("readPackageIntent no lanza si getItem lanza, y la URL sigue valiendo", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("sin acceso");
    });

    expect(() => readPackageIntent()).not.toThrow();
    expect(readPackageIntent()).toBeNull();
    expect(readPackageIntent("?paquete=combo-emprendedor")).toBe("combo-emprendedor");
  });

  it("no lanza si removeItem lanza al limpiar o al borrar lo caducado", () => {
    put({ id: "estandar", exp: NOW - 1 });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("sin acceso");
    });

    expect(() => clearPackageIntent()).not.toThrow();
    expect(() => readPackageIntent(undefined, NOW)).not.toThrow();
    expect(readPackageIntent(undefined, NOW)).toBeNull();
  });

  it("no lanza si ni siquiera se puede obtener window.localStorage (el getter lanza)", () => {
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new DOMException("SecurityError", "SecurityError");
    });

    expect(() => rememberPackageIntent("estandar", NOW)).not.toThrow();
    expect(() => clearPackageIntent()).not.toThrow();
    expect(readPackageIntent()).toBeNull();
    expect(readPackageIntent("?paquete=estandar")).toBe("estandar");
  });
});
