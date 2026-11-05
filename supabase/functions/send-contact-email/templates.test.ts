// @vitest-environment node
/**
 * Contact-form notification on the shared MultiStack e-mail design system.
 * Each sample is also written to _shared/email/__snapshots__/<name>.html (open
 * it in a browser to review the design; visual changes show up in the diff).
 */
import { describe, it, expect } from "vitest";
import { BRAND, COLORS, renderEmail } from "../_shared/email/layout.ts";
import { contactHtml, contactSubject } from "./templates.ts";
import { SUPPORT_REPLY_TO } from "./reply-to.ts";

// Deterministic sample data (no real addresses).
const RECEIVED = new Date("2026-10-14T16:41:00Z");
const FULL = { name: "Ana López", phone: "+504 9999-0000", email: "ana@ejemplo.com", message: "Quisiera cotizar un sistema de inventario.\n\n¿Pueden llamarme el lunes?" };
const PHONE_ONLY = { name: "Carlos Pérez", phone: "+504 8888-1111", email: "", message: "Llámenme por favor." };

const SAMPLES: Record<string, string> = {
  "contact-internal": contactHtml(FULL, true, RECEIVED),
  "contact-internal-phone-only": contactHtml(PHONE_ONLY, true, RECEIVED),
  "contact-internal-not-stored": contactHtml(FULL, false, RECEIVED),
};

/** Header (logo + wordmark) and footer as rendered for any e-mail. */
const chrome = (html: string) => ({
  header: html.slice(html.indexOf("<!-- Header -->"), html.indexOf("<!-- Card -->")),
  footer: html.slice(html.indexOf("¿Necesitas ayuda?"), html.indexOf("<!--[if mso]></td>")),
  head: html.slice(html.indexOf("<style>"), html.indexOf("</style>")),
});

describe("contact e-mail — corporate design", () => {
  it.each(Object.entries(SAMPLES))("%s matches its reviewed HTML snapshot", async (name, html) => {
    await expect(html).toMatchFileSnapshot(`../_shared/email/__snapshots__/${name}.html`);
  });

  it.each(Object.entries(SAMPLES))("%s uses the shared layout (white card, gray palette, header, footer)", (_n, html) => {
    expect(html).toMatch(/^<!DOCTYPE html>\n<html lang="es"/);
    expect(html).toContain(`background-color:${COLORS.page}`);
    expect(html).toContain(`background-color:${COLORS.card}`);
    expect(html).toContain(`border:1px solid ${COLORS.border}`);
    expect(html).toContain("max-width:560px");
    expect(html).toContain(BRAND.logoUrl);
    expect(html).toContain(`>${BRAND.name}</td>`);
    expect(html).toContain(`mailto:${BRAND.supportEmail}`);
    expect(html).toContain(BRAND.tagline);
  });

  it.each(Object.entries(SAMPLES))("%s has exactly the header and footer of every other e-mail (e.g. password recovery)", (_n, html) => {
    const reference = renderEmail({ preheader: "x", title: "Restablece tu contraseña", blocks: [], footerNote: "x" });
    expect(chrome(html)).toEqual(chrome(reference));
  });

  it.each(Object.entries(SAMPLES))("%s drops the old dark 'terminal' look", (_n, html) => {
    for (const legacy of ["#0a0e14", "#0f1419", "#0b1120", "#00ff00", "#0ea5e9", "logo-white.png", "Consolas','Monaco'", "Courier New"]) {
      expect(html).not.toContain(legacy);
    }
  });

  it.each(Object.entries(SAMPLES))("%s is e-mail-client safe (tables, inline styles, safe links only)", (_n, html) => {
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/<link[^>]+stylesheet/i);
    expect(html).toContain('role="presentation"');
    expect(html).toContain("<!--[if mso]>");
    for (const [, href] of html.matchAll(/href="([^"]*)"/g)) {
      expect(href).toMatch(/^(https?:\/\/|mailto:|tel:)/);
    }
  });

  it("shows the approved copy and every field of the lead", () => {
    const html = SAMPLES["contact-internal"];
    for (const text of [
      "Nueva solicitud", "Nuevo mensaje desde el sitio web",
      "Has recibido una nueva consulta a través del formulario de contacto de ",
      "Nombre completo", "Ana López", "Correo", "ana@ejemplo.com", "Teléfono", "+504 9999-0000",
      "Recibido", "(hora de Honduras)", "Mensaje", "Quisiera cotizar un sistema de inventario.<br /><br />¿Pueden llamarme el lunes?",
      "La solicitud también se registró como ticket en el panel.",
    ]) expect(html).toContain(text);
    expect(html).toContain('href="mailto:ana@ejemplo.com"');
    expect(html).toContain('href="tel:+50499990000"');
    expect(contactSubject("Ana López")).toBe("Nuevo mensaje de Ana López — MultiStack Systems");
  });

  it("phone-only leads get a phone hint instead of a reply button", () => {
    const html = SAMPLES["contact-internal-phone-only"];
    expect(html).not.toContain("Responder a");
    expect(html).not.toContain(">Correo<");
    expect(html).toContain("comunícate por teléfono");
  });

  it("never claims the lead is in the panel when the insert failed", () => {
    const html = SAMPLES["contact-internal-not-stored"];
    expect(html).toContain("No se registró en el panel");
    expect(html).not.toContain("también se registró como ticket");
  });
});

describe("contact e-mail — untrusted input", () => {
  const evil = {
    name: `<script>alert(1)</script> "Ana" & <b>`,
    phone: "",
    email: `x"onmouseover="alert(1)@ejemplo.com`,
    message: `<img src=x onerror=alert(1)>\n</td></tr></table><a href="javascript:alert(1)">x</a>`,
  };
  const html = contactHtml(evil, true, RECEIVED);

  it("escapes every visitor value", () => {
    expect(html).not.toContain("<script>alert(1)");
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("<b>");
    expect(html).not.toContain('onmouseover="');
    expect(html).not.toMatch(/href="javascript:/i);                     // shown as text only
    expect(html).toContain("&lt;a href=&quot;javascript:alert(1)&quot;&gt;");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt; &quot;Ana&quot; &amp; &lt;b&gt;");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;<br />&lt;/td&gt;&lt;/tr&gt;&lt;/table&gt;");
  });

  it("does not link or offer to reply to an address the Reply-To header would refuse", () => {
    expect(html).not.toContain("mailto:x");
    expect(html).not.toContain("Responder a");
    expect(html).toContain("x&quot;onmouseover=&quot;alert(1)@ejemplo.com");  // still shown, escaped
    expect(SUPPORT_REPLY_TO).toBe(BRAND.supportEmail);
  });
});

describe("contact e-mail — accessible contrast (WCAG AA ≥ 4.5:1)", () => {
  const lum = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a: string, b: string) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };

  it.each([
    ["title on card", COLORS.title, COLORS.card],
    ["text on card", COLORS.text, COLORS.card],
    ["muted on card", COLORS.muted, COLORS.card],
    ["text on detail/message background", COLORS.text, COLORS.subtle],
    ["muted on detail/message background", COLORS.muted, COLORS.subtle],
    ["footer on page", COLORS.footer, COLORS.page],
    ["button text on button", COLORS.buttonText, COLORS.button],
  ])("%s", (_n, fg, bg) => {
    expect(ratio(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });
});
