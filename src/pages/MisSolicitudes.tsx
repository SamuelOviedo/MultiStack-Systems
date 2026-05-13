import { useEffect, useState } from "react";
import { Terminal, Plus, X, ChevronDown, ChevronUp } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { createSolicitud, getSolicitudesByEmail } from "@/lib/tickets";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/Navbar";
import {
  TICKET_STATUS_CONFIG,
  type Ticket,
} from "@/types/tickets";

const INPUT =
  "w-full bg-background border border-border rounded px-3 py-2 font-sans text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary";

const SERVICE_OPTIONS = [
  "Página web corporativa",
  "E-commerce / tienda online",
  "Landing page",
  "Aplicación web a medida",
  "Sistema de gestión (CRM/ERP)",
  "Integración de API / backend",
  "Rediseño de sitio existente",
  "Otro",
];

export default function MisSolicitudes() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [solicitudes, setSolicitudes] = useState<(Ticket & { message_count: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [serviceType, setServiceType] = useState(SERVICE_OPTIONS[0]);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    if (!user?.email) return;
    try {
      const data = await getSolicitudesByEmail(user.email);
      setSolicitudes(data);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email) return;
    setSubmitting(true);
    try {
      await createSolicitud(
        user.email,
        user.email,
        title || serviceType,
        `Tipo de servicio: ${serviceType}\n\n${description}`,
      );
      toast({ title: "Solicitud enviada", description: "Nos pondremos en contacto pronto." });
      setTitle("");
      setServiceType(SERVICE_OPTIONS[0]);
      setDescription("");
      setShowForm(false);
      load();
    } catch (e: any) {
      toast({ title: "Error al enviar", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-6 pt-28 pb-16 max-w-3xl space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Terminal className="h-5 w-5 text-primary" />
            <h1 className="font-display text-lg font-semibold tracking-tight text-foreground">
              MIS SOLICITUDES
            </h1>
          </div>
          <button
            onClick={() => setShowForm(v => !v)}
            className="inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-xs font-display font-medium border bg-primary/10 text-primary border-primary/30 hover:bg-primary/20 transition-all"
          >
            {showForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {showForm ? "[ CANCELAR ]" : "[ NUEVA SOLICITUD ]"}
          </button>
        </div>

        {/* Form */}
        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="border border-primary/30 rounded bg-primary/5 p-6 space-y-4"
          >
            <p className="font-display text-xs text-primary uppercase tracking-wider">
              &gt; Nueva solicitud de desarrollo
            </p>

            <div className="space-y-1">
              <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                Tipo de servicio
              </label>
              <select
                value={serviceType}
                onChange={e => setServiceType(e.target.value)}
                className={INPUT}
                required
              >
                {SERVICE_OPTIONS.map(o => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                Título / nombre del proyecto <span className="text-muted-foreground/50">(opcional)</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Ej: Tienda online para ropa deportiva"
                className={INPUT}
              />
            </div>

            <div className="space-y-1">
              <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                Descripción y requerimientos
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Describe qué necesitas, funcionalidades deseadas, referencias, etc."
                rows={5}
                className={INPUT}
                required
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-sm py-2 text-xs font-display font-medium bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 transition-all disabled:opacity-50"
            >
              {submitting ? "[ ENVIANDO... ]" : "[ ENVIAR SOLICITUD ]"}
            </button>
          </form>
        )}

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Terminal className="h-6 w-6 text-primary animate-pulse" />
          </div>
        ) : solicitudes.length === 0 ? (
          <div className="border border-border rounded p-10 text-center space-y-2">
            <p className="font-display text-sm text-muted-foreground">No hay solicitudes aún.</p>
            <p className="font-sans text-xs text-muted-foreground/60">
              Usá el botón &ldquo;Nueva solicitud&rdquo; para comenzar.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {solicitudes.map(s => {
              const statusCfg = TICKET_STATUS_CONFIG[s.status];
              const isOpen = expanded === s.id;
              return (
                <div
                  key={s.id}
                  className="border border-border rounded bg-background/50 overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : s.id)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/10 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`font-mono text-[10px] border rounded-sm px-2 py-0.5 shrink-0 ${statusCfg.color}`}>
                        {statusCfg.label}
                      </span>
                      <span className="font-sans text-sm text-foreground truncate">{s.title}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-3">
                      <span className="font-mono text-[10px] text-muted-foreground/60">
                        {new Date(s.created_at).toLocaleDateString("es-AR")}
                      </span>
                      {isOpen
                        ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                        : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                      }
                    </div>
                  </button>
                  {isOpen && s.description && (
                    <div className="px-4 pb-4 pt-1 border-t border-border/50">
                      <p className="font-sans text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                        {s.description}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
