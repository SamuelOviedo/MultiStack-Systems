import { memo, useId } from "react";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { PLAZO_ETIQUETA, PLAZO_TONE } from "@/components/admin/statusTones";
import { daysUntil } from "@/lib/projects";
import { type ProjectService } from "@/types/projects";
import {
  RENEWAL_WINDOW_DAYS,
  formatCalendarDay,
  isUrgentRenewal,
  renewalWhen,
} from "./projectMetrics";

type Renewal = ProjectService & { nombre_proyecto: string };

/**
 * Renovaciones de servicios dentro de la ventana de 30 días, en el orden recibido (fecha ascendente).
 * La urgencia (7 días o menos) se dice con texto («Urgente»), icono y color; nunca solo con color. El tono, el icono
 * y la palabra salen de la escala única de plazo (`PLAZO_TONE`), la misma que usa Servicios.
 * Sin renovaciones no dibuja nada: el panel padre decide qué mostrar cuando no hay alertas.
 */
function RenewalAlerts({ renewals }: { renewals: readonly Renewal[] }) {
  const headingId = useId();
  if (renewals.length === 0) return null;
  return (
    <section aria-labelledby={headingId} className="space-y-2">
      <h3 id={headingId} className="text-sm font-semibold">
        Renovaciones próximas ({RENEWAL_WINDOW_DAYS} días)
      </h3>
      <ul className="divide-y rounded-md border">
        {renewals.map((r) => {
          if (!r.renewal_date) return null;
          const days = daysUntil(r.renewal_date);
          // Misma escala que Servicios (`PLAZO_TONE`): rojo de 0 a 7 días, ámbar de 8 a 30.
          const nivel = isUrgentRenewal(days) ? "urgente" : "proximo";
          const spec = PLAZO_TONE[nivel];
          return (
            <li key={r.id} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div className="min-w-0">
                <p className="break-words text-sm font-medium">{r.name}</p>
                <p className="break-words text-xs text-muted-foreground">{r.nombre_proyecto}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <StatusBadge kind="custom" label={PLAZO_ETIQUETA[nivel]} tone={spec.tone} icon={spec.icon} strong={spec.strong} />
                <span className="text-xs text-muted-foreground">
                  <span className="tabular">{renewalWhen(days)}</span> · {formatCalendarDay(r.renewal_date)}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default memo(RenewalAlerts);
