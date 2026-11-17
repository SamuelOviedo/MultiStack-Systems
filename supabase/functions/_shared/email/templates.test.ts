// @vitest-environment node
/**
 * Unified e-mail design system — every MultiStack e-mail must share one layout
 * (white card, gray palette, same header/footer) and stay safe for e-mail
 * clients. Each template is also written to __snapshots__/<name>.html: open
 * those files in a browser to review the design; any visual change shows up
 * in the git diff.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { BRAND, COLORS, renderEmail, safeUrl } from "./layout.ts";
import {
  confirmSignupHtml, emailChangeHtml, inviteHtml, passwordRecoveryHtml,
} from "../../send-auth-email/templates.ts";
import { welcomeHtml } from "../../send-welcome-email/templates.ts";
import { teamReplyHtml } from "../../send-notification/templates.ts";
import { alertHtml, contactHtml } from "../../send-contact-email/templates.ts";

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
    expect(html).toContain(BRAND.logoUrl);                              // official full logo
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

describe("header — official full logo (no duplicated brand text), safe for Gmail and Outlook", () => {
  const LOGO_FILE = new URL("../../../../public/brand/email-logo-v2.png", import.meta.url);
  const LOGO_URL = "https://www.multistacksystems.com/brand/email-logo-v2.png";
  /** Real pixels of the logo file, read from its IHDR chunk. */
  const logoPixels = (): [number, number] => {
    const png = readFileSync(LOGO_FILE);
    return [png.readUInt32BE(16), png.readUInt32BE(20)];
  };
  const header = (html: string) => html.slice(html.indexOf("<!-- Header -->"), html.indexOf("<!-- Card -->"));

  /** Contingency templates pasted by hand into the Dashboard (Auth → Email Templates); used only without the Send Email Hook. */
  const STATIC_DIR = new URL("../../../email-templates/", import.meta.url);
  const STATIC: Record<string, string> = Object.fromEntries(
    readdirSync(STATIC_DIR).filter((f) => f.endsWith(".html")).sort()
      .map((f) => [`email-templates/${f}`, readFileSync(new URL(f, STATIC_DIR), "utf8").replace(/\r\n/g, "\n")]),
  );
  /** Every e-mail the functions render (contact ones too, sample data is fictitious) plus the static ones. */
  const ALL: Record<string, string> = {
    ...TEMPLATES,
    "contact-internal": contactHtml({ name: "Ana López", phone: "+504 9999-0000", email: "ana@ejemplo.com", message: "Hola." }, true, RECEIVED),
    "contact-alert-unavailable": alertHtml("1/4 checks failed"),
    ...STATIC,
  };

  it("the static templates are the two known ones and keep their Supabase Auth variables", () => {
    expect(Object.keys(STATIC)).toEqual(["email-templates/confirm-signup.html", "email-templates/reset-password.html"]);
    for (const [name, html] of Object.entries(STATIC)) {
      expect(html.match(/href="\{\{ \.ConfirmationURL \}\}"/g), name).toHaveLength(2);   // button + fallback link
      expect(html, name).toContain("{{ .Email }}");
    }
  });

  it("every template, static ones included, carries exactly the header of the shared layout", () => {
    const reference = header(renderEmail({ preheader: "x", title: "x", blocks: [], footerNote: "x" }));
    expect(reference).toContain(LOGO_URL);
    for (const [name, html] of Object.entries(ALL)) expect(header(html), name).toBe(reference);
  });

  it.each(Object.entries(ALL))("%s: the logo is one PNG <img> by absolute URL, sized in attributes and style, in a table cell", (_n, html) => {
    const head = header(html);
    // A plain row of the layout table: <tr><td><img/></td></tr>, nothing Outlook (Word) could drop around it.
    expect(head).toMatch(/^<!-- Header -->\n\s*<tr>\n\s*<td style="padding:0 4px 20px;">\n\s*<img [^>]*\/>\n\s*<\/td>\n\s*<\/tr>\n\s*$/);
    const imgs = head.match(/<img\b[^>]*>/g) ?? [];
    expect(imgs).toHaveLength(1);
    const img = imgs[0];
    const attr = (name: string) => new RegExp(`\\s${name}="([^"]*)"`).exec(img)?.[1];
    expect(attr("src")).toBe(LOGO_URL);
    // The <img> is the file at half size (2x for retina screens); the odd height rounds up (189 / 2 = 94.5 -> 95).
    const [pxW, pxH] = logoPixels();
    const [w, h] = [String(Math.round(pxW / 2)), String(Math.round(pxH / 2))];
    expect([attr("width"), attr("height")]).toEqual([w, h]);
    expect(Math.abs(Number(h) / Number(w) - pxH / pxW)).toBeLessThan(0.01);   // same aspect as the file
    expect(attr("alt")).toBe("MultiStack Systems");
    const style = Object.fromEntries(
      (attr("style") ?? "").split(";").filter(Boolean).map((d) => [d.slice(0, d.indexOf(":")).trim(), d.slice(d.indexOf(":") + 1).trim()]),
    );
    expect(style).toMatchObject({
      display: "block", width: `${w}px`, height: `${h}px`, border: "0", outline: "none", "text-decoration": "none",
    });
    expect(style["font-family"]).toBeTruthy();                                 // alt stays legible with images blocked
    expect(head).not.toMatch(/<td[^>]*>\s*MultiStack Systems\s*<\/td>/);       // old duplicated text label is gone
    expect(head).not.toMatch(/<div|float|position\s*:|display\s*:\s*(flex|grid)|max-width|:\s*auto/i);
    // Widest client support, in the whole document: no SVG, WebP, <picture>, srcset or CSS background images.
    expect(html).not.toMatch(/<svg|\.svg\b|\.webp\b|<picture|srcset|background-image|url\(/i);
  });

  it("BRAND.logoUrl is an https URL on the brand host whose file ships in public/ at 264x189", () => {
    const url = new URL(BRAND.logoUrl);
    expect(url.protocol).toBe("https:");
    expect(url.hostname).toBe("www.multistacksystems.com");
    expect(url.pathname).toBe("/brand/email-logo-v2.png");
    const png = readFileSync(LOGO_FILE);
    expect(png.subarray(1, 4).toString("latin1")).toBe("PNG");
    expect(png.subarray(12, 16).toString("latin1")).toBe("IHDR");
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([264, 189]); // 2x of 132 x 94.5
  });

  it("no code or snapshot under supabase/functions, nor a static template, references the old logo files", () => {
    const root = new URL("../../", import.meta.url);
    const files = (readdirSync(root, { recursive: true }) as string[])
      .map((f) => f.split("\\").join("/"))
      .filter((f) => /\.(ts|html)$/.test(f) && !f.endsWith(".test.ts"));
    expect(files.length).toBeGreaterThan(10);
    for (const f of files) {
      expect(readFileSync(new URL(f, root), "utf8"), f).not.toMatch(/logo-(black|white)\.png/);
    }
    for (const [name, html] of Object.entries(STATIC)) expect(html, name).not.toMatch(/logo-(black|white)\.png/);
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
