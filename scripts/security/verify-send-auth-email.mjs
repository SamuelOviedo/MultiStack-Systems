#!/usr/bin/env node
/**
 * Production probe for send-auth-email (fix S3). Sends NO e-mail with either
 * the old (v16) or the fixed code, and tells which one is deployed:
 *
 *   payload            old v16 (no signature check)        fixed (Standard Webhooks)
 *   {}                 400 "Missing required fields"       401 Invalid webhook signature
 *   reauthentication   200 {} (no template → no e-mail)    401 Invalid webhook signature
 *   forged signature   200 {} (no template → no e-mail)    401 Invalid webhook signature
 *
 * The recipient uses the reserved ".invalid" TLD (undeliverable) as a second
 * safety net. Prints status codes only.
 *
 *   node scripts/security/verify-send-auth-email.mjs
 */
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../../.env", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]),
);
const SUPABASE_URL = (process.env.SUPABASE_URL ?? env.VITE_SUPABASE_URL ?? "").replace(/\/+$/, "");
const FN = process.env.FUNCTION_URL ?? `${SUPABASE_URL}/functions/v1/send-auth-email`;

const harmless = JSON.stringify({
  user: { email: "verify-s3@example.invalid" },
  email_data: { token_hash: "probe", email_action_type: "reauthentication", redirect_to: "" },
});
const now = String(Math.floor(Date.now() / 1000));

const probes = [
  ["unsigned, empty body", {}, "{}"],
  ["unsigned, harmless action", {}, harmless],
  [
    "forged signature, harmless action",
    { "webhook-id": "msg_probe", "webhook-timestamp": now, "webhook-signature": "v1,AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=" },
    harmless,
  ],
];

const results = [];
for (const [label, headers, body] of probes) {
  const res = await fetch(FN, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body });
  const text = (await res.text()).slice(0, 100);
  results.push(res.status);
  console.log(`${label.padEnd(36)} ${res.status}  ${text}`);
}

const fixed = results.every((s) => s === 401);
const old = results[0] === 400 && results[1] === 200;
console.log(
  fixed
    ? "\nVERDICT: fixed version deployed — unsigned/forged requests are rejected (S3 closed)."
    : old
      ? "\nVERDICT: OLD vulnerable version (v16) still deployed — S3 OPEN."
      : "\nVERDICT: unexpected responses — inspect function logs.",
);
process.exit(fixed ? 0 : 1);
