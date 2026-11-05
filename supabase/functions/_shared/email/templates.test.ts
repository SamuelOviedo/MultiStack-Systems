// @vitest-environment node
/**
 * Unified e-mail design system — every MultiStack e-mail must share one layout
 * (white card, gray palette, same header/footer) and stay safe for e-mail
 * clients. Each template is also written to __snapshots__/<name>.html: open
 * those files in a browser to review the design; any visual change shows up
 * in the git diff.
 */
import { describe, it, expect } from "vitest";
import { BRAND, COLORS, renderEmail, safeUrl } from "./layout.ts";
import {
  confirmSignupHtml, emailChangeHtml, inviteHtml, passwordRecoveryHtml,
} from "../../send-auth-email/templates.ts";
import { welcomeHtml } from "../../send-welcome-email/templates.ts";
import { teamReplyHtml } from "../../send-notification/templates.ts";

// Deterministic sample data (no real addresses or tokens).
const EMAIL = "cliente@ejemplo.com";
const VERIFY_URL =
  "https://ckyqrdemgssbrqfnkxsr.supabase.co/auth/v1/verify?token=EJEMPLO_TOKEN_HASH&type=recovery&redirect_to=https%3A%2F%2Fmultistacksystems.com%2Fauth%2Fcallback";
const RECEIVED = new Date("2026-10-14T16:41:00Z");

const TEMPLATES: Record<string, string> = {
  "auth-password-recovery": passwordRecoveryHtml(EMAIL, VERIFY_URL),
  "auth-confirm-signup": confirmSignupHtml(EMAIL, VERIFY_URL.replace("type=recovery", "type=signup")),
  "auth-email-change": emailChangeHtml(EMAIL, VERIFY_URL.replace("type=recovery", "type=email_change")),
  "auth-invite": inviteHtml(EMAIL, VERIFY_URL.replace("type=recovery", "type=invite")),
  "welcome": welcomeHtml(EMAIL, "María Fernanda"),
  "ticket-reply": teamReplyHtml({
    ticketTitle: "Tienda online para ropa deportiva",
    message: "Hola, ya revisamos tu solicitud.\n\nTe proponemos una llamada el jueves para definir el alcance.",
    link: "https://www.multistacksystems.com/solicitudes",
  }),
  "ticket-reply-project": teamReplyHtml({
    ticketTitle: "Ajuste en el formulario de pedidos",
    message: "Ya desplegamos el cambio en producción.",
    link: null,
  }),
  // The internal contact e-mail is covered by supabase/functions/send-contact-email/templates.test.ts
  // (production contact function), with its own reviewed snapshots.
};

describe("e-mail design system — one visual line for every e-mail", () => {
  it.each(Object.entries(TEMPLATES))("%s matches its reviewed HTML snapshot", async (name, html) => {
    await expect(html).toMatchFileSnapshot(`./__snapshots__/${name}.html`);
  });

  it.each(Object.entries(TEMPLATES))("%s uses the shared layout (white card, gray palette, header, footer)", (_n, html) => {
    expect(html).toMatch(/^<!DOCTYPE html>\n<html lang="es"/);
    expect(html).toContain(`background-color:${COLORS.page}`);          // light-gray page
    expect(html).toContain(`background-color:${COLORS.card}`);          // white card
    expect(html).toContain(`border:1px solid ${COLORS.border}`);
    expect(html).toContain("max-width:560px");
    expect(html).toContain(BRAND.logoUrl);                              // dark logo on white
    expect(html).toContain(`>${BRAND.name}</td>`);                      // wordmark
    expect(html).toContain(`mailto:${BRAND.supportEmail}`);             // footer help line
    expect(html).toContain(BRAND.tagline);
  });

  it.each(Object.entries(TEMPLATES))("%s drops the old dark 'terminal' look", (_n, html) => {
    for (const legacy of ["#0a0e14", "#0f1419", "#0b1120", "#00ff00", "#00ff88", "#0ea5e9", "#f59e0b", "logo-white.png", "Consolas','Monaco'", "multistack-auth"]) {
      expect(html).not.toContain(legacy);
    }
  });

  it.each(Object.entries(TEMPLATES))("%s is e-mail-client safe", (_n, html) => {
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/<link[^>]+stylesheet/i);
    expect(html).toContain('role="presentation"');                      // table layout
    for (const [, href] of html.matchAll(/href="([^"]*)"/g)) {
      expect(href).toMatch(/^(https?:\/\/|mailto:|tel:)/);              // no javascript: etc.
    }
  });
});

