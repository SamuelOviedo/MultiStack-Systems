import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

/**
 * Carga de datos del módulo de Cotizaciones, local al componente y solo para el administrador.
 *
 * Por qué no TanStack Query ni otra caché compartida: las cotizaciones llevan datos personales del prospecto
 * (nombre, contacto, correo, teléfono). Una caché compartida los conservaría al cerrar sesión o al entrar otra
 * cuenta en el mismo navegador. Aquí los datos viven solo en el estado del componente que los pidió, así que
 * desmontarlo (o cambiar de cuenta) los descarta. Mismo criterio que `useResource` del panel
 * (`dashboard-home/useDashboardData.ts`), con tres añadidos: cancelación real, identidad y rol.
 *
 * Contrato:
 * - `clave` identifica, sin datos sensibles, lo que se pide (`lista:2:25`, `detalle:<uuid>`). `null` = no cargar.
 * - Solo carga con la sesión resuelta (`!loading`), con usuario y con `userType === 0`. No es una fuente de
 *   autorización: la real son `ProtectedRoute` y RLS; esto evita pintar datos de otra sesión.
 * - Cada carga recibe su `AbortSignal`. Se aborta al desmontar, al cambiar `clave`, al cambiar de usuario, al
 *   perder el rol 0, al cerrar sesión y cuando un reintento la sustituye.
 * - Un ticket más la señal aseguran que solo la carga más reciente y vigente actualiza el estado, aunque
 *   `cargar` ignore la señal. Nada se actualiza tras desmontar.
 * - Los datos se guardan con el usuario y la `clave` con que se pidieron, y solo se devuelven si siguen
 *   coincidiendo con la sesión, el rol y la `clave` ACTUALES. La comparación se hace en el render, sin esperar
 *   a un efecto: en el mismo render en que cambia la sesión, se pierde el rol o cambia la `clave` ya no sale
 *   ningún dato, y lo guardado se descarta (volver a una clave anterior vuelve a cargar, sin caché).
 * - Cualquier resultado, bueno o malo, de una carga abortada o sustituida se ignora. Eso incluye la cancelación
 *   esperada (`ErrorCotizacion` con `codigo === 'CANCELADA'`), que la capa de datos solo emite con la señal ya
 *   abortada: nunca se presenta como error. Un fallo de la carga vigente, aunque sea un `CANCELADA` con la señal
 *   viva, pasa a `error` (con «Reintentar»): la pantalla nunca queda en `cargando` sin salida.
 * - No registra nada (ni errores ni datos) y no escribe en la URL ni en el almacenamiento del navegador.
 *   El `error` devuelto está para pasarlo a `traducirErrorCotizacion`; no se muestra tal cual.
 *
 * `estado`:
 * - `inactivo`: `clave` es `null` o aún no hay sesión de administrador resuelta. No hay datos ni error.
 * - `cargando`: hay una carga en curso para la `clave` actual (también al cambiar de página o reintentar).
 * - `listo`: `datos` es el resultado de `cargar` para la `clave` actual (puede ser `null` si `cargar` lo devuelve).
 * - `error`: `error` es lo que rechazó `cargar`.
 * `reintentar` descarta el resultado y vuelve a cargar con la misma `clave`.
 *
 * El resultado es una unión discriminada: se estrecha con `recurso.estado` (sin desestructurar antes).
 */
export type RecursoCotizacion<T> = { reintentar: () => void } & (
  | { estado: "inactivo" | "cargando"; datos: undefined; error: undefined }
  | { estado: "listo"; datos: T; error: undefined }
  | { estado: "error"; datos: undefined; error: unknown }
);

type Guardado<T> = { idUsuario: string; clave: string } & (
  | { estado: "listo"; datos: T }
  | { estado: "error"; error: unknown }
);

export function useRecursoCotizacion<T>(
  clave: string | null,
  cargar: (signal: AbortSignal) => Promise<T>,
): RecursoCotizacion<T> {
  const { user, userType, loading } = useAuth();
  const idUsuario = user?.id ?? null;
  const autorizado = !loading && idUsuario !== null && userType === 0;
  // Sin autorización no hay clave: todo lo que depende de ella se detiene y se aborta.
  const claveActiva = autorizado ? clave : null;

  const [guardado, setGuardado] = useState<Guardado<T> | null>(null);
  const [intento, setIntento] = useState(0);
  const cargarRef = useRef(cargar);
  const ticket = useRef(0);

  // Al cambiar de usuario, perder el rol o cambiar la clave se descarta lo guardado. Se hace durante el render
  // (patrón de React para derivar estado de props) y no en un efecto, para que no quede ni un render con el dato
  // anterior en el estado. Descartarlo también al cambiar la clave hace que volver a una clave anterior (X, Y, X)
  // muestre `cargando` hasta que llegue la respuesta nueva, y no las filas viejas mientras la petición sigue en vuelo.
  if (guardado !== null && (!autorizado || guardado.idUsuario !== idUsuario || guardado.clave !== claveActiva)) {
    setGuardado(null);
  }

  // `cargar` suele ser una función en línea nueva en cada render; se lee la última sin reiniciar la carga.
  useEffect(() => {
    cargarRef.current = cargar;
  });

  useEffect(() => {
    if (idUsuario === null || claveActiva === null) return;
    const controlador = new AbortController();
    const { signal } = controlador;
    const mio = ++ticket.current;

    void (async () => {
      let resultado: Guardado<T>;
      try {
        const datos = await cargarRef.current(signal);
        resultado = { idUsuario, clave: claveActiva, estado: "listo", datos };
      } catch (error) {
        resultado = { idUsuario, clave: claveActiva, estado: "error", error };
      }
      // Sustituida, abortada o desmontada: su respuesta, buena o mala, ya no importa. Aquí caen las cancelaciones
      // esperadas (la capa de datos solo emite `CANCELADA` con la señal ya abortada). Cualquier otro fallo de una
      // carga vigente, incluido un `CANCELADA` con la señal viva, es un error: así nunca queda «cargando» sin salida.
      if (signal.aborted || mio !== ticket.current) return;
      setGuardado(resultado);
    })();

    return () => controlador.abort();
  }, [idUsuario, claveActiva, intento]);

  const reintentar = useCallback(() => {
    setGuardado(null);
    setIntento((n) => n + 1);
  }, []);

  if (claveActiva === null) {
    return { estado: "inactivo", datos: undefined, error: undefined, reintentar };
  }
  // Solo se devuelve lo que se pidió con la sesión, el rol y la clave de ESTE render.
  const vigente = guardado !== null && guardado.idUsuario === idUsuario && guardado.clave === claveActiva ? guardado : null;
  if (vigente === null) {
    return { estado: "cargando", datos: undefined, error: undefined, reintentar };
  }
  return vigente.estado === "listo"
    ? { estado: "listo", datos: vigente.datos, error: undefined, reintentar }
    : { estado: "error", datos: undefined, error: vigente.error, reintentar };
}
