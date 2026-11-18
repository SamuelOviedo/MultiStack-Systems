import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Gauge, MapPin, MessageCircle, Smartphone, type LucideIcon } from "lucide-react";
import { useInView } from "@/hooks/useInView";
import type { SiteHero } from "@/pages/marketing/siteContent";
import lauPrecios from "@/assets/site/hero/lau-precios.webp";
import lauTitular from "@/assets/site/hero/lau-titular.webp";
import multistackServicios from "@/assets/site/hero/multistack-servicios.webp";
import { cn } from "../cn";
import { HeroCta, SiteButton } from "../SiteButton";
import { SiteLink } from "../SiteLink";
import { useReducedMotion } from "../useReducedMotion";
import { WavesShader } from "../WavesShader";

// Solo trabajo real: el sitio de LAU Graphic y este mismo sitio. Van en el orden de `hero.projectPills`.
const PROJECT_SHOTS = [lauTitular, lauPrecios, multistackServicios] as const;

// En el orden de `hero.featurePills`: celular, WhatsApp, Maps y rápida.
const FEATURE_ICONS: readonly LucideIcon[] = [Smartphone, MessageCircle, MapPin, Gauge];

/** Cada cuántos milisegundos cambia una de las dos píldoras. */
const TICK_MS = 1500;

const delay = (seconds: number) => ({ "--delay": `${seconds}s` }) as CSSProperties;

/**
 * Un solo reloj para las dos píldoras: alternan, nunca cambian a la vez. Se detiene cuando `running` es falso
 * (fuera de pantalla, con el cursor sobre el titular o con movimiento reducido).
 */
function useAlternatingTick(running: boolean, intervalMs: number): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => window.clearInterval(id);
  }, [running, intervalMs]);
  return tick;
}

function Word({ children, at, className }: { children: ReactNode; at: number; className?: string }) {
  return (
    <span className={cn("hero-word", className)} style={delay(at)}>
      {children}
    </span>
  );
}

const PILL =
  "relative h-[52px] w-[70px] shrink-0 overflow-hidden rounded-[18px] border-[2px] border-white/20 shadow-[6px_9px_16px_rgba(0,0,0,0.35),2px_3px_5px_rgba(0,0,0,0.25)] transition-transform site-pill-tilt sm:h-[78px] sm:w-[104px] sm:rounded-[28px] md:h-[100px] md:w-[132px] md:rounded-[34px] lg:h-[114px] lg:w-[150px] lg:rounded-[38px] lg:border-[2.5px]";

/** El carril vertical de una píldora: cada hijo ocupa toda la píldora y `index` decide cuál se ve. */
const RAIL = "flex h-full w-full flex-col transition-transform site-pill-reel";

function Pill({ at, tilt, className, children }: { at: number; tilt: string; className?: string; children: ReactNode }) {
  return (
    <span aria-hidden="true" className="hero-pill inline-flex" style={delay(at)}>
      <span
        className={cn(
          PILL,
          tilt,
          "[@media(hover:hover)_and_(pointer:fine)]:hover:-translate-y-0.5 [@media(hover:hover)_and_(pointer:fine)]:hover:scale-[1.035]",
          className,
        )}
      >
        {children}
        <span className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-white/15" />
      </span>
    </span>
  );
}

export interface HeroProps {
  hero: SiteHero;
}

/**
 * Primera pantalla de la home: ondas WebGL (con degradado de respaldo), insignia que se escribe, titular con
 * dos píldoras animadas, los dos botones y los tres datos.
 *
 * Accesibilidad: el H1 da su texto plano (`hero.title.plainText`) a los lectores de pantalla y todo lo demás del
 * titular (palabras sueltas y píldoras) es decorativo (`aria-hidden`). Es el único H1 de la página.
 */
