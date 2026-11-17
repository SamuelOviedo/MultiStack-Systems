/**
 * Capa de datos del módulo de Cotizaciones (solo administrador), fase F1.
 *
 * Los componentes no consultan Supabase directamente: todo pasa por aquí.
 *
 * Garantías:
 * - El acceso lo concede la base, no esta capa: RLS limita las dos tablas al administrador
 *   (`get_user_type() = 0`). Un colaborador, un cliente o un usuario sin perfil recibe 0 filas, sin
 *   error. Esta capa no añade ni sustituye ese control.
 * - Falla cerrado: valida los parámetros antes de llamar a Supabase y cada fila recibida contra una
 *   lista permitida. Una sola fila inválida rechaza la página entera: nunca se omiten filas en
 *   silencio ni se devuelve una parte. Una respuesta con más filas de las pedidas también se rechaza
 *   entera, nunca se trunca. La fila de más con la que `listarPaginaCotizaciones` sabe si hay página
 *   siguiente se valida igual que las demás y nunca se devuelve. Cada objeto se construye campo por
 *   campo, así que ninguna clave inesperada del servidor llega a la interfaz.
 * - Cancelación opcional: `listarPaginaCotizaciones` y `obtenerCotizacion` aceptan una `AbortSignal`
 *   genuina (cualquier otro valor es `PARAMETROS_INVALIDOS`) y la entregan a supabase-js con su
 *   método `abortSignal`. Con la señal ya cancelada no se llama a Supabase, y un fallo con la señal
 *   cancelada sale como `CANCELADA`, para que la interfaz no lo confunda con un error del servidor.
 * - Nunca expone SQL: todo fallo que esta capa propaga sale como `ErrorCotizacion`, cuyo `message`
 *   (en las instancias que crea esta capa) es siempre un texto en español de una tabla fija. Incluye
 *   los parámetros, la consulta, el transporte, la cancelación, la lectura de la respuesta y la
 *   validación de las filas, también cuando el error o la respuesta son hostiles (un getter que
 *   lanza, un `Proxy` con trampas o revocado): el error original (mensaje, detalle, pista, código
 *   SQLSTATE) ni se guarda ni se reenvía ni se registra, y tampoco el motivo (`reason`) de una
 *   cancelación ni los datos del prospecto. Quedan fuera de la garantía los fallos del propio motor
 *   (por ejemplo, memoria agotada) y una `ErrorCotizacion` fabricada por código que ya importe la
 *   clase: no hay ruta de datos del servidor que la produzca.
 */
import { supabase } from '@/integrations/supabase/client';
import { ESTADOS_COTIZACION } from '@/types/cotizaciones';
import type { Cotizacion, CotizacionResumen, EstadoCotizacion } from '@/types/cotizaciones';

export const MENSAJE_ERROR_GENERICO = 'No se pudo completar la operación. Inténtalo de nuevo.';

export const TAMANO_PAGINA_PREDETERMINADO = 25;
export const TAMANO_PAGINA_MAXIMO = 100;
export const PAGINA_MAXIMA = 10000;

/**
 * Única tabla de textos. La clave es el código que la base emite como `COT:<CODIGO>` (sin el
 * prefijo) y el valor, el texto aprobado para la interfaz. El tipo de los códigos conocidos se
 * deriva de aquí para que no se desincronicen.
 */
const MENSAJES_COT = [
  ['SIN_PERMISO', 'No tienes permiso para realizar esta acción.'],
  ['NO_ENCONTRADA', 'Cotización no encontrada.'],
  ['ESTADO_INVALIDO', 'No puedes realizar esta acción en el estado actual de la cotización.'],
  ['CONFLICTO_VERSION', 'La cotización cambió mientras la editabas. Recarga para ver la versión más reciente.'],
  ['MOTIVO_REQUERIDO', 'Indica un motivo de entre 10 y 1 000 caracteres.'],
  ['SUSTITUIDA', 'Esta cotización fue sustituida por otra versión.'],
  ['TOPE_EXCEDIDO', 'La cotización supera el límite permitido. Revisa los importes.'],
  ['INMUTABLE', 'Esta cotización ya no admite cambios.'],
] as const;

