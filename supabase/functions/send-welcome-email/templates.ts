/**
 * Welcome e-mail, on the shared MultiStack design system. Presentation only:
 * session check and idempotency (profiles.welcome_email_sent) stay in index.ts.
 */
import { BRAND, renderEmail } from "../_shared/email/layout.ts";

export const WELCOME_SUBJECT = `Te damos la bienvenida a ${BRAND.name}`;

export function welcomeHtml(email: string, name: string): string {
  const displayName = name.trim() || email.split("@")[0];
  return renderEmail({
    preheader: "Tu cuenta está activa. Esto es lo que puedes hacer en la plataforma.",
    eyebrow: "Cuenta activada",
    title: `Te damos la bienvenida, ${displayName}`,
    blocks: [
      { type: "paragraph", content: "Tu cuenta en MultiStack Systems ya está activa. Desde la plataforma puedes:" },
      {
        type: "list",
        items: [
          "Enviar solicitudes de desarrollo y cotización.",
          "Dar seguimiento al estado de tus solicitudes y proyectos.",
          "Comunicarte directamente con nuestro equipo.",
        ],
      },
      { type: "button", label: "Ir a la plataforma", url: `${BRAND.siteUrl}/dashboard` },
      {
        type: "paragraph",
        muted: true,
        content: ["¿Tienes alguna pregunta? Responde a este correo o escríbenos a ", { strong: BRAND.supportEmail }, "."],
      },
    ],
    footerNote: `Recibes este correo porque creaste una cuenta en ${BRAND.name}. Si no reconoces esta actividad, escríbenos.`,
  });
}
