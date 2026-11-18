/**
 * Contenido del sitio público rediseñado: home (`/`), planes, servicios y contacto, más la barra, el pie y los
 * metas de cada vista. Es la única fuente del texto: los componentes de `src/components/site/*` lo pintan y no
 * escriben copy propio. `paginasWebContent.ts` sigue siendo el de la landing de Ads `/paginas-web`; este módulo solo importa de él las
 * constantes de negocio.
 *
 * Reglas del módulo
 * - El texto sale literal del diseño de referencia, que el propietario fijó como fuente de verdad. Las únicas
 *   desviaciones son: el nombre de producto TechOn (de `products.ts`), los dos enlaces legales del pie (no hay
 *   vista de políticas) y el Plan Intermedio con «Hasta 8» páginas (esa está en `webPackages.ts`, no aquí). Las
 *   de este archivo llevan su comentario `Desviación:`. Los números salen de constantes, pero el texto resultante es idéntico al original.
 * - Todo número sale de una constante: precios de SITE_PLANS, meses de dominio y hosting, días de entrega y
 *   horas de respuesta de COMMITMENTS, teléfono y WhatsApp de CHANNELS, porcentajes de PAYMENT_TERMS. Nada se
 *   teclea a mano, para que un cambio en la fuente cambie todo el sitio.
 * - Sin testimonios, clientes ni cifras inventadas. LAU Graphic es el único proyecto externo y el propietario
 *   confirmó el permiso para mostrarlo.
 * - Sin JSX ni estilos. Los iconos van como claves (`icon`), el componente decide cuál dibuja.
 * - Los eyebrows de sección (`tag`) van sin el prefijo «>_ »: SectionTitle lo antepone. Los que ya son
 *   comentarios de código («// sitio», «// contacto») van completos.
 * - Las tarjetas de planes y las filas de la tabla comparativa salen de `src/lib/webPackages.ts`, no de aquí.
 *   El formulario de contacto es `src/components/marketing/ContactForm.tsx`: sus textos no están aquí.
 */

import { getProduct } from "@/lib/products";
import { buildViewMetas, type ViewMetaCopy } from "@/lib/routeMeta";
import {
  lempiras,
  lempirasSpoken,
  PAYMENT_TERMS,
  SITE_PLANS,
  type PaginasWebPackage,
} from "@/lib/webPackages";
import {
  CHANNELS,
  COMMITMENTS,
  type Channels,
  type Commitments,
  type PaginasWebFact,
  type PaginasWebLink,
} from "@/pages/marketing/paginasWebContent";

/** Rutas internas del sitio. Ningún dominio escrito a mano: son rutas del propio SPA. */
export const SITE_PATHS = {
  home: "/",
  planes: "/planes",
  servicios: "/servicios",
  contacto: "/contacto",
  /** El panel del cliente (ruta interna protegida). */
  panel: "/solicitudes",
  privacy: "/politica-de-privacidad",
  terms: "/terminos-del-servicio",
} as const;

/** Forma de pago: la misma de PAYMENT_TERMS, sin fijar los valores. */
export interface PaymentTerms {
  readonly upfrontPercent: number;
  readonly onDeliveryPercent: number;
}

/** Proyecto externo que se muestra en el portafolio. La URL de LAU Graphic es la única externa nueva. */
const LAU_GRAPHIC_URL = "https://www.laugraphic.com";

const NEW_TAB_NOTICE = "(se abre en una pestaña nueva)";

/**
 * Enlace de WhatsApp con el mensaje prellenado: `https://wa.me/<número>?text=<mensaje codificado>`.
 * El número sale de CHANNELS.whatsappUrl.
 */
export function whatsappMessageUrl(message: string, baseUrl: string = CHANNELS.whatsappUrl): string {
  return `${baseUrl}?text=${encodeURIComponent(message)}`;
}

/** «Plan Estándar» -> «Estándar»; «Combo Emprendedor» se queda igual. Nombre corto del botón y de la tabla. */
export const shortPlanName = (name: string): string => name.replace("Plan ", "");

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

/** Metas de cada vista. Su fuente es `src/lib/routeMeta.ts` (ahí también viven los de index.html). */
export interface SiteMeta {
  readonly home: ViewMetaCopy;
  readonly planes: ViewMetaCopy;
  readonly servicios: ViewMetaCopy;
  readonly contacto: ViewMetaCopy;
}

