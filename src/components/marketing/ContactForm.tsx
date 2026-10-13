import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { sendContactMessage } from "@/lib/contact";

const MONO = "'JetBrains Mono', monospace";

const fieldStyle: CSSProperties = {
  padding: "10px 13px",
  borderRadius: "8px",
  fontSize: "13.5px",
  fontFamily: "inherit",
  color: "var(--text)",
  background: "var(--input-bg)",
  border: "1px solid var(--border)",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

/** Texto para prellenar el mensaje. `nonce` permite reaplicar el mismo texto. */
export interface ContactPrefill {
  text: string;
  nonce: number;
}

/**
 * Formulario de contacto MultiStack (vía lib/contact → Edge Function).
 * Extraído del Footer para reutilizarlo en ContactSplit sin duplicar lógica.
 */
const ContactForm = ({ idPrefix = "ms-contact", prefill }: { idPrefix?: string; prefill?: ContactPrefill }) => {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const emailRef = useRef<HTMLInputElement>(null);

  // Prefill desde un CTA de servicio: reemplaza el mensaje y deja el foco en el
  // email (lo único que falta) sin interrumpir el scroll suave del llamador.
  useEffect(() => {
    if (!prefill) return;
    setMessage(prefill.text);
    setStatus((s) => (s === "loading" ? s : "idle"));
    emailRef.current?.focus({ preventScroll: true });
  }, [prefill]);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canSubmit = emailValid && message.trim().length >= 5 && status !== "loading";

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setStatus("loading");
    try {
      await sendContactMessage(email, message);
      setStatus("success");
      setEmail("");
      setMessage("");
    } catch {
      setStatus("error");
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <label
        htmlFor={`${idPrefix}-email`}
        style={{ fontFamily: MONO, fontSize: "11.5px", color: "var(--muted)" }}
      >
        tu@email.com
      </label>
      <input
        ref={emailRef}
        id={`${idPrefix}-email`}
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="tu@email.com"
        disabled={status === "loading"}
        autoComplete="email"
        style={fieldStyle}
      />
      <label
        htmlFor={`${idPrefix}-message`}
        style={{ fontFamily: MONO, fontSize: "11.5px", color: "var(--muted)" }}
      >
        mensaje
      </label>
      <textarea
        id={`${idPrefix}-message`}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Cuéntanos qué necesitas construir…"
        rows={3}
        disabled={status === "loading"}
        style={{ ...fieldStyle, resize: "vertical" }}
      />
      {status === "success" ? (
        <div role="status" style={{ fontFamily: MONO, fontSize: "12px", color: "var(--success)" }}>
          ¡Mensaje enviado! Te responderemos a la brevedad.
        </div>
      ) : (
        <button
          type="submit"
          disabled={!canSubmit}
          style={{
            padding: "11px",
            borderRadius: "8px",
            fontSize: "13.5px",
            fontWeight: 600,
            color: "var(--btn-primary-text)",
            background: "var(--primary)",
            border: "none",
            cursor: canSubmit ? "pointer" : "not-allowed",
            opacity: canSubmit ? 1 : 0.5,
          }}
        >
          {status === "loading" ? "Enviando…" : "Enviar mensaje"}
        </button>
      )}
      {status === "error" && (
        <div role="alert" style={{ fontFamily: MONO, fontSize: "11px", color: "var(--danger)" }}>
          No se pudo enviar. Intenta de nuevo.
        </div>
      )}
    </form>
  );
};

export default ContactForm;
