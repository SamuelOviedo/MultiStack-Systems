import { Check, X } from "lucide-react";
import type { PaginasWebPrice } from "@/pages/marketing/paginasWebContent";
import PwLink from "./PwLink";
import PwSection from "./PwSection";
import PwSectionHead from "./PwSectionHead";

interface PwPriceProps {
  price: PaginasWebPrice;
  /** Se llama al activar el CTA (ancla al formulario). */
  onContact: () => void;
}

/**
 * Precio: el monto a gran tamaño y, debajo, lo que incluye y lo que no. Las dos
 * listas se distinguen por la forma del icono (check o X), no solo por el color.
 */
const PwPrice = ({ price, onContact }: PwPriceProps) => (
  <PwSection head={price}>
    <PwSectionHead head={price} />
    <p className="ms-pw-amount">
      <span className="ms-pw-amount__prefix">{price.amountPrefix}</span>{" "}
      <span className="ms-pw-amount__value">{price.amount}</span>
    </p>
    <p className="ms-pw-note">{price.amountNote}</p>
    <p className="ms-pw-intro">{price.scope}</p>

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
