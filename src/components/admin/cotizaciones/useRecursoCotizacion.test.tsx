// Pruebas directas de `useRecursoCotizacion`: carga local del módulo de Cotizaciones, solo para el administrador.
// Solo se simulan `useAuth` (la sesión de cada caso) y el cliente de Supabase (nunca se usa): `ErrorCotizacion` es la
// real. Todos los datos son sintéticos y las respuestas las resuelve cada prueba a mano: sin red ni temporizadores.
import { StrictMode } from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

const auth = vi.hoisted(() => ({
  user: null as { id: string } | null,
  userType: null as number | null,
  loading: true,
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => {
      throw new Error("supabase.from no está simulado: el hook no debe consultar la base");
    },
  },
}));

import { ErrorCotizacion } from "@/lib/cotizaciones";
import { useRecursoCotizacion } from "./useRecursoCotizacion";

interface Dato {
  nombre: string;
}
const DATO_A: Dato = { nombre: "Dato sintético A" };
const DATO_A2: Dato = { nombre: "Dato sintético A (segunda carga)" };
const DATO_B: Dato = { nombre: "Dato sintético B" };

const USUARIO_1 = { id: "usuario-sintetico-1" };
const USUARIO_2 = { id: "usuario-sintetico-2" };

function fijarSesion(user: { id: string } | null, userType: number | null, loading = false) {
  auth.user = user;
  auth.userType = userType;
  auth.loading = loading;
}

beforeEach(() => fijarSesion(USUARIO_1, 0));

/** Una carga en curso: la señal que recibió y cómo resolverla o rechazarla. */
interface Llamada<T> {
  signal: AbortSignal;
  resolver: (valor: T) => void;
  rechazar: (motivo: unknown) => void;
}

/** `cargar` controlado por la prueba. Ignora la señal a propósito: no la usa para cancelar nada por su cuenta. */
function cargadorControlado<T = Dato>() {
  const llamadas: Llamada<T>[] = [];
  const cargar = vi.fn(
    (signal: AbortSignal) =>
      new Promise<T>((resolver, rechazar) => {
        llamadas.push({ signal, resolver, rechazar });
      }),
  );
  return { cargar, llamadas };
}

async function resolver<T>(llamada: Llamada<T>, valor: T) {
  await act(async () => {
    llamada.resolver(valor);
  });
}

async function rechazar(llamada: Llamada<Dato>, motivo: unknown) {
  await act(async () => {
    llamada.rechazar(motivo);
  });
}

async function vaciarMicrotareas() {
  await act(async () => {});
}

interface Props<T> {
  clave: string | null;
  cargar: (signal: AbortSignal) => Promise<T>;
}

/** Lo que devolvió el hook en UN render. */
interface Registro {
  estado: string;
  datos: unknown;
  error: unknown;
}

/**
 * Monta el hook y anota TODO lo que devuelve en cada render, también los que React descarta al volver a renderizar
 * de inmediato (el borrado durante el render llama a `setState`): lo que importa es que ninguno lleve datos ajenos.
 */
function montar<T = Dato>(inicial: Props<T>, opciones: { strict?: boolean } = {}) {
  let props = inicial;
  const registro: Registro[] = [];
  const vista = renderHook(
    (p: Props<T>) => {
      const recurso = useRecursoCotizacion(p.clave, p.cargar);
      registro.push({ estado: recurso.estado, datos: recurso.datos, error: recurso.error });
      return recurso;
    },
    { initialProps: inicial, wrapper: opciones.strict ? StrictMode : undefined },
  );
  return {
    registro,
    result: vista.result,
    unmount: vista.unmount,
    /** Vuelve a pintar con la sesión actual (`auth`) y los cambios de props indicados. */
    repintar(cambios: Partial<Props<T>> = {}) {
      props = { ...props, ...cambios };
      vista.rerender(props);
    },
  };
}

/** Los renders anotados desde `desde` que devolvieron `dato`. */
function rendersConDato(registro: Registro[], desde: number, dato: unknown) {
  return registro.slice(desde).filter((r) => r.datos === dato);
}

/** Cada forma de quedarse sin sesión de administrador (el hook pasa a «inactivo»). */
const PERDIDAS_DE_AUTORIZACION: Array<[string, () => void]> = [
  ["rol de colaborador (1)", () => fijarSesion(USUARIO_1, 1)],
  ["rol de cliente (2)", () => fijarSesion(USUARIO_1, 2)],
  ["rol desconocido (null)", () => fijarSesion(USUARIO_1, null)],
  ["cierre de sesión (user: null)", () => fijarSesion(null, null)],
  ["sesión que vuelve a resolverse (loading: true)", () => fijarSesion(USUARIO_1, 0, true)],
];

