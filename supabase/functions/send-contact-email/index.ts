import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail, FROM_DEV, FROM_VERIFIED } from "../_shared/resend.ts";
import { edgeFunctionsKey } from "../_shared/keys.ts";
import { replyToFor } from "./reply-to.ts";
import { contactHtml, contactSubject, type Lead } from "./templates.ts";

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
// name is logged, never the key.
const SECRET = edgeFunctionsKey();

// RESEND_DEST (optional): override delivery address.
// In sandbox mode Resend only delivers to the account owner — set this to
// isaaccoviedo@gmail.com for testing, remove once domain is verified.
const DEST = Deno.env.get("RESEND_DEST") ?? "samuel.oviedo@multistacksystems.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Handler ───────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método no permitido" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Startup diagnostics logged to Supabase function logs
  console.log(`[contact] FROM_ADDRESS: ${FROM_ADDRESS}`);
  console.log(`[contact] DEST: ${DEST}`);
  console.log(`[contact] RESEND_API_KEY present: ${Boolean(Deno.env.get("RESEND_API_KEY"))}`);
  if (SECRET.key) console.log(`[contact] secret key source: ${SECRET.source}`);
  else console.error(`[contact] ⚠ secret key missing: ${SECRET.source} — leads are e-mailed but NOT stored`);

  try {
    // Payload: { name, phone?, email?, message } (see src/lib/contact.ts).
    // Legacy clients still send { email, message }: name falls back to email.
    const body = await req.json().catch(() => ({}));
    const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
    const message     = str(body?.message);
    const senderEmail = str(body?.email).toLowerCase();
    const phone       = str(body?.phone);
    // Single line: the name ends up in the email subject header.
    const name        = str(body?.name).replace(/\s+/g, " ") || senderEmail;

    const phoneDigits = phone.replace(/\D/g, "").length;
    const emailOk = !senderEmail || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(senderEmail);
    const phoneOk = !phone || (/^\+?[\d\s().-]+$/.test(phone) && phoneDigits >= 7 && phoneDigits <= 15);
    const nameOk  = name.length >= 2 && name.length <= 120;
    const hasContactMethod = Boolean(senderEmail || phone);

    if (!nameOk || !emailOk || !phoneOk || !hasContactMethod || message.length < 5) {
      console.warn(
        `[contact] Rejected — name ok: ${nameOk}, email ok: ${emailOk}, phone ok: ${phoneOk}, ` +
        `contact method: ${hasContactMethod}, message chars: ${message.length}`,
      );
      return new Response(
        JSON.stringify({
          error: "Se requiere nombre, un teléfono o email válido y un mensaje de al menos 5 caracteres",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const lead: Lead = { name, phone, email: senderEmail, message };

    // Persist the lead as a 'received' ticket with the edge_functions secret
    // key only — no fallback to another key (see _shared/keys.ts).
    // Non-fatal: a DB hiccup or a missing key must never lose the email
    // notification; both are logged and the e-mail says it was not stored.
    let stored = false;
    try {
      if (!SECRET.key) throw new Error(`${SECRET.source} missing`);

      const admin = createClient(Deno.env.get("SUPABASE_URL")!, SECRET.key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      // tickets has no phone column: it leads the description so the team sees it.
      const { error: dbError } = await admin.from("tickets").insert({
        project_id:   null,
        client_name:  name,
        client_email: senderEmail || null,
        type:         "consulta",
        priority:     "media",
        status:       "abierto",
        title:        `Mensaje web de ${name}`,
        description:  phone ? `Teléfono: ${phone}\n\n${message}` : message,
      });
      if (dbError) console.error(`[contact] ⚠ ticket insert failed: ${dbError.message}`);
      else {
        stored = true;
        console.log("[contact] ✅ ticket row created");
      }
    } catch (e) {
      console.error(`[contact] ⚠ ticket insert threw: ${e instanceof Error ? e.message : e}`);
    }

    await sendEmail({
      from:    FROM_ADDRESS,
      // The visitor's plain address, or the support mailbox (see reply-to.ts).
      replyTo: replyToFor(senderEmail),
      to:      DEST,
      subject: contactSubject(name),
      html:    contactHtml(lead, stored),
    });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    console.error(`[contact] ❌ ${msg}`);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