// COT:DETALLE_INVALIDO no está en la tabla a propósito: es un error INTERNO de la auditoría (el
// detalle de un evento no cumple su esquema) y su causa no debe llegar nunca a la persona. Cae en
// el mensaje genérico, igual que cualquier otro código `COT:` desconocido.

export type CodigoCotizacionConocido = (typeof MENSAJES_COT)[number][0];

/**
 * Códigos de `ErrorCotizacion`: los `COT:` conocidos más los propios de esta capa. `CANCELADA` no es
 * un fallo del servidor: quien llamó canceló la consulta con su `AbortSignal`, así que la interfaz
 * debe ignorarlo en vez de mostrar un error. Como los demás códigos propios, su `message` es el
 * genérico y no está en la tabla de textos.
 */
export type CodigoErrorCotizacion =
  | CodigoCotizacionConocido
  | 'DESCONOCIDO'
  | 'DATOS_INVALIDOS'
  | 'PARAMETROS_INVALIDOS'
  | 'CANCELADA';

// Las búsquedas usan `Map`, nunca `objeto[clave]`: una clave como `constructor` o `__proto__` que
// viniera de un error no puede resolverse contra el prototipo.
const TEXTO_POR_CODIGO = new Map<string, string>(MENSAJES_COT);
const CODIGO_POR_MENSAJE = new Map<string, CodigoCotizacionConocido>(
  MENSAJES_COT.map(([codigo]): [string, CodigoCotizacionConocido] => [`COT:${codigo}`, codigo]),
);

/**
 * Fallo del módulo. El `message` es siempre un texto en español seguro (el de la tabla o el
 * genérico) y solo se guarda el código propio: ni una propiedad de causa ni parte alguna del error
 * original, para que ningún registro, boundary o serialización futura lo filtre.
 */
export class ErrorCotizacion extends Error {
  readonly codigo: CodigoErrorCotizacion;