describe("useRecursoCotizacion · estados", () => {
  const CASOS_INACTIVOS: Array<[string, () => void, string | null]> = [
    ["la clave es null", () => fijarSesion(USUARIO_1, 0), null],
    ["la sesión aún se resuelve (loading: true)", () => fijarSesion(USUARIO_1, 0, true), "clave-a"],
    ["la sesión aún se resuelve y no hay usuario", () => fijarSesion(null, null, true), "clave-a"],
    ["no hay usuario", () => fijarSesion(null, 0), "clave-a"],
    ["userType 1 (colaborador)", () => fijarSesion(USUARIO_1, 1), "clave-a"],
    ["userType 2 (cliente)", () => fijarSesion(USUARIO_1, 2), "clave-a"],
    ["userType null", () => fijarSesion(USUARIO_1, null), "clave-a"],
  ];

  it.each(CASOS_INACTIVOS)("inactivo y sin llamar a cargar: %s", async (_nombre, preparar, clave) => {
    preparar();
    const { cargar } = cargadorControlado();
    const vista = montar({ clave, cargar });
    await vaciarMicrotareas();

    expect(vista.result.current.estado).toBe("inactivo");
    expect(vista.result.current.datos).toBeUndefined();
    expect(vista.result.current.error).toBeUndefined();
    expect(typeof vista.result.current.reintentar).toBe("function");

    // Reintentar sin autorización tampoco carga.
    act(() => vista.result.current.reintentar());
    await vaciarMicrotareas();
    expect(cargar).not.toHaveBeenCalled();
    expect(vista.registro.every((r) => r.estado === "inactivo")).toBe(true);
  });

  it("cargando: llama a cargar una vez, sin datos ni error", async () => {
    const { cargar, llamadas } = cargadorControlado();
    const vista = montar({ clave: "clave-a", cargar });
    await vaciarMicrotareas();

    expect(cargar).toHaveBeenCalledTimes(1);
    expect(llamadas).toHaveLength(1);
    expect(vista.result.current.estado).toBe("cargando");
    expect(vista.result.current.datos).toBeUndefined();
    expect(vista.result.current.error).toBeUndefined();
  });

  it("listo: devuelve exactamente lo que resolvió cargar, sin error", async () => {
    const { cargar, llamadas } = cargadorControlado();
    const vista = montar({ clave: "clave-a", cargar });
    await resolver(llamadas[0], DATO_A);

    expect(vista.result.current.estado).toBe("listo");
    expect(vista.result.current.datos).toBe(DATO_A);
    expect(vista.result.current.error).toBeUndefined();
    expect(cargar).toHaveBeenCalledTimes(1);
  });

  it("listo también cuando cargar devuelve null (no es lo mismo que «cargando»)", async () => {
    const { cargar, llamadas } = cargadorControlado<Dato | null>();
    const vista = montar<Dato | null>({ clave: "clave-a", cargar });
    await resolver(llamadas[0], null);

    expect(vista.result.current.estado).toBe("listo");
    expect(vista.result.current.datos).toBeNull();
  });

  it("error: lo que rechazó cargar, sin datos", async () => {
    const { cargar, llamadas } = cargadorControlado();
    const vista = montar({ clave: "clave-a", cargar });
    const fallo = new ErrorCotizacion("SIN_PERMISO");
    await rechazar(llamadas[0], fallo);

    expect(vista.result.current.estado).toBe("error");
    expect(vista.result.current.error).toBe(fallo);
    expect(vista.result.current.datos).toBeUndefined();
  });

  it.each<[string, unknown]>([
    ["un Error cualquiera", new Error("fallo sintético")],
    ["una cadena", "fallo sintético"],
    ["null", null],
    ["undefined", undefined],
    ["un objeto plano", { codigo: "CANCELADA" }],
    ["un Error con el texto «CANCELADA»", new Error("CANCELADA")],
  ])("error con cualquier rechazo que no sea la cancelación real: %s", async (_nombre, motivo) => {
    const { cargar, llamadas } = cargadorControlado();
    const vista = montar({ clave: "clave-a", cargar });
    await rechazar(llamadas[0], motivo);

    expect(vista.result.current.estado).toBe("error");
    expect(vista.result.current.error).toBe(motivo);
    expect(vista.result.current.datos).toBeUndefined();
  });

  it("se activa solo cuando la sesión de administrador se resuelve", async () => {
    fijarSesion(null, null, true);
    const { cargar, llamadas } = cargadorControlado();
    const vista = montar({ clave: "clave-a", cargar });
    await vaciarMicrotareas();
    expect(cargar).not.toHaveBeenCalled();
    expect(vista.result.current.estado).toBe("inactivo");

    fijarSesion(USUARIO_1, 0);
    vista.repintar();
    await vaciarMicrotareas();
    expect(cargar).toHaveBeenCalledTimes(1);
    expect(vista.result.current.estado).toBe("cargando");

    await resolver(llamadas[0], DATO_A);
    expect(vista.result.current.estado).toBe("listo");
    expect(vista.result.current.datos).toBe(DATO_A);
  });

  it("una clave nueva vuelve a cargar, sin devolver mientras tanto los datos de la anterior", async () => {
    const { cargar, llamadas } = cargadorControlado();
    const vista = montar({ clave: "clave-a", cargar });
    await resolver(llamadas[0], DATO_A);
    expect(vista.result.current.datos).toBe(DATO_A);

    const desde = vista.registro.length;
    vista.repintar({ clave: "clave-b" });
    await vaciarMicrotareas();

    expect(cargar).toHaveBeenCalledTimes(2);
    expect(vista.result.current.estado).toBe("cargando");
    expect(rendersConDato(vista.registro, desde, DATO_A)).toEqual([]);
    expect(vista.registro[desde].estado).toBe("cargando");

    await resolver(llamadas[1], DATO_B);
    expect(vista.result.current.datos).toBe(DATO_B);
  });

  it("una función cargar nueva en cada render no reinicia la carga, y la última es la que se usa al recargar", async () => {
    const primero = cargadorControlado();
    const vista = montar({ clave: "clave-a", cargar: primero.cargar });
    await vaciarMicrotareas();

    const segundo = cargadorControlado();
    vista.repintar({ cargar: segundo.cargar });
    vista.repintar({ cargar: cargadorControlado().cargar });
    await vaciarMicrotareas();
    expect(primero.cargar).toHaveBeenCalledTimes(1);
    expect(segundo.cargar).not.toHaveBeenCalled();
    expect(primero.llamadas[0].signal.aborted).toBe(false);

    // La carga original sigue siendo la vigente.
    await resolver(primero.llamadas[0], DATO_A);
    expect(vista.result.current.datos).toBe(DATO_A);

    // Al cambiar la clave se usa la función del mismo render, no la anterior.
    vista.repintar({ clave: "clave-b", cargar: segundo.cargar });
    await vaciarMicrotareas();
    expect(segundo.cargar).toHaveBeenCalledTimes(1);
    expect(primero.cargar).toHaveBeenCalledTimes(1);
  });

  it("reintentar descarta el resultado y vuelve a cargar con la misma clave", async () => {
    const { cargar, llamadas } = cargadorControlado();
    const vista = montar({ clave: "clave-a", cargar });
    await resolver(llamadas[0], DATO_A);

    const desde = vista.registro.length;
    act(() => vista.result.current.reintentar());
    await vaciarMicrotareas();
    expect(cargar).toHaveBeenCalledTimes(2);
    expect(vista.result.current.estado).toBe("cargando");
    expect(rendersConDato(vista.registro, desde, DATO_A)).toEqual([]);

    await resolver(llamadas[1], DATO_A2);
    expect(vista.result.current.datos).toBe(DATO_A2);
  });

  it("reintentar desde un error vuelve a cargar y puede terminar en listo", async () => {
    const { cargar, llamadas } = cargadorControlado();
    const vista = montar({ clave: "clave-a", cargar });
    await rechazar(llamadas[0], new ErrorCotizacion("DESCONOCIDO"));
    expect(vista.result.current.estado).toBe("error");

    act(() => vista.result.current.reintentar());
    await vaciarMicrotareas();
    expect(vista.result.current.estado).toBe("cargando");
    expect(vista.result.current.error).toBeUndefined();

    await resolver(llamadas[1], DATO_A);
    expect(vista.result.current.estado).toBe("listo");
    expect(vista.result.current.datos).toBe(DATO_A);
  });

  it("bajo StrictMode (efectos montados dos veces) gana la carga vigente", async () => {
    const { cargar, llamadas } = cargadorControlado();
    const vista = montar({ clave: "clave-a", cargar }, { strict: true });
    await vaciarMicrotareas();

    expect(llamadas).toHaveLength(2);
    expect(llamadas[0].signal.aborted).toBe(true);
    expect(llamadas[1].signal.aborted).toBe(false);

    await resolver(llamadas[0], DATO_A);
    expect(vista.result.current.estado).toBe("cargando");
    await resolver(llamadas[1], DATO_B);
    expect(vista.result.current.estado).toBe("listo");
    expect(vista.result.current.datos).toBe(DATO_B);
  });
});

