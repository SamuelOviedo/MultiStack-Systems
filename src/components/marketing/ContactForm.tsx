import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import {
  CONTACT_LIMITS,
  ContactInvalidError,
  ContactRateLimitError,
  ContactUnavailableError,
  sendContactMessage,
  validateContact,
  type ContactPayload,
} from "@/lib/contact";
import { trackContactConversion } from "@/lib/analytics";

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

// Honeypot (S4): off-screen and out of the tab order; people never see it. The server contract is the JSON key
// `website` (ContactPayload.website, lead.ts HONEYPOT_FIELD): the form is controlled state, so the attributes of the DOM
// input are free. They are chosen so that autofill (browser, password managers, form-filling extensions) finds no
// "website / URL / company" to complete: neutral id, name and label, autocomplete off and the vendors' ignore flags.
const honeypotStyle: CSSProperties = { position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" };

/**
 * Formulario de contacto MultiStack (vía lib/contact → Edge Function).
 * Nombre y mensaje obligatorios; teléfono y correo opcionales, pero se pide al
 * menos uno de los dos para poder responder. Los errores aparecen tras el
 * primer intento de envío y se actualizan en vivo.
 */
const ContactForm = ({ idPrefix = "ms-contact", prefill }: { idPrefix?: string; prefill?: ContactPrefill }) => {
  const [form, setForm] = useState<ContactPayload>(EMPTY_FORM);
  const [submitted, setSubmitted] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error" | "rate-limited" | "unavailable" | "invalid">("idle");
  const nameRef = useRef<HTMLInputElement>(null);
  // Cerrojo síncrono del envío: `status` es el estado ya pintado, así que dos eventos submit antes de que React repinte
  // verían los dos "idle". El ref se activa en el mismo instante en que se decide enviar.
  const sendingRef = useRef(false);

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
    if (status === "loading" || sendingRef.current) return;
    setSubmitted(true);
    if (Object.keys(errors).length > 0) {
      // Lleva el foco al primer campo con error (en orden visual).
      const first = (["name", "phone", "email", "message"] as const).find(
        (f) => errors[f] || ((f === "phone" || f === "email") && errors.contact),
      );
      if (first) document.getElementById(id(first))?.focus();
      return;
    }
    // Honeypot lleno: el servidor lo descarta en silencio con un 200 idéntico al de un envío real, así que enviarlo haría
    // perder en silencio una solicitud legítima cuyo autocompletado lo llenó. No se envía, no se simula un éxito: se
    // vacía el campo y se avisa; el siguiente clic envía el formulario completo. Un bot que escribe directo al servidor
    // no pasa por aquí, y el servidor sigue descartándolo igual.
    if (form.website?.trim()) {
      setForm((f) => ({ ...f, website: "" }));
      setStatus("error");
      return;
    }
    sendingRef.current = true;
    setStatus("loading");
    try {
      await sendContactMessage(form);
      trackContactConversion();
      setStatus("success");
      setForm(EMPTY_FORM);
      setSubmitted(false);
    } catch (err) {
      setStatus(
        err instanceof ContactRateLimitError
          ? "rate-limited"
          : err instanceof ContactUnavailableError
            ? "unavailable"
            : err instanceof ContactInvalidError
              ? "invalid"
              : "error",
      );
    } finally {
      sendingRef.current = false;
    }
  };

  const contactInvalid = !!shown.contact;
  const describedBy = (field: "name" | "phone" | "email" | "message") =>
    [shown[field] && id(`${field}-error`), (field === "phone" || field === "email") && contactInvalid && id("contact-error")]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <form onSubmit={handleSubmit} noValidate className="ms-contact-form" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <div aria-hidden="true" style={honeypotStyle}>
        <label htmlFor={id("hp")}>Dejar este campo vacío</label>
        <input
          id={id("hp")}
          name="ms_hp"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          data-lpignore="true"
          data-1p-ignore="true"
          data-bwignore="true"
          data-form-type="other"
          value={form.website ?? ""}
          onChange={update("website")}
        />
      </div>
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
            maxLength={CONTACT_LIMITS.phoneMax}
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
            maxLength={CONTACT_LIMITS.emailMax}
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
          No pudimos enviar tu mensaje. Inténtalo de nuevo.
        </div>
      )}
      {status === "rate-limited" && (
        <div role="alert" style={{ fontFamily: MONO, fontSize: "11px", color: "var(--danger)" }}>
          Has alcanzado el límite de envíos. Inténtalo de nuevo más tarde.
        </div>
      )}
      {status === "unavailable" && (
        <div role="alert" style={{ fontFamily: MONO, fontSize: "11px", color: "var(--danger)" }}>
          El formulario no está disponible temporalmente. Inténtalo de nuevo más tarde.
        </div>
      )}
      {status === "invalid" && (
        <div role="alert" style={{ fontFamily: MONO, fontSize: "11px", color: "var(--danger)" }}>
          No pudimos procesar tu mensaje. Revisa los datos ingresados e inténtalo de nuevo.
        </div>
      )}
    </form>
  );
};

export default ContactForm;
