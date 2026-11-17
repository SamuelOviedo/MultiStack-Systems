import { Code2, Gauge, HandHelping, MapPin, RefreshCw, type LucideIcon } from "lucide-react";
import PwSection from "@/components/marketing/paginas-web/PwSection";
import PwSectionHead from "@/components/marketing/paginas-web/PwSectionHead";
import type { HomeWhy as HomeWhyContent } from "@/pages/marketing/homeContent";
import { reveal } from "./motion";

/** Un icono por razón, en el orden del contenido: código, velocidad, Honduras, atención, revisiones. */
const ICONS: readonly LucideIcon[] = [Code2, Gauge, MapPin, HandHelping, RefreshCw];

/** Las razones para elegirnos, una tarjeta cada una. Los iconos son decorativos. */
const HomeWhy = ({ why }: { why: HomeWhyContent }) => (
  <PwSection head={why}>
    <PwSectionHead head={why} />
    <ul role="list" className="ms-home-why">
      {why.items.map((item, index) => {
        const Icon = ICONS[index % ICONS.length];
        return (
          <li key={item.title} className="ms-home-card" {...reveal(index)}>
            <span className="ms-home-card__icon">
              <Icon size={20} strokeWidth={2} aria-hidden={true} />
            </span>
            <h3 className="ms-pw-h3">{item.title}</h3>
            {item.text && <p className="ms-pw-text">{item.text}</p>}
          </li>
        );
      })}
    </ul>
  </PwSection>
);

export default HomeWhy;