describe("useRecursoCotizacion · señal de cancelación", () => {
  type Cambio = (vista: ReturnType<typeof montar>) => void;
  /** Cada cambio que debe abortar la carga en curso; `recarga` indica si además pide otra. */
  const CAMBIOS: Array<[string, Cambio, boolean]> = [
    ["al desmontar", (v) => v.unmount(), false],
    ["al cambiar la clave", (v) => v.repintar({ clave: "clave-b" }), true],
    [
      "al cambiar de usuario",
      (v) => {
        fijarSesion(USUARIO_2, 0);
        v.repintar();
      },
      true,
    ],
    [
      "al perder el rol 0 (colaborador)",
      (v) => {
        fijarSesion(USUARIO_1, 1);
        v.repintar();
      },
      false,
    ],
    [
      "al perder el rol 0 (cliente)",
      (v) => {
        fijarSesion(USUARIO_1, 2);
        v.repintar();
      },
      false,
    ],
    [
      "al perder el rol 0 (rol desconocido, null)",
      (v) => {
        fijarSesion(USUARIO_1, null);
        v.repintar();
      },
      false,
    ],
    [
      "al cerrar sesión (user: null)",
      (v) => {
        fijarSesion(null, null);
        v.repintar();
      },
      false,
    ],
    [
      "al volver a resolverse la sesión (loading: true)",
      (v) => {
        fijarSesion(USUARIO_1, 0, true);
        v.repintar();
      },
      false,
    ],
    ["al reintentar", (v) => act(() => v.result.current.reintentar()), true],
    [
      "al poner la clave en null",
      (v) => v.repintar({ clave: null }),
      false,
    ],
  ];

  it("cargar recibe una AbortSignal que no está abortada", async () => {
    const { cargar, llamadas } = cargadorControlado();
    montar({ clave: "clave-a", cargar });
    await vaciarMicrotareas();

    expect(llamadas[0].signal).toBeInstanceOf(AbortSignal);
    expect(llamadas[0].signal.aborted).toBe(false);
  });

  it("control: pintar de nuevo sin cambios no aborta ni vuelve a pedir", async () => {
    const { cargar, llamadas } = cargadorControlado();
    const vista = montar({ clave: "clave-a", cargar });
    await vaciarMicrotareas();
    vista.repintar();
    vista.repintar();
    await vaciarMicrotareas();

    expect(llamadas).toHaveLength(1);
    expect(llamadas[0].signal.aborted).toBe(false);
  });

  it.each(CAMBIOS)("se aborta %s", async (_nombre, cambiar, recarga) => {
    const { cargar, llamadas } = cargadorControlado();
    const vista = montar({ clave: "clave-a", cargar });
    await vaciarMicrotareas();
    const primera = llamadas[0].signal;
    expect(primera.aborted).toBe(false);

    cambiar(vista);
    await vaciarMicrotareas();

    expect(primera.aborted).toBe(true);
    expect(llamadas).toHaveLength(recarga ? 2 : 1);
    if (recarga) {
      // La carga nueva lleva su propia señal, viva.
      expect(llamadas[1].signal).toBeInstanceOf(AbortSignal);
      expect(llamadas[1].signal).not.toBe(primera);
      expect(llamadas[1].signal.aborted).toBe(false);
    }
  });

  it("se aborta también una carga ya terminada cuando cambia la sesión (no queda nada vivo)", async () => {
    const { cargar, llamadas } = cargadorControlado();
    const vista = montar({ clave: "clave-a", cargar });
    await resolver(llamadas[0], DATO_A);

    fijarSesion(null, null);
    vista.repintar();
    await vaciarMicrotareas();
    expect(llamadas[0].signal.aborted).toBe(true);
  });

  it("varios reintentos seguidos: solo sobrevive la última señal", async () => {
    const { cargar, llamadas } = cargadorControlado();
    const vista = montar({ clave: "clave-a", cargar });
    await vaciarMicrotareas();
    act(() => vista.result.current.reintentar());
    act(() => vista.result.current.reintentar());
    await vaciarMicrotareas();

    expect(llamadas).toHaveLength(3);
    expect(llamadas.map((l) => l.signal.aborted)).toEqual([true, true, false]);
  });
});

