import { useRef } from "react";
import { Globe, MessageCircle, Palette, Smartphone, type LucideIcon } from "lucide-react";
import { usePointerTilt } from "@/hooks/usePointerTilt";

interface HomeHeroMockProps {
  /** Etiquetas de las tarjetas flotantes (`hero.floatingCards`). */
  cards: readonly string[];
  /** Descripción de la ilustración para lectores de pantalla (`hero.mockAlt`). */
  alt: string;
}

/** Un icono por tarjeta, en el orden del contenido: logo, celular, dominio. */
const CARD_ICONS: readonly LucideIcon[] = [Palette, Smartphone, Globe];

/**
 * Ilustración del hero: un teléfono con la maqueta de una página de negocio y tres tarjetas flotantes, todo con
 * HTML y CSS y los tokens MS. No es la captura de ningún sitio ni lleva imágenes de clientes. La profundidad es
 * `perspective` + `transform`; con ratón la escena se inclina un poco (usePointerTilt), con táctil o movimiento
 * reducido queda quieta. Las tarjetas repiten hechos que ya están en el texto: los lectores de pantalla las omiten.
 */
const HomeHeroMock = ({ cards, alt }: HomeHeroMockProps) => {
  const stageRef = useRef<HTMLDivElement>(null);
  usePointerTilt(stageRef);

  return (
    <div ref={stageRef} className="ms-home-stage" role="img" aria-label={alt}>
      <div className="ms-home-scene" aria-hidden="true">
        <div className="ms-home-phone">
          <div className="ms-home-screen">
            <span className="ms-home-mock__notch" />
            <div className="ms-home-mock__bar">
              <span className="ms-home-mock__dot" />
              <span className="ms-home-mock__line ms-home-mock__line--w40" />
              <span className="ms-home-mock__menu">
                <i />
                <i />
                <i />
              </span>
            </div>
            <div className="ms-home-mock__hero">
              <span className="ms-home-mock__line ms-home-mock__line--strong ms-home-mock__line--w85" />
              <span className="ms-home-mock__line ms-home-mock__line--strong ms-home-mock__line--w60" />
              <span className="ms-home-mock__line ms-home-mock__line--w75" />
              <span className="ms-home-mock__btn" />
            </div>
            <div className="ms-home-mock__cards">
              <span className="ms-home-mock__card">
                <b />
                <span className="ms-home-mock__line ms-home-mock__line--w85" />
                <span className="ms-home-mock__line ms-home-mock__line--w60" />
              </span>
              <span className="ms-home-mock__card">
                <b />
                <span className="ms-home-mock__line ms-home-mock__line--w85" />
                <span className="ms-home-mock__line ms-home-mock__line--w60" />
              </span>
            </div>
            <div className="ms-home-mock__map">
              <span className="ms-home-mock__pin" />
            </div>
            <span className="ms-home-mock__wa">
              <MessageCircle size={16} strokeWidth={2.2} aria-hidden={true} />
            </span>
          </div>
        </div>

        {cards.slice(0, CARD_ICONS.length).map((label, index) => {
          const Icon = CARD_ICONS[index];
          return (
            <div key={label} className={`ms-home-float ms-home-float--${index + 1}`}>
              <span className="ms-home-float__icon">
                <Icon size={16} strokeWidth={2.2} aria-hidden={true} />
              </span>
              <span>{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default HomeHeroMock;
