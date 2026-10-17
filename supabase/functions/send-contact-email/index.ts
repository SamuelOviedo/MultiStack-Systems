// Pinned on purpose: an unpinned "@2" is resolved when the function is DEPLOYED, so production could run a different
// supabase-js than the one the behaviour matrix was run against — and the limit check reads the shape of its errors
// (code / status, see classifyStoreError). Same version as send-notification and the frontend. Move it deliberately,
// together with the behaviour matrix.
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.110.5";
import { sendEmail, FROM_DEV, FROM_VERIFIED } from "../_shared/resend.ts";
import { edgeFunctionsKey } from "../_shared/keys.ts";
import { createContactHandler, type ContactStore } from "./handler.ts";
import { exactCount, STORE_TIMEOUT_MS, storeError } from "./limiter.ts";

// Request handling and abuse rules: see handler.ts. This file only wires the
// runtime (secrets, supabase-js, Resend) into it.

// ── Runtime config ────────────────────────────────────────────────────────────
//
// RESEND_FROM (Supabase secret, optional):
//   Unset / missing  →  uses onboarding@resend.dev  (Resend sandbox — no domain
//                        verification needed; delivers only to the Resend account
//                        owner's email address).
//   "verified"       →  uses FROM_VERIFIED: the corporate sender from the
//                        FROM_EMAIL secret, shared with the other e-mail
//                        functions (see _shared/sender.ts), so the Resend key
//                        can be restricted to that domain.
//
// To activate the verified sender once the domain is confirmed:
//   supabase secrets set RESEND_FROM=verified
//
const RESEND_FROM_ENV = Deno.env.get("RESEND_FROM");
const FROM_ADDRESS =
  RESEND_FROM_ENV === "verified" ? FROM_VERIFIED : FROM_DEV;

// Server-side key selected by name (see _shared/keys.ts); only its logical
// name is logged, never the key. Without it the function refuses requests (503).
const SECRET = edgeFunctionsKey();

// CONTACT_RATE_SALT (Supabase secret, ≥32 chars): HMAC key of the per-IP and
// per-e-mail buckets, so raw IPs and addresses are never stored. Deliberately no
// fallback to any API key: without it the function refuses requests with 503
// (fail closed, see handler.ts).
const RATE_SALT = Deno.env.get("CONTACT_RATE_SALT") ?? "";

// RESEND_DEST (optional): override delivery address.
// In sandbox mode Resend only delivers to the account owner — set this to
// isaaccoviedo@gmail.com for testing, remove once domain is verified.
const DEST = Deno.env.get("RESEND_DEST") ?? "samuel.oviedo@multistacksystems.com";

// ── Data store (supabase-js, edge_functions secret key) ───────────────────────

// deno-lint-ignore no-explicit-any
type Db = SupabaseClient<any>;

const since = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

/**
 * Every operation is cancelled by its own deadline (the handler also stops WAITING at the same time). Without it a hung
 * database leaves the requests running in the background, and supabase-js re-sends HEAD/GET up to three times with back-off
 * on network errors and 503/520 — an outage would feed itself. `.retry(false)` + an abort signal make one attempt, bounded.
 * One signal per operation: `recordAndCount` is a POST and a HEAD under the same deadline.
 */
const deadline = (ms = STORE_TIMEOUT_MS) => AbortSignal.timeout(ms);

function supabaseStore(db: Db): ContactStore {
  return {
    async recordAndCount(bucket) {
      const signal = deadline();
      const ins = await db.from("contact_rate_events").insert({ bucket }).abortSignal(signal);
      if (ins.error) throw storeError(ins.error, ins.status);
      const r = await db.from("contact_rate_events").select("id", { count: "exact", head: true })
        .eq("bucket", bucket).gte("created_at", since(60)).retry(false).abortSignal(signal);
      if (r.error) throw storeError(r.error, r.status);
      return exactCount(r);
    },
    async record(bucket) {
      const ins = await db.from("contact_rate_events").insert({ bucket }).abortSignal(deadline());
      if (ins.error) throw storeError(ins.error, ins.status);
    },
    async purge() {
      const r = await db.from("contact_rate_events").delete().lt("created_at", since(24 * 60)).retry(false).abortSignal(deadline());
      if (r.error) throw storeError(r.error, r.status);
    },
    async countLeads(minutes) {
      const r = await db.from("tickets").select("id", { count: "exact", head: true })
        .eq("type", "consulta").is("project_id", null).is("client_id", null)
        .gte("created_at", since(minutes)).retry(false).abortSignal(deadline());
      if (r.error) throw storeError(r.error, r.status);
      return exactCount(r);
    },
    async insertLead(lead) {
      // tickets has no phone column: it leads the description so the team sees it.
      const { error } = await db.from("tickets").insert({
        project_id:   null,
        client_name:  lead.name,
        client_email: lead.email || null,
        type:         "consulta",
        priority:     "media",
        status:       "abierto",
        title:        `Mensaje web de ${lead.name}`,
        description:  lead.phone ? `Teléfono: ${lead.phone}\n\n${lead.message}` : lead.message,
      }).abortSignal(deadline(STORE_TIMEOUT_MS * 2));
      return error ? error.message : null;
    },
  };
}

Deno.serve(createContactHandler({
  openStore: () =>
    SECRET.key
      ? supabaseStore(createClient(Deno.env.get("SUPABASE_URL")!, SECRET.key, {
        auth: { persistSession: false, autoRefreshToken: false },
      }))
      : null,
  secretSource: SECRET.source,
  rateSalt: RATE_SALT,
  resendConfigured: Boolean(Deno.env.get("RESEND_API_KEY")),
  fromAddress: FROM_ADDRESS,
  dest: DEST,
  sendEmail,
  log: (level, message) => console[level === "info" ? "log" : level](message),
}));
