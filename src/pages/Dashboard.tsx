import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { Terminal, FolderKanban, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";

interface Proyecto {
  id: string;
  nombre_proyecto: string;
  descripcion: string | null;
  estado: string;
  fecha_creacion: string;
}

const estadoColor: Record<string, string> = {
  "En análisis": "text-yellow-400 border-yellow-400/30 bg-yellow-400/10",
  "Desarrollo": "text-accent border-accent/30 bg-accent/10",
  "Finalizado": "text-primary border-primary/30 bg-primary/10",
};

const Dashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [nombreUsuario, setNombreUsuario] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (supabase
      .from("profiles" as any)
      .select("nombre_usuario")
      .eq("id", user.id)
      .single() as any
    ).then(({ data }: any) => {
      setNombreUsuario(data?.nombre_usuario ?? null);
    });
  }, [user]);

  const fetchProyectos = async () => {
    const { data, error } = await (supabase
      .from("proyectos_clientes" as any)
      .select("*")
      .order("fecha_creacion", { ascending: false }) as any);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setProyectos((data as Proyecto[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchProyectos();
  }, []);

  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return;
    setSubmitting(true);

    const { error } = await (supabase.from("proyectos_clientes" as any).insert({
      user_id: user!.id,
      nombre_proyecto: nombre.trim(),
      descripcion: descripcion.trim() || null,
    } as any) as any);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Proyecto creado" });
      setNombre("");
      setDescripcion("");
      setShowForm(false);
      fetchProyectos();
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Content */}
      <div className="container mx-auto px-6 pt-24 pb-10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <p className="font-display text-xs text-primary mb-1">$ multistack dashboard --list-projects</p>
            <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
              <FolderKanban className="h-6 w-6 text-primary" />
              {nombreUsuario ? `Hola, ${nombreUsuario}` : "Mis Proyectos"}
            </h1>
            <p className="text-xs text-muted-foreground font-mono-code mt-2 sm:mt-1">
              session: {user?.email}
            </p>
          </div>
          <Button
            onClick={() => setShowForm(!showForm)}
            size="sm"
            className="font-display text-xs bg-primary text-primary-foreground hover:bg-primary/90 glow-green"
          >
            <Plus className="h-3.5 w-3.5" />
            [ NUEVO ]
          </Button>
        </div>

        {/* New project form */}
        {showForm && (
          <div className="rounded-lg border border-primary/30 bg-card p-6 mb-8">
            <form onSubmit={handleAddProject} className="space-y-4">
              <div>
                <label className="font-display text-xs text-muted-foreground mb-1.5 block">nombre_proyecto:</label>
                <Input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Mi nuevo proyecto"
                  className="bg-background border-border font-mono-code text-sm"
                  required
                  maxLength={200}
                />
              </div>
              <div>
                <label className="font-display text-xs text-muted-foreground mb-1.5 block">descripcion:</label>
                <Input
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Descripción breve del proyecto"
                  className="bg-background border-border font-mono-code text-sm"
                  maxLength={500}
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={submitting} size="sm" className="font-display text-xs bg-primary text-primary-foreground">
                  {submitting ? "Creando..." : "[ CREAR ]"}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)} className="font-display text-xs">
                  Cancelar
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Projects list */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Terminal className="h-8 w-8 text-primary animate-pulse" />
          </div>
        ) : proyectos.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-border rounded-lg">
            <FolderKanban className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground font-display text-sm">No hay proyectos todavía.</p>
            <p className="text-xs text-muted-foreground mt-1">Crea tu primer proyecto para comenzar.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {proyectos.map((p) => (
              <div
                key={p.id}
                className="rounded-lg border border-border bg-card p-5 hover:border-primary/30 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-display text-sm font-semibold text-foreground">{p.nombre_proyecto}</h3>
                  <span className={`font-display text-[10px] px-2 py-0.5 rounded border ${estadoColor[p.estado] || "text-muted-foreground"}`}>
                    {p.estado}
                  </span>
                </div>
                {p.descripcion && (
                  <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{p.descripcion}</p>
                )}
                <p className="text-[10px] text-muted-foreground font-mono-code">
                  {new Date(p.fecha_creacion).toLocaleDateString("es-HN")}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
