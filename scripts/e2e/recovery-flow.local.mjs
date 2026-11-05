#!/usr/bin/env node
/**
 * End-to-end check of the password-recovery flow against the LOCAL Supabase
 * stack (GoTrue + Mailpit) and a LOCAL dev server — real browser, real auth
 * e-mail, real Supabase session. Refuses to run against anything that is not
 * localhost. Never touches production.
 *
 * Prereqs:
 *   npx supabase start            (Mailpit enabled; seed user client@test.local / test123456)
 *   VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_PUBLISHABLE_KEY=<local anon> \
 *     npx vite --port 3000 --strictPort --host 127.0.0.1
 *   SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_ANON_KEY=<local anon> node scripts/e2e/recovery-flow.local.mjs
 *
 * Uses the installed Google Chrome through Playwright (channel "chrome").
 */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";

const APP = process.env.APP_URL ?? "http://127.0.0.1:3000";
const API = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const MAIL = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";
const ANON = process.env.SUPABASE_ANON_KEY ?? "";
const OUT = process.env.OUT_DIR ?? "e2e-artifacts";
const EMAIL = "client@test.local";
const OLD_PASSWORD = "test123456";
const NEW_PASSWORD = "NuevaClave2026";

for (const url of [APP, API, MAIL]) {
  const host = new URL(url).hostname;
  if (host !== "127.0.0.1" && host !== "localhost") {
    console.error(`Refusing to run: ${url} is not local.`);
    process.exit(2);
  }
}
if (!ANON) {
  console.error("SUPABASE_ANON_KEY (local) is required.");
  process.exit(2);
}
mkdirSync(OUT, { recursive: true });

let failures = 0;
const check = (ok, label) => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
};

async function passwordGrant(password) {
  const res = await fetch(`${API}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password }),
  });
  return res.status;
}

async function latestRecoveryLink() {
  for (let i = 0; i < 20; i++) {
    const list = await (await fetch(`${MAIL}/api/v1/messages`)).json();
    const msg = (list.messages ?? []).find((m) => (m.To ?? []).some((t) => t.Address === EMAIL));
    if (msg) {
      const full = await (await fetch(`${MAIL}/api/v1/message/${msg.ID}`)).json();
      const match = `${full.HTML ?? ""} ${full.Text ?? ""}`.match(/https?:\/\/[^\s"'<>]*\/auth\/v1\/verify[^\s"'<>]*/);
      if (match) return match[0].replace(/&amp;/g, "&");
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
try {
  await fetch(`${MAIL}/api/v1/messages`, { method: "DELETE" });
  check((await passwordGrant(OLD_PASSWORD)) === 200, "baseline: old password works");

  // 1. Request the recovery e-mail through the real UI
  await page.goto(`${APP}/auth/reset-password`);
  await page.getByLabel("Email de trabajo").fill(EMAIL);
  await page.getByRole("button", { name: "Enviar enlace de recuperación" }).click();
  await page.getByRole("heading", { name: "Revisa tu email" }).waitFor();
  check(true, "reset form submitted, 'Revisa tu email' shown");

  // 2. Open the link from the e-mail (Mailpit)
  const link = await latestRecoveryLink();
  check(Boolean(link), "recovery e-mail received in Mailpit");
  if (!link) throw new Error("no link");
  await page.goto(link);

  // 3. The app must land on the new-password screen (not the dashboard)
  await page.getByRole("heading", { name: "Crea una nueva contraseña" }).waitFor({ timeout: 15000 });
  check(page.url().startsWith(`${APP}/auth/update-password`), `landed on ${new URL(page.url()).pathname}`);
  check(!page.url().includes("access_token"), "tokens are not left in the address bar");
  await page.screenshot({ path: `${OUT}/1-update-password-form.png` });

  // 4. Validation, then the real update
  await page.getByLabel("Nueva contraseña").fill("corta1");
  await page.getByLabel("Confirmar contraseña").fill("corta1");
  await page.getByRole("button", { name: "Guardar nueva contraseña" }).click();
  check(await page.getByRole("alert").getByText("Usa al menos 8 caracteres.").isVisible(), "short password rejected in the UI");

  await page.getByLabel("Nueva contraseña").fill(NEW_PASSWORD);
  await page.getByLabel("Confirmar contraseña").fill(NEW_PASSWORD);
  await page.getByRole("button", { name: "Guardar nueva contraseña" }).click();
  await page.getByRole("heading", { name: "Contraseña actualizada" }).waitFor({ timeout: 15000 });
  check(true, "success screen shown");
  await page.screenshot({ path: `${OUT}/2-password-updated.png` });

  check((await passwordGrant(NEW_PASSWORD)) === 200, "new password works");
  check((await passwordGrant(OLD_PASSWORD)) === 400, "old password no longer works");

  await page.getByRole("button", { name: "Continuar" }).click();
  await page.waitForURL(`${APP}/solicitudes`, { timeout: 15000 });
  check(true, "client continues to /solicitudes");

  // 5. Re-using the same (consumed) link → invalid-link state
  const fresh = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await fresh.goto(link);
  await fresh.getByRole("heading", { name: "Enlace no válido" }).waitFor({ timeout: 15000 });
  check(true, "re-used link shows 'Enlace no válido' (mobile viewport)");
  await fresh.screenshot({ path: `${OUT}/3-invalid-link-mobile.png` });
} catch (e) {
  failures++;
  console.log(`FAIL  ${e instanceof Error ? e.message.split("\n")[0] : e}`);
  await page.screenshot({ path: `${OUT}/failure.png` }).catch(() => {});
} finally {
  await browser.close();
}

console.log(failures ? `\n${failures} check(s) FAILED` : "\nRecovery flow verified end to end.");
process.exit(failures ? 1 : 0);
