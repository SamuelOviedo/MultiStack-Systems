import ContactForm, { type ContactPrefill } from "@/components/marketing/ContactForm";
import type { PaginasWebContact } from "@/pages/marketing/paginasWebContent";
import PwLink from "./PwLink";
import PwSection from "./PwSection";
import PwSectionHead from "./PwSectionHead";
import { CONTACT_ID_PREFIX } from "./ids";

interface PwContactProps {
  contact: PaginasWebContact;
  /**
   * Texto con el que se prellena el mensaje. Undefined hasta que la persona active un CTA: ContactForm
   * mueve el foco al nombre al recibir un prefill, y eso no puede ocurrir al cargar la página.
   */
  prefill?: ContactPrefill;
}

/**
 * Contacto: ContactForm en una tarjeta como la de ContactSplit y, al lado (debajo en pantallas
 * angostas), los canales alternativos. El orden del DOM es el de lectura.
 */
const PwContact = ({ contact, prefill }: PwContactProps) => {
  const alternativesId = `${contact.id}-alternativas`;

  return (
    <PwSection head={contact} alt>
      <PwSectionHead head={contact}>
        <p className="ms-pw-intro">{contact.intro}</p>
      </PwSectionHead>
      <div className="ms-pw-contact">
        <div className="ms-pw-card">
          <ContactForm idPrefix={CONTACT_ID_PREFIX} prefill={prefill} />
        </div>
        <div>
          <p id={alternativesId} className="ms-pw-alt__label">
            {contact.alternativesLabel}
          </p>
          <ul role="list" aria-labelledby={alternativesId} className="ms-pw-stack">
            {contact.alternatives.map((link) => (
              <li key={link.href}>
                <PwLink link={link} className="ms-pw-btn ms-pw-btn--ghost ms-pw-btn--block" />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </PwSection>
  );
};

export default PwContact;
