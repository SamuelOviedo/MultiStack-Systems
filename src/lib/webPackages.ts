/**
 * Paquetes comerciales de las páginas web: fuente única de ids, nombres, precios y entregables.
 * Los usan la landing /paginas-web y el flujo de solicitudes, que por eso no importa el contenido de la
 * landing. Los precios solo se escriben aquí.
 */

export interface PaginasWebPackage {
  readonly id: "estandar" | "combo-emprendedor";
  readonly name: string;
  /** Precio en lempiras, sin formato: 3500. */
  readonly priceLempiras: number;
  /** Una frase: qué hace distinto a este paquete del otro. */
  readonly summary: string;
  /** Encabezado de la lista de `extras`; solo cuando hay extras. */
  readonly extrasTitle?: string;
  /** Entregables propios del paquete, sobre lo que incluyen los dos. Vacío si no hay. */
  readonly extras: readonly string[];
}

/** Términos comerciales aprobados por el propietario. Los precios solo se escriben aquí. */
export const PACKAGES: readonly PaginasWebPackage[] = [
  {
    id: "estandar",
    name: "Plan Estándar",
    priceLempiras: 3500,
    summary: "Tú aportas tu logo.",
    extras: [],
  },
  {
    id: "combo-emprendedor",
    name: "Combo Emprendedor",
    priceLempiras: 3950,
    summary: "Incluye el diseño de tu logo.",
    extrasTitle: "Tu logo profesional incluye",
    extras: [
      "Diseño de logotipo personalizado",
      "Variaciones de color del logotipo",
      "Archivos PNG, JPG y PDF",
      "Archivo editable",
      "Paleta oficial de colores",
      "Tipografías utilizadas",
      "Alta resolución para redes sociales y medios físicos",
    ],
  },
];

/** 3500 -> «L 3,500»; 3950 -> «L 3,950». */
export const lempiras = (amount: number): string => `L ${amount.toLocaleString("en-US")}`;

/** 3500 -> «3500 lempiras»: sin coma, para que ninguna voz lo lea como decimal. */
export const lempirasSpoken = (amount: number): string => `${amount} lempiras`;
