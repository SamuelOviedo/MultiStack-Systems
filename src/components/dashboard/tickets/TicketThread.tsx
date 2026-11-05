import { useId, type RefObject } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { TicketMessage } from "@/types/tickets";
import { formatLongDateTime, formatShortDateTime } from "./ticketFormat";

export type ThreadState = "loading" | "ready" | "error";

function Message({ msg, now }: { msg: TicketMessage; now: Date }) {
  const team = msg.sender_type === "team";
  return (
    <li className={cn("flex", team ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "w-full max-w-[85%] space-y-1.5 rounded-lg border px-3 py-2.5",
          team ? "border-primary/25 bg-primary/10" : "bg-muted/50",
        )}
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span className="font-medium text-foreground">{msg.sender_name}</span>
          {/* El autor se dice con texto, no solo con la posición ni el color. */}
          <span className="rounded border bg-background px-1.5 py-px text-xs font-medium text-muted-foreground">
            {team ? "Equipo" : "Cliente"}
          </span>
          <time dateTime={msg.created_at} title={formatLongDateTime(msg.created_at)} className="ml-auto text-muted-foreground">
            {formatShortDateTime(msg.created_at, now)}
          </time>
        </div>
        <p className="whitespace-pre-wrap break-words text-sm text-foreground">{msg.message}</p>
      </div>
    </li>
  );
}

/**
 * Hilo de la conversación. El contenedor es un `log` con avisos educados: cuando llega un mensaje nuevo el lector
 * de pantalla lo anuncia sin interrumpir. Equipo a la derecha y cliente a la izquierda, además de la etiqueta.
 */
export function TicketThread({
  state, messages, now, onRetry, endRef,
}: {
  state: ThreadState;
  messages: TicketMessage[];
  now: Date;
  onRetry: () => void;
  endRef: RefObject<HTMLDivElement>;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId}>
      <h3 id={headingId} className="mb-3 text-sm font-semibold">
        Conversación
        {state === "ready" && messages.length > 0 && (
          <span className="tabular ml-1.5 font-normal text-muted-foreground">({messages.length})</span>
        )}
      </h3>
      {state === "error" ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm">
          <p>No se pudo cargar la conversación. Revisa tu conexión e inténtalo de nuevo.</p>
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            Reintentar
          </Button>
        </div>
      ) : (
        <div
          role="log"
          aria-labelledby={headingId}
          aria-live="polite"
          aria-relevant="additions"
          aria-busy={state === "loading" || undefined}
        >
          {state === "loading" ? (
            <div className="space-y-3">
              <span className="sr-only">Cargando mensajes…</span>
              <Skeleton className="h-16 w-4/5" />
              <Skeleton className="ml-auto h-16 w-4/5" />
            </div>
          ) : messages.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Sin mensajes todavía.</p>
          ) : (
            <ul className="space-y-3">
              {messages.map((m) => (
                <Message key={m.id} msg={m} now={now} />
              ))}
            </ul>
          )}
        </div>
      )}
      <div ref={endRef} />
    </section>
  );
}
