// @vitest-environment node
/**
 * Welcome e-mail on the shared MultiStack design system (same layout as the
 * approved password-recovery and contact e-mails). The sample is also written
 * to _shared/email/__snapshots__/welcome.html — byte-identical to the reviewed
 * snapshot on the e-mail design branch.
 */
import { describe, it, expect } from "vitest";
import { BRAND, COLORS } from "../_shared/email/layout.ts";
import { WELCOME_SUBJECT, welcomeHtml } from "./templates.ts";

const EMAIL = "cliente@ejemplo.com";
const html = welcomeHtml(EMAIL, "María Fernanda");

describe("welcome e-mail — corporate design", () => {
  it("matches its reviewed HTML snapshot", async () => {
    await expect(html).toMatchFileSnapshot("../_shared/email/__snapshots__/welcome.html");
  });

  it("uses the shared light layout, not the old terminal design", () => {
    expect(html).toContain(`background-color:${COLORS.page}`);
    expect(html).toContain(`background-color:${COLORS.card}`);
    expect(html).toContain("logo-black.png");
    expect(html).not.toMatch(/#0a0e14|#0f1419|Consolas|logo-white/i);
  });

  it("links only to the platform and the support mailbox", () => {
    expect(html).toContain(`href="${BRAND.siteUrl}/dashboard"`);
    expect(html).toContain(BRAND.supportEmail);
    expect(BRAND.supportEmail).toBe("soporte@multistacksystems.com");
  });

  it("escapes the user's name and falls back to the address local part", () => {
    expect(welcomeHtml(EMAIL, "<img src=x onerror=alert(1)>")).not.toContain("<img src=x");
    expect(welcomeHtml("ana.lopez@ejemplo.com", "  ")).toContain("Te damos la bienvenida, ana.lopez");
    expect(WELCOME_SUBJECT).toBe("Te damos la bienvenida a MultiStack Systems");
  });
});
