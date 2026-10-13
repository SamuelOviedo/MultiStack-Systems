import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail, FROM_DEV, REPLY_TO } from "../_shared/resend.ts";

// ── Runtime config ────────────────────────────────────────────────────────────
//
// RESEND_FROM (Supabase secret, optional):
//   Unset / missing  →  uses onboarding@resend.dev  (Resend sandbox — no domain
//                        verification needed; delivers only to the Resend account
//                        owner's email address).
//   "verified"       →  uses MultiStack Systems <soporte@multistacksystems.com>
//                        (requires multistacksystems.com to be verified in the
//                        Resend dashboard → Domains → Add Domain).
//
// To activate the verified sender once the domain is confirmed:
//   supabase secrets set RESEND_FROM=verified
//
const RESEND_FROM_ENV = Deno.env.get("RESEND_FROM");
const FROM_ADDRESS =
  RESEND_FROM_ENV === "verified"
    ? "MultiStack Systems <soporte@multistacksystems.com>"
    : FROM_DEV;

// RESEND_DEST (optional): override delivery address.
// In sandbox mode Resend only delivers to the account owner — set this to
// isaaccoviedo@gmail.com for testing, remove once domain is verified.
const DEST = Deno.env.get("RESEND_DEST") ?? "samuel.oviedo@multistacksystems.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── HTML template ─────────────────────────────────────────────────────────────

function escape(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface Lead {
  name: string;
  phone: string;   // "" when not provided
  email: string;   // "" when not provided
  message: string;
}

function contactHtml(lead: Lead): string {
  const ts = new Date().toLocaleString("es-HN", { timeZone: "America/Tegucigalpa" });
  const safeMsg  = escape(lead.message);
  const safeName = escape(lead.name);
  const telHref  = lead.phone.replace(/[^\d+]/g, "");

  const row = (label: string, value: string) => `
              <tr>
                <td style="padding:10px 20px;border-bottom:1px solid #0ea5e914;">
                  <p style="margin:0;font-size:11px;color:#475569;letter-spacing:0.06em;">${label}</p>
                  ${value}
                </td>
              </tr>`;
  const link = (href: string, text: string) =>
    `<a href="${href}" style="font-size:13px;color:#0ea5e9;text-decoration:none;">${text}</a>`;

  const senderRows = [
    row("NOMBRE", `<p style="margin:0;font-size:13px;color:#e2e8f0;">${safeName}</p>`),
    lead.phone ? row("TELÉFONO", link(`tel:${escape(telHref)}`, escape(lead.phone))) : "",
    lead.email ? row("CORREO", link(`mailto:${escape(lead.email)}`, escape(lead.email))) : "",
  ].join("");

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Nuevo mensaje — MultiStack Systems</title>
</head>
<body style="margin:0;padding:0;background:#0a0e14;font-family:'Consolas','Monaco','Courier New',monospace;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
         style="background:#0a0e14;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
               style="max-width:560px;border:1px solid #0ea5e933;border-radius:8px;background:#0f1419;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="padding:20px 24px;border-bottom:1px solid #0ea5e922;background:#0b1120;text-align:center;">
              <img src="https://multistacksystems.com/logo-white.png"
                   alt="MultiStack Systems Logo"
                   width="48" style="height:auto;display:block;margin:0 auto 10px;" />
              <p style="margin:0;font-size:11px;color:#0ea5e9;letter-spacing:0.1em;">
                NUEVO MENSAJE DESDE EL SITIO WEB
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:28px 24px;">
              <p style="margin:0 0 16px;font-size:13px;color:#94a3b8;">
                Recibiste un nuevo mensaje a través del formulario de contacto:
              </p>

              <!-- Sender rows: name + whichever contact methods were provided -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
                     style="background:#0b1120;border:1px solid #0ea5e922;border-radius:4px 4px 0 0;margin:0;border-bottom:none;">${senderRows}
              </table>

              <!-- Message row -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
                     style="background:#0b1120;border:1px solid #0ea5e922;border-radius:0 0 4px 4px;margin:0 0 20px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0;font-size:14px;color:#cbd5e1;line-height:1.7;white-space:pre-wrap;">${safeMsg}</p>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:11px;color:#475569;">
                Enviado el ${ts} (HN)
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:14px 24px;border-top:1px solid #0ea5e918;background:#080c10;">
              <p style="margin:0;font-size:10px;color:#475569;">
                multistacksystems.com — Formulario de contacto público
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

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

    // Persist the lead as a 'received' ticket.
    // Preferred: service role (bypasses RLS). Fallback: anon key — covered by
    // the "public inserts contact lead" RLS policy.
    // Non-fatal: a DB hiccup must never lose the email notification.
    try {
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
      const anonKey    = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
      const dbKey      = serviceKey || anonKey;
      console.log(`[contact] db client: ${serviceKey ? "service_role" : anonKey ? "anon (fallback)" : "NO KEY"}`);

      const admin = createClient(Deno.env.get("SUPABASE_URL")!, dbKey);
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
      else console.log("[contact] ✅ ticket row created");
    } catch (e) {
      console.error(`[contact] ⚠ ticket insert threw: ${e instanceof Error ? e.message : e}`);
    }

    await sendEmail({
      from:    FROM_ADDRESS,
      // No email → default REPLY_TO; the phone is in the body.
      ...(senderEmail ? { replyTo: senderEmail } : {}),
      to:      DEST,
      subject: `Nuevo mensaje de ${name} — MultiStack Systems`,
      html:    contactHtml(lead),
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
