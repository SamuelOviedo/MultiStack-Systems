/**
 * "The team replied to your ticket" e-mail, on the shared MultiStack design
 * system. Presentation only — authorization and data loading live in
 * handler.ts. All values are escaped by the layout blocks.
 */
import { BRAND, renderEmail, type Block } from "../_shared/email/layout.ts";

export function teamReplySubject(ticketTitle: string): string {
  return `Respuesta a tu ticket: ${ticketTitle} — ${BRAND.name}`;
}

export function teamReplyHtml(params: {
  ticketTitle: string;
  message: string;
  /** Where the client follows the request; null for project tickets (portal). */
  link: string | null;
}): string {
  const next: Block[] = params.link
    ? [
      { type: "paragraph", content: "Puedes ver el estado de tu solicitud y su historial en la plataforma:" },
      { type: "button", label: "Ver mis solicitudes", url: params.link },
    ]
    : [
      {
        type: "paragraph",
        content: "Puedes responder directamente a este correo o usar el enlace de seguimiento que te compartió nuestro equipo.",
      },
    ];

  return renderEmail({
    preheader: `Nuestro equipo respondió a "${params.ticketTitle}".`,
    eyebrow: "Seguimiento de tu solicitud",
    title: "Tienes una respuesta de nuestro equipo",
    blocks: [
      { type: "details", rows: [{ label: "Asunto", value: params.ticketTitle }] },
      { type: "message", caption: "Respuesta del equipo", text: params.message },
      ...next,
    ],
    footerNote: `Recibes este correo porque tienes una solicitud abierta con ${BRAND.name}.`,
  });
}
