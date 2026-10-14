import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { CONTACT_LIMITS, sendContactMessage, validateContact, type ContactPayload } from "@/lib/contact";

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

const invalidStyle: CSSProperties = { borderColor: "var(--danger)" };

const labelStyle: CSSProperties = { fontFamily: MONO, fontSize: "11.5px", color: "var(--muted)" };

const errorStyle: CSSProperties = { fontFamily: MONO, fontSize: "11px", color: "var(--danger)" };

/** Texto para prellenar el mensaje. `nonce` permite reaplicar el mismo texto. */
export interface ContactPrefill {
  text: string;
  nonce: number;
}

const EMPTY_FORM: ContactPayload = { name: "", phone: "", email: "", message: "" };

/**
 * Formulario de contacto MultiStack (vía lib/contact → Edge Function).
 * Nombre y mensaje obligatorios; teléfono y correo opcionales, pero se pide al
 * menos uno de los dos para poder responder. Los errores aparecen tras el
 * primer intento de envío y se actualizan en vivo.
 */
const ContactForm = ({ idPrefix = "ms-contact", prefill }: { idPrefix?: string; prefill?: ContactPrefill }) => {
  const [form, setForm] = useState<ContactPayload>(EMPTY_FORM);
  const [submitted, setSubmitted] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const nameRef = useRef<HTMLInputElement>(null);

  // Prefill desde un CTA de servicio: reemplaza el mensaje y deja el foco en el
  // primer campo (nombre) sin interrumpir el scroll suave del llamador.
  useEffect(() => {
    if (!prefill) return;
    setForm((f) => ({ ...f, message: prefill.text }));
    setStatus((s) => (s === "loading" ? s : "idle"));
    nameRef.current?.focus({ preventScroll: true });
  }, [prefill]);

  const errors = validateContact(form);
  const shown = submitted ? errors : {};
  const id = (field: string) => `${idPrefix}-${field}`;

  const update = (field: keyof ContactPayload) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (status === "loading") return;
    setSubmitted(true);
    if (Object.keys(errors).length > 0) {
      // Lleva el foco al primer campo con error (en orden visual).
      const first = (["name", "phone", "email", "message"] as const).find(
        (f) => errors[f] || ((f === "phone" || f === "email") && errors.contact),
      );
      if (first) document.getElementById(id(first))?.focus();
      return;
    }
    setStatus("loading");
    try {
      await sendContactMessage(form);
      setStatus("success");
      setForm(EMPTY_FORM);
      setSubmitted(false);
    } catch {
      setStatus("error");
    }
  };

  const contactInvalid = !!shown.contact;
  const describedBy = (field: "name" | "phone" | "email" | "message") =>
    [shown[field] && id(`${field}-error`), (field === "phone" || field === "email") && contactInvalid && id("contact-error")]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <form onSubmit={handleSubmit} noValidate className="ms-contact-form" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <label htmlFor={id("name")} style={labelStyle}>
        Nombre completo
      </label>
      <input
        ref={nameRef}
        id={id("name")}
        type="text"
        value={form.name}
        onChange={update("name")}
        placeholder="Nombre y apellido"
        disabled={status === "loading"}
        autoComplete="name"
        required
        maxLength={CONTACT_LIMITS.nameMax}
        aria-invalid={!!shown.name}
        aria-describedby={describedBy("name")}
        style={{ ...fieldStyle, ...(shown.name ? invalidStyle : {}) }}
      />
      {shown.name && (
        <div id={id("name-error")} style={errorStyle}>
          {shown.name}
        </div>
      )}

      <div className="ms-contact-pair">
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", minWidth: 0 }}>
          <label htmlFor={id("phone")} style={labelStyle}>
            Número de teléfono (opcional)
          </label>
          <input
            id={id("phone")}
            type="tel"
            value={form.phone}
            onChange={update("phone")}
            placeholder="+504 9999-9999"
            disabled={status === "loading"}
            autoComplete="tel"
            inputMode="tel"
            aria-invalid={!!shown.phone || contactInvalid}
            aria-describedby={describedBy("phone")}
            style={{ ...fieldStyle, ...(shown.phone || contactInvalid ? invalidStyle : {}) }}
          />
          {shown.phone && (
            <div id={id("phone-error")} style={errorStyle}>
              {shown.phone}
            </div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", minWidth: 0 }}>
          <label htmlFor={id("email")} style={labelStyle}>
            Correo electrónico (opcional)
          </label>
          <input
            id={id("email")}
            type="email"
            value={form.email}
            onChange={update("email")}
            placeholder="tu@email.com"
            disabled={status === "loading"}
            autoComplete="email"
            aria-invalid={!!shown.email || contactInvalid}
            aria-describedby={describedBy("email")}
            style={{ ...fieldStyle, ...(shown.email || contactInvalid ? invalidStyle : {}) }}
          />
          {shown.email && (
            <div id={id("email-error")} style={errorStyle}>
              {shown.email}
            </div>
          )}
        </div>
      </div>
      {contactInvalid && (
        <div id={id("contact-error")} style={errorStyle}>
          {shown.contact}
        </div>
      )}

      <label htmlFor={id("message")} style={labelStyle}>
        Mensaje
      </label>
      <textarea
        id={id("message")}
        value={form.message}
        onChange={update("message")}
        placeholder="Cuéntanos qué necesitas construir…"
        rows={3}
        disabled={status === "loading"}
        required
        aria-invalid={!!shown.message}
        aria-describedby={describedBy("message")}
        style={{ ...fieldStyle, resize: "vertical", ...(shown.message ? invalidStyle : {}) }}
      />
      {shown.message && (
        <div id={id("message-error")} style={errorStyle}>
          {shown.message}
        </div>
      )}

      {status === "success" ? (
        <div role="status" style={{ fontFamily: MONO, fontSize: "12px", color: "var(--success)" }}>
          ¡Mensaje enviado! Te responderemos a la brevedad.
        </div>
      ) : (
        <button
          type="submit"
          disabled={status === "loading"}
          style={{
            padding: "11px",
            borderRadius: "8px",
            fontSize: "13.5px",
            fontWeight: 600,
            color: "var(--btn-primary-text)",
            background: "var(--primary)",
            border: "none",
            cursor: status === "loading" ? "not-allowed" : "pointer",
            opacity: status === "loading" ? 0.6 : 1,
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
