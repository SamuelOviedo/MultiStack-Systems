import { useId, useState } from "react";
import { Clock, Copy, ExternalLink, Link2, RefreshCw } from "lucide-react";

import { Panel } from "@/components/admin/Panel";
import { actionErrorMessage } from "@/components/dashboard/dashboard-home/loadErrors";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { generateToken } from "@/lib/tickets";
import type { ClientAccessToken } from "@/types/tickets";
import Field from "./Field";
import { formatInstantDateTime, formatInstantDay } from "./format";
import { useReturnFocus } from "./panelBehavior";

interface Props {
  projectId: string;
  tokens: ClientAccessToken[];
  onRefresh: () => void;
}

export default function ClientAccessSection({ projectId, tokens, onRefresh }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const linkId = useId();

  const activeToken = tokens.find(t => t.active);
  const portalUrl = activeToken
    ? `${window.location.origin}/client/${activeToken.token}`
    : null;
  const inactive = tokens.filter(t => !t.active);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      await generateToken(projectId, clientName || undefined, clientEmail || undefined);
      toast({ title: "Enlace generado" });
      setClientName("");
      setClientEmail("");
      onRefresh();
    } catch (e) {
      toast({ title: "No se pudo generar el enlace", description: actionErrorMessage(e, "generar enlace del portal"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const copyUrl = async () => {
    if (!portalUrl) return;
    try {
      await navigator.clipboard.writeText(portalUrl);
      toast({ title: "Enlace copiado" });
    } catch {
      toast({ title: "No se pudo copiar", description: "Selecciona el enlace y cópialo con Ctrl+C.", variant: "destructive" });
    }
  };

  // El diálogo de confirmación no tiene disparador propio: se devuelve el foco al botón que lo abrió.
  const returnFocus = useReturnFocus();

  // Regenerar desactiva el enlace que el cliente ya tiene: pide confirmación. Generar el primero no.
  const requestGenerate = () => (activeToken ? setConfirmOpen(true) : void handleGenerate());

  return (
    <Panel
      title="Acceso del cliente"
      description="Enlace privado para que el cliente consulte el avance de su proyecto sin iniciar sesión."
    >
      <div className="space-y-6">
        {activeToken && portalUrl ? (
          <section aria-label="Enlace activo" className="space-y-3 rounded-lg border bg-subtle p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Link2 aria-hidden="true" className="size-4 text-success" />
              Enlace activo
            </div>

            <div className="space-y-1.5">
              <label htmlFor={linkId} className="text-xs font-medium text-muted-foreground">Enlace del portal del cliente</label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input id={linkId} value={portalUrl} readOnly onFocus={(e) => e.currentTarget.select()} className="font-mono text-xs" />
                <Button type="button" variant="outline" onClick={() => void copyUrl()} className="sm:shrink-0">
                  <Copy aria-hidden="true" />
                  Copiar enlace
                </Button>
              </div>
              <a
                href={portalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-sm text-sm text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Abrir el portal del cliente
                <ExternalLink aria-hidden="true" className="size-3.5" />
                <span className="sr-only">(se abre en otra pestaña)</span>
              </a>
            </div>

            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              {activeToken.client_name && (
                <div>
                  <dt className="text-xs text-muted-foreground">Cliente</dt>
                  <dd className="break-words">{activeToken.client_name}</dd>
                </div>
              )}
              {activeToken.client_email && (
                <div>
                  <dt className="text-xs text-muted-foreground">Correo</dt>
                  <dd className="break-words">{activeToken.client_email}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-muted-foreground">Creado</dt>
                <dd><time dateTime={activeToken.created_at}>{formatInstantDay(activeToken.created_at)}</time></dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Último acceso</dt>
                <dd className="flex items-center gap-1">
                  {activeToken.last_accessed_at ? (
                    <>
                      <Clock aria-hidden="true" className="size-3.5 text-muted-foreground" />
                      <time dateTime={activeToken.last_accessed_at}>{formatInstantDateTime(activeToken.last_accessed_at)}</time>
                    </>
                  ) : (
                    <span className="text-muted-foreground">Aún no ha entrado</span>
                  )}
                </dd>
              </div>
            </dl>
          </section>
        ) : (
          <p className="text-sm text-muted-foreground">Sin enlace activo para este proyecto.</p>
        )}

        <section aria-labelledby={`${linkId}-gen`} className="space-y-3 rounded-lg border p-4">
          <div className="space-y-0.5">
            <h3 id={`${linkId}-gen`} className="text-sm font-semibold">
              {activeToken ? "Regenerar enlace" : "Generar enlace de acceso"}
            </h3>
            <p className="text-xs text-muted-foreground">
              {activeToken
                ? "El enlace actual deja de funcionar y el cliente tendrá que usar el nuevo."
                : "Los datos del cliente son opcionales y solo sirven para reconocer el enlace."}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nombre del cliente">
              {(c) => <Input {...c} autoComplete="off" value={clientName} placeholder="Nombre de la persona" onChange={e => setClientName(e.target.value)} />}
            </Field>
            <Field label="Correo del cliente">
              {(c) => <Input {...c} type="email" inputMode="email" autoComplete="off" value={clientEmail} onChange={e => setClientEmail(e.target.value)} />}
            </Field>
          </div>
          <Button type="button" size="sm" onClick={requestGenerate} disabled={loading}>
            <RefreshCw aria-hidden="true" className={loading ? "animate-spin motion-reduce:animate-none" : undefined} />
            {loading ? "Generando…" : activeToken ? "Regenerar enlace" : "Generar enlace"}
          </Button>
        </section>

        {inactive.length > 0 && (
          <section aria-labelledby={`${linkId}-hist`} className="space-y-2">
            <h3 id={`${linkId}-hist`} className="text-sm font-semibold">Enlaces anteriores</h3>
            <ul className="divide-y rounded-md border text-xs text-muted-foreground">
              {inactive.map(t => (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <span className="font-mono">{t.token.slice(0, 16)}…</span>
                  <span>
                    <time dateTime={t.created_at}>{formatInstantDay(t.created_at)}</time> · inactivo
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent {...returnFocus}>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Regenerar el enlace de acceso?</AlertDialogTitle>
            <AlertDialogDescription>
              El enlace que ya tiene el cliente{activeToken?.client_name ? ` (${activeToken.client_name})` : ""} dejará de funcionar. Tendrás que
              enviarle el nuevo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void handleGenerate()}
            >
              Regenerar enlace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Panel>
  );
}