  constructor(codigo: CodigoErrorCotizacion) {
    // Los códigos propios (DESCONOCIDO, DATOS_INVALIDOS, PARAMETROS_INVALIDOS, CANCELADA) no están en la tabla.
    super(TEXTO_POR_CODIGO.get(codigo) ?? MENSAJE_ERROR_GENERICO);
    this.name = 'ErrorCotizacion';
    this.codigo = codigo;
  }
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

/** Lee `message` sin dejar pasar una excepción (un getter hostil): ante cualquier fallo, `undefined`. */
function leerMensaje(error: unknown): unknown {
  try {
    return esObjeto(error) ? error.message : undefined;
  } catch {
    return undefined;
  }
}

/** Igualdad exacta con `COT:<CODIGO>`: sin recorte, sin prefijo parcial, sin mayúsculas distintas. */
function codigoConocidoDe(error: unknown): CodigoCotizacionConocido | null {
  const mensaje = leerMensaje(error);
  return typeof mensaje === 'string' ? (CODIGO_POR_MENSAJE.get(mensaje) ?? null) : null;
}

/**
 * Texto en español para la interfaz. Solo reconoce una `ErrorCotizacion` o un `message` que sea
 * exactamente `COT:` más un código conocido (un `COT:` conocido gana aunque el SQLSTATE sea
 * `42501`). Todo lo demás devuelve el genérico: errores crudos, objetos de PostgREST, cadenas
 * sueltas, códigos desconocidos y `42501` sin `COT:`. Nunca incluye texto del error recibido.
 *
 * Es total: no lanza nunca (un getter hostil o un `Proxy` revocado dan el genérico). De una
 * `ErrorCotizacion` usa su `codigo` contra la tabla, no su `message`, que se puede sobrescribir o
 * fabricar con `Object.create(ErrorCotizacion.prototype, …)`.
 */
export function traducirErrorCotizacion(error: unknown): string {
  try {
    if (error instanceof ErrorCotizacion) return TEXTO_POR_CODIGO.get(error.codigo) ?? MENSAJE_ERROR_GENERICO;
    const codigo = codigoConocidoDe(error);
    return codigo === null ? MENSAJE_ERROR_GENERICO : (TEXTO_POR_CODIGO.get(codigo) ?? MENSAJE_ERROR_GENERICO);
  } catch {
    return MENSAJE_ERROR_GENERICO;
  }
}

/**
 * Convierte cualquier fallo en una `ErrorCotizacion`, conservando solo el código `COT:` conocido.
 * Es total: no lanza nunca. Ante un error hostil (un `instanceof` que lanza por la trampa
 * `getPrototypeOf` de un `Proxy`, un `Proxy` revocado) el resultado es `DESCONOCIDO`.
 */
function aErrorCotizacion(error: unknown): ErrorCotizacion {
  try {
    if (error instanceof ErrorCotizacion) return error;
    return new ErrorCotizacion(codigoConocidoDe(error) ?? 'DESCONOCIDO');
  } catch {
    return new ErrorCotizacion('DESCONOCIDO');
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Verdadero solo para un UUID en forma canónica 8-4-4-4-12 (sin restringir versión ni variante).
 * No recorta: un espacio, un salto de línea, llaves, `urn:uuid:` o guiones ausentes lo invalidan.
 */
export function esUuid(valor: unknown): valor is string {
  return typeof valor === 'string' && UUID_RE.test(valor);
}

// Los mismos topes que las restricciones de la base (`char_length`).
const LIMITES = { nombre: 200, contacto: 200, email: 254, telefono: 40 } as const;

// La base la genera como `'BOR-' || nextval(...)` sobre una secuencia `bigint`: como máximo 19 dígitos.
// Sin tope, un origen comprometido podría colar referencias de longitud arbitraria.
const REFERENCIA_RE = /^BOR-[0-9]{1,19}$/;

function esReferenciaInterna(valor: unknown): valor is string {
  return typeof valor === 'string' && REFERENCIA_RE.test(valor);
}

// La lista de estados vive duplicada: el CHECK de la base (`cotizaciones_estado_check`) y
// `ESTADOS_COTIZACION`. Orden de despliegue: la regla general es aplicar la migración ANTES de
// publicar el frontend de su fase (`specs/002-admin-quotations/quickstart.md`, §3, paso 2). Única
// excepción: añadir un valor nuevo a ese CHECK (la lista actual de 5 estados es definitiva y no está
// previsto ampliarla). Entonces se publica primero un frontend que ya conoce el estado nuevo, porque
// una fila con un estado que esta lista no conoce hace fallar la página ENTERA.
function esEstadoCotizacion(valor: unknown): valor is EstadoCotizacion {
  return ESTADOS_COTIZACION.some((estado) => estado === valor);
}

/**
 * Cadena de hasta `max` caracteres. La base cuenta puntos de código (`char_length`) y JavaScript
 * unidades UTF-16: contar con `length` rechazaría un texto válido con emoji.
 */
function esTextoMax(valor: unknown, max: number): valor is string {
  if (typeof valor !== 'string') return false;
  if (valor.length <= max) return true; // los puntos de código nunca superan las unidades
  if (valor.length > max * 2) return false; // un punto de código ocupa como mucho 2 unidades
  let puntos = 0;
  for (const _punto of valor) {
    puntos += 1;
    if (puntos > max) return false;
  }
  return true;
}

function esTextoMaxONulo(valor: unknown, max: number): valor is string | null {
  return valor === null || esTextoMax(valor, max);
}

function esUuidONulo(valor: unknown): valor is string | null {
  return valor === null || esUuid(valor);
}

function diasDelMes(anio: number, mes: number): number {
  if (mes === 2) return (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0 ? 29 : 28;
  return mes === 4 || mes === 6 || mes === 9 || mes === 11 ? 30 : 31;
}

// ISO 8601 con zona horaria, como lo emite PostgREST: 2026-11-09T12:00:00.123456+00:00. La zona es `Z`
// o `±hh:mm` / `±hhmm`; los decimales son opcionales (1 a 9).
const MARCA_DE_TIEMPO_RE =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-]\d{2}:?\d{2})$/;

/**
 * Valida la forma, el calendario real y el desfase de zona de forma explícita, sin pedirle a un
 * intérprete de fechas del motor que decida: no depende de lo que acepte cada motor (30 de febrero,
 * 24:00, desfases como `+25:00`).
 */
function esMarcaDeTiempo(valor: unknown): valor is string {
  if (typeof valor !== 'string') return false;
  const partes = MARCA_DE_TIEMPO_RE.exec(valor);
  if (partes === null) return false;
  const [anio, mes, dia, hora, minuto, segundo] = partes.slice(1, 7).map(Number);
  const calendarioValido =
    mes >= 1 && mes <= 12 && dia >= 1 && dia <= diasDelMes(anio, mes) && hora <= 23 && minuto <= 59 && segundo <= 59;
  if (!calendarioValido) return false;
  // `±hh:mm` o `±hhmm`: la hora son los 2 dígitos tras el signo y el minuto, los 2 últimos.
  const desfase = partes[7];
  return desfase === 'Z' || (Number(desfase.slice(1, 3)) <= 23 && Number(desfase.slice(-2)) <= 59);
}

function esVersionDeFila(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isSafeInteger(valor) && valor >= 1;
}

function esEnteroEnRango(valor: unknown, min: number, max: number): valor is number {
  return typeof valor === 'number' && Number.isInteger(valor) && valor >= min && valor <= max;
}

/** Columnas explícitas (nunca `*`), las mismas que `CotizacionResumen`. */
const COLUMNAS_RESUMEN = 'id, referencia_interna, estado, prospecto_nombre, creado_at, row_version' as const;

/** Columnas explícitas (nunca `*`), las mismas que `Cotizacion`. */
const COLUMNAS_COTIZACION =
  'id, referencia_interna, estado, prospecto_nombre, prospecto_contacto, prospecto_email, prospecto_telefono, creado_por, creado_at, actualizado_por, actualizado_at, row_version' as const;

/** Esquema estricto de `CotizacionResumen`: `null` si la fila no lo cumple. Copia campo por campo. */
function aResumen(fila: unknown): CotizacionResumen | null {
  if (!esObjeto(fila)) return null;
  const { id, referencia_interna, estado, prospecto_nombre, creado_at, row_version } = fila;
  if (
    !esUuid(id) ||
    !esReferenciaInterna(referencia_interna) ||
    !esEstadoCotizacion(estado) ||
    !esTextoMaxONulo(prospecto_nombre, LIMITES.nombre) ||
    !esMarcaDeTiempo(creado_at) ||
    !esVersionDeFila(row_version)
  ) {
    return null;
  }
  return { id, referencia_interna, estado, prospecto_nombre, creado_at, row_version };
}

/** Esquema estricto de `Cotizacion`: `null` si la fila no lo cumple. Copia campo por campo. */
function aCotizacion(fila: unknown): Cotizacion | null {
  const resumen = aResumen(fila);
  if (resumen === null || !esObjeto(fila)) return null;
  const { prospecto_contacto, prospecto_email, prospecto_telefono, creado_por, actualizado_por, actualizado_at } = fila;
  if (
    !esTextoMaxONulo(prospecto_contacto, LIMITES.contacto) ||
    !esTextoMaxONulo(prospecto_email, LIMITES.email) ||
    !esTextoMaxONulo(prospecto_telefono, LIMITES.telefono) ||
    !esUuid(creado_por) ||
    !esUuidONulo(actualizado_por) ||
    !esMarcaDeTiempo(actualizado_at)
  ) {
    return null;
  }
  // `resumen` es una copia ya validada (no el objeto crudo del servidor): su spread no filtra claves.
  return { ...resumen, prospecto_contacto, prospecto_email, prospecto_telefono, creado_por, actualizado_por, actualizado_at };
}

interface DatosLeidos {
  /** `data` de la respuesta, sin validar. */
  datos: unknown;
  /** `status` de la respuesta, sin validar (`undefined` si no viene). */
  status: unknown;
}

/**
 * Ejecuta la consulta y devuelve sus `data` y `status` sin validar. Un solo `try/catch` cubre la
 * llamada a `consulta()`, el `await` y la lectura de `error`, `data` y `status`: un `error` de la
 * respuesta, un rechazo, una excepción síncrona o un getter hostil se convierten en
 * `ErrorCotizacion` (con el código `COT:` conocido si el `message` original lo es exactamente;
 * `DESCONOCIDO` si la propia lectura falla) y el original no se reenvía. Una respuesta que no es un
 * objeto se trata como datos inválidos. `error` se lee primero y, si existe, ni `data` ni `status`
 * se tocan.
 */
async function leerDatos(consulta: () => PromiseLike<unknown>): Promise<DatosLeidos> {
  try {
    const respuesta = await consulta();
    if (!esObjeto(respuesta)) throw new ErrorCotizacion('DATOS_INVALIDOS');
    const error = respuesta.error;
    if (error !== null && error !== undefined) throw aErrorCotizacion(error);
    return { datos: respuesta.data, status: respuesta.status };
  } catch (fallo) {
    throw aErrorCotizacion(fallo);
  }
}

/**
 * Ejecuta la validación de lo que devolvió el servidor. Las propias validaciones solo lanzan
 * `DATOS_INVALIDOS`; cualquier otra excepción (un getter hostil o un `Proxy` revocado dentro de una
 * fila) significa una respuesta ilegible y se reduce al mismo `DATOS_INVALIDOS`, sin el original.
 */
function validarRespuesta<T>(validar: () => T): T {
  try {
    return validar();
  } catch {
    throw new ErrorCotizacion('DATOS_INVALIDOS');
  }
}

/**
 * Getter nativo de `AbortSignal.prototype.aborted`, capturado una sola vez al cargar el módulo para
 * que un cambio posterior del prototipo no lo sustituya. Hace su propia comprobación de marca: lanza
 * con cualquier objeto que no sea una `AbortSignal` genuina, aunque herede de su prototipo o imite
 * sus propiedades. En el navegador también rechaza un `Proxy`; en jsdom y Node, un `Proxy` sin trampas
 * sobre una señal genuina la supera (y `fetch` del navegador lo rechazaría después). `undefined` si el
 * entorno no tiene `AbortSignal`: entonces toda señal se rechaza.
 */
function capturarLectorDeCancelacion(): ((this: unknown) => unknown) | undefined {
  try {
    if (typeof AbortSignal !== 'function') return undefined;
    const lector = Object.getOwnPropertyDescriptor(AbortSignal.prototype, 'aborted')?.get;
    return typeof lector === 'function' ? lector : undefined;
  } catch {
    return undefined;
  }
}

const LEER_CANCELACION = capturarLectorDeCancelacion();

/**
 * Estado de una `AbortSignal` genuina, leído con el getter nativo y nunca con `valor.aborted`, que una
 * propiedad propia o un prototipo cambiado podrían sombrear: `true` si está cancelada, `false` si no,
 * `null` si `valor` no es una `AbortSignal` genuina o no se puede leer (un `Proxy` con trampas o
 * revocado). Es total: no lanza nunca. No lee el motivo (`reason`).
 */
function estadoDeSenal(valor: unknown): boolean | null {
  try {
    if (LEER_CANCELACION === undefined || !(valor instanceof AbortSignal)) return null;
    const cancelada: unknown = LEER_CANCELACION.call(valor);
    return typeof cancelada === 'boolean' ? cancelada : null;
  } catch {
    return null;
  }
}

/** Verdadero para `undefined` (sin señal) o una `AbortSignal` genuina; falso para cualquier otro valor. */
function esSenalOpcional(valor: unknown): valor is AbortSignal | undefined {
  return valor === undefined || estadoDeSenal(valor) !== null;
}

/** Verdadero solo si hay señal y está cancelada. Si no se puede leer, falso: decide el código de hoy. */
function estaCancelada(signal: AbortSignal | undefined): boolean {
  return signal !== undefined && estadoDeSenal(signal) === true;
}

/**
 * Ejecuta `operacion` con cancelación. Si la señal ya está cancelada, lanza `CANCELADA` sin ejecutarla
 * (sin llamar a Supabase). Tras CUALQUIER fallo, si la señal está cancelada en ese momento el resultado
 * es `CANCELADA`; si no, el fallo que corresponda, siempre como `ErrorCotizacion`. Un éxito se devuelve
 * tal cual. Ni el error original ni el motivo de la cancelación se guardan ni se reenvían. Sin señal
 * es transparente: los fallos de `operacion` ya son `ErrorCotizacion` y `aErrorCotizacion` los devuelve
 * sin cambios.
 */
async function conCancelacion<T>(signal: AbortSignal | undefined, operacion: () => Promise<T>): Promise<T> {
  if (estaCancelada(signal)) throw new ErrorCotizacion('CANCELADA');
  try {
    return await operacion();
  } catch (fallo) {
    if (estaCancelada(signal)) throw new ErrorCotizacion('CANCELADA');
    throw aErrorCotizacion(fallo);
  }
}

export interface OpcionesListadoCotizaciones {
  /** Base 1. Por defecto 1. */
  pagina?: number;
  /** Filas por página. Por defecto `TAMANO_PAGINA_PREDETERMINADO`. */
  tamano?: number;
}

/**
 * Lee y valida los parámetros del listado. Cada propiedad de `opciones` se lee UNA sola vez y el
 * valor validado es el que se usa después (no se vuelve a leer). Si la lectura lanza (un getter
 * hostil, un `Proxy` revocado) o el valor no es válido, lanza `PARAMETROS_INVALIDOS` sin el original.
 */
function leerOpciones(opciones: OpcionesListadoCotizaciones | undefined): { pagina: number; tamano: number } {
  try {
    if (opciones !== undefined && !esObjeto(opciones)) throw new ErrorCotizacion('PARAMETROS_INVALIDOS');
    // Cada propiedad se lee una sola vez; `undefined` toma el valor por defecto, `null` no.
    const { pagina = 1, tamano = TAMANO_PAGINA_PREDETERMINADO }: { pagina?: unknown; tamano?: unknown } =
      opciones ?? {};
    if (!esEnteroEnRango(pagina, 1, PAGINA_MAXIMA) || !esEnteroEnRango(tamano, 1, TAMANO_PAGINA_MAXIMO)) {
      throw new ErrorCotizacion('PARAMETROS_INVALIDOS');
    }
    return { pagina, tamano };
  } catch {
    throw new ErrorCotizacion('PARAMETROS_INVALIDOS');
  }
}

export interface OpcionesPaginaCotizaciones extends OpcionesListadoCotizaciones {
  /** Cancela la consulta. Solo `undefined` o una `AbortSignal` genuina: otro valor es `PARAMETROS_INVALIDOS`. */
  signal?: AbortSignal;
}

/** Resultado de `listarPaginaCotizaciones`, construido nuevo en cada llamada. */
export interface PaginaCotizaciones {
  /** Como mucho `tamano` filas, ya validadas. */
  cotizaciones: CotizacionResumen[];
  /** Si existe una página siguiente que se pueda pedir. */
  haySiguiente: boolean;
}

/**
 * Como `leerOpciones`, más la señal de cancelación. Cada propiedad (`pagina`, `tamano`, `signal`) se
 * lee UNA sola vez y el valor validado es el que se usa después. Si la lectura lanza o un valor no es
 * válido, lanza `PARAMETROS_INVALIDOS` sin el original.
 */
function leerOpcionesPagina(opciones: OpcionesPaginaCotizaciones | undefined): {
  pagina: number;
  tamano: number;
  signal: AbortSignal | undefined;
} {
  try {
    if (opciones !== undefined && !esObjeto(opciones)) throw new ErrorCotizacion('PARAMETROS_INVALIDOS');
    // Cada propiedad se lee una sola vez; `undefined` toma el valor por defecto, `null` no.
    const {
      pagina = 1,
      tamano = TAMANO_PAGINA_PREDETERMINADO,
      signal,
    }: { pagina?: unknown; tamano?: unknown; signal?: unknown } = opciones ?? {};
    if (
      !esEnteroEnRango(pagina, 1, PAGINA_MAXIMA) ||
      !esEnteroEnRango(tamano, 1, TAMANO_PAGINA_MAXIMO) ||
      !esSenalOpcional(signal)
    ) {
      throw new ErrorCotizacion('PARAMETROS_INVALIDOS');
    }
    return { pagina, tamano, signal };
  } catch {
    throw new ErrorCotizacion('PARAMETROS_INVALIDOS');
  }
}

/**
 * Una sola consulta del listado: columnas explícitas, de la más reciente a la más antigua con `id`
 * como desempate estable, `filas` filas a partir de `desde`. Acepta como mucho `filas` filas y las
 * valida todas: una de más o una inválida rechaza la respuesta entera con `DATOS_INVALIDOS`. Con
 * `signal`, la entrega a supabase-js con `abortSignal`; sin ella, la consulta no cambia.
 */
async function consultarResumenes(
  desde: number,
  filas: number,
  signal: AbortSignal | undefined,
): Promise<CotizacionResumen[]> {
  const { datos } = await leerDatos(() => {
    const consulta = supabase
      .from('cotizaciones')
      .select(COLUMNAS_RESUMEN)
      .order('creado_at', { ascending: false })
      .order('id', { ascending: false })
      .range(desde, desde + filas - 1);
    return signal === undefined ? consulta : consulta.abortSignal(signal);
  });

  return validarRespuesta(() => {
    if (!Array.isArray(datos) || datos.length > filas) throw new ErrorCotizacion('DATOS_INVALIDOS');
    const resumenes: CotizacionResumen[] = [];
    for (const fila of datos) {
      // El tope se vuelve a imponer en cada vuelta: un arreglo no genuino (un `Proxy` con `length`
      // cambiante o un `Symbol.iterator` propio) puede dar más filas de las que declaró. Una de más
      // rechaza la página entera, nunca se trunca: lo devuelto jamás supera `filas`.
      if (resumenes.length >= filas) throw new ErrorCotizacion('DATOS_INVALIDOS');
      const resumen = aResumen(fila);
      // Una fila inválida rechaza la página entera: nunca se omite en silencio ni se devuelve una parte.
      if (resumen === null) throw new ErrorCotizacion('DATOS_INVALIDOS');
      resumenes.push(resumen);
    }
    return resumenes;
  });
}

/**
 * Una página del listado, de la más reciente a la más antigua. La paginación es en el servidor y
 * `id` desempata el orden para que sea estable. Pide exactamente `tamano` filas y rechaza más. Con
 * parámetros inválidos lanza `ErrorCotizacion('PARAMETROS_INVALIDOS')` sin llamar a Supabase. Para
 * saber si hay página siguiente o poder cancelar, usa `listarPaginaCotizaciones`.
 */
export async function listarCotizaciones(opciones?: OpcionesListadoCotizaciones): Promise<CotizacionResumen[]> {
  const { pagina, tamano } = leerOpciones(opciones);
  return consultarResumenes((pagina - 1) * tamano, tamano, undefined);
}

/**
 * Una página del listado (mismo orden, columnas, valores por defecto y topes que `listarCotizaciones`)
 * y si existe otra después. En la MISMA consulta pide una fila de más (`tamano + 1`): si llega, hay
 * página siguiente. Esa fila de más se valida como las demás (una inválida rechaza la página entera con
 * `DATOS_INVALIDOS`) y nunca se devuelve; más de `tamano + 1` filas también es `DATOS_INVALIDOS`.
 * `haySiguiente` es falso en `PAGINA_MAXIMA`, porque la siguiente se rechazaría como parámetro inválido.
 *
 * Orden de las comprobaciones: los parámetros (`PARAMETROS_INVALIDOS`, sin red), después la señal (ya
 * cancelada: `CANCELADA`, sin red) y por último la consulta. Un fallo con la señal cancelada es
 * `CANCELADA`; sin señal, los fallos son los mismos que en `listarCotizaciones`.
 */
export async function listarPaginaCotizaciones(opciones?: OpcionesPaginaCotizaciones): Promise<PaginaCotizaciones> {
  const { pagina, tamano, signal } = leerOpcionesPagina(opciones);
  // `desde` usa el `tamano` PEDIDO, nunca el de la consulta (`tamano + 1`), para que las páginas no se
  // solapen. Con los topes ya validados, `desde` ≤ (10 000 − 1) × 100 = 999 900 y la última fila pedida,
  // `desde + tamano`, ≤ 1 000 000: enteros seguros, sin desborde posible.
  const desde = (pagina - 1) * tamano;
  return conCancelacion(signal, async () => {
    const filas = await consultarResumenes(desde, tamano + 1, signal);
    return {
      cotizaciones: filas.slice(0, tamano),
      haySiguiente: filas.length > tamano && pagina < PAGINA_MAXIMA,
    };
  });
}

export interface OpcionesObtenerCotizacion {
  /** Cancela la consulta. Solo `undefined` o una `AbortSignal` genuina: otro valor es `PARAMETROS_INVALIDOS`. */
  signal?: AbortSignal;
}

/**
 * Lee y valida las opciones de `obtenerCotizacion`. `signal` se lee UNA sola vez. Si `opciones` no es
 * un objeto (también `null`), la lectura lanza o la señal no es válida, lanza `PARAMETROS_INVALIDOS`
 * sin el original.
 */
function leerOpcionesObtener(opciones: unknown): AbortSignal | undefined {
  try {
    if (!esObjeto(opciones)) throw new ErrorCotizacion('PARAMETROS_INVALIDOS');
    const { signal }: { signal?: unknown } = opciones;
    if (!esSenalOpcional(signal)) throw new ErrorCotizacion('PARAMETROS_INVALIDOS');
    return signal;
  } catch {
    throw new ErrorCotizacion('PARAMETROS_INVALIDOS');
  }
}

/**
 * Una cotización por id. Devuelve `null` si `id` no es un UUID (sin llamar a Supabase) y también
 * si no hay fila: RLS la oculta igual que si no existiera, y esta capa no distingue los casos.
 *
 * «Sin fila» es solo la respuesta `data: null` con `status === 200` (comparación estricta), que es
 * lo que el cliente da para 0 filas legítimas. Con `data: null` y cualquier otro `status` (un 204,
 * un 404 que el cliente reescribe como 204, un `status` ausente o no numérico) la respuesta no tiene
 * cuerpo y NO se toma por «no encontrada»: lanza `DATOS_INVALIDOS`, igual que el listado. Un 200 con
 * cuerpo vacío es indistinguible de 0 filas y se acepta como tal.
 *
 * `opciones` es aditivo: llamar solo con `id` se comporta igual que antes de existir. Su valor por
 * defecto mantiene `obtenerCotizacion.length` en 1. Orden de las comprobaciones: `opciones`
 * (`PARAMETROS_INVALIDOS`, sin red), después el `id` (`null`, porque no hay consulta que cancelar),
 * después la señal (ya cancelada: `CANCELADA`, sin red) y por último la consulta. Un fallo con la
 * señal cancelada es `CANCELADA`.
 */
export async function obtenerCotizacion(
  id: string,
  opciones: OpcionesObtenerCotizacion = {},
): Promise<Cotizacion | null> {
  const signal = leerOpcionesObtener(opciones);
  if (!esUuid(id)) return null;

  return conCancelacion(signal, async () => {
    const { datos: dato, status } = await leerDatos(() => {
      const filtro = supabase.from('cotizaciones').select(COLUMNAS_COTIZACION).eq('id', id);
      // `abortSignal` va antes de `maybeSingle()`, que devuelve un constructor sin ese método.
      return (signal === undefined ? filtro : filtro.abortSignal(signal)).maybeSingle();
    });
    if (dato === null) {
      if (status === 200) return null;
      throw new ErrorCotizacion('DATOS_INVALIDOS');
    }

    return validarRespuesta(() => {
      const cotizacion = aCotizacion(dato);
      // La fila devuelta debe ser la pedida: otra distinta es una respuesta inválida, no «no encontrada».
      if (cotizacion === null || cotizacion.id.toLowerCase() !== id.toLowerCase()) {
        throw new ErrorCotizacion('DATOS_INVALIDOS');
      }
      return cotizacion;
    });
  });
}
