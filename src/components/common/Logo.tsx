import { Fragment } from "react";
import { cn } from "@/lib/utils";
import isotipoClaro from "@/assets/brand/isotipo-claro-2x.png";
import isotipoOscuro from "@/assets/brand/isotipo-oscuro-2x.png";
import wordmarkClaro from "@/assets/brand/wordmark-claro-2x.png";
import wordmarkOscuro from "@/assets/brand/wordmark-oscuro-2x.png";
import logoClaro from "@/assets/brand/logo-completo-claro-2x.png";
import logoOscuro from "@/assets/brand/logo-completo-oscuro-2x.png";

/**
 * Derivados oficiales a 2x. `width` y `height` son los reales de cada archivo (proporción sin deformar): reservan el
 * espacio antes de que cargue la imagen. «claro» es para interfaz clara y «oscuro» para interfaz oscura.
 */
const ASSETS = {
  isotipo: { claro: isotipoClaro, oscuro: isotipoOscuro, width: 242, height: 191 },
  wordmark: { claro: wordmarkClaro, oscuro: wordmarkOscuro, width: 580, height: 141 },
  full: { claro: logoClaro, oscuro: logoOscuro, width: 580, height: 400 },
} as const;

export type LogoVariant = "lockup" | "isotipo" | "full";

/** Qué piezas compone cada variante. */
const PIECES: Record<LogoVariant, readonly (keyof typeof ASSETS)[]> = {
  lockup: ["isotipo", "wordmark"],
  isotipo: ["isotipo"],
  full: ["full"],
};

type Theme = "claro" | "oscuro";

/** Tema activo ahora mismo: el script de index.html y next-themes ponen la clase `dark` en <html> antes de pintar. */
const activeTheme = (): Theme =>
  typeof document !== "undefined" && document.documentElement.classList.contains("dark") ? "oscuro" : "claro";

interface LogoProps {
  /** La altura se fija por clase (p. ej. `h-7`); el ancho sigue la proporción de los archivos. */
  className?: string;
  /** Nombre accesible del conjunto (único: las imágenes son decorativas). Con `decorative` se ignora: no hay nombre. */
  alt?: string;
  /** "light" fuerza la versión para fondo oscuro (p. ej. sobre escenas cinemáticas oscuras en tema claro). */
  tone?: "auto" | "light";
  /**
   * Regla de uso por tamaño:
   * - `lockup` (por defecto): isotipo + rótulo «MultiStack SYSTEMS». Desde 24 px de alto.
   * - `isotipo`: solo el símbolo. Por debajo de 24 px.
   * - `full`: logotipo completo (isotipo sobre el rótulo). Solo con 64 px de alto o más.
   */
  variant?: LogoVariant;
  /**
   * Logo sobre el pliegue: la versión del tema activo se pide ya (`loading="eager"`). La otra sigue diferida y, al
   * estar oculta con `display: none`, el navegador no la descarga hasta que se cambie de tema.
   */
  priority?: boolean;
  /**
   * Marca decorativa: sin `role="img"` ni `aria-label` y con `aria-hidden`. Solo cuando otro elemento de la misma
   * pantalla ya da el nombre (p. ej. el logo de la barra junto a un encabezado), para no leerlo dos veces.
   */
  decorative?: boolean;
}

/**
 * Identidad oficial de MultiStack Systems para el sitio (landing, acceso, portal y pantallas de carga). El panel
 * administrador usa `admin/BrandMark`.
 *
 * Tema: la clase `dark` de `<html>` (Tailwind, estrategia de clase) decide qué versión se ve; sin estado, sin
 * JavaScript de tema y sin parpadeo. Cada pieza lleva sus dos versiones, la oculta con `display: none` y diferida.
 *
 * Accesibilidad: un único nombre accesible en el contenedor (`role="img"`); las imágenes son decorativas, así que el
 * nombre existe en ambos temas y no se duplica texto. Con `decorative` el contenedor no lleva `role` ni nombre (`alt` se
 * ignora) y queda `aria-hidden`.
 */
const Logo = ({
  className,
  alt = "MultiStack Systems",
  tone = "auto",
  variant = "lockup",
  priority = false,
  decorative = false,
}: LogoProps) => {
  const active = tone === "light" ? "oscuro" : activeTheme();
  const loadingFor = (theme: Theme): "eager" | "lazy" => (priority && theme === active ? "eager" : "lazy");

  return (
    <span
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : alt}
      aria-hidden={decorative ? true : undefined}
      data-brand-variant={variant}
      className={cn("inline-flex w-auto shrink-0 items-center", variant === "lockup" && "gap-2", className)}
    >
      {PIECES[variant].map((piece) => {
        const { width, height } = ASSETS[piece];
        // `loading` y `decoding` van ANTES que `src`: React asigna los atributos en el orden de las props y, si `src` llega
        // primero a un <img> recién creado, el navegador ya lo está pidiendo cuando `loading="lazy"` se aplica (se bajaría
        // también la versión oculta al montarse, p. ej. cuando la barra pasa de tone="light" a "auto" al hacer scroll).
        const image = (theme: Theme, visibility: string) => (
          <img
            alt=""
            aria-hidden="true"
            width={width}
            height={height}
            loading={loadingFor(theme)}
            decoding="async"
            draggable={false}
            data-brand-piece={piece}
            data-brand-theme={theme}
            className={cn("h-full w-auto max-w-none shrink-0 object-contain", visibility)}
            src={ASSETS[piece][theme]}
          />
        );
        return (
          <Fragment key={piece}>
            {tone === "auto" && image("claro", "block dark:hidden")}
            {image("oscuro", tone === "light" ? "block" : "hidden dark:block")}
          </Fragment>
        );
      })}
    </span>
  );
};

export default Logo;
