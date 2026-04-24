import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { createProject } from "@/lib/projects";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export default function NewProjectModal({ open, onClose, onCreated }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    nombre_proyecto: "",
    descripcion: "",
    client_name: "",
    client_email: "",
    client_phone: "",
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre_proyecto.trim() || !user) return;
    setLoading(true);
    try {
      await createProject(user.id, {
        nombre_proyecto: form.nombre_proyecto.trim(),
        descripcion: form.descripcion.trim() || null,
        client_name: form.client_name.trim() || null,
        client_email: form.client_email.trim() || null,
        client_phone: form.client_phone.trim() || null,
      });
      toast({ title: "Proyecto creado" });
      setForm({ nombre_proyecto: "", descripcion: "", client_name: "", client_email: "", client_phone: "" });
      onCreated();
      onClose();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const field = (label: string, key: keyof typeof form, type = "text", placeholder = "") => (
    <div>
      <label className="font-display text-xs text-muted-foreground mb-1.5 block">{label}:</label>
      <Input
        type={type}
        value={form[key]}
        onChange={set(key)}
        placeholder={placeholder}
        className="bg-background border-border font-mono-code text-sm"
      />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-sm text-foreground">
            <span className="text-primary">$ </span>multistack create --project
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {field("nombre_proyecto *", "nombre_proyecto", "text", "Mi nuevo proyecto")}

          <div>
            <label className="font-display text-xs text-muted-foreground mb-1.5 block">descripcion:</label>
            <Textarea
              value={form.descripcion}
              onChange={set("descripcion")}
              placeholder="Descripción breve del proyecto"
              className="bg-background border-border font-mono-code text-sm resize-none"
              rows={2}
              maxLength={500}
            />
          </div>

          <div className="border-t border-border pt-4 space-y-3">
            <p className="font-display text-[10px] text-muted-foreground">— datos del cliente —</p>
            {field("client_name", "client_name", "text", "Nombre del cliente")}
            {field("client_email", "client_email", "email", "cliente@email.com")}
            {field("client_phone", "client_phone", "tel", "+504 0000-0000")}
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="submit"
              disabled={loading || !form.nombre_proyecto.trim()}
              size="sm"
              className="font-display text-xs bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {loading ? "Creando..." : "[ CREAR PROYECTO ]"}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onClose} className="font-display text-xs">
              Cancelar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
