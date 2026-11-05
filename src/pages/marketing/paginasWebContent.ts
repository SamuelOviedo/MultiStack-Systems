/**
 * Contenido de la landing /paginas-web, una oferta aparte de la home: aquí no se habla de IA,
 * de automatización ni de los productos del ecosistema.
 *
 * Reglas del módulo
 * - Solo hechos confirmados por el propietario. Sin cifras, clientes, testimonios, reseñas
 *   ni puntajes que no estén en COMMITMENTS o en CHANNELS.
 * - Todo número del texto sale de COMMITMENTS: al cambiar uno cambia en toda la página.
 * - Hechos, no adjetivos: la velocidad se cuenta como proceso (se mide con Lighthouse), nunca
 *   como resultado ni con adjetivos que la prometan.
 * - Sin JSX ni estilos. Las propiedades de PaginasWebContent siguen el orden de lectura.
 */

export interface Commitments {
  /** Precio base «desde», en dólares estadounidenses. No incluye impuestos. */
  readonly priceFromUsd: number;
  readonly maxSections: number;
  readonly revisionRounds: number;
  /** Plazo de entrega en días hábiles, desde que el cliente entrega textos, logo y fotos. */
  readonly deliveryBusinessDays: number;
  /** El formulario se responde en menos de estas horas hábiles. */
  readonly responseBusinessHours: number;
}

export const COMMITMENTS: Commitments = {
  priceFromUsd: 500,
  maxSections: 6,
  revisionRounds: 2,
  deliveryBusinessDays: 10,
  responseBusinessHours: 24,
};

export interface Channels {
  readonly whatsappUrl: string;
  readonly phoneDisplay: string;
  /** Enlace tel: del mismo número, que es también el del WhatsApp. */
  readonly phoneHref: string;
  readonly instagramUrl: string;
  readonly facebookUrl: string;
  readonly location: string;
}

export const CHANNELS: Channels = {
  whatsappUrl: "https://wa.me/50433023042",
  phoneDisplay: "+504 3302-3042",
  phoneHref: "tel:+50433023042",
  instagramUrl: "https://www.instagram.com/multistacksystems/",
  facebookUrl: "https://www.facebook.com/multistacksystems/",
  location: "Siguatepeque, Comayagua, Honduras",
};

/** Anclas estables de cada sección. Los enlaces del anuncio y de la página dependen de ellas. */
export const SECTION_IDS = {
  hero: "inicio",
  includes: "que-incluye",
  price: "precio",
  timeline: "proceso",
  engineering: "ingenieria",
  honduras: "honduras",
  support: "atencion",
  social: "como-trabajamos",
  faq: "preguntas",
  contact: "contacto",
} as const;

export interface PaginasWebLink {
  readonly label: string;
  readonly href: string;
  /** Nombre accesible: empieza con el texto visible (WCAG 2.5.3). */
  readonly ariaLabel?: string;
  /** true: se abre en una pestaña nueva con target="_blank" y rel="noopener noreferrer". */
  readonly external?: boolean;
}

export interface PaginasWebFact {
  readonly value: string;
  readonly label: string;
}

export interface PaginasWebItem {
  readonly title: string;
  readonly text?: string;
}

export interface PaginasWebStep {
  readonly title: string;
  readonly text: string;
}

export interface PaginasWebFaqItem {
  readonly question: string;
  /** Texto plano, sin marcado: sirve igual para la página y para un JSON-LD FAQPage. */
  readonly answer: string;
}

export interface PaginasWebSectionHead {
  readonly id: string;
  readonly eyebrow: string;
  readonly title: string;
}

/** Su `title` es el único H1 de la página. */
export interface PaginasWebHero extends PaginasWebSectionHead {
  readonly subtitle: string;
  readonly primaryCta: PaginasWebLink;
  readonly secondaryCta: PaginasWebLink;
  readonly reassurance: string;
  readonly facts: readonly PaginasWebFact[];
}

export interface PaginasWebIncludes extends PaginasWebSectionHead {
  readonly intro: string;
  readonly items: readonly PaginasWebItem[];
}

export interface PaginasWebPrice extends PaginasWebSectionHead {
  readonly amountPrefix: string;
  readonly amount: string;
  readonly amountNote: string;
  readonly scope: string;
  readonly includedTitle: string;
  readonly included: readonly string[];
  readonly notIncludedTitle: string;
  readonly notIncluded: readonly PaginasWebItem[];
  readonly quoteNote: string;
  readonly cta: PaginasWebLink;
}

