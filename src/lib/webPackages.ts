/**
 * Paquetes comerciales de las páginas web: fuente única de ids, nombres, precios y entregables. Los precios solo se
 * escriben aquí.
 *
 * - SITE_PLANS: todos los paquetes que se pueden solicitar, en el orden de pantalla del sitio. Es también la lista
 *   blanca del flujo de solicitudes (packageIntent).
 * - PACKAGES: solo los de la landing de Ads /paginas-web (Estándar y Combo), en su orden. Esa landing y el flujo de
 *   solicitudes no importan el contenido del sitio.
 * - PLAN_COMPARISON y PAYMENT_TERMS: la tabla comparativa y los términos de pago del sitio.
 */

export interface PaginasWebPackage {
  readonly id: "estandar" | "intermedio" | "combo-emprendedor";
  readonly name: string;
  /** Precio en lempiras, sin formato: 3500. */
  readonly priceLempiras: number;
  /** Frase de la tarjeta del sitio, bajo el nombre. */
  readonly tagline: string;
  /** Insignia de la tarjeta («Más elegido»); solo si tiene. */
  readonly badge?: string;
  /** Tarjeta destacada del sitio: una sola, al centro. */
  readonly highlight?: boolean;
  /** Plazo de entrega en días hábiles, desde que el cliente entrega su material. */
  readonly deliveryBusinessDays: number;
  readonly revisionRounds: number;
  /** Lo que incluye, en el orden de la tarjeta del sitio. */
  readonly features: readonly string[];
  /** Una frase: qué hace distinto a este paquete de los demás. La usan /paginas-web y el modo paquete del portal. */
  readonly summary: string;
  /** Encabezado de la lista de `extras`; solo cuando hay extras. */
  readonly extrasTitle?: string;
  /** Entregables propios del paquete, sobre lo que incluye el Plan Estándar. Vacío si no hay. */
  readonly extras: readonly string[];
}

/** Lo que el Intermedio suma al Estándar: abre su tarjeta y es la lista de sus extras. */
const INTERMEDIO_EXTRAS: readonly string[] = [
  "Hasta 8 páginas independientes",
  "Blog o sección de noticias",
  "Posicionamiento local en Google",
  "Configuración de tu perfil en Google Maps",
  "Estadísticas de visitas",
  "Catálogo con pedidos por WhatsApp",
  "Correo con tu dominio",
];

/**
 * Términos comerciales aprobados por el propietario, en el orden de pantalla del sitio: el plan destacado va al
 * centro. Todos se pueden solicitar.
 */
