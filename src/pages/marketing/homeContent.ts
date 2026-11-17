/**
 * Contenido de la home pública (`/`): MultiStack Systems como negocio de páginas web. Prioridad 1: el Combo
 * Emprendedor. Prioridad 2: el Plan Estándar. El software a medida y los agentes de IA son servicios
 * secundarios, solo bajo cotización. `/paginas-web` sigue siendo una landing aparte, con su propio contenido.
 *
 * Reglas del módulo
 * - Solo hechos confirmados por el propietario. Sin cifras, clientes, testimonios, reseñas ni
 *   puntajes que no estén en COMMITMENTS, PACKAGES o CHANNELS.
 * - Todo número del texto sale de COMMITMENTS o de PACKAGES. Los textos ya aprobados (combo, incluido,
 *   no incluido, pasos del proceso, preguntas) se importan de `buildPaginasWebContent`: aquí solo se
 *   escribe lo nuevo, y lo nuevo tampoco lleva números escritos a mano.
 * - Lo que el propietario no ha decidido no se afirma ni se insinúa: impuestos; renovación del dominio
 *   y del hosting después del primer periodo, titularidad y extensiones del dominio; plazo propio del
 *   Combo; propuestas o revisiones del logo; vigencia de la promoción; precios en dólares.
 * - El plazo de entrega se dice solo como está aprobado («desde que nos pasas tus textos, tu logo y tus
 *   fotos») y nunca como plazo del Combo.
 * - Del Combo se afirma solo lo que hace cada parte: LAU Graphic diseña el logo y MultiStack Systems
 *   programa la página. Nada de trabajos ni clientes de LAU Graphic.
 * - Hechos, no adjetivos: la velocidad se cuenta como proceso (se mide con Lighthouse), nunca como
 *   resultado ni con adjetivos que la prometan.
 * - Servicios secundarios: la única promesa es que se cotizan. Sin precios, plazos, porcentajes, horarios
 *   ni funciones de producto. Ningún texto de IA se presenta como producto disponible.
 * - Sin testimonios, clientes, logos ni métricas inventadas.
 * - Sin JSX ni estilos. Las propiedades de HomeContent siguen el orden de lectura de la página.
 */

import { packageRequestPath } from "@/lib/packageIntent";
import { lempiras, lempirasSpoken, type PaginasWebPackage } from "@/lib/webPackages";
import {
  CHANNELS,
  COMMITMENTS,
  PACKAGES,
  SECTION_IDS,
  buildPaginasWebContent,
  type Commitments,
  type PaginasWebCombo,
  type PaginasWebFact,
  type PaginasWebFaqItem,
  type PaginasWebItem,
  type PaginasWebLink,
  type PaginasWebPricePackage,
  type PaginasWebSectionHead,
  type PaginasWebStep,
} from "@/pages/marketing/paginasWebContent";

/** Anclas estables de la home. Las de la barra, los CTA y el prellenado del formulario dependen de ellas. */
export const HOME_SECTION_IDS = {
  hero: "inicio",
  combo: SECTION_IDS.combo,
  plans: "planes",
  why: "por-que-elegirnos",
  process: SECTION_IDS.timeline,
  services: "servicios",
  faq: SECTION_IDS.faq,
  contact: SECTION_IDS.contact,
  finalCta: "solicitar",
} as const;

export interface HomeMeta {
  /** Hasta 60 caracteres, sin precios. */
  readonly title: string;
  /** Hasta 155 caracteres. */
  readonly description: string;
  readonly ogTitle: string;
  readonly ogDescription: string;
  /** Describe la imagen que se compartirá: debe coincidir con la imagen final de la home. */
  readonly ogImageAlt: string;
}

export interface HomeNavItem {
  readonly label: string;
  /** Ancla dentro de la home: `#combo-emprendedor`. */
  readonly href: string;
}

