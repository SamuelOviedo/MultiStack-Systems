import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "noreply@multistack.app";
const TEAM_EMAIL = Deno.env.get("TEAM_EMAIL") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });
  if (!res.ok) throw new Error(await res.text());
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const { type, ticket, projectName, message, portalUrl } = body;

    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not set");

    if (type === "new_ticket") {
      if (!TEAM_EMAIL) throw new Error("TEAM_EMAIL not set");
      await sendEmail(
        TEAM_EMAIL,
        `[MultiStack] Nuevo ticket: ${ticket.title}`,
        `
          <h2>Nuevo ticket recibido</h2>
          <p><strong>Proyecto:</strong> ${projectName ?? "—"}</p>
          <p><strong>Título:</strong> ${ticket.title}</p>
          <p><strong>Tipo:</strong> ${ticket.type}</p>
          <p><strong>Prioridad:</strong> ${ticket.priority}</p>
          ${ticket.description ? `<p><strong>Descripción:</strong> ${ticket.description}</p>` : ""}
          ${ticket.client_name ? `<p><strong>Cliente:</strong> ${ticket.client_name}</p>` : ""}
          ${ticket.client_email ? `<p><strong>Email:</strong> ${ticket.client_email}</p>` : ""}
        `,
      );
    } else if (type === "team_reply") {
      if (!ticket.client_email) throw new Error("No client email on ticket");
      await sendEmail(
        ticket.client_email,
        `[MultiStack] Respuesta a tu ticket: ${ticket.title}`,
        `
          <h2>El equipo de MultiStack ha respondido tu ticket</h2>
          <p><strong>Ticket:</strong> ${ticket.title}</p>
          <blockquote style="border-left:3px solid #00ff88;padding-left:12px;margin:12px 0;">
            ${message}
          </blockquote>
          ${portalUrl ? `<p><a href="${portalUrl}" style="color:#00ff88;">Ver conversación completa →</a></p>` : ""}
        `,
      );
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
