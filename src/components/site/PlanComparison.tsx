import { Check, Minus } from "lucide-react";
import type { PlanComparisonRow, PaginasWebPackage } from "@/lib/webPackages";
import { shortPlanName, type SitePlansView } from "@/pages/marketing/siteContent";

export interface PlanComparisonProps {
  plans: readonly PaginasWebPackage[];
  rows: readonly PlanComparisonRow[];
  text: SitePlansView["comparison"];
}

/**
 * «Comparación completa»: una columna por plan y una fila por característica.
 *
 * La tabla es más ancha que una pantalla de celular, así que se desplaza dentro de su contenedor y la página no
 * (`overflow-x-auto` + `min-w`). Ese contenedor es la única región con nombre (la `<section>` no la lleva, para no
 * duplicar el hito) y es enfocable, para que el teclado también pueda desplazarla. Cabeceras con `scope`; los ✓ y —
 * son decorativos y cada celda dice «Incluido» o «No incluido» con texto solo para lectores de pantalla.
 *
 * El contenedor lleva `relative`: ese texto es `sr-only` (posición absoluta) y, sin un ancestro posicionado dentro del
 * contenedor, su caja se ubica contra uno de fuera, no la recorta el `overflow` y alarga la página a lo ancho.
 */
export function PlanComparison({ plans, rows, text }: PlanComparisonProps) {
  return (
    <section className="mx-auto max-w-6xl px-5 py-16">
      <h2 id="comparacion-titulo" className="text-2xl font-bold">
        {text.title}
      </h2>
      <div
        role="region"
        aria-labelledby="comparacion-titulo"
        tabIndex={0}
        className="relative mt-6 overflow-x-auto rounded-site-2xl border border-site-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-ring"
      >
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-site-surface text-left">
            <tr>
              <th scope="col" className="p-4 font-medium text-site-muted-foreground">
                {text.featureHeader}
              </th>
              {plans.map((plan) => (
                <th key={plan.id} scope="col" className="p-4 font-semibold">
                  {shortPlanName(plan.name)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-t border-site-border">
                <th scope="row" className="p-4 text-left font-normal text-site-muted-foreground">
                  {row.label}
                </th>
                {plans.map((plan) => {
                  const value = row.values[plan.id];
                  return (
                    <td key={plan.id} className="p-4">
                      {value === true || value === false ? (
                        <>
                          {value ? (
                            <Check aria-hidden="true" className="h-4 w-4 text-site-primary" />
                          ) : (
                            <Minus aria-hidden="true" className="h-4 w-4 text-site-muted-foreground/40" />
                          )}
                          <span className="sr-only">{value ? text.included : text.notIncluded}</span>
                        </>
                      ) : (
                        value
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