export interface PaginasWebTimeline extends PaginasWebSectionHead {
  readonly intro: string;
  readonly steps: readonly PaginasWebStep[];
  readonly facts: readonly PaginasWebFact[];
  readonly cta: PaginasWebLink;
}

export interface PaginasWebEngineering extends PaginasWebSectionHead {
  readonly intro: string;
  readonly points: readonly PaginasWebItem[];
}

export interface PaginasWebHonduras extends PaginasWebSectionHead {
  readonly text: string;
  readonly location: string;
}

export interface PaginasWebSupport extends PaginasWebSectionHead {
  readonly text: string;
  readonly channels: readonly PaginasWebLink[];
}

export interface PaginasWebSocial extends PaginasWebSectionHead {
  readonly text: string;
  readonly links: readonly PaginasWebLink[];
}

export interface PaginasWebFaq extends PaginasWebSectionHead {
  readonly items: readonly PaginasWebFaqItem[];
}

export interface PaginasWebContact extends PaginasWebSectionHead {
  /** El formulario ya existe (ContactForm); aquí solo va el encabezado y su introducción. */
  readonly intro: string;
  /** Texto con el que se prellena el mensaje del formulario (ContactPrefill). */
  readonly messagePrefill: string;
  readonly alternativesLabel: string;
  readonly alternatives: readonly PaginasWebLink[];
}

export interface PaginasWebContent {
  readonly hero: PaginasWebHero;
  readonly includes: PaginasWebIncludes;
  readonly price: PaginasWebPrice;
  readonly timeline: PaginasWebTimeline;
  readonly engineering: PaginasWebEngineering;
  readonly honduras: PaginasWebHonduras;
  readonly support: PaginasWebSupport;
  readonly social: PaginasWebSocial;
  readonly faq: PaginasWebFaq;
  readonly contact: PaginasWebContact;
}

const NEW_TAB_NOTICE = "(se abre en una pestaña nueva)";

/** 500 -> «US$500»; 1200 -> «US$1,200». */
const usd = (amount: number): string => `US$${amount.toLocaleString("en-US")}`;

/** (6, "sección", "secciones") -> «6 secciones»; con 1 usa el singular. */
const count = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

function externalLink(label: string, href: string): PaginasWebLink {
  return { label, href, ariaLabel: `${label} ${NEW_TAB_NOTICE}`, external: true };
}

/**
 * Existe como función para poder probar que cada número del texto sale de los compromisos:
 * se pasan valores distintos y no debe quedar ninguno de los anteriores.
 */
