import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";

import { actionErrorMessage } from "@/components/dashboard/dashboard-home/loadErrors";
import { useReturnFocus } from "@/components/dashboard/project-detail/panelBehavior";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { convertTicketToProject } from "@/lib/projects";
import { EXTERNAL_URL_ERROR, safeExternalUrl } from "@/lib/safeUrl";
import { getTeamMembers } from "@/lib/tickets";
import { ROLE_LABELS, type Ticket, type TeamMember } from "@/types/tickets";

interface Props {
  ticket: Ticket | null;
  open: boolean;
  onClose: () => void;
  onConverted: () => void;
}

interface Values {
  title: string;
  description: string;
  leadDev: string;
  deadline: string;
  googleDocs: string;
  stack: string;
  alcance: string;
  entregables: string;
}

const EMPTY: Values = { title: "", description: "", leadDev: "", deadline: "", googleDocs: "", stack: "", alcance: "", entregables: "" };

/** Un `Select` de Radix no admite el valor vacío en sus opciones: «sin asignar» usa este valor y se guarda como vacío. */
const NO_LEAD = "__sin_asignar__";

/** El título del proyecto necesita al menos 3 letras (sin contar espacios de los lados). */
const MIN_TITLE = 3;

export default function ProjectScopingModal({ ticket, open, onClose, onConverted }: Props) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const focus = useReturnFocus();

  // Formulario de alcance, precargado con los datos de la solicitud.
  const form = useForm<Values>({ defaultValues: EMPTY, mode: "onChange" });
  const title = form.watch("title");

  useEffect(() => {
    if (open && ticket) {
      form.reset({ ...EMPTY, title: ticket.title, description: ticket.description ?? "" });
      getTeamMembers().then(setTeam).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ticket?.id]);

  const canSubmit = title.trim().length >= MIN_TITLE && !submitting;

  const onSubmit = async (v: Values) => {
    if (!ticket || !canSubmit) return;
    setSubmitting(true);
    try {
      const projectId = await convertTicketToProject({
        ticketId: ticket.id,
        title: v.title.trim(),
        description: v.description.trim(),
        leadDeveloperId: v.leadDev || null,
        deadline: v.deadline || null,
        requirements: {
          stack: v.stack.trim() || undefined,
          alcance: v.alcance.trim() || undefined,
          entregables: v.entregables.trim() || undefined,
        },
        googleDocsUrl: v.googleDocs.trim() || null,
      });
      toast({ title: "Proyecto creado", description: "Ticket convertido a proyecto oficial." });
      onConverted();
      onClose();
      navigate(`/dashboard/project/${projectId}`);
    } catch (err) {
      toast({
        title: "No se pudo convertir la solicitud",
        description: actionErrorMessage(err, "convertir solicitud en proyecto"),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && !submitting && onClose()}>
      <DialogContent
        closeLabel="Cerrar"
        className="max-h-[90dvh] overflow-y-auto sm:max-w-xl"
        onOpenAutoFocus={focus.onOpenAutoFocus}
        onCloseAutoFocus={focus.onCloseAutoFocus}
      >
        <DialogHeader className="pr-6 text-left">
          <DialogTitle>Convertir en proyecto</DialogTitle>
          {/* El título de la solicitud se muestra completo (se parte en varias líneas en pantallas angostas). */}
          <DialogDescription className="break-words">
            {ticket ? <>Se creará un proyecto a partir de la solicitud «{ticket.title}». Revisa el alcance antes de crearlo.</> : "Revisa el alcance antes de crear el proyecto."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-1">
            <FormField
              control={form.control}
              name="title"
              rules={{ validate: (v) => v.trim().length >= MIN_TITLE || "Escribe al menos 3 letras para el título." }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título del proyecto</FormLabel>
                  <FormControl>
                    <Input {...field} required aria-required="true" autoComplete="off" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción del proyecto</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={3} className="resize-none" />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="leadDev"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Desarrollador responsable</FormLabel>
                    <Select value={field.value || NO_LEAD} onValueChange={(v) => field.onChange(v === NO_LEAD ? "" : v)}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NO_LEAD}>Sin asignar</SelectItem>
                        {team.map(m => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.email ?? m.id.slice(0, 8)} ({ROLE_LABELS[m.user_type] ?? m.user_type})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="deadline"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha límite</FormLabel>
                    <FormControl>
                      <Input {...field} type="date" />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="googleDocs"
              rules={{ validate: (v) => !v.trim() || safeExternalUrl(v) !== null || EXTERNAL_URL_ERROR }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Google Docs de requerimientos</FormLabel>
                  <FormControl>
                    <Input {...field} type="url" inputMode="url" placeholder="https://docs.google.com/document/d/…" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <fieldset className="space-y-3 rounded-lg border bg-subtle p-4">
              <legend className="px-1 text-sm font-medium">Requerimientos técnicos</legend>
              <FormField
                control={form.control}
                name="stack"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stack propuesto</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="React, Supabase, Vercel…" />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="alcance"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Alcance y especificaciones</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={3} className="resize-none" placeholder="Módulos, funciones, integraciones…" />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="entregables"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Entregables</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={2} className="resize-none" placeholder="Aplicación en producción, documentación, accesos…" />
                    </FormControl>
                  </FormItem>
                )}
              />
            </fieldset>

            <DialogFooter className="gap-2 pt-1 sm:gap-0">
              <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!canSubmit}>
                {submitting ? (
                  <>
                    <Loader2 aria-hidden="true" className="animate-spin motion-reduce:animate-none" /> Convirtiendo…
                  </>
                ) : (
                  "Crear proyecto"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
