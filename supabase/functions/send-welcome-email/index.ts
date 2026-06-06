import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail } from "../_shared/resend.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function welcomeHtml(email: string, name: string): string {
  const displayName = name || email.split("@")[0];
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Bienvenido a MultiStack Systems</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0e14;font-family:'Consolas','Monaco','Courier New',monospace;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#0a0e14;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;border:1px solid #0ea5e933;border-radius:8px;background-color:#0f1419;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="padding:20px 24px;border-bottom:1px solid #0ea5e922;background-color:#0b1120;text-align:center;">
              <img src="https://multistacksystems.com/newLogoEnterprise.png"
                   alt="MultiStack Systems Logo"
                   width="180" style="height:auto;display:block;margin:0 auto 12px;" />
              <p style="margin:0;font-size:11px;color:#0ea5e9;line-height:1.6;letter-spacing:0.08em;">
                <span style="color:#0ea5e9;">&gt;</span> multistack-auth<span style="color:#7a8a99;">@</span>secure<span style="color:#0ea5e9;">:~</span><span style="color:#7a8a99;">$</span> <span style="color:#94a3b8;">init --welcome</span>
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:28px 24px;">
              <p style="margin:0 0 8px;font-size:12px;color:#0ea5e9;text-transform:uppercase;letter-spacing:0.12em;">[ WELCOME_INITIALIZED ]</p>
              <p style="margin:0 0 16px;font-size:20px;font-weight:600;color:#e2e8f0;letter-spacing:-0.01em;">
                Bienvenido, ${displayName}.
              </p>
              <p style="margin:0 0 24px;font-size:14px;color:#94a3b8;line-height:1.7;">
                Tu acceso a la plataforma <strong style="color:#cbd5e1;">MultiStack Systems</strong> está activo. Desde aquí podés gestionar tus proyectos, tickets de soporte y comunicarte directamente con el equipo.
              </p>

              <!-- Feature list -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 28px;">
                <tr>
                  <td style="padding:12px 14px;background:#0b1120;border:1px solid #0ea5e918;border-radius:4px 4px 0 0;border-bottom:none;">
                    <p style="margin:0;font-size:13px;color:#cbd5e1;">
                      <span style="color:#0ea5e9;margin-right:8px;">&#x25B8;</span>Panel de proyectos en tiempo real
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 14px;background:#0b1120;border:1px solid #0ea5e918;border-bottom:none;">
                    <p style="margin:0;font-size:13px;color:#cbd5e1;">
                      <span style="color:#0ea5e9;margin-right:8px;">&#x25B8;</span>Sistema de tickets y soporte técnico
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 14px;background:#0b1120;border:1px solid #0ea5e918;border-radius:0 0 4px 4px;">
                    <p style="margin:0;font-size:13px;color:#cbd5e1;">
                      <span style="color:#0ea5e9;margin-right:8px;">&#x25B8;</span>Comunicación directa con el equipo
                    </p>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto 28px;">
                <tr>
                  <td style="border-radius:4px;background-color:#0ea5e914;border:1px solid #0ea5e944;">
                    <a href="https://multistacksystems.com/dashboard"
                       target="_blank"
                       rel="noopener noreferrer"
                       style="display:inline-block;padding:12px 28px;font-size:12px;font-weight:600;color:#0ea5e9;text-decoration:none;letter-spacing:0.1em;font-family:'Consolas','Monaco','Courier New',monospace;">
                      [ ABRIR DASHBOARD ]
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:13px;color:#64748b;line-height:1.6;">
                ¿Tenés alguna pregunta? Respondé este email o escribinos a
                <a href="mailto:soporte@multistacksystems.com" style="color:#0ea5e9;text-decoration:none;">soporte@multistacksystems.com</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:16px 24px;border-top:1px solid #0ea5e918;background-color:#080c10;">
              <p style="margin:0;font-size:10px;color:#475569;line-height:1.5;">
                Recibiste este mensaje porque creaste una cuenta en MultiStack Systems.
                Si no reconocés esta actividad, escribinos a
                <a href="mailto:soporte@multistacksystems.com" style="color:#475569;">soporte@multistacksystems.com</a>
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error("Invalid session");

    const email = user.email!;
    const name: string =
      user.user_metadata?.full_name ??
      user.user_metadata?.name ??
      "";

    // Idempotency check — skip if already sent
    const { data: profile } = await supabase
      .from("profiles")
      .select("welcome_email_sent")
      .eq("id", user.id)
      .single();

    if (profile?.welcome_email_sent) {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await sendEmail({
      to: email,
      subject: "Bienvenido a MultiStack Systems",
      html: welcomeHtml(email, name),
    });

    // Mark as sent
    await supabase
      .from("profiles")
      .update({ welcome_email_sent: true })
      .eq("id", user.id);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
