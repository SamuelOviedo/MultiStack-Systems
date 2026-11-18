import type { ContactFormLook } from "@/components/marketing/ContactForm";

// 16 px en celular evita que iOS haga zoom al enfocar; 13.5 px desde md. `leading-normal` (relativo) es lo que hace que la
// altura siga al tamaño: el `line-height` fijo de `text-base` dejaba los campos 4 px más altos que en la referencia.
// `rounded-site-lg` es el radio del sitio (14 px); `rounded-lg` del panel es otro. El borde rojo lo da `aria-invalid`.
const FIELD =
  "w-full rounded-site-lg border border-site-input bg-site-background/70 px-3.5 py-2.5 text-base leading-normal text-site-foreground placeholder:text-site-muted-foreground/60 transition-colors focus-visible:border-site-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-ring/40 disabled:cursor-not-allowed disabled:opacity-60 md:text-[13.5px] aria-[invalid=true]:border-site-destructive";
const ALERT = "font-mono text-[11px] text-site-destructive";

/**
 * Aspecto del formulario de contacto en el sitio público (`.ms-site`): etiquetas mono pequeñas, campos oscuros con borde
 * sutil y foco teal, y botón primario de ancho completo. Es el aspecto del formulario de la referencia con la lógica de
 * ContactForm (Edge Function, consentimiento, honeypot y conversión de Ads), que no cambia. Usa los tokens `site-*`:
 * las variables MS del estilo por omisión (`--text`, `--primary`…) no existen dentro de `.ms-site`, y sin `style` en línea
 * el foco, el borde de error y el estado deshabilitado se resuelven con clases.
 */
export const SITE_CONTACT_LOOK: ContactFormLook = {
  form: { className: "flex flex-col gap-4" },
  Group: ({ children }) => <div className="flex flex-col gap-2">{children}</div>,
  pair: { className: "grid gap-4 sm:grid-cols-2 sm:gap-3" },
  column: { className: "flex min-w-0 flex-col gap-2" },
  label: { className: "font-mono text-[11.5px] text-site-muted-foreground" },
  field: (kind) => ({ className: kind === "textarea" ? `${FIELD} min-h-[84px] resize-y` : FIELD }),
  error: { className: ALERT },
  success: { className: "font-mono text-xs text-site-success" },
  button: () => ({
    className:
      "w-full rounded-site-lg bg-site-primary py-3 text-[13.5px] font-semibold text-site-background transition-[filter,transform] duration-150 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-ring focus-visible:ring-offset-2 focus-visible:ring-offset-site-card active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60",
  }),
  alert: { className: ALERT },
};
