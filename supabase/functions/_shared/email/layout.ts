/**
 * MultiStack Systems — unified e-mail design system.
 *
 * One layout for every transactional e-mail (Auth, welcome, ticket replies,
 * contact form): white card on a light-gray page, gray palette, dark-gray
 * primary button, consistent header and footer.
 *
 * E-mail-client safety: table layout, inline styles, no external CSS/JS, no
 * web fonts, 560 px max width (fluid below), a tiny <style> block only for
 * mobile tweaks (ignored safely where unsupported).
 *
 * Security: every block escapes its content; URLs are restricted to
 * http/https/mailto/tel. Templates compose blocks — they never concatenate
 * untrusted HTML. Pure module (no Deno globals): runs on Deno and in Vitest.
 */
import { escapeHtml } from "../html.ts";

// ── Brand tokens ─────────────────────────────────────────────────────────────
export const BRAND = {
  name: "MultiStack Systems",
  tagline: "Desarrollo de software y sistemas · Honduras",
  siteUrl: "https://www.multistacksystems.com",
  siteLabel: "multistacksystems.com",
  /** Public mailbox with MX records (the mail. sending subdomain has none). */
  supportEmail: "soporte@multistacksystems.com",
  /** Dark mark on transparent background — readable on white. */
  logoUrl: "https://www.multistacksystems.com/logo-black.png",
} as const;

export const COLORS = {
  page: "#f4f4f5",       // page background (zinc-100)
  card: "#ffffff",
  border: "#e4e4e7",     // zinc-200
  subtle: "#fafafa",     // zinc-50 — notices, detail tables
  title: "#18181b",      // zinc-900
  text: "#3f3f46",       // zinc-700
  muted: "#71717a",      // zinc-500
  faint: "#a1a1aa",      // zinc-400 — decorative only (bullets)
  footer: "#52525b",     // zinc-600 — footer text on the page background (AA)
  button: "#18181b",
  buttonText: "#ffffff",
} as const;

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";
const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace";

// ── Blocks ───────────────────────────────────────────────────────────────────
/** Inline text: plain strings are escaped; `{ strong }` renders bold. */
export type Inline = string | { strong: string };

export type Block =
  | { type: "paragraph"; content: Inline | Inline[]; muted?: boolean }
  | { type: "button"; label: string; url: string }
  | { type: "fallbackLink"; url: string }
  | { type: "details"; rows: Array<{ label: string; value: string; href?: string }> }
  | { type: "message"; caption?: string; text: string }
  | { type: "list"; items: string[] }
  | { type: "notice"; title?: string; content: Inline | Inline[] };

export interface EmailContent {
  /** Hidden preview line shown by inbox lists. */
  preheader: string;
  /** Small uppercase label above the title (context of the e-mail). */
  eyebrow?: string;
  title: string;
  blocks: Block[];
  /** Why the recipient gets this e-mail (footer, first line). */
  footerNote: string;
}

const SAFE_URL = /^(https?:\/\/|mailto:|tel:)/i;

/** Escaped URL safe for an href; anything outside http(s)/mailto/tel → "#". */
export function safeUrl(url: string): string {
  return SAFE_URL.test(url.trim()) ? escapeHtml(url.trim()) : "#";
}

function inline(content: Inline | Inline[]): string {
  const parts = Array.isArray(content) ? content : [content];
  return parts
    .map((p) =>
      typeof p === "string"
        ? escapeHtml(p)
        : `<strong style="color:${COLORS.title};font-weight:600;">${escapeHtml(p.strong)}</strong>`
    )
    .join("");
}

/** Escaped text with line breaks kept as <br> (Outlook ignores white-space:pre-wrap). */
function multiline(text: string): string {
  return escapeHtml(text).replace(/\r?\n/g, "<br />");
}

const P = `margin:0 0 16px;font-family:${FONT};font-size:15px;line-height:24px;`;

