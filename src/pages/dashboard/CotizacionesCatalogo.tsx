import { Package } from "lucide-react";
import { EmptyState } from "@/components/admin/EmptyState";
import { PageHeader } from "@/components/admin/PageHeader";

/**
 * Catálogo de paquetes y módulos de cotización (`/dashboard/cotizaciones/catalogo`). En F1 es solo el esqueleto:
 * no carga datos y dice con honestidad que todavía no existe.
 */
export default function CotizacionesCatalogo() {
  return (
    <div className="container mx-auto max-w-7xl space-y-5 px-4 pb-10 sm:px-6">
      <PageHeader title="Catálogo" description="Paquetes y módulos disponibles para cotizar." />
      <EmptyState icon={Package} headingLevel="h2" title="El catálogo se habilita en la siguiente fase" />
    </div>
  );
}
