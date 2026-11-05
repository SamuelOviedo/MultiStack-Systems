
import { cn } from "@/lib/utils";
import { STATUS_CONFIG, type ProjectStatus } from "@/types/projects";
import {
  TICKET_PRIORITY_CONFIG,
  TICKET_STATUS_CONFIG,
  type TicketPriority,
  type TicketStatus,
} from "@/types/tickets";
import {
  PROJECT_STATUS_TONE,
  TICKET_PRIORITY_TONE,
  TICKET_STATUS_TONE,
  type IndicatorIcon,
  type StatusTone,
  type ToneSpec,
} from "./statusTones";

// El tinte baja de 10 % a 8 % en oscuro: el texto de estado es más claro que la superficie, así que cada punto
// de tinte le resta contraste. Con 10 % el rojo sobre una fila con hover daba 4,496:1 (AA exige 4,5); con 8 %, 4,60:1.
const PILL_TONE: Record<StatusTone, string> = {
  neutral: "border-border bg-muted text-muted-foreground",
  primary: "border-primary/20 bg-primary/10 text-foreground",
  info: "border-info/25 bg-info/10 text-info dark:bg-info/[0.08]",
  success: "border-success/25 bg-success/10 text-success dark:bg-success/[0.08]",
  warning: "border-warning/25 bg-warning/10 text-warning dark:bg-warning/[0.08]",
  destructive: "border-destructive/25 bg-destructive/10 text-destructive dark:bg-destructive/[0.08]",
};

// Énfasis fuerte: relleno sólido con el `*-foreground` del token (contraste fijado en erp-tokens.test.ts). Solo
// existe para destructivo: es lo que separa «Vencido» de «Urgente», que comparten el rojo.
const PILL_STRONG: Partial<Record<StatusTone, string>> = {
  destructive: "border-destructive bg-destructive font-semibold text-destructive-foreground",
};

const DOT_TONE: Record<StatusTone, string> = {
  neutral: "bg-muted-foreground",
  primary: "bg-primary",
  info: "bg-info",
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
};

const HOLLOW_DOT_TONE: Record<StatusTone, string> = {
  neutral: "border-muted-foreground",
  primary: "border-primary",
  info: "border-info",
  success: "border-success",
  warning: "border-warning",
  destructive: "border-destructive",
};

/**
 * El punto de color de un estado (decorativo: el texto va siempre al lado). Lo usan la píldora y los
 * selectores de estado y prioridad del cajón de tickets, para que ambos se lean igual.
 */
export function StatusDot({ spec, className }: { spec: ToneSpec; className?: string }) {
  return (
    <span
      aria-hidden="true"
      data-indicator="dot"
      className={cn(
        "h-1.5 w-1.5 shrink-0 rounded-full",
        spec.hollow ? cn("border bg-transparent", HOLLOW_DOT_TONE[spec.tone]) : DOT_TONE[spec.tone],
        spec.pulse && "animate-pulse motion-reduce:animate-none",
        className,
      )}
    />
  );
}

export type StatusBadgeProps = (
  | { kind: "project"; value: ProjectStatus }
  | { kind: "ticket"; value: TicketStatus }
  | { kind: "priority"; value: TicketPriority }
  /**
   * Estado que no es de un modelo del dominio (urgencia de una renovación, módulo «Pronto»). El texto lo pone
   * quien llama; el tono y el icono opcional refuerzan, nunca sustituyen, el texto.
   */
  | {
      kind: "custom";
      label: string;
      tone: StatusTone;
      /** Punto hueco; solo cuenta si no hay `icon`. */
      hollow?: boolean;
      /** Icono de alerta: sustituye al punto (un solo indicador por insignia). */
      icon?: IndicatorIcon;
      /** Relleno sólido (solo `destructive`). */
      strong?: boolean;
    }
) & { className?: string };

function resolve(props: StatusBadgeProps): { label: string; spec: ToneSpec } {
  switch (props.kind) {
    case "project":
      return { label: STATUS_CONFIG[props.value].label, spec: PROJECT_STATUS_TONE[props.value] };
    case "ticket":
      return { label: TICKET_STATUS_CONFIG[props.value].label, spec: TICKET_STATUS_TONE[props.value] };
    case "priority":
      return { label: TICKET_PRIORITY_CONFIG[props.value].label, spec: TICKET_PRIORITY_TONE[props.value] };
    case "custom":
      return { label: props.label, spec: { tone: props.tone, hollow: props.hollow, icon: props.icon, strong: props.strong } };
  }
}

/**
 * Píldora de estado: UN indicador (icono para alertas, punto para estados ordinarios) más texto; el estado nunca
 * depende solo del color. El texto cumple AA sobre su tinte en claro y oscuro (ver src/test/erp-tokens.test.ts). La
 * prioridad antepone «Prioridad:» solo para lectores de pantalla, porque «Alta» o «Media» solas son ambiguas.
 */
export function StatusBadge(props: StatusBadgeProps) {
  const { label, spec } = resolve(props);
  const Icon = spec.icon;
  const strong = spec.strong ? PILL_STRONG[spec.tone] : undefined;
  return (
    <span
      data-kind={props.kind}
      data-tone={spec.tone}
      data-emphasis={strong ? "strong" : undefined}
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium leading-4",
        strong ?? PILL_TONE[spec.tone],
        props.className,
      )}
    >
      {Icon ? <Icon aria-hidden="true" data-indicator="icon" className="h-3 w-3 shrink-0" /> : <StatusDot spec={spec} />}
      {props.kind === "priority" && <span className="sr-only">Prioridad: </span>}
      {label}
    </span>
  );
}