function renderBlock(block: Block): string {
  switch (block.type) {
    case "paragraph":
      return `<p style="${P}color:${block.muted ? COLORS.muted : COLORS.text};">${inline(block.content)}</p>`;

    case "button":
      return `
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0 28px;">
  <tr>
    <td class="ms-btn" align="center" bgcolor="${COLORS.button}" style="border-radius:8px;background-color:${COLORS.button};mso-padding-alt:14px 28px;">
      <a href="${safeUrl(block.url)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:15px;font-weight:600;line-height:20px;color:${COLORS.buttonText};text-decoration:none;border-radius:8px;">${escapeHtml(block.label)}</a>
    </td>
  </tr>
</table>`;

    case "fallbackLink":
      return `
<p style="margin:0 0 6px;font-family:${FONT};font-size:13px;line-height:20px;color:${COLORS.muted};">Si el botón no funciona, copia y pega este enlace en tu navegador:</p>
<p style="margin:0 0 24px;font-family:${MONO};font-size:12px;line-height:18px;word-break:break-all;"><a href="${safeUrl(block.url)}" target="_blank" rel="noopener noreferrer" style="color:${COLORS.muted};text-decoration:underline;">${escapeHtml(block.url)}</a></p>`;

    case "details":
      return `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:8px 0 24px;border:1px solid ${COLORS.border};border-radius:8px;background-color:${COLORS.subtle};">
${block.rows.map((row, i) => `  <tr>
    <td style="padding:12px 16px;${i > 0 ? `border-top:1px solid ${COLORS.border};` : ""}font-family:${FONT};">
      <p style="margin:0 0 2px;font-size:11px;line-height:16px;letter-spacing:0.06em;text-transform:uppercase;color:${COLORS.muted};">${escapeHtml(row.label)}</p>
      <p style="margin:0;font-size:15px;line-height:22px;color:${COLORS.title};">${row.href
        ? `<a href="${safeUrl(row.href)}" style="color:${COLORS.title};text-decoration:underline;">${escapeHtml(row.value)}</a>`
        : escapeHtml(row.value)}</p>
    </td>
  </tr>`).join("\n")}
</table>`;

    case "message":
      return `
${block.caption ? `<p style="margin:8px 0 8px;font-family:${FONT};font-size:11px;line-height:16px;letter-spacing:0.06em;text-transform:uppercase;color:${COLORS.muted};">${escapeHtml(block.caption)}</p>` : ""}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px;">
  <tr>
    <td style="padding:16px 20px;border-left:3px solid ${COLORS.title};background-color:${COLORS.subtle};font-family:${FONT};font-size:15px;line-height:24px;color:${COLORS.text};">${multiline(block.text)}</td>
  </tr>
</table>`;

    case "list":
      return `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 20px;">
${block.items.map((item) => `  <tr>
    <td width="20" valign="top" style="padding:4px 0;font-family:${FONT};font-size:15px;line-height:24px;color:${COLORS.faint};">&#8226;</td>
    <td style="padding:4px 0;font-family:${FONT};font-size:15px;line-height:24px;color:${COLORS.text};">${escapeHtml(item)}</td>
  </tr>`).join("\n")}
</table>`;

    case "notice":
      return `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:8px 0 0;border:1px solid ${COLORS.border};border-radius:8px;background-color:${COLORS.subtle};">
  <tr>
    <td style="padding:14px 16px;font-family:${FONT};font-size:13px;line-height:20px;color:${COLORS.muted};">
      ${block.title ? `<p style="margin:0 0 4px;font-weight:600;color:${COLORS.text};">${escapeHtml(block.title)}</p>` : ""}
      <p style="margin:0;">${inline(block.content)}</p>
    </td>
  </tr>
</table>`;
  }
}

// ── Layout ───────────────────────────────────────────────────────────────────
export function renderEmail(content: EmailContent): string {
  const support = escapeHtml(BRAND.supportEmail);
  return `<!DOCTYPE html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${escapeHtml(content.title)} — ${BRAND.name}</title>
  <style>
    @media only screen and (max-width: 600px) {
      .ms-outer { padding: 20px 12px !important; }
      .ms-card { padding: 28px 22px !important; }
      .ms-title { font-size: 22px !important; line-height: 30px !important; }
      .ms-btn, .ms-btn a { display: block !important; text-align: center !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${COLORS.page};-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:${COLORS.page};">${escapeHtml(content.preheader)}&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="${COLORS.page}" style="background-color:${COLORS.page};">
    <tr>
      <td class="ms-outer" align="center" style="padding:40px 16px;">
        <!--[if mso]><table role="presentation" width="560" align="center" cellspacing="0" cellpadding="0" border="0"><tr><td><![endif]-->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;">
          <!-- Header -->
          <tr>
            <td style="padding:0 4px 20px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td valign="middle" style="padding-right:10px;">
                    <img src="${BRAND.logoUrl}" width="24" height="28" alt="" style="display:block;width:24px;height:28px;border:0;" />
                  </td>
                  <td valign="middle" style="font-family:${FONT};font-size:16px;font-weight:600;letter-spacing:-0.01em;color:${COLORS.title};">${BRAND.name}</td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Card -->
          <tr>
            <td class="ms-card" bgcolor="${COLORS.card}" style="background-color:${COLORS.card};border:1px solid ${COLORS.border};border-radius:12px;padding:40px 40px 36px;">
              ${content.eyebrow ? `<p style="margin:0 0 10px;font-family:${FONT};font-size:12px;line-height:16px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${COLORS.muted};">${escapeHtml(content.eyebrow)}</p>` : ""}
              <h1 class="ms-title" style="margin:0 0 20px;font-family:${FONT};font-size:24px;line-height:32px;font-weight:600;letter-spacing:-0.02em;color:${COLORS.title};">${escapeHtml(content.title)}</h1>
              ${content.blocks.map(renderBlock).join("\n")}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 8px 0;font-family:${FONT};font-size:12px;line-height:19px;color:${COLORS.footer};">
              <p style="margin:0 0 8px;">${escapeHtml(content.footerNote)}</p>
              <p style="margin:0 0 8px;">¿Necesitas ayuda? Escríbenos a <a href="mailto:${support}" style="color:${COLORS.text};text-decoration:underline;">${support}</a>.</p>
              <p style="margin:0;">${BRAND.name} · ${BRAND.tagline} · <a href="${BRAND.siteUrl}" style="color:${COLORS.footer};text-decoration:underline;">${BRAND.siteLabel}</a></p>
            </td>
          </tr>
        </table>
        <!--[if mso]></td></tr></table><![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`;
}