describe("useRecursoCotizacion · ningún render con datos ajenos", () => {
  it("al cambiar de usuario ningún render devuelve los datos del anterior", async () => {
    const { cargar, llamadas } = cargadorControlado();
    const vista = montar({ clave: "clave-a", cargar });
    await resolver(llamadas[0], DATO_A);
    expect(vista.result.current.datos).toBe(DATO_A);

    const desde = vista.registro.length;
    fijarSesion(USUARIO_2, 0);
    vista.repintar();
    await vaciarMicrotareas();

    expect(vista.registro.length).toBeGreaterThan(desde);
    expect(rendersConDato(vista.registro, desde, DATO_A)).toEqual([]);
    expect(vista.registro.slice(desde).every((r) => r.estado === "cargando")).toBe(true);
    expect(llamadas).toHaveLength(2);

    await resolver(llamadas[1], DATO_B);
    expect(vista.result.current.datos).toBe(DATO_B);
    expect(rendersConDato(vista.registro, desde, DATO_A)).toEqual([]);
  });

  it.each(PERDIDAS_DE_AUTORIZACION)("tras perder la autorización (%s) ningún render devuelve los datos", async (_nombre, perder) => {
    const { cargar, llamadas } = cargadorControlado();
    const vista = montar({ clave: "clave-a", cargar });
    await resolver(llamadas[0], DATO_A);
    expect(vista.result.current.datos).toBe(DATO_A);

    const desde = vista.registro.length;
    perder();
    vista.repintar();
    await vaciarMicrotareas();

    expect(vista.registro.length).toBeGreaterThan(desde);
    expect(rendersConDato(vista.registro, desde, DATO_A)).toEqual([]);
    expect(vista.registro.slice(desde).every((r) => r.estado === "inactivo")).toBe(true);
    expect(cargar).toHaveBeenCalledTimes(1);
  });

  it.each(PERDIDAS_DE_AUTORIZACION)("recuperar el rol 0 tras %s no resucita el dato: vuelve a cargar", async (_nombre, perder) => {
    const { cargar, llamadas } = cargadorControlado();
    const vista = montar({ clave: "clave-a", cargar });
    await resolver(llamadas[0], DATO_A);

    const desde = vista.registro.length;
    perder();
    vista.repintar();
    await vaciarMicrotareas();

    fijarSesion(USUARIO_1, 0);
    vista.repintar();
    await vaciarMicrotareas();

    // Ni un solo render desde la pérdida devuelve el dato anterior, y el primero tras recuperarla es «cargando».
    expect(rendersConDato(vista.registro, desde, DATO_A)).toEqual([]);
    expect(vista.result.current.estado).toBe("cargando");
    expect(vista.result.current.datos).toBeUndefined();
    expect(cargar).toHaveBeenCalledTimes(2);
    expect(llamadas[1].signal.aborted).toBe(false);

    await resolver(llamadas[1], DATO_A2);
    expect(vista.result.current.estado).toBe("listo");
    expect(vista.result.current.datos).toBe(DATO_A2);
    expect(rendersConDato(vista.registro, desde, DATO_A)).toEqual([]);
  });

  it("usuario 1, luego usuario 2 sin respuesta, y de vuelta al 1: el dato viejo no reaparece", async () => {
    const { cargar, llamadas } = cargadorControlado();
    const vista = montar({ clave: "clave-a", cargar });
    await resolver(llamadas[0], DATO_A);

    const desde = vista.registro.length;
    fijarSesion(USUARIO_2, 0);
    vista.repintar();
    await vaciarMicrotareas();
    expect(vista.result.current.estado).toBe("cargando");

    fijarSesion(USUARIO_1, 0);
    vista.repintar();
    await vaciarMicrotareas();

    expect(rendersConDato(vista.registro, desde, DATO_A)).toEqual([]);
    expect(vista.result.current.estado).toBe("cargando");
    expect(cargar).toHaveBeenCalledTimes(3);
  });

  it.each<[string, (llamada: Llamada<Dato>) => Promise<void>]>([
    ["datos", (llamada) => resolver(llamada, DATO_A)],
    ["un error", (llamada) => rechazar(llamada, new ErrorCotizacion("SIN_PERMISO"))],
  ])(
    "volver a una clave anterior (X → Y → X) no devuelve %s viejos: cargando hasta la respuesta nueva, con una petición nueva",
    async (_nombre, terminarX) => {
      const { cargar, llamadas } = cargadorControlado();
      const vista = montar({ clave: "clave-x", cargar });
      await terminarX(llamadas[0]);
      expect(vista.result.current.estado).not.toBe("cargando");

      const desdeX = vista.registro.length;
      vista.repintar({ clave: "clave-y" }); // Y queda pendiente
      await vaciarMicrotareas();
      expect(vista.result.current.estado).toBe("cargando");
      expect(llamadas).toHaveLength(2);

      vista.repintar({ clave: "clave-x" }); // de vuelta en X, sin caché
      await vaciarMicrotareas();

      expect(llamadas).toHaveLength(3);
      expect(llamadas[2].signal.aborted).toBe(false);
      expect(vista.result.current.estado).toBe("cargando");
      expect(vista.result.current.datos).toBeUndefined();
      expect(vista.result.current.error).toBeUndefined();
      // Ni un solo render desde que se dejó X devolvió sus datos o su error.
      expect(rendersConDato(vista.registro, desdeX, DATO_A)).toEqual([]);
      expect(vista.registro.slice(desdeX).every((r) => r.estado === "cargando" && r.error === undefined)).toBe(true);

      await resolver(llamadas[2], DATO_A2);
      expect(vista.result.current.estado).toBe("listo");
      expect(vista.result.current.datos).toBe(DATO_A2);
      expect(rendersConDato(vista.registro, desdeX, DATO_A)).toEqual([]);
    },
  );

  it("volver a X con la primera carga de X todavía en vuelo: su respuesta tardía no se pinta", async () => {
    const { cargar, llamadas } = cargadorControlado();
    const vista = montar({ clave: "clave-x", cargar });
    await vaciarMicrotareas();
    vista.repintar({ clave: "clave-y" });
    await vaciarMicrotareas();
    vista.repintar({ clave: "clave-x" });
    await vaciarMicrotareas();
    expect(llamadas).toHaveLength(3);
    expect(llamadas.map((l) => l.signal.aborted)).toEqual([true, true, false]);

    // La primera carga de X (abortada) llega tarde, cuando la clave ya volvió a ser X.
    await resolver(llamadas[0], DATO_A);
    expect(vista.result.current.estado).toBe("cargando");
    expect(rendersConDato(vista.registro, 0, DATO_A)).toEqual([]);

    await resolver(llamadas[2], DATO_A2);
    expect(vista.result.current.datos).toBe(DATO_A2);
    expect(rendersConDato(vista.registro, 0, DATO_A)).toEqual([]);
  });

  it("un error de la sesión anterior tampoco se muestra a la siguiente", async () => {
    const { cargar, llamadas } = cargadorControlado();
    const vista = montar({ clave: "clave-a", cargar });
    const fallo = new ErrorCotizacion("SIN_PERMISO");
    await rechazar(llamadas[0], fallo);
    expect(vista.result.current.estado).toBe("error");

    const desde = vista.registro.length;
    fijarSesion(USUARIO_2, 0);
    vista.repintar();
    await vaciarMicrotareas();

    expect(vista.registro.slice(desde).filter((r) => r.error === fallo || r.estado === "error")).toEqual([]);
    expect(vista.result.current.estado).toBe("cargando");
  });
});

