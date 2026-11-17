import { ComboColumn } from "@/components/marketing/paginas-web/PwCombo";
import PwRequestLink from "@/components/marketing/paginas-web/PwRequestLink";
import PwSection from "@/components/marketing/paginas-web/PwSection";
import { PwEyebrow } from "@/components/marketing/paginas-web/PwSectionHead";
import { titleId } from "@/components/marketing/paginas-web/ids";
import type { HomeCombo as HomeComboContent } from "@/pages/marketing/homeContent";
import { reveal } from "./motion";

/**
 * Combo Emprendedor: la sección más destacada de la home (borde y degradado de marca). «LAU Graphic × MultiStack
 * Systems» va en texto: no hay permiso para usar el logo de LAU Graphic. El marcado de cada parte lleva
 * `data-partner`, que es donde irá su logo cuando exista el permiso. Los entregables, el precio y la nota son los
 * aprobados de /paginas-web (mismo ComboColumn); aquí solo cambian el titular y la frase de la colaboración.
 * Los montos en lempiras se ven con la «L» y la coma de miles (aria-hidden) y se leen con la palabra «lempiras» (sr-only).
 */
const HomeCombo = ({ combo }: { combo: HomeComboContent }) => (
  <PwSection head={combo} tight className="ms-home-combo-section">
    <div className="ms-home-combo" {...reveal()}>
      <div className="ms-home-combo__top">
        <div>
          <PwEyebrow className="ms-home-combo__eyebrow">{combo.eyebrow}</PwEyebrow>
          <h2 id={titleId(combo.id)} className="ms-pw-h2">
            {combo.headline}
          </h2>
          <p className="ms-pw-lead ms-home-combo__collab">{combo.collaboration}</p>
          <p className="ms-pw-text ms-home-combo__sub">
            <span aria-hidden="true">{combo.subtitle}</span>
            <span className="sr-only">{combo.subtitleSpoken}</span>
          </p>
        </div>
        <div className="ms-home-combo__ticket">
          <p className="ms-home-combo__name">{combo.title}</p>
          <p className="ms-pw-combo__price">
            <span aria-hidden="true">{combo.amount}</span>
            <span className="sr-only">{combo.amountSpoken}</span>
          </p>
        </div>
      </div>

      <div className="ms-pw-combo__cols">
        <div data-partner="lau-graphic">
          <ComboColumn column={combo.logo} />
        </div>
        <div data-partner="multistack-systems">
          <ComboColumn column={combo.web} />
        </div>
      </div>

      <div className="ms-home-combo__buy">
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

export default HomeCombo;
