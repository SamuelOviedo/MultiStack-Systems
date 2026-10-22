import { ExternalLink } from "lucide-react";
import { SECTION_IDS, type PaginasWebLink } from "@/pages/marketing/paginasWebContent";

const CONTACT_HREF = `#${SECTION_IDS.contact}`;

interface PwLinkProps {
  link: PaginasWebLink;
  className: string;
  /** Se llama al activar un enlace hacia #contacto. No cancela la navegación nativa: solo avisa a la página. */
  onContact?: () => void;
}

/**
 * Un PaginasWebLink como <a>. Externo: pestaña nueva con noopener noreferrer e icono que lo anuncia;
 * ancla (#…) y tel: abren en la misma pestaña. El nombre accesible (ariaLabel) viene del contenido.
 */
const PwLink = ({ link, className, onContact }: PwLinkProps) => {
  const external = link.external === true;

  return (
    <a
      href={link.href}
      className={className}
      aria-label={link.ariaLabel}
      onClick={link.href === CONTACT_HREF ? onContact : undefined}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {link.label}
      {external && <ExternalLink size={16} aria-hidden="true" />}
    </a>
  );
};

export default PwLink;