describe("useRecursoCotizacion · respuestas fuera de orden", () => {
  it("la carga lenta (A) y la rápida (B) tras cambiar de clave: gana B aunque A resuelva después", async () => {
    const { cargar, llamadas } = cargadorControlado();
    const vista = montar({ clave: "clave-a", cargar });
    await vaciarMicrotareas();
    vista.repintar({ clave: "clave-b" });
    await vaciarMicrotareas();
    expect(llamadas).toHaveLength(2);

    await resolver(llamadas[1], DATO_B);
    expect(vista.result.current.datos).toBe(DATO_B);

    const desde = vista.registro.length;
    await resolver(llamadas[0], DATO_A);
    expect(vista.result.current.estado).toBe("listo");
    expect(vista.result.current.datos).toBe(DATO_B);
    expect(rendersConDato(vista.registro, 0, DATO_A)).toEqual([]);
    expect(vista.registro.length).toBe(desde);
  });

  it("si la lenta (A) resuelve antes que la nueva (B), no se pinta A y se sigue cargando", async () => {
    const { cargar, llamadas } = cargadorControlado();
    const vista = montar({ clave: "clave-a", cargar });
    await vaciarMicrotareas();
    vista.repintar({ clave: "clave-b" });
    await vaciarMicrotareas();

    await resolver(llamadas[0], DATO_A);
    expect(vista.result.current.estado).toBe("cargando");
    expect(rendersConDato(vista.registro, 0, DATO_A)).toEqual([]);

    await resolver(llamadas[1], DATO_B);
    expect(vista.result.current.datos).toBe(DATO_B);
    expect(rendersConDato(vista.registro, 0, DATO_A)).toEqual([]);
  });

  it("una respuesta tardía de la sesión anterior no se pinta en la siguiente", async () => {
    const { cargar, llamadas } = cargadorControlado();
    const vista = montar({ clave: "clave-a", cargar });
    await vaciarMicrotareas();
    fijarSesion(USUARIO_2, 0);
    vista.repintar();
    await vaciarMicrotareas();

    await resolver(llamadas[0], DATO_A);
    expect(vista.result.current.estado).toBe("cargando");
    await resolver(llamadas[1], DATO_B);
    expect(vista.result.current.datos).toBe(DATO_B);
    expect(rendersConDato(vista.registro, 0, DATO_A)).toEqual([]);
  });

  it("una respuesta tardía de la sesión anterior no pisa a la de la siguiente si llega después", async () => {
    const { cargar, llamadas } = cargadorControlado();
    const vista = montar({ clave: "clave-a", cargar });
    await vaciarMicrotareas();
    fijarSesion(USUARIO_2, 0);
    vista.repintar();
    await vaciarMicrotareas();

    await resolver(llamadas[1], DATO_B);
    await resolver(llamadas[0], DATO_A);
    expect(vista.result.current.datos).toBe(DATO_B);
    expect(rendersConDato(vista.registro, 0, DATO_A)).toEqual([]);
  });

  it.each(PERDIDAS_DE_AUTORIZACION)(
    "una respuesta que llega tras perder la autorización (%s) ni se pinta ni provoca otro render, tampoco al recuperarla",
    async (_nombre, perder) => {
      const { cargar, llamadas } = cargadorControlado();
      const vista = montar({ clave: "clave-a", cargar });
      await vaciarMicrotareas();
      perder();
      vista.repintar();
      await vaciarMicrotareas();
      const antes = vista.registro.length;

      await resolver(llamadas[0], DATO_A);
      expect(vista.result.current.estado).toBe("inactivo");
      // Una carga abortada no toca el estado: ni siquiera pide un render.
      expect(vista.registro.length).toBe(antes);

      fijarSesion(USUARIO_1, 0);
      vista.repintar();
      await vaciarMicrotareas();
      expect(vista.result.current.estado).toBe("cargando");
      expect(rendersConDato(vista.registro, 0, DATO_A)).toEqual([]);
    },
  );

  it.each<[string, (llamada: Llamada<Dato>) => Promise<void>]>([
    ["datos", (llamada) => resolver(llamada, DATO_A)],
    ["un error", (llamada) => rechazar(llamada, new Error("fallo sintético"))],
  ])(
    "%s de una carga abortada que llegan mientras la clave era null no se muestran cuando la clave vuelve",
    async (_nombre, entregar) => {
      const { cargar, llamadas } = cargadorControlado();
      const vista = montar({ clave: "clave-a", cargar });
      await vaciarMicrotareas();
      // Un id que deja de ser válido (clave null) aborta la carga sin lanzar otra.
      vista.repintar({ clave: null });
      await vaciarMicrotareas();
      expect(vista.result.current.estado).toBe("inactivo");
      expect(llamadas[0].signal.aborted).toBe(true);

      await entregar(llamadas[0]);
      vista.repintar({ clave: "clave-a" });
      await vaciarMicrotareas();

      expect(vista.result.current.estado).toBe("cargando");
      expect(rendersConDato(vista.registro, 0, DATO_A)).toEqual([]);
      expect(vista.registro.some((r) => r.estado === "error")).toBe(false);
      expect(llamadas).toHaveLength(2);

      await resolver(llamadas[1], DATO_B);
      expect(vista.result.current.datos).toBe(DATO_B);
    },
  );

  it("la carga sustituida por un reintento no gana aunque resuelva después", async () => {
    const { cargar, llamadas } = cargadorControlado();
    const vista = montar({ clave: "clave-a", cargar });
    await vaciarMicrotareas();
    act(() => vista.result.current.reintentar());
    await vaciarMicrotareas();

    await resolver(llamadas[1], DATO_B);
    await resolver(llamadas[0], DATO_A);
    expect(vista.result.current.datos).toBe(DATO_B);
    expect(rendersConDato(vista.registro, 0, DATO_A)).toEqual([]);
  });

  it("una respuesta o un fallo tras desmontar no actualiza nada ni avisa", async () => {
    const consola = espiarConsola();
    const { cargar, llamadas } = cargadorControlado();
    const vista = montar({ clave: "clave-a", cargar });
    await vaciarMicrotareas();
    const antes = vista.registro.length;
    vista.unmount();

    await resolver(llamadas[0], DATO_A);
    expect(vista.registro.length).toBe(antes);

    const otro = cargadorControlado();
    const vista2 = montar({ clave: "clave-a", cargar: otro.cargar });
    await vaciarMicrotareas();
    const antes2 = vista2.registro.length;
    vista2.unmount();
    await rechazar(otro.llamadas[0], new ErrorCotizacion("DESCONOCIDO"));
    expect(vista2.registro.length).toBe(antes2);

    expect(consola.llamadas()).toEqual([]);
  });
});