export interface HomeNav {
  readonly items: readonly HomeNavItem[];
  /** CTA de la barra. Su `ariaLabel` empieza con el texto visible (WCAG 2.5.3). */
  readonly cta: PaginasWebLink;
  /** Paquete que pide el CTA: la barra guarda esta intención antes de navegar (PwRequestLink). */
  readonly packageId: PaginasWebPackage["id"];
}

/** Su `title` es el único H1 de la página. */
export interface HomeHero extends PaginasWebSectionHead {
  readonly subtitle: string;
  readonly primaryCta: PaginasWebLink;
  readonly secondaryCta: PaginasWebLink;
  readonly reassurance: string;
  readonly facts: readonly PaginasWebFact[];
  /**
   * Etiquetas de las tarjetas flotantes de la maqueta. Son decorativas y repiten hechos que ya están en
   * el texto: ui-system las oculta a los lectores de pantalla.
   */
  readonly floatingCards: readonly string[];
  /** Descripción de la maqueta para lectores de pantalla: es una ilustración, no la captura de un cliente. */
  readonly mockAlt: string;
}

/** El Combo de `/paginas-web`, más el titular de la sección y la frase de la colaboración. */
export interface HomeCombo extends PaginasWebCombo {
  /** Titular de la sección en la home (H2). `title` es el nombre del paquete. */
  readonly headline: string;
  /** Qué hace cada parte: LAU Graphic diseña el logo, MultiStack Systems programa la página. */
  readonly collaboration: string;
}

export interface HomePlans extends PaginasWebSectionHead {
  readonly intro: string;
  /** Combo primero y Estándar después. Los ids de las tarjetas son `packageCardId(id)`: el enlace del Combo apunta a ellos. */
  readonly packages: readonly PaginasWebPricePackage[];
  /** Paquete que lleva la etiqueta `recommendedLabel`. */
  readonly recommendedId: PaginasWebPackage["id"];
  readonly recommendedLabel: string;
  readonly scope: string;
  readonly includedTitle: string;
  readonly included: readonly string[];
  readonly notIncludedTitle: string;
  readonly notIncluded: readonly PaginasWebItem[];
  /** Lleva a `/paginas-web`: ruta interna, no ancla. */
  readonly seeAllLink: PaginasWebLink;
}

export interface HomeWhy extends PaginasWebSectionHead {
  readonly items: readonly PaginasWebItem[];
}

export interface HomeProcess extends PaginasWebSectionHead {
  readonly intro: string;
  readonly steps: readonly PaginasWebStep[];
}

export interface HomeService {
  readonly id: "software-a-medida" | "agentes-ia";
  readonly title: string;
  readonly text: string;
  /** «Bajo cotización». */
  readonly tag: string;
  /** Lleva al formulario de contacto (`#contacto`). */
  readonly cta: PaginasWebLink;
  /** Texto con el que se prellena el mensaje del formulario (ContactPrefill) al pulsar este CTA. */
  readonly messagePrefill: string;
}

export interface HomeServices extends PaginasWebSectionHead {
  readonly intro: string;
  readonly items: readonly HomeService[];
}

export interface HomeFaq extends PaginasWebSectionHead {
  readonly items: readonly PaginasWebFaqItem[];
}

export interface HomeContact extends PaginasWebSectionHead {
  /** El formulario ya existe (ContactForm); aquí solo va el encabezado y su introducción. */
  readonly intro: string;
  /** Mensaje de prellenado por defecto, cuando no se llega desde una tarjeta de servicio. */
  readonly messagePrefill: string;
  readonly alternativesLabel: string;
  readonly alternatives: readonly PaginasWebLink[];
}

export interface HomeFinalCta {
  readonly id: string;
  readonly title: string;
  readonly text: string;
  readonly comboCta: PaginasWebLink;
  readonly standardCta: PaginasWebLink;
  readonly alternativeLabel: string;
  readonly whatsapp: PaginasWebLink;
}

export interface HomeFooter {
  /** Una línea, centrada en páginas web. */
  readonly description: string;
  readonly location: string;
}

