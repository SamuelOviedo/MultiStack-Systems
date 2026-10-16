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
 */
export function contactHtml(lead: Lead, stored: boolean, receivedAt: Date = new Date()): string {
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

  return renderEmail({
    preheader: `${lead.name} escribió a través del formulario de contacto.`,
    eyebrow: "Nueva solicitud",
    title: "Nuevo mensaje desde el sitio web",
    blocks: [
      {
        type: "paragraph",
        content: ["Has recibido una nueva consulta a través del formulario de contacto de ", { strong: BRAND.name }, "."],
      },
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
