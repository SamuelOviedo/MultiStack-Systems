import { Panel } from "@/components/admin/Panel";
import { StatusBadge } from "@/components/admin/StatusBadge";

/**
 * Aviso de lo que aún no existe. Sin cifras ni gráficos: ni el Centro de Operaciones ni las finanzas tienen datos
 * detrás todavía, y mostrar números de ejemplo parecería información real. La decide el padre por rol
 * (solo administrador); esto es presentación, la barrera real es la autorización de las futuras pantallas.
 */
export default function UpcomingModules() {
  return (
    <Panel
      title="Centro de Operaciones y Finanzas"
      description="Visible solo para administradores."
      actions={<StatusBadge kind="custom" tone="neutral" hollow label="Pronto" />}
    >
      <p className="text-sm text-muted-foreground">
        El estado de la infraestructura y los indicadores financieros llegarán más adelante. Por ahora no hay cifras
        que mostrar.
      </p>
    </Panel>
  );
}
