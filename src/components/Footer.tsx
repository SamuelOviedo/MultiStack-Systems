import { useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Logo from "@/components/Logo";

const MONO = "'JetBrains Mono', monospace";

const fieldStyle: CSSProperties = {
  padding: "10px 13px",
  borderRadius: "9px",
  fontSize: "13.5px",
  fontFamily: "inherit",
  color: "var(--text)",
  background: "var(--input-bg)",
  border: "1px solid var(--border)",
  outline: "none",
};

const colTitle: CSSProperties = { fontSize: "13px", fontWeight: 600, color: "var(--text)", marginBottom: "14px" };
const linkStyle: CSSProperties = { textAlign: "left", background: "none", border: "none", color: "var(--text2)", cursor: "pointer", padding: 0, fontSize: "14px", textDecoration: "none" };

const scrollTo = (id: string, navigate: ReturnType<typeof useNavigate>) => {
  const el = document.getElementById(id);
  if (el) window.scrollTo({ top: el.offsetTop - 60, behavior: "smooth" });
  else navigate("/");
};

const Footer = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canSubmit = emailValid && message.trim().length >= 5 && status !== "loading";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setStatus("loading");
    try {
      const { error } = await supabase.functions.invoke("send-contact-email", {
        body: { email: email.trim().toLowerCase(), message: message.trim() },
      });
      if (error) throw error;
      setStatus("success");
      setEmail("");
      setMessage("");
    } catch {
      setStatus("error");
    }
  };

  return (
    <footer id="footer" style={{ background: "var(--surface-2)", borderTop: "1px solid var(--border-soft)" }}>
      <div className="ms-footer-grid" style={{ maxWidth: "1240px", margin: "0 auto", padding: "64px 32px 28px" }}>
        {/* Col 1 — brand */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "11px", marginBottom: "16px" }}>
            <Logo className="h-[26px]" />
            <span style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: "16px", color: "var(--text)" }}>
              MultiStack Systems
            </span>
          </div>
          <div style={{ fontFamily: MONO, fontSize: "12.5px", lineHeight: 1.7, color: "var(--muted)" }}>
            Siguatepeque, HN
            <br />
            14.5951° N, 87.8321° W
          </div>
        </div>

        {/* Col 2 — Navegación */}
        <div>
          <div style={colTitle}>Navegación</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <button type="button" className="ms-foot-link" style={linkStyle} onClick={() => scrollTo("hero", navigate)}>Inicio</button>
            <button type="button" className="ms-foot-link" style={linkStyle} onClick={() => scrollTo("servicios", navigate)}>Servicios</button>
            <button type="button" className="ms-foot-link" style={linkStyle} onClick={() => scrollTo("stack", navigate)}>Stack</button>
            <button type="button" className="ms-foot-link" style={linkStyle} onClick={() => navigate("/login")}>Soporte</button>
          </div>
        </div>

        {/* Col 3 — Legal */}
        <div>
          <div style={colTitle}>Legal</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <button type="button" className="ms-foot-link" style={linkStyle} onClick={() => navigate("/politica-de-privacidad")}>Política de Privacidad</button>
            <button type="button" className="ms-foot-link" style={linkStyle} onClick={() => navigate("/terminos-del-servicio")}>Términos del Servicio</button>
          </div>
        </div>

        {/* Col 4 — Contacto */}
        <div>
          <div style={colTitle}>Contacto</div>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              disabled={status === "loading"}
              style={fieldStyle}
            />
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Escribe tu mensaje o consulta aquí..."
              rows={2}
              disabled={status === "loading"}
              style={{ ...fieldStyle, resize: "none" }}
            />
            {status === "success" ? (
              <div style={{ fontFamily: MONO, fontSize: "12px", color: "var(--success)" }}>
                ¡Mensaje enviado con éxito! Te responderemos a la brevedad.
              </div>
            ) : (
              <button
                type="submit"
                disabled={!canSubmit}
                style={{
                  padding: "10px",
                  borderRadius: "9px",
                  fontSize: "13.5px",
                  fontWeight: 600,
                  color: "var(--btn-primary-text)",
                  background: "var(--primary)",
                  border: "none",
                  cursor: canSubmit ? "pointer" : "not-allowed",
                  opacity: canSubmit ? 1 : 0.5,
                }}
              >
                {status === "loading" ? "Enviando..." : "Enviar mensaje"}
              </button>
            )}
            {status === "error" && (
              <div style={{ fontFamily: MONO, fontSize: "11px", color: "var(--danger)" }}>No se pudo enviar. Intenta de nuevo.</div>
            )}
            <a
              href="https://wa.me/50433023042"
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "10px", borderRadius: "9px", fontSize: "13.5px", fontWeight: 500, textDecoration: "none", color: "var(--success)", background: "var(--success-soft)", border: "1px solid rgba(16,185,129,0.3)" }}
            >
              ✆ Escríbenos por WhatsApp
            </a>
          </form>
        </div>
      </div>

      <div style={{ maxWidth: "1240px", margin: "0 auto", padding: "18px 32px", borderTop: "1px solid var(--border-soft)", fontFamily: MONO, fontSize: "12px", color: "var(--muted)" }}>
        © 2026 MultiStack Systems. Todos los derechos reservados.
        <span style={{ animation: "ms-blink 1.1s steps(1) infinite" }}>_</span>
      </div>
    </footer>
  );
};

export default Footer;
