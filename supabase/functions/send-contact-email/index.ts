import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
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

const DEST = "samuel.oviedo@multistacksystems.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── HTML template ─────────────────────────────────────────────────────────────

function contactHtml(message: string): string {
  const ts = new Date().toLocaleString("es-HN", { timeZone: "America/Tegucigalpa" });
  // Escape HTML entities to prevent injection in the email body
  const safe = message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

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
            <td style="padding:20px 24px;border-bottom:1px solid #0ea5e922;background:#0b1120;">
              <p style="margin:0;font-size:18px;font-weight:700;color:#e2e8f0;letter-spacing:-0.02em;">
                MultiStack<span style="color:#0ea5e9;">.</span>
              </p>
              <p style="margin:4px 0 0;font-size:11px;color:#0ea5e9;letter-spacing:0.1em;">
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
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
                     style="background:#0b1120;border:1px solid #0ea5e922;border-radius:4px;margin:0 0 20px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0;font-size:14px;color:#cbd5e1;line-height:1.7;white-space:pre-wrap;">${safe}</p>
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

serve(async (req) => {
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
    const body = await req.json().catch(() => ({}));
    const message: string = typeof body?.message === "string" ? body.message.trim() : "";

    if (message.length < 5) {
      console.warn("[contact] Rejected — message too short");
      return new Response(JSON.stringify({ error: "El mensaje es demasiado corto" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await sendEmail({
      from:    FROM_ADDRESS,
      replyTo: REPLY_TO,
      to:      DEST,
      subject: "Nuevo mensaje desde el sitio web — MultiStack Systems",
      html:    contactHtml(message),
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