describe("useRecursoCotizacion · cancelación y fallos", () => {
  it("un ErrorCotizacion('CANCELADA') de la carga vigente (con la señal viva) pasa a error y ofrece reintentar", async () => {
    const { cargar, llamadas } = cargadorControlado();
    const vista = montar({ clave: "clave-a", cargar });
    await vaciarMicrotareas();
    expect(llamadas[0].signal.aborted).toBe(false);
    const cancelacion = new ErrorCotizacion("CANCELADA");
    await rechazar(llamadas[0], cancelacion);

    // La pantalla nunca queda en «cargando» sin salida.
    expect(vista.result.current.estado).toBe("error");
    expect(vista.result.current.error).toBe(cancelacion);
    expect(vista.result.current.datos).toBeUndefined();

    // Y reintentar vuelve a cargar y puede terminar bien.
    act(() => vista.result.current.reintentar());
    await vaciarMicrotareas();
    expect(vista.result.current.estado).toBe("cargando");
    expect(vista.result.current.error).toBeUndefined();
    await resolver(llamadas[1], DATO_A);
    expect(vista.result.current.estado).toBe("listo");
    expect(vista.result.current.datos).toBe(DATO_A);
  });

  it.each<[string, ErrorCotizacion]>([
    ["SIN_PERMISO", new ErrorCotizacion("SIN_PERMISO")],
    ["NO_ENCONTRADA", new ErrorCotizacion("NO_ENCONTRADA")],
    ["DESCONOCIDO", new ErrorCotizacion("DESCONOCIDO")],
    ["DATOS_INVALIDOS", new ErrorCotizacion("DATOS_INVALIDOS")],
    ["PARAMETROS_INVALIDOS", new ErrorCotizacion("PARAMETROS_INVALIDOS")],
  ])("un ErrorCotizacion('%s') vigente sí es error", async (_codigo, fallo) => {
    const { cargar, llamadas } = cargadorControlado();
    const vista = montar({ clave: "clave-a", cargar });
    await rechazar(llamadas[0], fallo);

    expect(vista.result.current.estado).toBe("error");
    expect(vista.result.current.error).toBe(fallo);
  });

  type Provocar = (vista: ReturnType<typeof montar>) => void;
  const SUSTITUCIONES: Array<[string, Provocar]> = [
    ["al cambiar la clave", (v) => v.repintar({ clave: "clave-b" })],
    [
      "al cambiar de usuario",
      (v) => {
        fijarSesion(USUARIO_2, 0);
        v.repintar();
      },
    ],
    [
      "al perder el rol 0",
      (v) => {
        fijarSesion(USUARIO_1, 1);
        v.repintar();
      },
    ],
    [
      "al cerrar sesión",
      (v) => {
        fijarSesion(null, null);
        v.repintar();
      },
    ],
    ["al reintentar", (v) => act(() => v.result.current.reintentar())],
  ];

  it.each(SUSTITUCIONES)("el fallo de una carga abortada %s se ignora (sea cual sea su código)", async (_nombre, provocar) => {
    const { cargar, llamadas } = cargadorControlado();
    const vista = montar({ clave: "clave-a", cargar });
    await vaciarMicrotareas();
    provocar(vista);
    await vaciarMicrotareas();
    expect(llamadas[0].signal.aborted).toBe(true);

    const antes = vista.registro.length;
    await rechazar(llamadas[0], new ErrorCotizacion("DESCONOCIDO"));
    expect(vista.registro.some((r) => r.estado === "error")).toBe(false);
    expect(vista.result.current.estado).not.toBe("error");
    // Si no hay otra carga en curso, el fallo de la abortada ni siquiera pide un render.
    if (llamadas.length === 1) expect(vista.registro.length).toBe(antes);

    // Y la carga que sí está vigente (si la hay) termina bien.
    if (llamadas.length > 1) {
      await resolver(llamadas[1], DATO_B);
      expect(vista.result.current.estado).toBe("listo");
      expect(vista.result.current.datos).toBe(DATO_B);
    }
  });

  it.each(SUSTITUCIONES)(
    "la cancelación (CANCELADA) de una carga abortada o sustituida %s se ignora y no pasa a error",
    async (_nombre, provocar) => {
      const { cargar, llamadas } = cargadorControlado();
      const vista = montar({ clave: "clave-a", cargar });
      await vaciarMicrotareas();
      provocar(vista);
      await vaciarMicrotareas();
      // Es el caso real: la capa de datos emite CANCELADA justamente cuando la señal ya está abortada.
      expect(llamadas[0].signal.aborted).toBe(true);

      const antes = vista.registro.length;
      await rechazar(llamadas[0], new ErrorCotizacion("CANCELADA"));
      expect(vista.registro.some((r) => r.estado === "error")).toBe(false);
      expect(vista.result.current.estado).not.toBe("error");
      if (llamadas.length === 1) expect(vista.registro.length).toBe(antes);

      if (llamadas.length > 1) {
        await resolver(llamadas[1], DATO_B);
        expect(vista.result.current.estado).toBe("listo");
        expect(vista.result.current.datos).toBe(DATO_B);
      }
    },
  );

  it("la cancelación (CANCELADA) de una carga abortada al desmontar se ignora", async () => {
    const { cargar, llamadas } = cargadorControlado();
    const vista = montar({ clave: "clave-a", cargar });
    await vaciarMicrotareas();
    const antes = vista.registro.length;
    vista.unmount();
    await rechazar(llamadas[0], new ErrorCotizacion("CANCELADA"));
    expect(vista.registro.length).toBe(antes);
  });

  it("el fallo de una carga abortada al desmontar se ignora", async () => {
    const { cargar, llamadas } = cargadorControlado();
    const vista = montar({ clave: "clave-a", cargar });
    await vaciarMicrotareas();
    const antes = vista.registro.length;
    vista.unmount();
    await rechazar(llamadas[0], new ErrorCotizacion("DESCONOCIDO"));
    expect(vista.registro.length).toBe(antes);
  });

  it("un rechazo hostil (instanceof que lanza) es un error normal, no una excepción sin capturar", async () => {
    const { cargar, llamadas } = cargadorControlado();
    const vista = montar({ clave: "clave-a", cargar });
    const hostil = new Proxy(
      {},
      {
        getPrototypeOf() {
          throw new Error("trampa hostil de getPrototypeOf");
        },
      },
    );
    await rechazar(llamadas[0], hostil);

    expect(vista.result.current.estado).toBe("error");
    expect(vista.result.current.error).toBe(hostil);
  });

  it("un ErrorCotizacion cuyo codigo lanza al leerse es un error normal", async () => {
    const { cargar, llamadas } = cargadorControlado();
    const vista = montar({ clave: "clave-a", cargar });
    const hostil = Object.defineProperty(new ErrorCotizacion("DESCONOCIDO"), "codigo", {
      get() {
        throw new Error("getter hostil de codigo");
      },
    });
    await rechazar(llamadas[0], hostil);

    expect(vista.result.current.estado).toBe("error");
    expect(vista.result.current.error).toBe(hostil);
  });

  it("cargar que lanza de forma síncrona es un error, no una excepción en el render", async () => {
    const fallo = new ErrorCotizacion("DESCONOCIDO");
    const cargar = vi.fn((): Promise<Dato> => {
      throw fallo;
    });
    const vista = montar({ clave: "clave-a", cargar });
    await vaciarMicrotareas();

    expect(vista.result.current.estado).toBe("error");
    expect(vista.result.current.error).toBe(fallo);
  });
});