export const SITE_PLANS: readonly PaginasWebPackage[] = [
  {
    id: "estandar",
    name: "Plan Estándar",
    priceLempiras: 3500,
    tagline: "Tu página de una sola sección, lista para vender. Tú aportas tu logo.",
    deliveryBusinessDays: 10,
    revisionRounds: 2,
    features: [
      "Una página con hasta 6 secciones",
      "Diseño propio en React, sin plantillas",
      "Adaptada al celular",
      "Formulario de contacto",
      "Botón de WhatsApp y redes sociales",
      "Ubicación con Google Maps",
      "Velocidad medida con Lighthouse",
      "Dominio y hosting por 12 meses",
      "2 rondas de revisión",
    ],
    summary: "Tú aportas tu logo.",
    extras: [],
  },
  {
    id: "intermedio",
    name: "Plan Intermedio",
    priceLempiras: 7500,
    tagline: "Un sitio completo para negocios que quieren crecer y aparecer en Google.",
    badge: "Más elegido",
    highlight: true,
    deliveryBusinessDays: 15,
    revisionRounds: 3,
    features: [...INTERMEDIO_EXTRAS, "Dominio y hosting por 12 meses", "3 rondas de revisión"],
    summary: "Hasta 8 páginas, con blog y posicionamiento local en Google.",
    extrasTitle: "Tu sitio completo incluye",
    extras: INTERMEDIO_EXTRAS,
  },
  {
    id: "combo-emprendedor",
    name: "Combo Emprendedor",
    priceLempiras: 3950,
    tagline: "Todo el Plan Estándar más tu logo profesional diseñado por LAU Graphic.",
    badge: "Promoción del año",
    deliveryBusinessDays: 10,
    revisionRounds: 2,
    features: [
      "Todo lo del Plan Estándar",
      "Logo profesional por LAU Graphic",
      "Variaciones de color del logo",
      "Archivos PNG, JPG, PDF y editable",
      "Paleta oficial y tipografías",
      "Alta resolución para redes e impresos",
    ],
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

/** Los paquetes que muestra /paginas-web, en su orden. El Intermedio no está en esa landing. */
const PAGINAS_WEB_PACKAGE_IDS: readonly PaginasWebPackage["id"][] = ["estandar", "combo-emprendedor"];

/** Paquetes de la landing /paginas-web: los mismos objetos de SITE_PLANS, solo Estándar y Combo y en este orden. */
export const PACKAGES: readonly PaginasWebPackage[] = PAGINAS_WEB_PACKAGE_IDS.map((id) => {
  const pkg = SITE_PLANS.find((plan) => plan.id === id);
  if (!pkg) throw new Error(`Falta el paquete «${id}» en SITE_PLANS.`);
  return pkg;
});

/** Forma de pago de todos los planes: la mitad para arrancar y la otra mitad al aprobar la entrega. */
export const PAYMENT_TERMS = { upfrontPercent: 50, onDeliveryPercent: 50 } as const;

/** Una celda de la comparación: incluido (true), no incluido (false) o un valor («Hasta 8»). */
export type PlanComparisonValue = boolean | string;

export interface PlanComparisonRow {
  readonly label: string;
  /** Un valor por plan de SITE_PLANS: el sitio pinta las columnas en el orden de SITE_PLANS. */
  readonly values: Readonly<Record<PaginasWebPackage["id"], PlanComparisonValue>>;
}

/** El mismo valor en todos los planes. */
const everyPlan = (value: PlanComparisonValue): PlanComparisonRow["values"] => ({
  estandar: value,
  intermedio: value,
  "combo-emprendedor": value,
});

/** Un valor por plan, calculado de sus datos. */
const perPlan = (pick: (pkg: PaginasWebPackage) => PlanComparisonValue): PlanComparisonRow["values"] =>
  Object.fromEntries(SITE_PLANS.map((pkg) => [pkg.id, pick(pkg)])) as PlanComparisonRow["values"];

/** Tabla «Comparación completa» del sitio: solo filas que al menos un plan incluye. */
export const PLAN_COMPARISON: readonly PlanComparisonRow[] = [
  { label: "Páginas", values: { estandar: "1 (6 secciones)", intermedio: "Hasta 8", "combo-emprendedor": "1 (6 secciones)" } },
  { label: "Logo profesional (LAU Graphic)", values: { estandar: false, intermedio: false, "combo-emprendedor": true } },
  { label: "Adaptada al celular", values: everyPlan(true) },
  { label: "WhatsApp, redes y Google Maps", values: everyPlan(true) },
  { label: "Dominio y hosting 12 meses", values: everyPlan(true) },
  { label: "Blog o noticias", values: { estandar: false, intermedio: true, "combo-emprendedor": false } },
  { label: "Posicionamiento local en Google", values: { estandar: false, intermedio: true, "combo-emprendedor": false } },
  { label: "Perfil de Google Maps configurado", values: { estandar: false, intermedio: true, "combo-emprendedor": false } },
  { label: "Estadísticas de visitas", values: { estandar: false, intermedio: true, "combo-emprendedor": false } },
  { label: "Catálogo con pedidos por WhatsApp", values: { estandar: false, intermedio: true, "combo-emprendedor": false } },
  { label: "Correo con tu dominio", values: { estandar: false, intermedio: true, "combo-emprendedor": false } },
  { label: "Rondas de revisión", values: perPlan((pkg) => String(pkg.revisionRounds)) },
  { label: "Entrega (días hábiles)", values: perPlan((pkg) => String(pkg.deliveryBusinessDays)) },
];

/** 3500 -> «L 3,500»; 3950 -> «L 3,950». */
export const lempiras = (amount: number): string => `L ${amount.toLocaleString("en-US")}`;

/** 3500 -> «3500 lempiras»: sin coma, para que ninguna voz lo lea como decimal. */
export const lempirasSpoken = (amount: number): string => `${amount} lempiras`;
