import { cn } from "@/lib/utils";
import isotipoClaro from "@/assets/brand/isotipo-claro.png";
import isotipoOscuro from "@/assets/brand/isotipo-oscuro.png";
import logoClaro from "@/assets/brand/logo-completo-claro.png";
import logoOscuro from "@/assets/brand/logo-completo-oscuro.png";

/** Dimensiones intrínsecas de cada derivado: reservan el espacio (proporción) antes de que cargue la imagen. */
const VARIANTS = {
  logo: { claro: logoClaro, oscuro: logoOscuro, width: 290, height: 200 },
  isotipo: { claro: isotipoClaro, oscuro: isotipoOscuro, width: 121, height: 96 },
} as const;

export type BrandMarkVariant = keyof typeof VARIANTS;

interface BrandMarkProps {
  /** `logo`: logotipo completo (barra lateral expandida y cajón). `isotipo`: solo el símbolo (barra plegada). */
  variant: BrandMarkVariant;
  /** La altura se fija por clase (p. ej. `h-20`); el ancho sigue la proporción del archivo. */
  className?: string;
  /** Nombre accesible del conjunto. */
  label?: string;
}

/**
 * Identidad oficial de MultiStack Systems para el administrador (solo aquí: la landing, el acceso y el portal
 * siguen con `common/Logo`). Muestra el archivo oficial sin recolorear, sombrear, filtrar ni animar: el manual de
 * marca lo prohíbe.
 *
 * Tema: la clase `dark` de `<html>` (next-themes, `attribute="class"`) decide qué versión se ve. Las dos imágenes
 * están en el árbol, pero la oculta lleva `display: none` y `loading="lazy"`: el navegador no pide un archivo sin caja
 * de maquetación, así que solo se descarga la variante activa (la otra se pide al cambiar de tema). Sin JavaScript
 * de tema ni estado: no hay parpadeo al hidratar y el componente no se vuelve a renderizar al cambiar de tema.
 *
 * Accesibilidad: un único nombre accesible en el contenedor (`role="img"`); ambas imágenes son decorativas
 * (`alt=""`, `aria-hidden`). Así el nombre existe en los dos temas, sea cual sea la imagen visible.
 */
export default function BrandMark({ variant, className, label = "MultiStack Systems" }: BrandMarkProps) {
  const { claro, oscuro, width, height } = VARIANTS[variant];
  return (
    <span role="img" aria-label={label} data-brand-variant={variant} className={cn("inline-flex shrink-0", className)}>
      <img
        src={claro}
        alt=""
        aria-hidden="true"
        width={width}
        height={height}
        loading="lazy"
        decoding="async"
        draggable={false}
        data-brand-theme="claro"
        className="block h-full w-auto max-w-none object-contain dark:hidden"
      />
      <img
        src={oscuro}
        alt=""
        aria-hidden="true"
        width={width}
        height={height}
        loading="lazy"
        decoding="async"
        draggable={false}
        data-brand-theme="oscuro"
        className="hidden h-full w-auto max-w-none object-contain dark:block"
      />
    </span>
  );
}