export function buildPaginasWebContent(commitments: Commitments): PaginasWebContent {
  const price = usd(commitments.priceFromUsd);
  const sections = count(commitments.maxSections, "sección", "secciones");
  const rounds = count(commitments.revisionRounds, "ronda", "rondas");
  const days = count(commitments.deliveryBusinessDays, "día hábil", "días hábiles");
  const hours = count(commitments.responseBusinessHours, "hora hábil", "horas hábiles");

  const contactHref = `#${SECTION_IDS.contact}`;
  const quoteCta: PaginasWebLink = { label: "Cotiza tu página web", href: contactHref };
  const formLink: PaginasWebLink = { label: "Llena el formulario", href: contactHref };
  const whatsappLink = externalLink("Escríbenos por WhatsApp", CHANNELS.whatsappUrl);
  const phoneLink: PaginasWebLink = {
    label: `Llama al ${CHANNELS.phoneDisplay}`,
    href: CHANNELS.phoneHref,
  };

  const deliveryFact: PaginasWebFact = {
    value: days,
    label: "De entrega, desde que nos pasas tu material",
  };

  const includedItems: readonly PaginasWebItem[] = [
    {
      title: `Hasta ${sections}`,
      text: "Una sección es un bloque de la página, como la portada, tus servicios o el contacto.",
    },
    {
      title: "Formulario de contacto",
      text: "Tus visitantes te dejan su nombre, un teléfono o un correo, y lo que necesitan.",
    },
    {
      title: "Botón de WhatsApp",
      text: "Quien prefiere chatear abre la conversación con un toque.",
    },
    {
      title: "Versión para celular",
      text: "La página se adapta a la pantalla del celular.",
    },
    {
      title: "Velocidad de carga medida con Lighthouse",
      text:
        "Lighthouse es una herramienta de Google que revisa páginas web. La usamos para medir cuánto tarda en cargar tu página.",
    },
    {
      title: "Código propio con React",
      text: "Escribimos el código de tu página para tu negocio.",
    },
    {
      title: `${rounds} de revisión`,
      text: "Revisas la página, nos dices qué cambiar y lo ajustamos.",
    },
  ];

  const notIncludedItems: readonly PaginasWebItem[] = [
    {
      title: "Dominio",
      text: "No incluye el dominio: lo compras a tu nombre y te ayudamos a elegirlo y configurarlo.",
    },
    {
      title: "Hosting",
      text: "El servicio donde vive tu página en internet. No está en el precio base.",
    },
    {
      title: "Tienda en línea",
      text: "Esta landing de una página no la incluye.",
    },
    {
      title: "Fotografía profesional",
      text: "Las fotos de tu página las entregas tú.",
    },
    {
      title: "Redacción de textos largos",
      text: "Los textos largos los entregas tú.",
    },
  ];

  const faqItems: readonly PaginasWebFaqItem[] = [
    {
      question: "¿Cuánto cuesta una página web?",
      answer: `Desde ${price}, impuestos no incluidos. Ese precio cubre el diseño y el desarrollo de una landing de una página con hasta ${sections}. El dominio, el hosting, la tienda en línea, la fotografía profesional y la redacción de textos largos no están en el precio base.`,
    },
    {
      question: "¿Cuánto tardan en entregar la página?",
      answer: `Entregamos en ${days}, contados desde que nos pasas tus textos, tu logo y tus fotos.`,
    },
    {
      question: "¿Qué necesito darles para empezar?",
      answer:
        "Tus textos, tu logo y tus fotos. La redacción de textos largos y la fotografía profesional no están incluidas en el precio base.",
    },
    {
      question: "¿El dominio y el hosting están incluidos?",
      answer:
        "No incluye el dominio: lo compras a tu nombre y te ayudamos a elegirlo y configurarlo. El hosting, el servicio donde vive tu página, tampoco está en el precio base.",
    },
    {
      question: "¿Usan WordPress, Wix o plantillas?",
      answer: "No. Programamos cada landing con React y código propio.",
    },
    {
      question: "¿Puedo pedir cambios?",
      answer: `Sí. El precio incluye ${rounds} de revisión. Revisas la página, nos dices qué cambiar y lo ajustamos.`,
    },
    {
      question: "¿Cotizar tiene algún costo?",
      answer: `No. La cotización es gratis y sin compromiso. Al formulario respondemos en menos de ${hours}. También puedes escribirnos por WhatsApp o llamar al ${CHANNELS.phoneDisplay}.`,
    },
  ];

  return {
    // Anuncio: «Páginas web en Honduras» (H1), «Diseño web a medida» (etiqueta),
    // «Cotiza tu página web» (CTA principal) y «Cotización sin compromiso» (microcopy).
    hero: {
      id: SECTION_IDS.hero,
      eyebrow: "Diseño web a medida",
      title: "Páginas web en Honduras",
      subtitle:
        "Diseñamos y programamos tu landing con código propio en React, para que quien la visite te escriba.",
      primaryCta: quoteCta,
      secondaryCta: whatsappLink,
      reassurance: "La cotización es gratis y sin compromiso.",
      facts: [
        { value: `Desde ${price}`, label: "Impuestos no incluidos" },
        deliveryFact,
        { value: `Menos de ${hours}`, label: "De respuesta al formulario" },
      ],
    },

    // Anuncio: «Landing pages a medida» y «Diseño web a medida».
    // La sección no promete ventas: muestra lo que una landing necesita para recibir contactos.
    includes: {
      id: SECTION_IDS.includes,
      eyebrow: "Qué incluye",
      title: "Una landing pensada para que te escriban",
      intro:
        "Una landing es una página única con una sola meta. En la tuya, esa meta es que tus visitantes te contacten por el formulario o por WhatsApp.",
      items: includedItems,
    },

    // Anuncio: «Precio claro desde el inicio» y «Cotización sin compromiso».
    // Sin precio de hosting a propósito: el hosting no está en el precio base.
    price: {
      id: SECTION_IDS.price,
      eyebrow: "Precio",
      title: "Precio claro desde el inicio",
      amountPrefix: "Desde",
      amount: price,
      amountNote: "Impuestos no incluidos.",
      scope: "Incluye el diseño y el desarrollo de una landing de una página.",
      includedTitle: "Lo que incluye el precio",
      included: includedItems.map((item) => item.title),
      notIncludedTitle: "Lo que no incluye el precio base",
      notIncluded: notIncludedItems,
      quoteNote:
        "El precio de tu proyecto lo confirmamos en la cotización, que es gratis y sin compromiso.",
      cta: quoteCta,
    },

    // Anuncio: «Precio claro desde el inicio» (plazo y revisiones) y «Cotización sin compromiso».
    timeline: {
      id: SECTION_IDS.timeline,
      eyebrow: "Proceso",
      title: `Entrega en ${days}`,
      intro: `El plazo de ${days} corre desde que nos pasas tus textos, tu logo y tus fotos.`,
      steps: [
        {
          title: "Pides tu cotización",
          text: `Llenas el formulario o nos escribes por WhatsApp. Al formulario respondemos en menos de ${hours}.`,
        },
        {
          title: "Nos pasas tu material",
          text: "Tus textos, tu logo y tus fotos. Con eso empieza a contar el plazo.",
        },
        {
          title: "Diseñamos y programamos",
          text: `Armamos tu landing de una página, con hasta ${sections} y código propio en React.`,
        },
        {
          title: "Entrega y ajustes",
          text: `Te entregamos tu página en ${days} desde que nos pasas tu material. El precio incluye ${rounds} de revisión: tú nos dices qué cambiar y nosotros lo ajustamos.`,
        },
      ],
      facts: [deliveryFact, { value: rounds, label: "De revisión en el precio base" }],
      cta: quoteCta,
    },

    // Anuncio: «Ingeniería, no plantillas» y «Diseño web a medida».
    // El sitio de MultiStack está hecho con React y TypeScript: lo confirma TechStack.tsx.
    engineering: {
      id: SECTION_IDS.engineering,
      eyebrow: "Cómo la construimos",
      title: "Ingeniería a medida, con React y código propio",
      intro: "Programamos tu landing con React y con código propio. No usamos WordPress, Wix ni plantillas.",
      points: [
        {
          title: "Diseño a partir de tu material",
          text: "Diseñamos con tus textos, tu logo y tus fotos, y escribimos el código para tu página.",
        },
        {
          title: "Velocidad medida",
          text: "Medimos la velocidad de carga con Lighthouse.",
        },
        {
          title: "Lo usamos en nuestro propio sitio",
          text: "El sitio de MultiStack, esta página incluida, está hecho con React y TypeScript.",
        },
      ],
    },

    // Anuncio: «Hecho en Honduras» y «Páginas web en Honduras». Fuente: Footer e index.html.
    honduras: {
      id: SECTION_IDS.honduras,
      eyebrow: "Origen",
      title: "Hecho en Honduras, desde Siguatepeque",
      text: "Estamos en Siguatepeque, Comayagua. Diseñamos y programamos tu página en Honduras.",
      location: CHANNELS.location,
    },

    // Anuncio: «Atención directa del equipo». Solo el formulario tiene plazo de respuesta
    // (COMMITMENTS.responseBusinessHours): no se promete plazo por WhatsApp ni horario.
    support: {
      id: SECTION_IDS.support,
      eyebrow: "Atención directa",
      title: "Te responde el equipo de MultiStack",
      text: `El formulario lo respondemos en menos de ${hours}. Si prefieres otro canal, escríbenos por WhatsApp o llámanos.`,
      channels: [formLink, whatsappLink, phoneLink],
    },

    // Anuncio: «Mira cómo trabajamos». No se describe qué se publica en las redes.
    social: {
      id: SECTION_IDS.social,
      eyebrow: "Redes",
      title: "Mira cómo trabajamos",
      text: "Antes de escribirnos, pasa por nuestro Instagram. También estamos en Facebook.",
      links: [
        externalLink("Mira cómo trabajamos en Instagram", CHANNELS.instagramUrl),
        externalLink("Visita nuestro Facebook", CHANNELS.facebookUrl),
      ],
    },

    faq: {
      id: SECTION_IDS.faq,
      eyebrow: "Preguntas",
      title: "Preguntas antes de cotizar",
      items: faqItems,
    },

    // Anuncio: «Cotiza tu página web» y «Cotización sin compromiso».
    contact: {
      id: SECTION_IDS.contact,
      eyebrow: "Cotización",
      title: "Cotiza tu página web",
      intro: `Cuéntanos qué necesitas y para qué quieres tu página. Respondemos en menos de ${hours}. La cotización es gratis y sin compromiso.`,
      messagePrefill: "Hola, quiero cotizar una página web.",
      alternativesLabel: "¿Prefieres otro canal?",
      alternatives: [whatsappLink, phoneLink],
    },
  };
}

export const PAGINAS_WEB_CONTENT: PaginasWebContent = buildPaginasWebContent(COMMITMENTS);
