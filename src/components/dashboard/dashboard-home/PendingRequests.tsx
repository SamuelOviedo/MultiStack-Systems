import { memo, useId } from "react";
import { FolderGit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type Ticket } from "@/types/tickets";

type Request = Ticket & { message_count: number };

export interface PendingRequestsProps {
  requests: readonly Request[];
  onSelect: (ticket: Ticket) => void;
}

/**
 * Solo administrador: solicitudes de proyecto (`solicitud`) por convertir. Qué solicitudes cuentan lo decide la
 * consulta `getProjectRequests`; aquí se muestran tal cual llegan. «Confirmar proyecto» abre el modal de alcance.
 */
function PendingRequests({ requests, onSelect }: PendingRequestsProps) {
  const headingId = useId();
  if (requests.length === 0) return null;
  return (
    <section aria-labelledby={headingId} className="space-y-2">
      <div className="flex items-center gap-2">
        <h3 id={headingId} className="text-sm font-semibold">
          Solicitudes de proyecto pendientes
        </h3>
        <span className="tabular rounded-full border bg-muted px-1.5 text-xs font-medium leading-4">{requests.length}</span>
      </div>
      <ul className="divide-y rounded-md border">
        {requests.map((r) => (
          <li key={r.id} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <p className="break-words text-sm font-medium">{r.title}</p>
              <p className="break-words text-xs text-muted-foreground">
                {r.client_name || "Sin nombre"}
                {r.client_email ? ` · ${r.client_email}` : ""}
                {` · ${new Date(r.created_at).toLocaleDateString("es-HN")}`}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onSelect(r)}
              aria-label={`Confirmar proyecto: ${r.title}`}
              className="shrink-0 self-start sm:self-auto"
            >
              <FolderGit2 aria-hidden="true" />
              Confirmar proyecto
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default memo(PendingRequests);