export interface SiteNav {
  /** Nombre accesible del isotipo, que lleva a la home. */
  readonly homeLabel: string;
  readonly items: readonly PaginasWebLink[];
  /** Nombre accesible del botón del menú móvil. */
  readonly menuLabel: string;
  /** «[ mi panel ]»: ruta interna del panel. */
  readonly panel: PaginasWebLink;
  /** «Cotizar mi web»: lleva a los planes. */
  readonly cta: PaginasWebLink;
}

export interface SiteFooter {
  /** Texto alternativo del logotipo. */
  readonly logoAlt: string;
  readonly description: string;
  /** «// sitio». */
  readonly siteLabel: string;
  readonly siteLinks: readonly PaginasWebLink[];
  /** «// contacto». */
  readonly contactLabel: string;
  readonly whatsapp: PaginasWebLink;
  readonly phone: PaginasWebLink;
  /** Línea de ubicación, sin enlace. */
  readonly location: string;
  readonly copyright: (year: number) => string;
}

export interface SiteHeroTitle {
  readonly pages: string;
  readonly web: string;
  readonly forWord: string;
  readonly businesses: string;
  readonly place: string;
  /** El H1 completo en texto plano, para lectores de pantalla (las píldoras del titular son decorativas). */
  readonly plainText: string;
}

export interface SiteHero {
  /** Insignia con efecto de máquina de escribir; el texto completo también va a los lectores de pantalla. */
  readonly badge: string;
  readonly title: SiteHeroTitle;
  /** Rótulos de las capturas que alternan en la primera píldora. Son decorativos. */
  readonly projectPills: readonly string[];
  /** Rótulos de las funciones que alternan en la segunda píldora. Son decorativos. */
  readonly featurePills: readonly string[];
  readonly subtitle: string;
  /** «Ver planes». */
  readonly primaryCta: PaginasWebLink;
  /** WhatsApp con el mensaje prellenado. */
  readonly secondaryCta: PaginasWebLink;
  /** Desde, dominio y hosting, y entrega. */
  readonly facts: readonly PaginasWebFact[];
}

export interface SiteBentoService {
  readonly id: "web" | "techon" | "ia" | "tools";
  /** Etiqueta en forma de llamada de código: `web.build()`. */
  readonly code: string;
  readonly title: string;
  readonly text: string;
}

export type SiteTerminalLineType = "cmd" | "ok" | "info" | "url";

export interface SiteTerminalLine {
  readonly type: SiteTerminalLineType;
  readonly text: string;
}

export interface SiteChatMessage {
  readonly from: "cliente" | "ia";
  readonly text: string;
}

export type SiteStackId = "react" | "typescript" | "tailwind" | "vite" | "lighthouse" | "whatsapp" | "maps" | "ia";

export interface SiteStackItem {
  readonly id: SiteStackId;
  readonly name: string;
  /** Versión mayor, sin «v»: el componente la antepone. Solo las tecnologías con versión propia. */
  readonly version?: string;
  readonly description: string;
}

export interface SiteBento {
  /** Eyebrow sin «>_ ». */
  readonly tag: string;
  readonly title: string;
  readonly text: string;
  readonly services: readonly SiteBentoService[];
  readonly terminal: {
    /** Título de la ventana de la terminal. */
    readonly windowTitle: string;
    readonly lines: readonly SiteTerminalLine[];
  };
  readonly chat: {
    readonly assistantName: string;
    /** Rótulo «ejemplo»: la conversación es una muestra, no un cliente real. */
    readonly exampleLabel: string;
    readonly messages: readonly SiteChatMessage[];
  };
  /** Chips de soporte técnico. */
  readonly supportChips: readonly string[];
  /** Pie de la gráfica de muestra de las herramientas a medida. */
  readonly reportCaption: string;
  readonly stack: {
    readonly title: string;
    readonly code: string;
    /** Ayuda que se ve mientras no hay una tecnología activa. */
    readonly help: string;
    readonly items: readonly SiteStackItem[];
  };
}

