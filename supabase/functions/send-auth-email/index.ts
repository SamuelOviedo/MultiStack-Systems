const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "onboarding@resend.dev";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error: ${err}`);
  }
}

function buildConfirmUrl(
  tokenHash: string,
  actionType: string,
  redirectTo: string,
): string {
  const base = SUPABASE_URL || `https://ckyqrdemgssbrqfnkxsr.supabase.co`;
  const url = new URL(`${base}/auth/v1/verify`);
  url.searchParams.set("token", tokenHash);
  url.searchParams.set("type", actionType);
  url.searchParams.set("redirect_to", redirectTo);
  return url.toString();
}

function confirmSignupHtml(email: string, confirmUrl: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Confirmar cuenta — MultiStack Systems</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0e14;font-family:'Consolas','Monaco','Courier New',monospace;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#0a0e14;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;border:1px solid #00ff0033;border-radius:8px;background-color:#0f1419;overflow:hidden;">
          <tr>
            <td style="padding:20px 24px;border-bottom:1px solid #00ff0022;background-color:#0b1120;">
              <p style="margin:0;font-size:11px;color:#00ff00;line-height:1.6;letter-spacing:0.08em;">
                <span style="color:#00ff00;">&gt;</span> multistack-auth<span style="color:#7a8a99;">@</span>secure<span style="color:#00ff00;">:~</span><span style="color:#7a8a99;">$</span> <span style="color:#94a3b8;">verify --user</span>
              </p>
              <img src="https://multistacksystems.com/logo-white.png"
                   alt="MultiStack Systems Logo"
                   width="48" style="height:auto;display:block;margin:12px 0 0;" />
              <p style="margin:6px 0 0;font-size:12px;color:#7a8a99;">High-Level Engineering</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 24px;">
              <p style="margin:0 0 8px;font-size:12px;color:#00ff00;text-transform:uppercase;letter-spacing:0.12em;">[ CONFIRM_SIGNUP ]</p>
              <p style="margin:0 0 16px;font-size:14px;color:#cbd5e1;line-height:1.6;">
                Recibimos una solicitud de registro para:
              </p>
              <p style="margin:0 0 24px;padding:12px 14px;background-color:#0b1120;border:1px solid #00ff0022;border-radius:4px;font-size:13px;color:#00ff00;word-break:break-all;">
                ${email}
              </p>
              <p style="margin:0 0 24px;font-size:14px;color:#94a3b8;line-height:1.6;">
                Ejecuta la verificación para activar tu cuenta. El enlace expira por seguridad.
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto 24px;">
                <tr>
                  <td style="border-radius:4px;background-color:#00ff0014;border:1px solid #00ff0044;">
                    <a href="${confirmUrl}" target="_blank" rel="noopener noreferrer"
                       style="display:inline-block;padding:12px 28px;font-size:12px;font-weight:600;color:#00ff00;text-decoration:none;letter-spacing:0.1em;font-family:'Consolas','Monaco','Courier New',monospace;">
                      [ CONFIRMAR CUENTA ]
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:11px;color:#64748b;line-height:1.6;word-break:break-all;">
                Si el botón no funciona, pega esta URL en el navegador:<br />
                <span style="color:#475569;">${confirmUrl}</span>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px;border-top:1px solid #00ff0018;background-color:#080c10;">
              <p style="margin:0;font-size:10px;color:#475569;line-height:1.5;">
                ¿No solicitaste esta cuenta? Ignora este mensaje. No se realizará ningún cambio.
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

function passwordRecoveryHtml(email: string, confirmUrl: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Recuperar contraseña — MultiStack Systems</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0e14;font-family:'Consolas','Monaco','Courier New',monospace;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#0a0e14;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;border:1px solid #00ff0033;border-radius:8px;background-color:#0f1419;overflow:hidden;">
          <tr>
            <td style="padding:20px 24px;border-bottom:1px solid #00ff0022;background-color:#0b1120;">
              <p style="margin:0;font-size:11px;color:#00ff00;line-height:1.6;letter-spacing:0.08em;">
                <span style="color:#00ff00;">&gt;</span> multistack-auth<span style="color:#7a8a99;">@</span>secure<span style="color:#00ff00;">:~</span><span style="color:#7a8a99;">$</span> <span style="color:#94a3b8;">reset --password</span>
              </p>
              <img src="https://multistacksystems.com/logo-white.png"
                   alt="MultiStack Systems Logo"
                   width="48" style="height:auto;display:block;margin:12px 0 0;" />
              <p style="margin:6px 0 0;font-size:12px;color:#7a8a99;">High-Level Engineering</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 24px;">
              <p style="margin:0 0 8px;font-size:12px;color:#f59e0b;text-transform:uppercase;letter-spacing:0.12em;">[ RESET_PASSWORD ]</p>
              <p style="margin:0 0 16px;font-size:14px;color:#cbd5e1;line-height:1.6;">
                Solicitud de recuperación de contraseña para:
              </p>
              <p style="margin:0 0 24px;padding:12px 14px;background-color:#0b1120;border:1px solid #f59e0b22;border-radius:4px;font-size:13px;color:#f59e0b;word-break:break-all;">
                ${email}
              </p>
              <p style="margin:0 0 24px;font-size:14px;color:#94a3b8;line-height:1.6;">
                Este enlace es válido por 1 hora. Si no solicitaste este cambio, ignorá el mensaje.
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto 24px;">
                <tr>
                  <td style="border-radius:4px;background-color:#f59e0b14;border:1px solid #f59e0b44;">
                    <a href="${confirmUrl}" target="_blank" rel="noopener noreferrer"
                       style="display:inline-block;padding:12px 28px;font-size:12px;font-weight:600;color:#f59e0b;text-decoration:none;letter-spacing:0.1em;font-family:'Consolas','Monaco','Courier New',monospace;">
                      [ RESETEAR CONTRASEÑA ]
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:11px;color:#64748b;line-height:1.6;word-break:break-all;">
                Si el botón no funciona:<br />
                <span style="color:#475569;">${confirmUrl}</span>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px;border-top:1px solid #f59e0b18;background-color:#080c10;">
              <p style="margin:0;font-size:10px;color:#475569;line-height:1.5;">
                Si no solicitaste este cambio, ignorá este mensaje. Tu contraseña no será modificada.
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

Deno.serve(async (req) => {
  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY not set" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const payload = await req.json();
    const { user, email_data } = payload;

    const email: string = user?.email ?? "";
    const tokenHash: string = email_data?.token_hash ?? "";
    const actionType: string = email_data?.email_action_type ?? "";
    const redirectTo: string = email_data?.redirect_to ?? email_data?.site_url ?? "";

    if (!email || !tokenHash || !actionType) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const confirmUrl = buildConfirmUrl(tokenHash, actionType, redirectTo);

    if (actionType === "signup" || actionType === "email_change_new") {
      await sendEmail(
        email,
        "Confirmá tu cuenta — MultiStack Systems",
        confirmSignupHtml(email, confirmUrl),
      );
    } else if (actionType === "recovery") {
      await sendEmail(
        email,
        "Recuperar contraseña — MultiStack Systems",
        passwordRecoveryHtml(email, confirmUrl),
      );
    } else if (actionType === "invite") {
      await sendEmail(
        email,
        "Fuiste invitado a MultiStack Systems",
        confirmSignupHtml(email, confirmUrl),
      );
    }
    // email_change_current: notificación silenciosa, no requiere acción

    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
