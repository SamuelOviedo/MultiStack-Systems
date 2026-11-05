import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { navGroupsForRole } from "@/components/admin/adminNav";
import { Panel } from "@/components/admin/Panel";

/**
 * Accesos a los módulos que ya funcionan. Salen de la misma configuración que el menú lateral
 * (`adminNav`): si un módulo pasa a «funcional» aparece aquí, y los «Pronto» no se enlazan.
 * El Resumen no se lista a sí mismo.
 */
export default function QuickAccess({ userType }: { userType: number | null }) {
  const items = navGroupsForRole(userType)
    .flatMap((group) => group.items)
    .filter((item) => item.status === "funcional" && item.href && item.href !== "/dashboard");
  if (items.length === 0) return null;
  return (
    <Panel title="Accesos rápidos">
      <ul className="-mx-2 space-y-0.5">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.id}>
              <Link
                to={item.href!}
                className="flex min-h-10 items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors duration-150 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
              >
                <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                <span className="flex-1">{item.label}</span>
                <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