/** Bloque de planes de la home. Las tarjetas salen de SITE_PLANS, no de este objeto. */
export interface SiteHomePlans {
  readonly tag: string;
  readonly title: string;
  readonly text: string;
  readonly note: string;
  /** «Compara todo lo que incluye cada plan →», lleva a `/planes`. */
  readonly compareLink: PaginasWebLink;
}

export interface SitePortfolio {
  readonly tag: string;
  readonly title: string;
  readonly project: {
    readonly name: string;
    /** Tipo de negocio, en la etiqueta sobre el nombre. */
    readonly kind: string;
    readonly description: string;
    /** Texto alternativo de la captura. */
    readonly imageAlt: string;
    /** Dominio que se ve en la barra del navegador de la maqueta. */
    readonly hostLabel: string;
    /** «Visitar sitio»: externo, se abre en una pestaña nueva. */
    readonly link: PaginasWebLink;
  };
}

export type SiteReasonIcon = "cpu" | "gauge" | "map-pin" | "users" | "shield-check";

export interface SiteReason {
  readonly icon: SiteReasonIcon;
  readonly title: string;
  readonly text: string;
}

export interface SiteStep {
  /** «01», «02»… */
  readonly number: string;
  readonly title: string;
  readonly text: string;
}

export interface SiteWhy {
  readonly tag: string;
  readonly title: string;
  readonly reasons: readonly SiteReason[];
  readonly steps: readonly SiteStep[];
}

export interface SitePhase {
  readonly name: string;
  readonly text: string;
}

export interface SiteTracker {
  readonly tag: string;
  readonly title: string;
  readonly text: string;
  /** Los dos pagos: valor y cuándo. */
  readonly payments: readonly { readonly value: string; readonly label: string }[];
  /** «Entrar a mi panel»: ruta interna del panel. */
  readonly cta: PaginasWebLink;
  readonly ticket: {
    /** Ticket de ejemplo de la maqueta: no es un cliente real. */
    readonly label: string;
    readonly status: string;
  };
  readonly phases: readonly SitePhase[];
  /** Índice (desde 0) de la fase en curso: las anteriores salen hechas y las siguientes pendientes. */
  readonly currentPhaseIndex: number;
  /** Estado de cada fase para lectores de pantalla: la marca visual (✓, número, brillo) no lo dice con texto. */
  readonly phaseStatus: { readonly done: string; readonly current: string; readonly pending: string };
  readonly update: {
    readonly label: string;
    readonly text: string;
  };
}

/** Textos sueltos de las tarjetas de planes. Los datos de cada tarjeta son de SITE_PLANS. */
export interface SitePlanCardText {
  /** «Solicitar Estándar»: el nombre del plan va sin «Plan». */
  readonly requestLabel: (planName: string) => string;
  /** «entrega: 10 días hábiles · 50% al iniciar, 50% al entregar». */
  readonly deliveryLine: (deliveryBusinessDays: number) => string;
}

export interface SitePlansView {
  readonly tag: string;
  readonly title: string;
  readonly text: string;
  readonly comparison: {
    /** «Comparación completa». */
    readonly title: string;
    /** Cabecera de la primera columna de la tabla. */
    readonly featureHeader: string;
    /** Texto accesible de una celda con ✓: el icono es decorativo y no lo dice. */
    readonly included: string;
    /** Texto accesible de una celda con —. */
    readonly notIncluded: string;
  };
}

export interface SiteServiceItem {
  readonly id: SiteBentoService["id"];
  readonly code: string;
  readonly title: string;
  readonly price: string;
  /** Los 4 elementos del servicio. */
  readonly items: readonly string[];
  /** «Consultar»: abre WhatsApp con el mensaje prellenado. */
  readonly cta: PaginasWebLink;
}

export interface SiteServicesView {
  readonly tag: string;
  readonly title: string;
  readonly text: string;
  readonly items: readonly SiteServiceItem[];
}

/** La vista de contacto. El formulario es ContactForm; aquí van el encabezado y los otros canales. */
export interface SiteContactView {
  /** «// contacto». */
  readonly eyebrow: string;
  /** Su texto es el H1 de la vista. */
  readonly title: string;
  readonly intro: string;
  readonly alternativesLabel: string;
  readonly whatsapp: PaginasWebLink;
  readonly phone: PaginasWebLink;
}

