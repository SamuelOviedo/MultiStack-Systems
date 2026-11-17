import { useEffect, useId, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BUSINESS_NAME_MAX, PACKAGE_MESSAGE_MAX, requiresLauConsent } from "@/lib/packageRequest";
import { lempiras, lempirasSpoken, type PaginasWebPackage } from "@/lib/webPackages";

// Contraste (WCAG 1.4.3): el texto secundario usa el token de cuerpo de las páginas de auth, no `muted-foreground`
// (2,65:1 en claro), y los títulos y el enlace usan `foreground`, no `primary` a 12 px (3,86:1 en claro).
const BODY = "text-[hsl(var(--body-foreground))]";
const INPUT =
  "w-full bg-background border border-border rounded px-3 py-2 font-sans text-sm text-foreground placeholder:text-[hsl(var(--body-foreground))] focus:outline-none focus:ring-1 focus:ring-primary";
const LABEL = `block font-mono text-[10px] font-normal leading-normal ${BODY} uppercase tracking-wider`;

const LAU_CONSENT_LABEL =
  "Autorizo a MultiStack Systems a compartir con LAU Graphic mi nombre, mi correo, el nombre de mi negocio y la información necesaria para diseñar mi logo, solo para diseñar el logo de mi Combo Emprendedor.";
const CONSENT_REQUIRED_HINT = "Marca la casilla para poder enviar tu solicitud.";
const PRIVACY_LINK_LABEL = "Lee la política de privacidad";
const PRIVACY_LINK_NAME = `${PRIVACY_LINK_LABEL} (se abre en una pestaña nueva)`;
const PRIVACY_HREF = "/politica-de-privacidad";
const NOT_A_PAYMENT_NOTE =
  "Esto es una solicitud, no un pago ni un contrato. Te contactamos para confirmar el paquete y los siguientes pasos.";

export interface PackageRequestValues {
  readonly businessName: string;
  readonly message: string;
  readonly consentLau: boolean;
}

interface PackageRequestFormProps {
  pkg: PaginasWebPackage;
  submitting: boolean;
  onSubmit: (values: PackageRequestValues) => void;
  /** «Quitar paquete»: el padre borra la intención y vuelve al formulario normal. */
  onRemove: () => void;
}

/**
 * «Modo paquete» de Mis solicitudes: el paquete elegido en /paginas-web, un nombre de negocio y un mensaje opcionales
 * y, en el Combo, la casilla obligatoria para compartir datos con LAU Graphic. Al abrirse mueve el foco al recuadro
 * del paquete. Es una solicitud: no cobra nada ni firma un contrato.
 */
export default function PackageRequestForm({ pkg, submitting, onSubmit, onRemove }: PackageRequestFormProps) {
  const uid = useId();
  const ids = {
    title: `${uid}-titulo`,
    selected: `${uid}-seleccionado`,
    business: `${uid}-negocio`,
    message: `${uid}-mensaje`,
    consent: `${uid}-consentimiento`,
    hint: `${uid}-consentimiento-ayuda`,
  };
  const selectedRef = useRef<HTMLElement>(null);
  const [businessName, setBusinessName] = useState("");
  const [message, setMessage] = useState("");
  const [consentLau, setConsentLau] = useState(false);
  const needsConsent = requiresLauConsent(pkg);
  const blocked = needsConsent && !consentLau;

  useEffect(() => {
    selectedRef.current?.focus();
  }, []);

  // Mientras envía no se usa `disabled` (el foco caería en <body>): el botón queda con aria-disabled y el envío se
  // bloquea aquí.
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (blocked || submitting) return;
    onSubmit({ businessName, message, consentLau });
  };

  return (
    <form
      onSubmit={handleSubmit}
      aria-labelledby={ids.title}
      className="border border-primary/30 rounded bg-primary/5 p-6 space-y-4"
    >
      <p id={ids.title} className="font-display text-xs text-foreground uppercase tracking-wider">
        <span aria-hidden="true">&gt; </span>
        Solicitud de paquete
      </p>

      <section
        ref={selectedRef}
        tabIndex={-1}
        aria-labelledby={ids.selected}
        className="rounded border border-primary/30 bg-background p-4 space-y-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <h2 id={ids.selected} className={`font-mono text-[10px] ${BODY} uppercase tracking-wider`}>
          Paquete seleccionado
        </h2>
        <p className="font-display text-base font-semibold text-foreground">{pkg.name}</p>
        {/* «L 3,950» se ve así, pero un lector de pantalla dice «ele»: se oculta y se anuncia «3950 lempiras». */}
        <p className="font-display text-2xl font-semibold text-foreground">
          <span aria-hidden="true">{lempiras(pkg.priceLempiras)}</span>
          <span className="sr-only">{lempirasSpoken(pkg.priceLempiras)}</span>
        </p>
        <p className={`font-sans text-sm ${BODY}`}>{pkg.summary}</p>
        <button
          type="button"
          onClick={onRemove}
          className={`inline-flex min-h-8 items-center rounded-sm border border-border px-3 text-xs font-display font-medium ${BODY} hover:text-foreground hover:bg-muted/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary`}
        >
          Quitar paquete
        </button>
      </section>

      <div className="space-y-1">
        <Label htmlFor={ids.business} className={LABEL}>
          Nombre de tu negocio <span>(opcional)</span>
        </Label>
        <Input
          id={ids.business}
          type="text"
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          maxLength={BUSINESS_NAME_MAX}
          autoComplete="organization"
          className={INPUT}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor={ids.message} className={LABEL}>
          Cuéntanos de tu negocio o lo que necesitas <span>(opcional)</span>
        </Label>
        <Textarea
          id={ids.message}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={PACKAGE_MESSAGE_MAX}
          rows={4}
          className={INPUT}
        />
      </div>

      {needsConsent && (
        <div className="space-y-1">
          <div className="flex items-start gap-3">
            <Checkbox
              id={ids.consent}
              checked={consentLau}
              onCheckedChange={(value) => setConsentLau(value === true)}
              aria-required="true"
              aria-describedby={consentLau ? undefined : ids.hint}
              className="mt-0.5 h-6 w-6"
            />
            <Label htmlFor={ids.consent} className="font-sans text-sm font-normal leading-snug text-foreground cursor-pointer">
              {LAU_CONSENT_LABEL}
            </Label>
          </div>
          {/* Fuera del <label>: pulsarlo no debe marcar ni desmarcar la casilla. */}
          <a
            href={PRIVACY_HREF}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={PRIVACY_LINK_NAME}
            className="ml-9 inline-flex min-h-6 items-center gap-1 font-sans text-xs text-foreground underline underline-offset-2 hover:text-foreground/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {PRIVACY_LINK_LABEL}
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
          {!consentLau && (
            <p id={ids.hint} className={`pl-9 font-sans text-xs ${BODY}`}>
              {CONSENT_REQUIRED_HINT}
            </p>
          )}
        </div>
      )}

      <p className={`font-sans text-xs ${BODY}`}>{NOT_A_PAYMENT_NOTE}</p>

      {/* El Button por defecto (texto blanco sobre primary) da 4,11:1 en claro: no llega a AA. Contorno con texto foreground. */}
      <Button
        type="submit"
        variant="outline"
        disabled={blocked}
        aria-disabled={submitting || undefined}
        className="h-10 w-full rounded-sm border-primary bg-primary/10 font-display text-xs text-foreground hover:bg-primary/20 hover:text-foreground aria-disabled:cursor-wait aria-disabled:opacity-60"
      >
        {submitting ? "[ ENVIANDO... ]" : "[ ENVIAR SOLICITUD ]"}
      </Button>
    </form>
  );
}
