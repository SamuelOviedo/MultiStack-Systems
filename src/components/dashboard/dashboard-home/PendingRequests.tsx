import { memo } from "react";
import { Inbox, FolderGit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type Ticket } from "@/types/tickets";

type Request = Ticket & { message_count: number };

export interface PendingRequestsProps {
  requests: Request[];
  onSelect: (ticket: Ticket) => void;
}

/** Admin-only panel: project requests ('solicitud') awaiting conversion. */
function PendingRequests({ requests, onSelect }: PendingRequestsProps) {
  if (requests.length === 0) return null;
  return (
    <div className="rounded-lg border border-primary/30 bg-primary/[0.03] p-4 mb-8">
      <div className="flex items-center gap-2 mb-3">
        <Inbox className="h-4 w-4 text-primary" />
        <span className="font-mono text-xs text-primary">
          Solicitudes de proyecto pendientes ({requests.length})
        </span>
      </div>
      <div className="space-y-2">
        {requests.map((r) => (
          <div
            key={r.id}
            className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-4 py-3"
          >
            <div className="min-w-0">
              <p className="font-display text-xs text-foreground truncate">{r.title}</p>
              <p className="text-[10px] text-muted-foreground font-mono mt-0.5 truncate">
                {r.client_name || "—"}
                {r.client_email ? ` · ${r.client_email}` : ""}
                {` · ${new Date(r.created_at).toLocaleDateString("es-HN")}`}
              </p>
            </div>
            <Button
              onClick={() => onSelect(r)}
              size="sm"
              className="shrink-0 font-display text-[10px] bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20"
            >
              <FolderGit2 className="h-3.5 w-3.5" />
              [ CONFIRMAR PROYECTO ]
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default memo(PendingRequests);
