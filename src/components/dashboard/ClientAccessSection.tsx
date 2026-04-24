import { useState } from "react";
import { getProjectTokens, generateToken } from "@/lib/tickets";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, RefreshCw, Link2, Clock } from "lucide-react";
import type { ClientAccessToken } from "@/types/tickets";

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

  const activeToken = tokens.find(t => t.active);
  const portalUrl = activeToken
    ? `${window.location.origin}/client/${activeToken.token}`
    : null;

  const handleGenerate = async () => {
    setLoading(true);
    try {
      await generateToken(projectId, clientName || undefined, clientEmail || undefined);
      toast({ title: "Enlace generado" });
      setClientName("");
      setClientEmail("");
      onRefresh();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const copyUrl = () => {
    if (!portalUrl) return;
    navigator.clipboard.writeText(portalUrl);
    toast({ title: "URL copiada" });
  };

  return (
    <div className="space-y-4">
      <h3 className="font-display text-xs text-muted-foreground">$ acceso del cliente</h3>

      {/* Active token */}
      {activeToken && portalUrl ? (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Link2 className="h-3.5 w-3.5 text-primary" />
            <span className="font-display text-xs text-primary">Enlace activo</span>
          </div>

          <div className="flex gap-2">
            <Input
              value={portalUrl}
              readOnly
              className="bg-background border-border font-mono-code text-xs h-8"
            />
            <Button onClick={copyUrl} variant="outline" size="sm"
              className="font-display text-[10px] shrink-0 border-primary/30 text-primary hover:bg-primary/10">
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="text-[10px] text-muted-foreground font-mono-code space-y-0.5">
            {activeToken.client_name  && <p>cliente: {activeToken.client_name}</p>}
            {activeToken.client_email && <p>email: {activeToken.client_email}</p>}
            <p>creado: {new Date(activeToken.created_at).toLocaleDateString("es-HN")}</p>
            {activeToken.last_accessed_at && (
              <p className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                último acceso: {new Date(activeToken.last_accessed_at).toLocaleString("es-HN")}
              </p>
            )}
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic">Sin enlace activo para este proyecto.</p>
      )}

      {/* Generate / Regenerate form */}
      <div className="rounded-lg border border-border p-4 space-y-3">
        <p className="font-display text-[10px] text-muted-foreground">
          {activeToken ? "— regenerar enlace (desactiva el anterior) —" : "— generar enlace de acceso —"}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="font-display text-[10px] text-muted-foreground mb-1 block">nombre_cliente:</label>
            <Input value={clientName} onChange={e => setClientName(e.target.value)}
              placeholder="Juan Pérez" className="bg-background border-border font-mono-code text-xs h-8" />
          </div>
          <div>
            <label className="font-display text-[10px] text-muted-foreground mb-1 block">email_cliente:</label>
            <Input type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)}
              placeholder="juan@email.com" className="bg-background border-border font-mono-code text-xs h-8" />
          </div>
        </div>
        <Button onClick={handleGenerate} disabled={loading} size="sm"
          className="font-display text-[10px] bg-primary text-primary-foreground hover:bg-primary/90">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Generando..." : activeToken ? "[ REGENERAR ENLACE ]" : "[ GENERAR ENLACE ]"}
        </Button>
      </div>

      {/* History */}
      {tokens.filter(t => !t.active).length > 0 && (
        <div>
          <p className="font-display text-[10px] text-muted-foreground mb-2">historial:</p>
          <div className="space-y-1">
            {tokens.filter(t => !t.active).map(t => (
              <div key={t.id} className="flex items-center justify-between text-[10px] text-muted-foreground/50 font-mono-code px-2 py-1 border border-border/30 rounded">
                <span>{t.token.slice(0, 16)}…</span>
                <span>{new Date(t.created_at).toLocaleDateString("es-HN")} · inactivo</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