export interface SiteContent {
  readonly meta: SiteMeta;
  readonly nav: SiteNav;
  readonly footer: SiteFooter;
  readonly hero: SiteHero;
  readonly bento: SiteBento;
  readonly homePlans: SiteHomePlans;
  readonly portfolio: SitePortfolio;
  readonly why: SiteWhy;
  readonly tracker: SiteTracker;
  readonly planCard: SitePlanCardText;
  readonly plansView: SitePlansView;
  readonly servicesView: SiteServicesView;
  readonly contactView: SiteContactView;
}

// ---------------------------------------------------------------------------
// Ayudas
// ---------------------------------------------------------------------------

/** (12, "mes", "meses") -> «12 meses»; con 1 usa el singular. */
const count = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

function externalLink(label: string, href: string): PaginasWebLink {
  return { label, href, ariaLabel: `${label} ${NEW_TAB_NOTICE}`, external: true };
}

// ---------------------------------------------------------------------------
// Construcción
// ---------------------------------------------------------------------------

/**
 * Existe como función para poder probar que cada número del texto sale de las constantes: se pasan valores
 * distintos y no debe quedar ninguno de los anteriores.
 */
export function buildSiteContent(
  commitments: Commitments,
  plans: readonly PaginasWebPackage[],
  channels: Channels,
  paymentTerms: PaymentTerms,
): SiteContent {
  const techon = getProduct("techon");
  const upfront = `${paymentTerms.upfrontPercent}%`;
  const onDelivery = `${paymentTerms.onDeliveryPercent}%`;
  const lowest = Math.min(...plans.map((plan) => plan.priceLempiras));
  const months = count(commitments.domainHostingMonths, "mes", "meses");
  const days = commitments.deliveryBusinessDays;
  const hoursLong = count(commitments.responseBusinessHours, "hora hábil", "horas hábiles");
  const hoursShort = count(commitments.responseBusinessHours, "h hábil", "h hábiles");

  // El plan que el terminal de ejemplo «crea» es el destacado de la tarjeta central; si no hay, el primero.
  const terminalPlan = plans.find((plan) => plan.highlight) ?? plans[0];

  const whatsappHero = externalLink(
    "Escríbenos por WhatsApp",
    whatsappMessageUrl("Hola, MultiStack. Quiero una página web.", channels.whatsappUrl),
  );
  const whatsappChannel = externalLink("Escríbenos por WhatsApp", channels.whatsappUrl);
  const phoneLink: PaginasWebLink = {
    label: `Llama al ${channels.phoneDisplay}`,
    href: channels.phoneHref,
  };

  // Los cuatro servicios: la home (bento) y la vista /servicios comparten código y título.
  const serviceCodes = {
    web: "web.build()",
    techon: `${techon.slug}.support()`,
    ia: "ai.agent()",
    tools: "tools.custom()",
  } as const;
  const serviceTitles = {
    web: "Páginas web",
    techon: `${techon.name} · Soporte técnico`,
    ia: "Productos con IA",
    tools: "Herramientas a medida",
  } as const;

  const consultCta = (title: string): PaginasWebLink => ({
    label: "Consultar",
    href: whatsappMessageUrl(`Hola, MultiStack. Quiero información sobre ${title}.`, channels.whatsappUrl),
    ariaLabel: `Consultar ${title} ${NEW_TAB_NOTICE}`,
    external: true,
  });

  return {
    meta: buildViewMetas({
      plans,
      techonName: techon.name,
      phoneDisplay: channels.phoneDisplay,
      responseBusinessHours: commitments.responseBusinessHours,
    }),

    nav: {
      homeLabel: "MultiStack Systems, ir al inicio",
      items: [
        { label: "Inicio", href: SITE_PATHS.home },
        { label: "Planes", href: SITE_PATHS.planes },
        { label: "Servicios", href: SITE_PATHS.servicios },
        { label: "Contacto", href: SITE_PATHS.contacto },
      ],
      menuLabel: "Abrir menú",
      panel: { label: "[ mi panel ]", href: SITE_PATHS.panel },
      cta: { label: "Cotizar mi web", href: SITE_PATHS.planes },
    },

    footer: {
      logoAlt: "MultiStack Systems",
      description: `Soluciones tecnológicas con código propio. Hecho en ${channels.location}.`,
      siteLabel: "// sitio",
      // Desviación: el diseño de referencia traía un solo enlace «Políticas». El propietario decidió dos enlaces
      // y que no exista la vista /politicas: la política de privacidad v1.2 vigente no se toca.
      siteLinks: [
        { label: "Planes", href: SITE_PATHS.planes },
        { label: "Servicios", href: SITE_PATHS.servicios },
        { label: "Contacto", href: SITE_PATHS.contacto },
        { label: "Política de privacidad", href: SITE_PATHS.privacy },
        { label: "Términos del servicio", href: SITE_PATHS.terms },
      ],
      contactLabel: "// contacto",
      whatsapp: externalLink("WhatsApp", channels.whatsappUrl),
      phone: { label: channels.phoneDisplay, href: channels.phoneHref },
      location: "Siguatepeque, Honduras",
      copyright: (year) => `© ${year} MultiStack Systems. Todos los derechos reservados.`,
    },

    hero: {
      badge: "// hecho en Honduras, desde Siguatepeque",
      title: {
        pages: "Páginas",
        web: "web",
        forWord: "para",
        businesses: "negocios",
        place: "en Honduras",
        plainText: "Páginas web para negocios en Honduras",
      },
      projectPills: ["LAU Graphic, inicio", "LAU Graphic, precios", "MultiStack, servicios"],
      featurePills: ["Celular", "WhatsApp", "Maps", "Rápida"],
      subtitle:
        "Programamos tu sitio con código propio en React, sin plantillas. Rápido, adaptado al celular y listo para traerte clientes.",
      primaryCta: { label: "Ver planes", href: SITE_PATHS.planes },
      secondaryCta: whatsappHero,
      facts: [
        { value: lempiras(lowest), valueSpoken: lempirasSpoken(lowest), label: "desde" },
        { value: months, label: "dominio y hosting" },
        {
          value: count(days, "día", "días"),
          label: `${days === 1 ? "hábil" : "hábiles"} de entrega`,
        },
      ],
    },

    bento: {
      tag: "servicios",
      title: "Un stack completo para tu negocio",
      text: "Empezamos por tu página web y crecemos contigo con soporte, IA y herramientas propias.",
      services: [
        {
          id: "web",
          code: serviceCodes.web,
          title: serviceTitles.web,
          text: "Landings, sitios corporativos y catálogos programados con código propio. Rápidos, seguros y listos para Google.",
        },
        {
          id: "techon",
          code: serviceCodes.techon,
          // Desviación: el original escribía mal el nombre del producto; el nombre sale de products.ts.
          title: serviceTitles.techon,
          text: "Mantenimiento, configuración de equipos, redes y correos. Te ayudamos a que tu tecnología no te detenga.",
        },
        {
          id: "ia",
          code: serviceCodes.ia,
          title: serviceTitles.ia,
          text: "Agentes que responden a tus clientes, chatbots para tu web y automatizaciones que ahorran horas de trabajo.",
        },
        {
          id: "tools",
          code: serviceCodes.tools,
          title: serviceTitles.tools,
          text: "Sistemas internos, inventarios, reportes y paneles hechos para cómo trabaja tu negocio.",
        },
      ],
      terminal: {
        windowTitle: "deploy.sh",
        lines: [
          { type: "cmd", text: `multistack nuevo --plan ${terminalPlan?.id ?? ""}` },
          { type: "info", text: "Diseño propio, sin plantillas…" },
          { type: "ok", text: "Adaptado al celular" },
          { type: "ok", text: "WhatsApp y Google Maps conectados" },
          { type: "cmd", text: "bun run build" },
          { type: "ok", text: "Compilado sin errores" },
          { type: "ok", text: "Velocidad medida con Lighthouse" },
          { type: "cmd", text: "deploy --dominio tunegocio.hn" },
          { type: "ok", text: `Dominio y hosting por ${months}` },
          { type: "url", text: "https://tunegocio.hn" },
        ],
      },
      chat: {
        assistantName: "Asistente IA",
        exampleLabel: "ejemplo",
        messages: [
          { from: "cliente", text: "Hola, ¿tienen pastel de chocolate para hoy?" },
          { from: "ia", text: "¡Hola! Sí, hay de chocolate y de tres leches. ¿Te aparto uno?" },
          { from: "cliente", text: "Sí, uno de chocolate para las 4 p. m." },
          { from: "ia", text: "Listo, quedó apartado a tu nombre para las 4:00 p. m. ✓" },
        ],
      },
      supportChips: ["Equipos", "Redes y Wi-Fi", "Correos", "Mantenimiento"],
      reportCaption: "ejemplo: reporte de ventas semanal",
      stack: {
        title: "Nuestro stack",
        code: "stack.list()",
        help: "Pasa el cursor o toca una tecnología para ver para qué la usamos.",
        // Las versiones describen el stack con que se construyen los sitios de los clientes, no las de este
        // repositorio. Son texto de la referencia: si el propietario las cambia, se cambian aquí.
        items: [
          { id: "react", name: "React", version: "19", description: "Interfaces propias y rápidas, sin plantillas." },
          {
            id: "typescript",
            name: "TypeScript",
            version: "5",
            description: "Código tipado: atrapamos errores antes de publicar.",
          },
          {
            id: "tailwind",
            name: "Tailwind CSS",
            version: "4",
            description: "Estilos consistentes con tu marca en todo el sitio.",
          },
          { id: "vite", name: "Vite", version: "8", description: "Compilación rápida y archivos livianos para tu web." },
          {
            id: "lighthouse",
            name: "Lighthouse",
            description: "Medimos velocidad, accesibilidad y SEO en cada entrega.",
          },
          { id: "whatsapp", name: "WhatsApp", description: "Botones y pedidos que llegan directo a tu chat." },
          { id: "maps", name: "Google Maps", description: "Tu ubicación y tu perfil para que te encuentren." },
          { id: "ia", name: "IA", description: "Agentes y chatbots que responden a tus clientes por ti." },
        ],
      },
    },

    homePlans: {
      tag: "planes",
      title: "Elige el plan para tu página web",
      text: `Precios claros en lempiras. Dominio y hosting por ${months} incluidos en todos.`,
      note: "Solicitar no es un pago ni un contrato.",
      compareLink: { label: "Compara todo lo que incluye cada plan →", href: SITE_PATHS.planes },
    },

    portfolio: {
      tag: "proyectos",
      title: "Webs que ya lanzamos",
      project: {
        name: "LAU Graphic",
        kind: "agencia de publicidad",
        description:
          "Sitio para una agencia de logos, branding, videos y redes: planes con contratación directa por WhatsApp, diseño editorial y carga rápida.",
        imageAlt: "Página web de LAU Graphic, agencia de publicidad",
        hostLabel: "laugraphic.com",
        // Desviación: la referencia no avisaba que el enlace abre otra pestaña; aquí sí, como los demás externos.
        link: externalLink("Visitar sitio", LAU_GRAPHIC_URL),
      },
    },

    why: {
      tag: "por_que",
      title: "Por qué hacer tu página con nosotros",
      reasons: [
        { icon: "cpu", title: "Código propio", text: "Nada de WordPress, Wix ni plantillas recicladas." },
        {
          icon: "gauge",
          title: "Velocidad medida",
          text: "Cada entrega pasa por Lighthouse.",
        },
        { icon: "map-pin", title: "Hecho en Honduras", text: "Desde Siguatepeque, Comayagua." },
        { icon: "users", title: "Atención directa", text: `Respondemos en menos de ${hoursShort}.` },
        {
          icon: "shield-check",
          title: "Revisiones incluidas",
          text: "Ajustamos tu página hasta que quede.",
        },
      ],
      steps: [
        {
          number: "01",
          title: "Inicias sesión y solicitas",
          text: "Registras tu proyecto en tu panel y se crea tu ticket.",
        },
        {
          number: "02",
          title: `Pagas el ${upfront} y envías material`,
          text: "Con el anticipo y tus textos, logo y fotos, arrancamos.",
        },
        {
          number: "03",
          title: "Diseñamos y programamos",
          text: "Sigues cada fase con nuestras actualizaciones.",
        },
        {
          number: "04",
          title: `Revisión, ${onDelivery} final y en línea`,
          text: "Ajustamos, pagas el resto y publicamos tu web.",
        },
      ],
    },

    tracker: {
      tag: "seguimiento",
      title: "Mira tu web avanzar, fase a fase",
      text: "Inicia sesión en tu panel, registra tu solicitud y sigue tu proyecto con las actualizaciones que te vamos dejando.",
      payments: [
        { value: upfront, label: "al iniciar el proyecto" },
        { value: onDelivery, label: "al entregar tu web en línea" },
      ],
      cta: { label: "Entrar a mi panel", href: SITE_PATHS.panel },
      ticket: { label: "ticket #0142 · tunegocio.hn", status: "en desarrollo" },
      phases: [
        { name: "Solicitud", text: "Inicias sesión y registras tu solicitud. Se crea tu ticket." },
        { name: `Pago ${upfront}`, text: `Pagas el ${upfront} del proyecto para arrancar.` },
        { name: "Material", text: "Nos pasas textos, logo y fotos. Empieza el plazo." },
        { name: "Diseño", text: "Te mostramos la propuesta visual de tu web." },
        { name: "Desarrollo", text: "Programamos tu sitio con código propio." },
        { name: "Revisión", text: "Revisas y pides ajustes en tus rondas incluidas." },
        { name: "Pago final", text: `Pagas el ${onDelivery} restante al aprobar la entrega.` },
        { name: "En línea", text: "Publicamos tu web en tu dominio. ¡Listo!" },
      ],
      currentPhaseIndex: 4,
      // Desviación: texto nuevo, solo para lectores de pantalla (la referencia marcaba el estado únicamente con color).
      phaseStatus: { done: "hecha", current: "en curso", pending: "pendiente" },
      update: {
        label: "actualización:",
        text: "sección de servicios lista, avanzando con el catálogo.",
      },
    },

    planCard: {
      requestLabel: (planName) => `Solicitar ${shortPlanName(planName)}`,
      deliveryLine: (deliveryBusinessDays) =>
        `entrega: ${count(deliveryBusinessDays, "día hábil", "días hábiles")} · ${upfront} al iniciar, ${onDelivery} al entregar`,
    },

    plansView: {
      tag: "planes",
      title: "Planes claros, en lempiras",
      text: "Elige según lo que tu negocio necesita hoy. Puedes subir de plan cuando quieras.",
      comparison: {
        title: "Comparación completa",
        featureHeader: "Incluye",
        included: "Incluido",
        notIncluded: "No incluido",
      },
    },

    servicesView: {
      tag: "servicios",
      title: "Tecnología que trabaja para tu negocio",
      text: "Hoy nos especializamos en páginas web, y te acompañamos con soporte, IA y herramientas propias.",
      items: [
        {
          id: "web",
          code: serviceCodes.web,
          title: serviceTitles.web,
          price: `Desde ${lempiras(lowest)}`,
          items: ["Landing pages", "Sitios corporativos", "Catálogos con WhatsApp", "Blogs y portafolios"],
          cta: consultCta(serviceTitles.web),
        },
        {
          id: "techon",
          code: serviceCodes.techon,
          title: serviceTitles.techon,
          price: "Bajo cotización",
          items: ["Mantenimiento de equipos", "Redes e internet", "Correos y cuentas", "Respaldo de información"],
          cta: consultCta(serviceTitles.techon),
        },
        {
          id: "ia",
          code: serviceCodes.ia,
          title: serviceTitles.ia,
          price: "Bajo cotización",
          items: [
            "Agentes para WhatsApp",
            "Chatbots para tu web",
            "Automatización de tareas",
            "Respuestas con tu catálogo",
          ],
          cta: consultCta(serviceTitles.ia),
        },
        {
          id: "tools",
          code: serviceCodes.tools,
          title: serviceTitles.tools,
          price: "Bajo cotización",
          items: ["Inventarios", "Reportes y paneles", "Sistemas internos", "Conexión entre sistemas"],
          cta: consultCta(serviceTitles.tools),
        },
      ],
    },

    contactView: {
      eyebrow: "// contacto",
      title: "Cuéntanos qué necesitas",
      intro: `Escríbenos sobre tu página web o sobre otro proyecto. Respondemos en menos de ${hoursLong}. La cotización es gratis y sin compromiso.`,
      alternativesLabel: "¿Prefieres otro canal?",
      whatsapp: whatsappChannel,
      phone: phoneLink,
    },
  };
}

export const SITE_CONTENT: SiteContent = buildSiteContent(COMMITMENTS, SITE_PLANS, CHANNELS, PAYMENT_TERMS);
