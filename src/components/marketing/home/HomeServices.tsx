import PwSection from "@/components/marketing/paginas-web/PwSection";
import PwSectionHead from "@/components/marketing/paginas-web/PwSectionHead";
import type { HomeService, HomeServices as HomeServicesContent } from "@/pages/marketing/homeContent";
import { reveal } from "./motion";

interface HomeServicesProps {
  services: HomeServicesContent;
  /** Se llama al activar el CTA de un servicio: la página prellena el formulario con su `messagePrefill`. */
  onRequest: (service: HomeService) => void;
}

/**
 * «También hacemos»: servicios secundarios, discretos y siempre bajo cotización. El CTA es un enlace a
 * `#contacto` (sin JavaScript navega solo); con JavaScript avisa a la página, que prellena el mensaje y hace el scroll.
 */
const HomeServices = ({ services, onRequest }: HomeServicesProps) => (
  <PwSection head={services}>
    <PwSectionHead head={services}>
      <p className="ms-pw-intro">{services.intro}</p>
    </PwSectionHead>
    <ul role="list" className="ms-home-services">
      {services.items.map((service, index) => (
        <li key={service.id} className="ms-home-service" data-service={service.id} {...reveal(index)}>
          <p className="ms-home-tag">{service.tag}</p>
          <h3 className="ms-pw-h3">{service.title}</h3>
          <p className="ms-pw-text">{service.text}</p>
          <a
            href={service.cta.href}
            aria-label={service.cta.ariaLabel}
            className="ms-home-textlink"
            onClick={(event) => {
              // Clic normal: la página prellena y lleva a #contacto. Con modificadores (abrir en otra pestaña) manda el enlace.
              if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
              event.preventDefault();
              onRequest(service);
            }}
          >
            {service.cta.label}
            <span aria-hidden="true">→</span>
          </a>
        </li>
      ))}
    </ul>
  </PwSection>
);

export default HomeServices;