/* ------------------------------------------------------------------------------------------------
 * Sin registros: el hook nunca escribe en la consola, en la URL, en el almacenamiento ni en las cookies.
 * ---------------------------------------------------------------------------------------------- */

const METODOS_DE_CONSOLA = ["log", "info", "warn", "error", "debug", "trace", "dir"] as const;
const espiasActivos: MockInstance[] = [];

/** Espía los métodos de la consola (sin dejarlos escribir) y devuelve los nombres de los que se llamaron. */
function espiarConsola(): { llamadas: () => string[] } {
  const espias: Array<[string, MockInstance]> = METODOS_DE_CONSOLA.map((metodo): [string, MockInstance] => {
    const espia = vi.spyOn(console, metodo).mockImplementation(() => undefined);
    espiasActivos.push(espia);
    return [metodo, espia];
  });
  return { llamadas: () => espias.flatMap(([metodo, espia]) => espia.mock.calls.map(() => metodo)) };
}

afterEach(() => {
  for (const espia of espiasActivos.splice(0)) espia.mockRestore();
});

describe("useRecursoCotizacion · sin registros", () => {
  type Escenario = () => Promise<void>;
  const ESCENARIOS: Array<[string, Escenario]> = [
    [
      "carga correcta",
      async () => {
        const { cargar, llamadas } = cargadorControlado();
        montar({ clave: "clave-a", cargar });
        await resolver(llamadas[0], DATO_A);
      },
    ],
    [
      "error de dominio",
      async () => {
        const { cargar, llamadas } = cargadorControlado();
        montar({ clave: "clave-a", cargar });
        await rechazar(llamadas[0], new ErrorCotizacion("SIN_PERMISO"));
      },
    ],
    [
      "error crudo con datos del prospecto en el mensaje",
      async () => {
        const { cargar, llamadas } = cargadorControlado();
        montar({ clave: "clave-a", cargar });
        await rechazar(llamadas[0], new Error("prospecto.sintetico@example.test +504 5550-0100"));
      },
    ],
    [
      "cancelación con la señal viva (pasa a error)",
      async () => {
        const { cargar, llamadas } = cargadorControlado();
        montar({ clave: "clave-a", cargar });
        await rechazar(llamadas[0], new ErrorCotizacion("CANCELADA"));
      },
    ],
    [
      "desmontar con respuesta tardía",
      async () => {
        const { cargar, llamadas } = cargadorControlado();
        const vista = montar({ clave: "clave-a", cargar });
        await vaciarMicrotareas();
        vista.unmount();
        await resolver(llamadas[0], DATO_A);
      },
    ],
    [
      "fallo tardío de una carga sustituida",
      async () => {
        const { cargar, llamadas } = cargadorControlado();
        const vista = montar({ clave: "clave-a", cargar });
        await vaciarMicrotareas();
        vista.repintar({ clave: "clave-b" });
        await vaciarMicrotareas();
        await rechazar(llamadas[0], new Error("fallo tardío"));
        await resolver(llamadas[1], DATO_B);
      },
    ],
    [
      "cancelación de una carga abortada y vuelta a la clave anterior",
      async () => {
        const { cargar, llamadas } = cargadorControlado();
        const vista = montar({ clave: "clave-a", cargar });
        await vaciarMicrotareas();
        vista.repintar({ clave: "clave-b" });
        await vaciarMicrotareas();
        await rechazar(llamadas[0], new ErrorCotizacion("CANCELADA"));
        vista.repintar({ clave: "clave-a" });
        await vaciarMicrotareas();
        await resolver(llamadas[2], DATO_A);
      },
    ],
    [
      "cambio de usuario, pérdida de rol y cierre de sesión",
      async () => {
        const { cargar, llamadas } = cargadorControlado();
        const vista = montar({ clave: "clave-a", cargar });
        await resolver(llamadas[0], DATO_A);
        fijarSesion(USUARIO_2, 0);
        vista.repintar();
        await vaciarMicrotareas();
        fijarSesion(USUARIO_2, 1);
        vista.repintar();
        fijarSesion(null, null);
        vista.repintar();
        await vaciarMicrotareas();
      },
    ],
    [
      "reintentos",
      async () => {
        const { cargar, llamadas } = cargadorControlado();
        const vista = montar({ clave: "clave-a", cargar });
        await rechazar(llamadas[0], new ErrorCotizacion("DESCONOCIDO"));
        act(() => vista.result.current.reintentar());
        await vaciarMicrotareas();
        await resolver(llamadas[1], DATO_A);
      },
    ],
  ];

  it("control: los espías ven una llamada a cada método de la consola", () => {
    const consola = espiarConsola();
    for (const metodo of METODOS_DE_CONSOLA) console[metodo]("control");
    expect(consola.llamadas().sort()).toEqual([...METODOS_DE_CONSOLA].sort());
  });

  it.each(ESCENARIOS)("ningún camino escribe en la consola: %s", async (_nombre, escenario) => {
    const consola = espiarConsola();
    await escenario();
    expect(consola.llamadas()).toEqual([]);
  });

  it("no escribe en la URL, el almacenamiento ni las cookies", async () => {
    // Control: el sondeo sí ve una escritura.
    const cookieAntes = document.cookie;
    window.localStorage.setItem("control", "1");
    expect(window.localStorage.length).toBe(1);
    window.localStorage.clear();

    const urlAntes = window.location.href;
    const empujar = vi.spyOn(window.history, "pushState");
    const reemplazar = vi.spyOn(window.history, "replaceState");
    espiasActivos.push(empujar, reemplazar);

    for (const [, escenario] of ESCENARIOS) {
      cleanup();
      fijarSesion(USUARIO_1, 0);
      await escenario();
    }

    expect(window.location.href).toBe(urlAntes);
    expect(empujar).not.toHaveBeenCalled();
    expect(reemplazar).not.toHaveBeenCalled();
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
    expect(document.cookie).toBe(cookieAntes);
  });
});
