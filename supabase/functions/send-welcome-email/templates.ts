/**
 * Welcome e-mail, on the shared MultiStack design system. Presentation only:
 * session check and idempotency (profiles.welcome_email_sent) stay in index.ts.
 */
import { BRAND, renderEmail } from "../_shared/email/layout.ts";

export const WELCOME_SUBJECT = `Te damos la bienvenida a ${BRAND.name}`;

/** Longest name shown in the greeting, counted in code points (not UTF-16 units). */
const MAX_NAME_LENGTH = 80;

/**
 * Removed from a name: C0/C1 controls (the whitespace ones become spaces instead),
 * soft hyphen, Arabic letter mark, blank Hangul letters, Mongolian vowel separator,
 * zero-width space, LRM/RLM, bidi embeddings and overrides, U+2060-206F (word joiner,
 * invisible operators, bidi isolates), BOM, every tag character and lone surrogates.
 * Tag characters also build the England/Scotland/Wales flags: they degrade to a plain
 * black flag (accepted trade-off). Kept on purpose: ZWNJ/ZWJ (U+200C/200D) and
 * variation selectors, which Persian, Indic scripts and compound emoji need.
 */
const INVISIBLE_RE = /[\u0000-\u0008\u000E-\u001F\u007F-\u0084\u0086-\u009F\u00AD\u061C\u115F-\u1160\u180E\u200B\u200E-\u200F\u202A-\u202E\u2060-\u206F\u3164\uFEFF\uFFA0\u{E0000}-\u{E007F}\uD800-\uDFFF]/gu;
const VISIBLE_RE = /[\p{L}\p{N}\p{Extended_Pictographic}]/u;
const TRAILING_RE = /[ \u200C\u200D]+$/;

function cleanName(value: string): string {
  const text = value.replace(INVISIBLE_RE, "").replace(/[\s\u0085]+/g, " ").trim();
  if (!VISIBLE_RE.test(text)) return ""; // only marks, joiners, symbols...: nothing to show
  const chars = Array.from(text); // by code point: never splits a surrogate pair
  if (chars.length <= MAX_NAME_LENGTH) return text;
  return `${chars.slice(0, MAX_NAME_LENGTH - 1).join("").replace(TRAILING_RE, "")}…`;
}

/**
 * Name shown in the greeting. HTML escaping (renderEmail) stops injected markup;
 * this stops misleading text without narrowing international names. Anything that
 * is not a string is ignored (user metadata is user-controlled); control, bidi and
 * invisible code points are removed, whitespace collapses, and the result is capped
 * at 80 code points ("…" if cut). A name with no letter, number or emoji left counts
 * as empty and falls back to the local part of the address, cleaned the same way.
 */
export function toDisplayName(name: unknown, email: string): string {
  const fromName = typeof name === "string" ? cleanName(name) : "";
  return fromName || cleanName(email.split("@")[0]);
}

export function welcomeHtml(email: string, name: unknown): string {
  const displayName = toDisplayName(name, email);
  return renderEmail({
    preheader: "Tu cuenta está activa. Esto es lo que puedes hacer en la plataforma.",
    eyebrow: "Cuenta activada",
    title: displayName ? `Te damos la bienvenida, ${displayName}` : "Te damos la bienvenida",
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