export interface HomeContent {
  readonly meta: HomeMeta;
  readonly nav: HomeNav;
  readonly hero: HomeHero;
  readonly combo: HomeCombo;
  readonly plans: HomePlans;
  readonly why: HomeWhy;
  readonly process: HomeProcess;
  readonly services: HomeServices;
  readonly faq: HomeFaq;
  readonly contact: HomeContact;
  readonly finalCta: HomeFinalCta;
  readonly footer: HomeFooter;
}

/** (12, "mes", "meses") -> «12 meses»; con 1 usa el singular. */
const count = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

function findPackage(
  packages: readonly PaginasWebPackage[],
  id: PaginasWebPackage["id"],
): PaginasWebPackage {
  const found = packages.find((pkg) => pkg.id === id);
  if (!found) throw new Error(`Falta el paquete «${id}» en PACKAGES.`);
  return found;
}

function findPricePackage(
  packages: readonly PaginasWebPricePackage[],
  id: PaginasWebPackage["id"],
): PaginasWebPricePackage {
  const found = packages.find((pkg) => pkg.id === id);
  if (!found) throw new Error(`Falta la tarjeta del paquete «${id}».`);
  return found;
}

/**
 * Existe como función para poder probar que cada número del texto sale de los compromisos y de los
 * paquetes: se pasan valores distintos y no debe quedar ninguno de los anteriores.
 */
