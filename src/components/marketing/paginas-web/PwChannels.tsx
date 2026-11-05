import type { PaginasWebLink, PaginasWebSectionHead } from "@/pages/marketing/paginasWebContent";
import PwLink from "./PwLink";
import PwSection from "./PwSection";
import PwSectionHead from "./PwSectionHead";

interface PwChannelsProps {
  head: PaginasWebSectionHead;
  text: string;
  links: readonly PaginasWebLink[];
  alt?: boolean;
  /** Se llama al activar un enlace hacia el formulario (ancla a #contacto). */
  onContact?: () => void;
}

/** Franja de texto a la izquierda y enlaces a la derecha: atención directa y redes. */
const PwChannels = ({ head, text, links, alt, onContact }: PwChannelsProps) => (
  <PwSection head={head} alt={alt} tight>
    <div className="ms-pw-split">
      <PwSectionHead head={head}>
        <p className="ms-pw-intro">{text}</p>
      </PwSectionHead>
      <ul role="list" className="ms-pw-stack">
        {links.map((link) => (
          <li key={link.href}>
            <PwLink link={link} className="ms-pw-btn ms-pw-btn--ghost ms-pw-btn--block" onContact={onContact} />
          </li>
        ))}
      </ul>
    </div>
  </PwSection>
);

export default PwChannels;