export function Hero({ hero }: HeroProps) {
  const { title } = hero;
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { amount: 0.3 });
  const reduced = useReducedMotion();
  const [hovering, setHovering] = useState(false);
  const tick = useAlternatingTick(inView && !reduced && !hovering, TICK_MS);
  // La primera píldora cambia en los ticks impares y la segunda en los pares: nunca a la vez.
  const project = Math.floor((tick + 1) / 2) % PROJECT_SHOTS.length;
  const feature = Math.floor(tick / 2) % hero.featurePills.length;

  return (
    // `id="inicio"`: ancla antigua de la home anterior (/#inicio). Ver lib/legacyHomeHash.ts.
    <section ref={ref} id="inicio" className="relative isolate scroll-mt-16 overflow-hidden">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_60%_at_50%_100%,oklch(0.6_0.12_225/0.45),transparent_70%)]"
      />
      <WavesShader className="-z-10" />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_70%_55%_at_50%_45%,oklch(0.155_0.014_250/0.55),oklch(0.155_0.014_250/0.15))]"
      />
      <div aria-hidden="true" className="hero-text-veil absolute inset-0 -z-10" />
      <div aria-hidden="true" className="bg-grid absolute inset-0 -z-10 opacity-60" />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-b from-transparent to-site-background"
      />

      <div className="mx-auto flex min-h-[640px] max-w-6xl flex-col items-center justify-center px-5 pb-24 pt-16 text-center md:min-h-[760px] md:pt-20">
        <p className="hero-in inline-flex items-center gap-2.5 rounded-full border border-site-border bg-site-background/60 px-4 py-2 font-mono text-xs text-site-muted-foreground backdrop-blur-md">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-site-success" />
          <span className="sr-only">{hero.badge}</span>
          <span aria-hidden="true" className="hero-typewriter" style={{ "--chars": hero.badge.length } as CSSProperties}>
            <span className="hero-typed">{hero.badge}</span>
            <span className="hero-caret h-3.5 w-[1.5px] bg-site-primary motion-reduce:hidden" />
          </span>
        </p>

        <h1
          className="mt-10 flex flex-col items-center text-[38px] font-semibold leading-[1.04] tracking-[-0.045em] sm:text-[64px] md:text-[84px] lg:text-[96px]"
          onPointerEnter={() => setHovering(true)}
          onPointerLeave={() => setHovering(false)}
        >
          <span className="sr-only">{title.plainText}</span>
          <span aria-hidden="true" className="flex flex-col items-center">
            <span className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 sm:gap-x-6">
              <Word at={0.1}>{title.pages}</Word>{" "}
              <Pill at={0.28} tilt="-rotate-[0.8deg] skew-x-[3.5deg]" className="bg-[#0B2533]">
                <span className={RAIL} style={{ transform: `translateY(-${project * 100}%)` }}>
                  {PROJECT_SHOTS.map((src, i) => (
                    <img
                      key={hero.projectPills[i] ?? src}
                      src={src}
                      alt=""
                      width={150}
                      height={114}
                      draggable={false}
                      className="h-full w-full shrink-0 select-none object-cover"
                    />
                  ))}
                </span>
              </Pill>{" "}
              <Word at={0.2} className="text-site-muted-foreground">
                {title.web}
              </Word>
            </span>{" "}
            <span className="mt-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 sm:mt-3 sm:gap-x-6">
              <Word at={0.3} className="text-site-muted-foreground">
                {title.forWord}
              </Word>{" "}
              <Pill
                at={0.5}
                tilt="-rotate-[0.6deg] skew-x-[3.5deg]"
                className="border-site-primary/40 bg-[linear-gradient(160deg,#137590,#0B2533)]"
              >
                <span className={RAIL} style={{ transform: `translateY(-${feature * 100}%)` }}>
                  {hero.featurePills.map((label, i) => {
                    const Icon = FEATURE_ICONS[i];
                    return (
                      <span key={label} className="flex h-full w-full shrink-0 flex-col items-center justify-center gap-1">
                        {Icon && <Icon className="h-5 w-5 text-white sm:h-7 sm:w-7 md:h-9 md:w-9" strokeWidth={1.6} />}
                        <span
                          data-label={label}
                          className="hidden text-[11px] font-medium tracking-normal text-white/85 after:content-[attr(data-label)] sm:block md:text-xs"
                        />
                      </span>
                    );
                  })}
                </span>
              </Pill>{" "}
              <Word at={0.4}>{title.businesses}</Word>
            </span>{" "}
            <span className="mt-1 sm:mt-3">
              <Word at={0.55} className="text-gradient pb-[0.08em]">
                {title.place}
              </Word>
            </span>
          </span>
        </h1>

        <p className="hero-in mt-8 max-w-xl text-base text-site-hero-muted md:text-lg" style={delay(0.7)}>
          {hero.subtitle}
        </p>

        <div className="hero-in mt-10 flex flex-wrap items-center justify-center gap-4" style={delay(0.82)}>
          <HeroCta asChild>
            <SiteLink to={hero.primaryCta.href}>{hero.primaryCta.label}</SiteLink>
          </HeroCta>
          <SiteButton asChild variant="glass" size="xl">
            <SiteLink to={hero.secondaryCta.href} target="_blank" aria-label={hero.secondaryCta.ariaLabel}>
              {hero.secondaryCta.label}
            </SiteLink>
          </SiteButton>
        </div>

        <dl className="hero-in mt-12 grid w-full max-w-lg grid-cols-3 gap-6 border-t border-white/10 pt-6" style={delay(0.95)}>
          {hero.facts.map((fact) => (
            <div key={fact.label}>
              <dt className="text-xl font-bold md:text-2xl">
                {fact.valueSpoken ? (
                  <>
                    <span aria-hidden="true">{fact.value}</span>
                    <span className="sr-only">{fact.valueSpoken}</span>
                  </>
                ) : (
                  fact.value
                )}
              </dt>
              <dd className="text-xs text-site-hero-muted">{fact.label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
