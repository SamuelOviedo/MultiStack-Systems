#!/usr/bin/env node
/**
 * Production smoke test for send-notification (fix S2). Sends NO e-mail:
 * every request is designed to be rejected before Resend is ever called.
 *
 *   node scripts/security/verify-send-notification.mjs
 *   TEST_EMAIL=… TEST_PASSWORD=… node scripts/security/verify-send-notification.mjs
 *
 * Reads VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY from .env (public
 * values). With TEST_EMAIL/TEST_PASSWORD (an email+password account you own)
 * it also checks that a signed-in user is rejected (client → 403; staff → 404
 * for the non-existent ticket used here). Prints status codes only — never
 * tokens, keys or e-mail addresses.
 */
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../../.env", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]),
);
const SUPABASE_URL = (process.env.SUPABASE_URL ?? env.VITE_SUPABASE_URL ?? "").replace(/\/+$/, "");
const ANON = process.env.SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_PUBLISHABLE_KEY ?? env.VITE_SUPABASE_ANON_KEY ?? "";
if (!SUPABASE_URL || !ANON) {
  console.error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY in .env");
  process.exit(2);
}

// FUNCTION_URL: optional override (e.g. a local `deno run` of the function).
const FN = process.env.FUNCTION_URL ?? `${SUPABASE_URL}/functions/v1/send-notification`;
const NIL = "00000000-0000-4000-8000-000000000000";
const NEW_CONTRACT = { type: "team_reply", ticket_id: NIL, message_id: NIL };
// The pre-fix exploit shape. ".invalid" is a reserved TLD: undeliverable.
const OLD_EXPLOIT = {
  type: "team_reply",
  ticket: { title: "verify", client_email: "verify-s2@example.invalid" },
  message: "<b>verify</b>",
  portalUrl: "https://example.invalid",
};

let failures = 0;
async function check(label, expected, init) {
  const res = await fetch(FN, init);
  const body = (await res.text()).slice(0, 120).replace(/eyJ[\w.-]+/g, "<redacted>");
  const ok = expected.includes(res.status);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label.padEnd(44)} ${res.status}  ${body}`);
}

const post = (headers, body) => ({
  method: "POST",
  headers: { "Content-Type": "application/json", ...headers },
  body: JSON.stringify(body),
});

await check("no Authorization (old exploit)", [401], post({}, OLD_EXPLOIT));
await check("apikey only (old exploit)", [401], post({ apikey: ANON }, OLD_EXPLOIT));
await check("anon key as bearer (old exploit)", [401], post({ apikey: ANON, Authorization: `Bearer ${ANON}` }, OLD_EXPLOIT));
await check("anon key as bearer (new contract)", [401], post({ apikey: ANON, Authorization: `Bearer ${ANON}` }, NEW_CONTRACT));
await check("malformed bearer", [401], post({ apikey: ANON, Authorization: "Bearer abc.def" }, NEW_CONTRACT));

if (process.env.TEST_EMAIL && process.env.TEST_PASSWORD) {
  const auth = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email: process.env.TEST_EMAIL, password: process.env.TEST_PASSWORD }),
  });
  const token = (await auth.json()).access_token;
  if (!token) {
    console.log(`SKIP  signed-in checks: login failed (HTTP ${auth.status})`);
  } else {
    const h = { apikey: ANON, Authorization: `Bearer ${token}` };
    // client → 403 forbidden; staff → 404 (ticket NIL does not exist). Never 200.
    await check("signed-in user, non-existent ticket", [403, 404], post(h, NEW_CONTRACT));
    await check("signed-in user, old exploit payload", [400, 403], post(h, OLD_EXPLOIT));
  }
} else {
  console.log("SKIP  signed-in checks (set TEST_EMAIL / TEST_PASSWORD to run them)");
}

console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll checks passed — no e-mail was sent.");
process.exit(failures ? 1 : 0);
