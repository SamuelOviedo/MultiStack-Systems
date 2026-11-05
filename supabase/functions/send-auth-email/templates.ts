/**
 * Supabase Auth e-mails, built on the shared MultiStack design system
 * (`_shared/email/layout.ts`). Only presentation lives here: signature
 * verification, payload validation and the action → template mapping stay in
 * handler.ts. Every dynamic value is escaped by the layout blocks.
 */
import { BRAND, renderEmail } from "../_shared/email/layout.ts";

const ignoreIfNotYou = (what: string) => ({
  type: "notice" as const,
  title: "¿No fuiste tú?",
  content: [
    `${what} Si recibes mensajes que no reconoces, escríbenos a `,
    { strong: BRAND.supportEmail },
    ".",
  ],
});

/** Password recovery (action "recovery"). */
export function passwordRecoveryHtml(email: string, confirmUrl: string): string {
  return renderEmail({
    preheader: "Usa este enlace para crear una nueva contraseña. Caduca en 1 hora.",
    eyebrow: "Seguridad de la cuenta",
    title: "Restablece tu contraseña",
    blocks: [
      {
        type: "paragraph",
        content: [
          "Recibimos una solicitud para restablecer la contraseña de la cuenta asociada a ",
          { strong: email },
          ".",
        ],
      },
      {
        type: "paragraph",
        content: "Pulsa el botón para continuar. Por seguridad, el enlace caduca en 1 hora y solo puede usarse una vez.",
      },
      { type: "button", label: "Restablecer contraseña", url: confirmUrl },
      { type: "fallbackLink", url: confirmUrl },
      ignoreIfNotYou("Si no solicitaste este cambio, ignora este correo: tu contraseña seguirá siendo la misma."),
    ],
    footerNote: `Recibes este correo porque se solicitó restablecer la contraseña de tu cuenta en ${BRAND.name}.`,
  });
}

/** Sign-up confirmation (action "signup"). */
export function confirmSignupHtml(email: string, confirmUrl: string): string {
  return renderEmail({
    preheader: "Confirma tu correo para activar tu cuenta en MultiStack Systems.",
    eyebrow: "Verificación de correo",
    title: "Confirma tu correo electrónico",
    blocks: [
      {
        type: "paragraph",
        content: [
          "Gracias por registrarte en MultiStack Systems. Para activar tu cuenta, confirma que ",
          { strong: email },
          " es tu dirección de correo.",
        ],
      },
      { type: "button", label: "Confirmar mi cuenta", url: confirmUrl },
      { type: "fallbackLink", url: confirmUrl },
      ignoreIfNotYou("Si no creaste esta cuenta, ignora este correo: no se activará sin tu confirmación."),
    ],
    footerNote: `Recibes este correo porque se registró una cuenta con esta dirección en ${BRAND.name}.`,
  });
}

/** New-address confirmation after an e-mail change (action "email_change_new"). */
export function emailChangeHtml(email: string, confirmUrl: string): string {
  return renderEmail({
    preheader: "Confirma tu nueva dirección de correo en MultiStack Systems.",
    eyebrow: "Verificación de correo",
    title: "Confirma tu nuevo correo",
    blocks: [
      {
        type: "paragraph",
        content: ["Recibimos una solicitud para usar ", { strong: email }, " como el nuevo correo de tu cuenta."],
      },
      { type: "button", label: "Confirmar nuevo correo", url: confirmUrl },
      { type: "fallbackLink", url: confirmUrl },
      ignoreIfNotYou("Si no pediste este cambio, ignora este correo: tu dirección actual no se modificará."),
    ],
    footerNote: `Recibes este correo porque se solicitó un cambio de correo en una cuenta de ${BRAND.name}.`,
  });
}

/** Invitation (action "invite"). */
export function inviteHtml(email: string, confirmUrl: string): string {
  return renderEmail({
    preheader: "Acepta la invitación para acceder a la plataforma de MultiStack Systems.",
    eyebrow: "Invitación",
    title: "Te invitaron a MultiStack Systems",
    blocks: [
      {
        type: "paragraph",
        content: [
          "Se creó una cuenta para ",
          { strong: email },
          " en la plataforma de MultiStack Systems. Acepta la invitación para activarla y acceder a tus proyectos y solicitudes.",
        ],
      },
      { type: "button", label: "Aceptar invitación", url: confirmUrl },
      { type: "fallbackLink", url: confirmUrl },
      ignoreIfNotYou("Si no esperabas esta invitación, puedes ignorar este correo."),
    ],
    footerNote: `Recibes este correo porque alguien del equipo de ${BRAND.name} te invitó a la plataforma.`,
  });
}
