import { useState } from "react";
import { useForm } from "react-hook-form";

import { useAuth } from "@/hooks/useAuth";
import { createProject } from "@/lib/projects";
import { useToast } from "@/hooks/use-toast";
import { useReturnFocus } from "@/components/dashboard/project-detail/panelBehavior";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { actionErrorMessage } from "./loadErrors";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

interface Values {
  nombre_proyecto: string;
  descripcion: string;
  client_name: string;
  client_email: string;
  client_phone: string;
}

const EMPTY_FORM: Values = { nombre_proyecto: "", descripcion: "", client_name: "", client_email: "", client_phone: "" };

export default function NewProjectModal({ open, onClose, onCreated }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const form = useForm<Values>({ defaultValues: EMPTY_FORM });
  const nombre = form.watch("nombre_proyecto");
  const focus = useReturnFocus();

  const handleSubmit = async (v: Values) => {
    if (!v.nombre_proyecto.trim() || !user) return;
    setLoading(true);
    try {
      await createProject(user.id, {
        nombre_proyecto: v.nombre_proyecto.trim(),
        descripcion: v.descripcion.trim() || null,
        client_name: v.client_name.trim() || null,
        client_email: v.client_email.trim() || null,
        client_phone: v.client_phone.trim() || null,
      });
      toast({ title: "Proyecto creado" });
      form.reset(EMPTY_FORM);
      onCreated();
      onClose();
    } catch (error) {
      // El detalle técnico no se muestra: solo un mensaje claro (y un código en el registro).
      toast({ title: "No se pudo crear el proyecto", description: actionErrorMessage(error, "crear proyecto"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent
        closeLabel="Cerrar"
        className="max-h-[90dvh] max-w-md overflow-y-auto"
        onOpenAutoFocus={focus.onOpenAutoFocus}
        onCloseAutoFocus={focus.onCloseAutoFocus}
      >
        <DialogHeader className="text-left">
          <DialogTitle>Nuevo proyecto</DialogTitle>
          <DialogDescription>Solo el nombre es obligatorio. Los demás datos puedes completarlos después.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="nombre_proyecto"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Nombre del proyecto <span aria-hidden="true">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Mi nuevo proyecto" aria-required="true" autoComplete="off" />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="descripcion"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Descripción breve del proyecto" className="resize-none" rows={2} maxLength={500} />
                  </FormControl>
                </FormItem>
              )}
            />

            <fieldset className="space-y-3 border-t pt-4">
              <legend className="text-sm font-medium">Datos del cliente</legend>
              <FormField
                control={form.control}
                name="client_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Nombre del cliente" autoComplete="off" />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="client_email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Correo</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" inputMode="email" placeholder="cliente@email.com" autoComplete="off" />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="client_phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Teléfono</FormLabel>
                    <FormControl>
                      <Input {...field} type="tel" inputMode="tel" placeholder="+504 0000-0000" autoComplete="off" />
                    </FormControl>
                  </FormItem>
                )}
              />
            </fieldset>

            <DialogFooter className="gap-2 pt-2 sm:gap-0">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading || !nombre.trim()} size="sm">
                {loading ? "Creando…" : "Crear proyecto"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
