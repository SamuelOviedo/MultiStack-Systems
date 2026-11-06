import { useEffect, useId, useRef, useState, type RefObject } from "react";

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

/** Texto que anuncia el lector de pantalla cuando llegan mensajes después de abrir el hilo. */
function announcementFor(fresh: TicketMessage[]): string {
  const last = fresh[fresh.length - 1];
  return fresh.length === 1
    ? `Nuevo mensaje de ${last.sender_name}`
    : `${fresh.length} mensajes nuevos, el último de ${last.sender_name}`;
}

/**
 * Hilo de la conversación: una lista de mensajes, equipo a la derecha y cliente a la izquierda, además de la etiqueta.
 * La lista NO es una región viva: al abrir un ticket el lector de pantalla no lee toda la conversación sin que se
 * lo pidan. Solo los mensajes que llegan DESPUÉS de abrir el hilo se anuncian, de forma educada, en una región aparte
 * y oculta («Nuevo mensaje de …»). Al cargar o cambiar de ticket el hilo vuelve a empezar: lo que trae la carga es
 * el punto de partida y no se anuncia.
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
  // Ids ya presentes al terminar de cargar (el punto de partida). `null` mientras el hilo carga o falla.
  const seen = useRef<Set<string> | null>(null);
  const [announcement, setAnnouncement] = useState<{ id: number; text: string } | null>(null);

  useEffect(() => {
    if (state !== "ready") {
      seen.current = null;
      setAnnouncement(null);
      return;
    }
    if (seen.current === null) {
      seen.current = new Set(messages.map((m) => m.id));
      return;
    }
    const known = seen.current;
    const fresh = messages.filter((m) => !known.has(m.id));
    if (fresh.length === 0) return;
    fresh.forEach((m) => known.add(m.id));
    setAnnouncement((prev) => ({ id: (prev?.id ?? 0) + 1, text: announcementFor(fresh) }));
  }, [state, messages]);

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
        <div aria-busy={state === "loading" || undefined}>
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
      {/* Región viva siempre presente y vacía al abrir: solo anuncia lo que llega después. Cada anuncio es un nodo nuevo
          (clave distinta) para que dos mensajes seguidos del mismo autor se digan los dos. */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement && <p key={announcement.id}>{announcement.text}</p>}
      </div>
      <div ref={endRef} />
    </section>
  );
}