describe("password recovery e-mail", () => {
  const html = TEMPLATES["auth-password-recovery"];

  it("says clearly what happened and for which account", () => {
    expect(html).toContain("Restablece tu contraseña");
    expect(html).toContain("Recibimos una solicitud para restablecer la contraseña");
    expect(html).toContain(`>${EMAIL}</strong>`);
  });

  it("has one prominent dark button plus the visible fallback link", () => {
    expect(html.match(/class="ms-btn"/g)).toHaveLength(1);
    expect(html).toContain(`bgcolor="${COLORS.button}"`);
    expect(html).toContain(">Restablecer contraseña</a>");
    const escapedUrl = VERIFY_URL.replace(/&/g, "&amp;");
    expect(html).toContain(`href="${escapedUrl}"`);
    expect(html).toContain(`>${escapedUrl}</a>`);                      // copy-paste fallback
    expect(html).toContain("Si el botón no funciona");
  });

  it("explains expiry and warns when the request was not made by the user", () => {
    expect(html).toContain("caduca en 1 hora");
    expect(html).toContain("¿No fuiste tú?");
    expect(html).toContain("tu contraseña seguirá siendo la misma");
  });
});

describe("readability & Outlook compatibility", () => {
  const luminance = (hex: string) => {
    const [r, g, b] = [1, 3, 5]
      .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a: string, b: string) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };

  it.each([
    ["button label", COLORS.buttonText, COLORS.button],
    ["title on card", COLORS.title, COLORS.card],
    ["body text on card", COLORS.text, COLORS.card],
    ["secondary text on card", COLORS.muted, COLORS.card],
    ["notice text on subtle", COLORS.muted, COLORS.subtle],
    ["message text on subtle", COLORS.text, COLORS.subtle],
    ["footer text on page", COLORS.footer, COLORS.page],
  ])("%s meets WCAG AA (≥ 4.5:1)", (_label, fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(Object.entries(TEMPLATES))("%s keeps 560 px in Outlook (ghost table) and has no low-contrast footer text", (_n, html) => {
    expect(html).toContain('<!--[if mso]><table role="presentation" width="560"');
    expect(html).toContain("<!--[if mso]></td></tr></table><![endif]-->");
    const footer = html.slice(html.indexOf("<!-- Footer -->"));
    expect(footer).not.toContain(COLORS.faint);
  });

  it("buttons keep their padding in Outlook (mso-padding-alt)", () => {
    expect(TEMPLATES["auth-password-recovery"]).toContain("mso-padding-alt:14px 28px;");
  });

  it("message line breaks survive in Outlook (<br />, not white-space:pre-wrap)", () => {
    const html = TEMPLATES["ticket-reply"];
    expect(html).toContain("Hola, ya revisamos tu solicitud.<br /><br />Te proponemos");
    expect(html).not.toContain("pre-wrap");
  });
});

describe("layout safety", () => {
  it("escapes every dynamic value", () => {
    const html = renderEmail({
      preheader: '<b>pre</b>',
      eyebrow: '<i>eye</i>',
      title: '<script>alert(1)</script>',
      blocks: [
        { type: "paragraph", content: ['<img src=x onerror="a()">', { strong: "<u>s</u>" }] },
        { type: "details", rows: [{ label: "<l>", value: '"><svg onload=1>' }] },
        { type: "message", caption: "<c>", text: "</td></tr></table><h1>x</h1>" },
        { type: "list", items: ["<li>x</li>"] },
        { type: "notice", title: "<t>", content: "<n>" },
        { type: "button", label: "<btn>", url: "https://ok.test/?a=1&b=2" },
      ],
      footerNote: "<f>",
    });
    for (const raw of ["<b>pre", "<i>eye", "<script>", "<img src=x", "<u>s", "<l>", "<svg", "</td></tr></table><h1>", "<li>x", "<t>", "<n>", "<btn>", "<f>"]) {
      expect(html).not.toContain(raw);
    }
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain('href="https://ok.test/?a=1&amp;b=2"');
  });

  it("neutralizes dangerous URL schemes", () => {
    expect(safeUrl("javascript:alert(1)")).toBe("#");
    expect(safeUrl("data:text/html,x")).toBe("#");
    expect(safeUrl(" https://ok.test ")).toBe("https://ok.test");
    expect(safeUrl("mailto:a@b.co")).toBe("mailto:a@b.co");
    expect(safeUrl("tel:+50499990000")).toBe("tel:+50499990000");
  });
});
