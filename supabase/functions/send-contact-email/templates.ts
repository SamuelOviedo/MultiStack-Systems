/**
 * Internal "new website message" e-mail (contact form → team inbox), on the
 * shared MultiStack design system (_shared/email/layout.ts, the same layout as
 * the password-recovery and welcome e-mails). Presentation only — validation,
 * ticket persistence, key selection and sending stay in index.ts. Every value
 * is escaped by the layout blocks; links are limited to tel:/mailto: built from
 * validated input.
 */
import { BRAND, renderEmail, type Block } from "../_shared/email/layout.ts";
import { replyToFor } from "./reply-to.ts";

export interface Lead {
  name: string;
  phone: string;   // "" when not provided
  email: string;   // "" when not provided
  message: string;
}

export function contactSubject(name: string): string {
  return `Nuevo mensaje de ${name} — ${BRAND.name}`;
}

/**
 * @param stored whether the lead was saved as a ticket — the e-mail must not
 *   claim it is in the panel when the insert failed.
 * @param flags.limitsUnchecked the shared rate limits could not be read for this message (database failure): the team
 *   is told at the top of the e-mail, so a silently disabled limit does not depend on anyone reading the logs.
 */
export function contactHtml(
  lead: Lead,
  stored: boolean,
  receivedAt: Date = new Date(),
  flags: { limitsUnchecked?: boolean } = {},
): string {
  const received = receivedAt.toLocaleString("es-HN", { timeZone: "America/Tegucigalpa" });
  const telHref = lead.phone.replace(/[^\d+]/g, "");
  // Same rule as the Reply-To header: only a single plain address is linked.
  const replyEmail = lead.email && replyToFor(lead.email) === lead.email ? lead.email : "";

  const rows: Array<{ label: string; value: string; href?: string }> = [
    { label: "Nombre completo", value: lead.name },
    ...(lead.email ? [{ label: "Correo", value: lead.email, ...(replyEmail ? { href: `mailto:${replyEmail}` } : {}) }] : []),
    ...(lead.phone ? [{ label: "Teléfono", value: lead.phone, href: `tel:${telHref}` }] : []),
    { label: "Recibido", value: `${received} (hora de Honduras)` },
  ];

  const reply: Block[] = replyEmail
    ? [{ type: "button", label: `Responder a ${lead.name}`, url: `mailto:${replyEmail}` }]
    : [{
      type: "paragraph",
      muted: true,
      content: lead.phone
        ? "El contacto no dejó un correo al que responder: comunícate por teléfono."
        : "El contacto no dejó un correo válido al que responder.",
    }];

  const notStored: Block[] = stored ? [] : [{
    type: "notice",
    title: "No se registró en el panel",
    content: "La solicitud no pudo guardarse como ticket. Regístrala manualmente a partir de este correo.",
  }];

  const limitsUnchecked: Block[] = flags.limitsUnchecked ? [{
    type: "notice",
    title: "Límites de seguridad no verificados",
    content: "Este mensaje llegó mientras la base de datos no respondía, así que no se pudo comprobar el límite de envíos. " +
      "Si recibes varios correos como este seguidos, o ves mensajes sospechosos, revisa los registros de la función send-contact-email.",
  }] : [];

  return renderEmail({
    preheader: `${lead.name} escribió a través del formulario de contacto.`,
    eyebrow: "Nueva solicitud",
    title: "Nuevo mensaje desde el sitio web",
    blocks: [
      {
        type: "paragraph",
        content: ["Has recibido una nueva consulta a través del formulario de contacto de ", { strong: BRAND.name }, "."],
      },
      ...limitsUnchecked, // right under the intro, before the lead's details: it is the first thing to read, with room around it
      { type: "details", rows },
      { type: "message", caption: "Mensaje", text: lead.message },
      ...reply,
      ...notStored,
    ],
    footerNote: stored
      ? `Notificación interna del formulario de contacto de ${BRAND.siteLabel}. La solicitud también se registró como ticket en el panel.`
      : `Notificación interna del formulario de contacto de ${BRAND.siteLabel}.`,
  });
}

/** Subject of the outage alert (see alertHtml). */
export function alertSubject(): string {
  return `Formulario de contacto fuera de servicio — ${BRAND.name}`;
}

/**
 * Internal alert: the contact form is refusing every message because its limit check is misconfigured (a failure that will
 * not heal by itself). Sent by the function, once per instance every 30 minutes, and never contains anything a visitor sent;
 * `detail` is the bounded technical reason (database code / status / message), shown escaped by the layout.
 */
export function alertHtml(detail: string): string {
  return renderEmail({
    preheader: "El formulario de contacto está rechazando todos los mensajes.",
    eyebrow: "Alerta",
    title: "El formulario de contacto está fuera de servicio",
    blocks: [
      {
        type: "paragraph",
        content: [
          "La comprobación de límites del formulario falló por un problema de configuración y, por seguridad, el formulario responde ",
          { strong: "«servicio no disponible»" },
          " a todos los visitantes hasta que se corrija. Los mensajes que lleguen mientras tanto no se guardan ni se envían.",
        ],
      },
      { type: "details", rows: [{ label: "Detalle técnico", value: detail }] },
      {
        type: "notice",
        title: "Qué revisar",
        content: "En Supabase: que exista la tabla public.contact_rate_events, que la clave edge_functions tenga permisos sobre ella y " +
          "sobre tickets, y los registros de la función send-contact-email (busca «throttle misconfigured»). Si no puedes corregirlo " +
          "enseguida, vuelve a desplegar la versión anterior con el procedimiento de reversión.",
      },
    ],
    footerNote: `Notificación interna del formulario de contacto de ${BRAND.siteLabel}.`,
  });
}
