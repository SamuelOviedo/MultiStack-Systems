import type { ReactNode } from "react";
import { Check, X } from "lucide-react";
import type { PaginasWebPrice, PaginasWebPricePackage } from "@/pages/marketing/paginasWebContent";
import { packageCardId } from "./ids";
import PwLink from "./PwLink";
import PwRequestLink from "./PwRequestLink";
import PwSection from "./PwSection";
import PwSectionHead from "./PwSectionHead";

interface PwPriceProps {
  price: PaginasWebPrice;
  /** Se llama al activar el CTA (ancla al formulario). */
  onContact: () => void;
}

const NO_BREAK = "One-Page";

/**
 * El guion de «One-Page» es un punto de corte para el navegador («One-» / «Page»). Se envuelve en un span
 * sin saltos: el texto del DOM no cambia, solo que no se parte.
 */
const withoutBreaks = (text: string): ReactNode =>
  text
    .split(NO_BREAK)
    .flatMap((part, i) => (i === 0 ? [part] : [<span key={i} className="ms-pw-nowrap">{NO_BREAK}</span>, part]));

/**
 * Una tarjeta por paquete. Es un <article> nombrado con su encabezado y su precio (aria-labelledby con
 * los dos ids): el lector de pantalla anuncia «Plan Estándar 3500 lempiras» como un solo grupo. El id de la
 * tarjeta es un ancla estable (`paquete-<id>`) y `data-package` lleva el id del paquete. Al fondo lleva su CTA
 * «Solicitar …», que guarda la intención de paquete y abre /solicitudes?paquete=<id>; el del Combo es el principal
 * y el del Plan Estándar es el secundario.
 */
const PwPlan = ({ plan }: { plan: PaginasWebPricePackage }) => {
  const cardId = packageCardId(plan.id);
  const nameId = `${cardId}-nombre`;
  const amountId = `${cardId}-precio`;
  const hasExtras = plan.extras.length > 0;

  return (
    <article id={cardId} data-package={plan.id} aria-labelledby={`${nameId} ${amountId}`} className="ms-pw-plan">
      <h3 id={nameId} className="ms-pw-h3">
        {plan.name}
      </h3>
      {/* «L 3,500» se ve así, pero un lector de pantalla lo dice «ele»: se oculta y se anuncia «3500 lempiras» (amountSpoken, sin coma). */}
      <p id={amountId} className="ms-pw-plan__amount">
        <span aria-hidden="true">{plan.amount}</span>
        <span className="sr-only">{plan.amountSpoken}</span>
      </p>
      <p className="ms-pw-text">{plan.summary}</p>
      {hasExtras && (
        <div className="ms-pw-plan__extras">
          {plan.extrasTitle && <h4 className="ms-pw-plan__extras-title">{plan.extrasTitle}</h4>}
          <ul role="list" className="ms-pw-checks">
            {plan.extras.map((extra) => (
              <li key={extra}>
                <Check size={18} strokeWidth={2.4} aria-hidden="true" />
                <span>{extra}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="ms-pw-plan__cta">
        <PwRequestLink
          packageId={plan.id}
          to={plan.requestHref}
          className={`ms-pw-btn ${plan.id === "combo-emprendedor" ? "ms-pw-btn--primary" : "ms-pw-btn--ghost"}`}
        >
          {plan.requestLabel}
        </PwRequestLink>
      </div>
    </article>
  );
};

/**
 * Precio: los dos paquetes en tarjetas (lado a lado en escritorio, apiladas en móvil) y, debajo, lo que
 * incluyen los dos planes y lo que no. Las dos listas se distinguen por la forma del icono (check o X),
 * no solo por el color.
 */
const PwPrice = ({ price, onContact }: PwPriceProps) => (
  <PwSection head={price}>
    <PwSectionHead head={price} />

    <div className="ms-pw-plans">
      {price.packages.map((plan) => (
        <PwPlan key={plan.id} plan={plan} />
      ))}
    </div>

    <p className="ms-pw-intro">{withoutBreaks(price.scope)}</p>

    <div className="ms-pw-ledger">
      <div className="ms-pw-ledger__col">
        <h3 className="ms-pw-h3">{price.includedTitle}</h3>
        <ul role="list" className="ms-pw-checks">
          {price.included.map((title) => (
            <li key={title}>
              <Check size={18} strokeWidth={2.4} aria-hidden="true" />
              <span>{title}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="ms-pw-ledger__col">
        <h3 className="ms-pw-h3">{price.notIncludedTitle}</h3>
        <ul role="list" className="ms-pw-checks ms-pw-checks--no">
          {price.notIncluded.map((item) => (
            <li key={item.title}>
              <X size={18} strokeWidth={2.4} aria-hidden="true" />
              <span>
                <span className="ms-pw-checks__title">{item.title}</span>
                {item.text && <span className="ms-pw-checks__text">{item.text}</span>}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>

    <p className="ms-pw-quote">{price.quoteNote}</p>
    <div className="ms-pw-actions">
      <PwLink link={price.cta} className="ms-pw-btn ms-pw-btn--primary" onContact={onContact} />
    </div>
  </PwSection>
);

export default PwPrice;
