import { useState } from "react";
import {
  ArrowUpRight,
  Atom,
  Bot,
  FileCode,
  Gauge,
  Mail,
  MapPin,
  MessageCircle,
  Monitor,
  Paintbrush,
  Wifi,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";
import {
  SITE_PATHS,
  type SiteBento,
  type SiteBentoService,
  type SiteStackId,
  type SiteTerminalLineType,
} from "@/pages/marketing/siteContent";
import { cn } from "../cn";
import { GlowCard } from "../GlowCard";
import { SectionTitle } from "../SectionTitle";
import { SiteLink } from "../SiteLink";
import { useEnterOnView, useLoopingStep } from "./useLoopingStep";

const ENTER_EASE = "site-ease-enter";

/** Encabezado de una tarjeta: el título enlaza a /servicios y su enlace cubre toda la tarjeta (patrón de tarjeta clicable). */
function ServiceHead({ service, big = false }: { service: SiteBentoService; big?: boolean }) {
  return (
    <>
      <p className="font-mono text-xs text-site-primary-text">{service.code}</p>
      <h3 className={cn("mt-3 font-semibold", big ? "text-3xl" : "text-xl")}>
        <SiteLink
          to={SITE_PATHS.servicios}
          className="rounded-site-3xl outline-none after:absolute after:inset-0 after:rounded-site-3xl focus-visible:after:ring-2 focus-visible:after:ring-site-ring"
        >
          {service.title}
        </SiteLink>
      </h3>
      <p className={cn("mt-3 text-sm text-site-muted-foreground", big && "max-w-md")}>{service.text}</p>
      <ArrowUpRight
        aria-hidden="true"
        className="absolute right-6 top-6 text-site-muted-foreground transition-colors group-hover:text-site-primary"
      />
    </>
  );
}

/* ---------- Páginas web: terminal de entrega ---------- */

const LINE_STYLES: Record<SiteTerminalLineType, { mark: string; markClass: string; textClass: string }> = {
  cmd: { mark: "$", markClass: "text-site-primary-text", textClass: "text-site-foreground" },
  ok: { mark: "✓", markClass: "text-site-success", textClass: "text-site-muted-foreground" },
  info: { mark: "›", markClass: "text-site-muted-foreground/60", textClass: "text-site-muted-foreground/80" },
  url: { mark: "●", markClass: "text-site-primary-text", textClass: "text-site-primary-text underline underline-offset-2" },
};

/** Pasos extra al final: dejan el resultado en pantalla un rato antes de reiniciar. */
const TERMINAL_HOLD_STEPS = 5;

function DeployTerminal({ terminal }: { terminal: SiteBento["terminal"] }) {
  const { lines } = terminal;
  const { ref, step } = useLoopingStep(lines.length + TERMINAL_HOLD_STEPS, 850);
  const printed = Math.min(step, lines.length);
  const typing = printed < lines.length;

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="mt-8 flex min-h-[290px] flex-1 flex-col overflow-hidden rounded-site-2xl border border-site-border bg-site-background/70 font-mono text-xs leading-relaxed"
    >
      <div className="flex items-center gap-1.5 border-b border-site-border px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-site-muted-foreground/40" />
        <span className="h-2.5 w-2.5 rounded-full bg-site-muted-foreground/40" />
        <span className="h-2.5 w-2.5 rounded-full bg-site-muted-foreground/40" />
        <span className="ml-3 text-site-muted-foreground">{terminal.windowTitle}</span>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-5">
        {lines.slice(0, printed).map((line, i) => {
          const style = LINE_STYLES[line.type];
          return (
            <div key={i} className="animate-line-in flex gap-2">
              <span className={cn("w-3 shrink-0 text-center", style.markClass)}>{style.mark}</span>
              <span className={cn("min-w-0 break-words", style.textClass)}>
                {line.text}
                {typing && i === printed - 1 && (
                  <span className="animate-blink ml-1 inline-block h-3 w-1.5 translate-y-0.5 bg-site-primary" />
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Productos con IA: conversación de ejemplo ---------- */

interface ChatFrame {
  count: number;
  typing: boolean;
}

/** Cada respuesta de la IA va precedida de un paso con «escribiendo…»; al final, tres pasos con la charla completa. */
function chatTimeline(messages: SiteBento["chat"]["messages"]): ChatFrame[] {
  const frames: ChatFrame[] = [{ count: 0, typing: false }];
  messages.forEach((message, i) => {
    if (message.from === "ia") frames.push({ count: i, typing: true });
    frames.push({ count: i + 1, typing: false });
  });
  const last = frames[frames.length - 1] ?? { count: messages.length, typing: false };
  frames.push(last, last, last);
  return frames;
}

function ChatDemo({ chat }: { chat: SiteBento["chat"] }) {
  const timeline = chatTimeline(chat.messages);
  const { ref, step } = useLoopingStep(timeline.length, 1100);
  const frame = timeline[step] ?? { count: chat.messages.length, typing: false };

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="mt-6 flex min-h-[280px] flex-1 flex-col overflow-hidden rounded-site-2xl border border-site-border bg-site-background/70"
    >
      <div className="flex items-center gap-2 border-b border-site-border px-4 py-2.5">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-site-primary/15 text-site-primary">
          <Bot className="h-3.5 w-3.5" />
        </span>
        <span className="text-xs font-medium">{chat.assistantName}</span>
        <span className="ml-auto rounded-full border border-site-border px-2 py-0.5 font-mono text-[10px] text-site-muted-foreground">
          {chat.exampleLabel}
        </span>
      </div>
      <div className="flex flex-1 flex-col justify-end gap-2 p-4 text-xs">
        {chat.messages.slice(0, frame.count).map((message, i) => (
          <p
            key={i}
            className={cn(
              "animate-bubble-in max-w-[85%] rounded-site-2xl px-3 py-2 leading-snug",
              message.from === "cliente"
                ? "self-start rounded-bl-site-md bg-site-secondary text-site-foreground/90"
                : "self-end rounded-br-site-md border border-site-primary/30 bg-site-primary/15 text-site-foreground",
            )}
          >
            {message.text}
          </p>
        ))}
        {frame.typing && (
          <span className="animate-fade-in flex gap-1 self-end rounded-site-2xl rounded-br-site-md border border-site-primary/30 bg-site-primary/10 px-3 py-2.5">
            {[0, 1, 2].map((dot) => (
              <span
                key={dot}
                className="animate-typing-dot h-1.5 w-1.5 rounded-full bg-site-primary"
                style={{ animationDelay: `${dot * 0.15}s` }}
              />
            ))}
          </span>
        )}
      </div>
    </div>
  );
}

/* ---------- TechOn y herramientas a medida ---------- */

// En el orden de `bento.supportChips`: equipos, redes, correos y mantenimiento.
const SUPPORT_ICONS: readonly LucideIcon[] = [Monitor, Wifi, Mail, Wrench];

function SupportChips({ chips }: { chips: readonly string[] }) {
  const { ref, shown } = useEnterOnView<HTMLUListElement>();
  return (
    <ul ref={ref} className="mt-5 flex flex-wrap gap-2">
      {chips.map((label, i) => {
        const Icon = SUPPORT_ICONS[i];
        return (
          <li
            key={label}
            style={{ transitionDelay: shown ? `${0.2 + i * 0.07}s` : undefined }}
            className={cn(
              "flex items-center gap-1.5 whitespace-nowrap rounded-full border border-site-border bg-site-background/50 px-3 py-1.5 text-xs text-site-muted-foreground transition-[opacity,transform] duration-300",
              ENTER_EASE,
              !shown && "-translate-x-1.5 opacity-0",
            )}
          >
            {Icon && <Icon className="h-3.5 w-3.5 shrink-0 text-site-primary" aria-hidden="true" />}
            {label}
          </li>
        );
      })}
    </ul>
  );
}

// Alturas (en %) de la gráfica de muestra: decorativa, no es un dato.
const SAMPLE_BARS = [38, 52, 45, 70, 62, 84, 76];

function SampleReport({ caption }: { caption: string }) {
  const { ref, shown } = useEnterOnView<HTMLDivElement>();
  return (
    <div className="mt-auto pt-5" aria-hidden="true">
      <div ref={ref} className="flex h-16 items-end gap-1.5">
        {SAMPLE_BARS.map((height, i) => (
          <span
            key={i}
            style={{
              height: `${height}%`,
              // Solo la entrada espera su turno: el color del hover (segunda propiedad) responde sin retardo.
              transitionDelay: shown ? `${0.2 + i * 0.05}s, 0s` : undefined,
            }}
            className={cn(
              "flex-1 origin-bottom rounded-t-[3px] transition-[transform,background-color] duration-500",
              ENTER_EASE,
              !shown && "scale-y-0",
              i === SAMPLE_BARS.length - 1 ? "bg-site-primary" : "bg-site-primary/30 group-hover:bg-site-primary/45",
            )}
          />
        ))}
      </div>
      <p className="mt-2 font-mono text-[11px] text-site-muted-foreground">{caption}</p>
    </div>
  );
}

/* ---------- Stack ---------- */

const TECH_ICONS: Record<SiteStackId, LucideIcon> = {
  react: Atom,
  typescript: FileCode,
  tailwind: Paintbrush,
  vite: Zap,
  lighthouse: Gauge,
  whatsapp: MessageCircle,
  maps: MapPin,
  ia: Bot,
};

/**
 * Cada tecnología es un botón: con el cursor, con el teclado (foco) y con el toque se muestra su descripción en la
 * región `aria-live`. En pantallas táctiles el puntero «sale» apenas se levanta el dedo, así que ahí la descripción
 * se queda hasta que se toca otra tecnología.
 */
function StackCard({ stack, index }: { stack: SiteBento["stack"]; index: number }) {
  const [activeId, setActiveId] = useState<SiteStackId | null>(null);
  const active = stack.items.find((item) => item.id === activeId);

  return (
    <GlowCard reveal index={index} className="md:col-span-2 lg:col-span-4">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h3 className="text-xl font-semibold">{stack.title}</h3>
        <p className="font-mono text-xs text-site-primary-text">{stack.code}</p>
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {stack.items.map((item) => {
          const Icon = TECH_ICONS[item.id];
          const on = item.id === activeId;
          return (
            <li key={item.id}>
              <button
                type="button"
                onPointerEnter={() => setActiveId(item.id)}
                onPointerLeave={(e) => {
                  if (e.pointerType !== "touch") setActiveId(null);
                }}
                onClick={() => setActiveId(item.id)}
                onFocus={() => setActiveId(item.id)}
                onBlur={() => setActiveId(null)}
                className={cn(
                  "flex w-full cursor-pointer flex-col items-center gap-1.5 rounded-site-2xl border px-2 py-3 transition-[color,background-color,border-color,transform] site-tile-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-ring",
                  on
                    ? "-translate-y-[3px] border-site-primary/55 bg-site-primary/10 text-site-primary-text"
                    : "border-site-border bg-site-foreground/[0.03] text-site-muted-foreground",
                )}
              >
                <Icon className="h-7 w-7" strokeWidth={1.6} aria-hidden="true" />
                <span
                  className={cn(
                    "text-xs font-medium transition-colors duration-300",
                    on ? "text-site-foreground" : "text-site-foreground/80",
                  )}
                >
                  {item.name}
                </span>
                <span className="min-h-[15px] text-[10px] text-site-muted-foreground">
                  {item.version ? `v${item.version}` : ""}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 min-h-[20px] text-sm text-site-muted-foreground" aria-live="polite">
        <span key={active?.id ?? "none"} className="animate-swap-in inline-block">
          {active ? (
            <>
              <span className="font-medium text-site-foreground">{active.name}:</span> {active.description}
            </>
          ) : (
            stack.help
          )}
        </span>
      </p>
    </GlowCard>
  );
}

/* ---------- Sección ---------- */

export interface ServicesBentoProps {
  bento: SiteBento;
}

function service(bento: SiteBento, id: SiteBentoService["id"]): SiteBentoService {
  const found = bento.services.find((item) => item.id === id);
  if (!found) throw new Error(`Falta el servicio «${id}» en SITE_CONTENT.bento.services.`);
  return found;
}

/** Bento de servicios: páginas web (terminal), IA (chat), TechOn (chips), herramientas (barras) y el stack. */
export function ServicesBento({ bento }: ServicesBentoProps) {
  return (
    <section aria-labelledby="home-servicios-titulo" className="mx-auto max-w-6xl px-5 py-24">
      <SectionTitle id="home-servicios-titulo" tag={bento.tag} title={bento.title} text={bento.text} />
      <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <GlowCard reveal index={0} className="md:col-span-2 lg:row-span-2">
          <ServiceHead service={service(bento, "web")} big />
          <DeployTerminal terminal={bento.terminal} />
        </GlowCard>

        <GlowCard reveal index={1} className="md:col-span-2 lg:col-span-1 lg:row-span-2">
          <ServiceHead service={service(bento, "ia")} />
          <ChatDemo chat={bento.chat} />
        </GlowCard>

        <GlowCard reveal index={2}>
          <ServiceHead service={service(bento, "techon")} />
          <SupportChips chips={bento.supportChips} />
        </GlowCard>

        <GlowCard reveal index={3}>
          <ServiceHead service={service(bento, "tools")} />
          <SampleReport caption={bento.reportCaption} />
        </GlowCard>

        <StackCard stack={bento.stack} index={4} />
      </div>
    </section>
  );
}