export function buildHomeContent(
  commitments: Commitments,
  packages: readonly PaginasWebPackage[],
): HomeContent {
  const pw = buildPaginasWebContent(commitments, packages);
  const standard = findPackage(packages, "estandar");
  const combo = findPackage(packages, "combo-emprendedor");
  const lowest = packages.reduce((min, pkg) => (pkg.priceLempiras < min.priceLempiras ? pkg : min));
  const rounds = count(commitments.revisionRounds, "ronda", "rondas");
  const days = count(commitments.deliveryBusinessDays, "día hábil", "días hábiles");
  const hours = count(commitments.responseBusinessHours, "hora hábil", "horas hábiles");
  const months = count(commitments.domainHostingMonths, "mes", "meses");

  const contactHref = `#${HOME_SECTION_IDS.contact}`;
  const comboHref = packageRequestPath(combo.id);
  const standardHref = packageRequestPath(standard.id);

  // El enlace de WhatsApp ya está aprobado en /paginas-web (con su aviso de pestaña nueva): se reutiliza.
  const whatsappLink = pw.contact.alternatives.find((link) => link.href === CHANNELS.whatsappUrl);
  if (!whatsappLink) throw new Error("Falta el enlace de WhatsApp en el contenido de /paginas-web.");

  // Combo primero: es la prioridad 1. Los textos de cada tarjeta son los aprobados de /paginas-web.
  const planCards: readonly PaginasWebPricePackage[] = [
    findPricePackage(pw.price.packages, combo.id),
    findPricePackage(pw.price.packages, standard.id),
  ];

  // Anuncio de cada servicio: solo se afirma que se cotiza. No se promete producto, plazo ni precio.
  const services: readonly HomeService[] = [
    {
      id: "software-a-medida",
      title: "Software a medida",
      text: "Programamos software para lo que tu negocio necesita. Cuéntanos qué buscas y lo cotizamos.",
      tag: "Bajo cotización",
      cta: {
        label: "Cuéntanos tu proyecto",
        href: contactHref,
        ariaLabel: "Cuéntanos tu proyecto de software a medida",
      },
      messagePrefill: "Hola, quiero cotizar un software a medida.",
    },
    {
      id: "agentes-ia",
      title: "Agentes de IA y automatización personalizada",
      text: "Diseñamos agentes de IA y automatizaciones para tareas de tu negocio. Cada proyecto se cotiza según lo que necesites.",
      tag: "Bajo cotización",
      cta: {
        label: "Cuéntanos tu proyecto",
        href: contactHref,
        ariaLabel: "Cuéntanos tu proyecto de IA o automatización",
      },
      messagePrefill: "Hola, quiero cotizar un agente de IA o una automatización.",
    },
  ];

  // Las preguntas de /paginas-web, completas y en su orden, y una más para quien busca otros servicios.
  const faqItems: readonly PaginasWebFaqItem[] = [
    ...pw.faq.items,
    {
      question: "¿Hacen otros proyectos además de páginas web?",
      answer:
        "Sí. Hacemos software a medida y agentes de IA y automatización personalizada. Estos proyectos se hacen solo bajo cotización: cuéntanos qué necesitas en el formulario de contacto.",
    },
  ];

  return {
    // Los metas viven también en index.html y src/lib/routeMeta.ts. No se importa este módulo desde routeMeta
    // para no acoplar los metas de las rutas al contenido de la página; se copian como literales y una prueba
    // los compara. (Este módulo y el contenido de /paginas-web que reutiliza sí entran en el chunk de entrada,
    // porque la home no es lazy.)
    meta: {
      title: "Páginas web para negocios en Honduras | MultiStack Systems",
      description:
        "Páginas web con código propio en React para negocios en Honduras. Elige el Combo Emprendedor con el diseño de tu logo o el Plan Estándar.",
      ogTitle: "Páginas web para negocios en Honduras",
      ogDescription: `${combo.name} con el diseño de tu logo y ${standard.name}. Código propio en React, hecho en Honduras.`,
      ogImageAlt: "MultiStack Systems: páginas web para negocios en Honduras.",
    },

    nav: {
      items: [
        { label: "Combo", href: `#${HOME_SECTION_IDS.combo}` },
        { label: "Planes", href: `#${HOME_SECTION_IDS.plans}` },
        { label: "Proceso", href: `#${HOME_SECTION_IDS.process}` },
        { label: "Preguntas", href: `#${HOME_SECTION_IDS.faq}` },
        { label: "Contacto", href: `#${HOME_SECTION_IDS.contact}` },
      ],
      cta: { label: "Solicitar Combo", href: comboHref, ariaLabel: `Solicitar ${combo.name}` },
      packageId: combo.id,
    },

    hero: {
      id: HOME_SECTION_IDS.hero,
      eyebrow: "Hecho en Honduras, desde Siguatepeque",
      title: "Páginas web para negocios en Honduras",
      subtitle: `Programamos tu página web con código propio en React, sin plantillas. Con el ${combo.name}, LAU Graphic diseña tu logo.`,
      primaryCta: { label: `Solicitar ${combo.name}`, href: comboHref },
      secondaryCta: { label: "Ver planes", href: `#${HOME_SECTION_IDS.plans}` },
      reassurance: "Es una solicitud, no un pago.",
      facts: [
        {
          value: `Desde ${lempiras(lowest.priceLempiras)}`,
          valueSpoken: `Desde ${lempirasSpoken(lowest.priceLempiras)}`,
          label: `En el ${lowest.name}`,
        },
        { value: months, label: "De dominio y hosting incluidos" },
        {
          value: days,
          label: "De entrega, desde que nos pasas tus textos, tu logo y tus fotos",
        },
      ],
      floatingCards: ["Tu logo profesional", "Adaptable al celular", `Dominio y hosting por ${months}`],
      mockAlt:
        "Ilustración de ejemplo de una página web para un negocio. Es una maqueta decorativa, no la captura del sitio de un cliente.",
    },

    // Los entregables, el precio y la nota son los aprobados de /paginas-web. Se añaden solo el titular de
    // la home y la frase de la colaboración, que nombra a cada parte directamente.
    combo: {
      ...pw.combo,
      headline: "Tu logo y tu página web, en un solo paquete",
      collaboration: "LAU Graphic diseña tu logo y MultiStack Systems programa tu página web.",
    },

    plans: {
      id: HOME_SECTION_IDS.plans,
      eyebrow: "Planes",
      title: "Elige el plan para tu página web",
      intro: `Los dos planes incluyen la misma página web. La diferencia es el logo: en el ${standard.name} tú aportas el tuyo; en el ${combo.name}, lo diseña LAU Graphic.`,
      packages: planCards,
      recommendedId: combo.id,
      recommendedLabel: "Recomendado para empezar",
      scope: pw.price.scope,
      includedTitle: pw.price.includedTitle,
      included: pw.price.included,
      notIncludedTitle: pw.price.notIncludedTitle,
      notIncluded: pw.price.notIncluded,
      seeAllLink: { label: "Ver todo lo que incluye", href: "/paginas-web" },
    },

    // Solo hechos aprobados: código propio, velocidad medida, Honduras, atención del equipo, revisiones.
    why: {
      id: HOME_SECTION_IDS.why,
      eyebrow: "Por qué MultiStack",
      title: "Por qué hacer tu página con nosotros",
      items: [
        {
          title: "Código propio, sin plantillas",
          text: "Programamos tu página con React. No usamos WordPress, Wix ni plantillas.",
        },
        {
          title: "Velocidad medida",
          text: "Medimos la velocidad de carga con Lighthouse.",
        },
        {
          title: "Hecho en Honduras",
          text: "Estamos en Siguatepeque, Comayagua. Diseñamos y programamos tu página en Honduras.",
        },
        {
          title: "Atención directa del equipo",
          text: `Te responde el equipo de MultiStack. Al formulario respondemos en menos de ${hours}.`,
        },
        {
          title: "Revisiones incluidas",
          text: `Cada plan incluye ${rounds} de revisión de la página: tú nos dices qué cambiar y nosotros lo ajustamos.`,
        },
      ],
    },

    // El paso 1 es propio de la home, porque aquí se envía una solicitud y no una cotización. No nombra
    // paquetes ni plazos: los pasos siguientes (los aprobados de /paginas-web) ya cuentan el plazo desde que el
    // cliente entrega su material, y nada de esto insinúa un plazo propio del Combo.
    process: {
      id: HOME_SECTION_IDS.process,
      eyebrow: "Proceso",
      title: "De tu solicitud a tu página",
      intro: pw.timeline.intro,
      steps: [
        {
          title: "Envías tu solicitud",
          text: "Es una solicitud, no un pago ni un contrato. Te contactamos para confirmar el paquete y los siguientes pasos.",
        },
        ...pw.timeline.steps.slice(1),
      ],
    },

    services: {
      id: HOME_SECTION_IDS.services,
      eyebrow: "Otros proyectos",
      title: "También hacemos",
      intro: "Además de páginas web, hacemos otros proyectos. Los cotizamos según lo que necesites.",
      items: services,
    },

    faq: {
      id: HOME_SECTION_IDS.faq,
      eyebrow: "Preguntas",
      title: "Preguntas antes de empezar",
      items: faqItems,
    },

    // Existe porque la barra y las tarjetas de servicios apuntan a `#contacto`.
    contact: {
      id: HOME_SECTION_IDS.contact,
      eyebrow: "Contacto",
      title: "Cuéntanos qué necesitas",
      intro: `Escríbenos sobre tu página web o sobre otro proyecto. Respondemos en menos de ${hours}. La cotización es gratis y sin compromiso.`,
      messagePrefill: "Hola, quiero cotizar una página web.",
      alternativesLabel: pw.contact.alternativesLabel,
      alternatives: pw.contact.alternatives,
    },

    finalCta: {
      id: HOME_SECTION_IDS.finalCta,
      title: "Empieza con tu página web",
      text: `Elige el ${combo.name} o el ${standard.name} y envía tu solicitud. Es una solicitud, no un pago ni un contrato.`,
      comboCta: { label: `Solicitar ${combo.name}`, href: comboHref },
      standardCta: { label: `Solicitar ${standard.name}`, href: standardHref },
      alternativeLabel: "¿Prefieres escribirnos primero?",
      whatsapp: whatsappLink,
    },

    footer: {
      description: "Páginas web a medida para negocios en Honduras, con código propio en React.",
      location: CHANNELS.location,
    },
  };
}

export const HOME_CONTENT: HomeContent = buildHomeContent(COMMITMENTS, PACKAGES);
