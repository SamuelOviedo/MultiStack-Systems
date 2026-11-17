import { Check } from "lucide-react";
import type { PaginasWebCombo, PaginasWebComboColumn } from "@/pages/marketing/paginasWebContent";
import PwRequestLink from "./PwRequestLink";
import PwSection from "./PwSection";
import PwSectionHead from "./PwSectionHead";

interface PwComboProps {
  combo: PaginasWebCombo;
}

/** Una parte del Combo: quién la hace y sus entregables. */
const ComboColumn = ({ column }: { column: PaginasWebComboColumn }) => (
  <div className="ms-pw-combo__col">
    <h3 className="ms-pw-h3">{column.title}</h3>
    <p className="ms-pw-combo__by">{column.note}</p>
    <ul role="list" className="ms-pw-checks">
      {column.items.map((item) => (
        <li key={item}>
          <Check size={18} strokeWidth={2.4} aria-hidden="true" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  </div>
);

/**
 * Combo Emprendedor (LAU Graphic × MultiStack Systems), justo después del hero. Es un panel de texto a todo el ancho:
 * encabezado, las dos columnas de entregables y, abajo, el precio con los CTA. Los entregables salen de la referencia
 * oficial de la campaña y se escriben con los términos aprobados (una sola página con hasta 6 secciones); la sección
 * no lleva imágenes.
 * Los montos en lempiras se ven como «L 3,950» (aria-hidden) y se leen «3950 lempiras» (sr-only).
 */
const PwCombo = ({ combo }: PwComboProps) => (
  <PwSection head={combo} tight>
    <div className="ms-pw-combo">
      <PwSectionHead head={combo} />
      <p className="ms-pw-lead">
        <span aria-hidden="true">{combo.subtitle}</span>
        <span className="sr-only">{combo.subtitleSpoken}</span>
      </p>

      <div className="ms-pw-combo__cols">
        <ComboColumn column={combo.logo} />
        <ComboColumn column={combo.web} />
      </div>

      <div className="ms-pw-combo__buy">
        <p className="ms-pw-combo__price">
          <span aria-hidden="true">{combo.amount}</span>
          <span className="sr-only">{combo.amountSpoken}</span>
        </p>
        <div className="ms-pw-combo__actions">
          <PwRequestLink packageId={combo.packageId} to={combo.ctaHref} className="ms-pw-btn ms-pw-btn--primary">
            {combo.ctaLabel}
          </PwRequestLink>
          <a href={combo.standardLink.href} className="ms-pw-btn ms-pw-btn--ghost">
            {/* .ms-pw-btn es flex con gap: sin este contenedor cada fragmento de texto sería un ítem separado. */}
            <span>
              {combo.standardLink.label} (<span aria-hidden="true">{combo.standardLink.amount}</span>
              <span className="sr-only">{combo.standardLink.amountSpoken}</span>)
            </span>
          </a>
        </div>
        <p className="ms-pw-note">{combo.note}</p>
      </div>
    </div>
  </PwSection>
);

export default PwCombo;
