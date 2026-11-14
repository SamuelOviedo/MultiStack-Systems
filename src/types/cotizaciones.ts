/**
 * Tipos del módulo de Cotizaciones (solo administrador), fase F1.
 *
 * Son la forma del dominio del módulo y estrechan los tipos generados en
 * `src/integrations/supabase/types.ts`, que es la fuente de verdad del esquema
 * (se regenera y no se edita a mano). La base entrega `estado`, `tipo` y
 * `detalle` como `string` o `Json`; aquí se cierran a uniones y listas
 * permitidas que el acceso a datos debe validar en tiempo de ejecución.
 *
 * El acceso a datos pasa por `src/lib/cotizaciones.ts`: los componentes no
 * consultan Supabase directamente.
 *
 * Los eventos no llevan datos personales: el nombre, el correo y el teléfono del
 * prospecto viven solo en la fila protegida por RLS.
 */

/**
 * Estados de una cotización. Son los cinco valores de la restricción
 * `cotizaciones_estado_check`; el tipo se deriva de esta constante para que no
 * se desincronicen. «Vencida», «sustituida» y «archivada» no son estados.
 */
export const ESTADOS_COTIZACION = [
  'borrador',
  'emitida',
  'aceptada_firmada',
  'rechazada',
  'cancelada',
] as const;

export type EstadoCotizacion = (typeof ESTADOS_COTIZACION)[number];

/**
 * Fila completa de `cotizaciones` tal como la devuelve PostgREST en F1.
 * uuid y timestamptz llegan como `string` (este último en ISO 8601). Las
 * fases siguientes añaden columnas (contenido, totales, numeración) con su
 * propia migración.
 */
export interface Cotizacion {
  id: string;
  /** `BOR-n`, asignada por el trigger de alta. No es el número de cotización. */
  referencia_interna: string;
  estado: EstadoCotizacion;
  prospecto_nombre: string | null;
  prospecto_contacto: string | null;
  prospecto_email: string | null;
  prospecto_telefono: string | null;
  creado_por: string;
  creado_at: string;
  /** `null` cuando el cambio no trae sesión (mantenimiento). */
  actualizado_por: string | null;
  actualizado_at: string;
  row_version: number;
}

/** Lo que muestra el listado de cotizaciones. */
export type CotizacionResumen = Pick<
  Cotizacion,
  'id' | 'referencia_interna' | 'estado' | 'prospecto_nombre' | 'creado_at' | 'row_version'
>;

/**
 * Tipos de evento de auditoría. En F1 solo existe `'creada'`; cada fase amplía
 * esta lista junto con el CHECK `cotizacion_eventos_tipo_check` de la base.
 */
export type TipoEventoCotizacion = 'creada';

/**
 * Fila de `cotizacion_eventos`. Solo se añade, nunca se modifica ni se borra.
 */
export interface CotizacionEvento {
  /** Identidad bigint: PostgREST la devuelve como número JSON. */
  id: number;
  cotizacion_id: string;
  tipo: TipoEventoCotizacion;
  actor: string;
  ocurrido_at: string;
  motivo: string | null;
  /**
   * En F1 el esquema estricto de la base exige `{}` para `'creada'`, por eso el
   * tipo es un objeto sin claves. Cada fase que añada tipos de evento lo
   * sustituirá por una unión discriminada por `tipo`.
   */
  detalle: Record<string, never>;
}
