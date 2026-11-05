// Átomos del administrador (src/components/admin): StatusBadge, EmptyState,
// PageHeader, Panel y KpiTile. Roles ARIA, nombres accesibles y estados.
import { Inbox } from "lucide-react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EmptyState } from "@/components/admin/EmptyState";
import { KpiTile } from "@/components/admin/KpiTile";
import { PageHeader } from "@/components/admin/PageHeader";
import { Panel } from "@/components/admin/Panel";
import { StatusBadge, type StatusBadgeProps } from "@/components/admin/StatusBadge";
import { PROJECT_STATUS_TONE, TICKET_PRIORITY_TONE, TICKET_STATUS_TONE } from "@/components/admin/statusTones";
import { Button } from "@/components/ui/button";
import { STATUS_CONFIG, type ProjectStatus } from "@/types/projects";
import {
  TICKET_PRIORITY_CONFIG,
  TICKET_STATUS_CONFIG,
  type TicketPriority,
  type TicketStatus,
} from "@/types/tickets";

describe("StatusBadge · mapas reales del dominio", () => {
  it("cada estado de proyecto tiene tono y muestra la etiqueta de STATUS_CONFIG", () => {
    expect(Object.keys(PROJECT_STATUS_TONE).sort()).toEqual(Object.keys(STATUS_CONFIG).sort());
    for (const key of Object.keys(STATUS_CONFIG) as ProjectStatus[]) {
      const { unmount } = render(<StatusBadge kind="project" value={key} />);
      expect(screen.getByText(STATUS_CONFIG[key].label)).toBeInTheDocument();
      unmount();
    }
  });

  it("cada estado de ticket tiene tono y muestra la etiqueta de TICKET_STATUS_CONFIG", () => {
    expect(Object.keys(TICKET_STATUS_TONE).sort()).toEqual(Object.keys(TICKET_STATUS_CONFIG).sort());
    for (const key of Object.keys(TICKET_STATUS_CONFIG) as TicketStatus[]) {
      const { unmount } = render(<StatusBadge kind="ticket" value={key} />);
      expect(screen.getByText(TICKET_STATUS_CONFIG[key].label)).toBeInTheDocument();
      unmount();
    }
  });

  it("cada prioridad tiene tono y su nombre accesible incluye «Prioridad»", () => {
    expect(Object.keys(TICKET_PRIORITY_TONE).sort()).toEqual(Object.keys(TICKET_PRIORITY_CONFIG).sort());
    for (const key of Object.keys(TICKET_PRIORITY_CONFIG) as TicketPriority[]) {
      const { container, unmount } = render(<StatusBadge kind="priority" value={key} />);
      expect(container.textContent).toBe(`Prioridad: ${TICKET_PRIORITY_CONFIG[key].label}`);
      unmount();
    }
  });
});

describe("StatusBadge · presentación", () => {
  it("el punto es decorativo: el estado se lee por el texto, no por el color", () => {
    const { container } = render(<StatusBadge kind="project" value="activo" />);
    const dot = container.querySelector("[aria-hidden='true']");
    expect(dot).not.toBeNull();
    expect(container.textContent).toBe("Activo");
  });

  it("usa tokens de estado, nunca valores hex ni colores crudos de los mapas", () => {
    const samples: StatusBadgeProps[] = [
      { kind: "project", value: "activo" },
      { kind: "project", value: "cancelado" },
      { kind: "ticket", value: "convertido" },
      { kind: "priority", value: "urgente" },
    ];
    for (const sample of samples) {
      const { container, unmount } = render(<StatusBadge {...sample} />);
      const html = container.innerHTML;
      expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}|violet-|orange-|blue-/);
      unmount();
    }
    const { container } = render(<StatusBadge kind="project" value="en_analisis" />);
    expect(container.firstElementChild?.className).toContain("text-warning");
    const ok = render(<StatusBadge kind="ticket" value="convertido" />);
    expect(ok.container.firstElementChild?.className).toContain("text-success");
  });

  it("urgente pulsa solo con movimiento permitido", () => {
    const { container } = render(<StatusBadge kind="priority" value="urgente" />);
    const dot = container.querySelector("[aria-hidden='true']") as HTMLElement;
    expect(dot.className).toContain("animate-pulse");
    expect(dot.className).toContain("motion-reduce:animate-none");
  });

  it("los estados terminados usan punto hueco y no tamaños de texto menores a 12 px", () => {
    const { container } = render(<StatusBadge kind="ticket" value="cerrado" />);
    const dot = container.querySelector("[aria-hidden='true']") as HTMLElement;
    expect(dot.className).toContain("bg-transparent");
    expect(container.firstElementChild?.className).toContain("text-xs");
    expect(container.firstElementChild?.className).not.toMatch(/text-\[(8|9|10|11)px\]/);
  });
});

describe("EmptyState", () => {
  it("muestra título como encabezado, descripción y acción", () => {
    render(
      <EmptyState
        icon={Inbox}
        title="Aún no hay tickets"
        description="Cuando llegue una solicitud la verás aquí."
        action={<Button>Crear ticket</Button>}
      />,
    );
    expect(screen.getByRole("heading", { level: 3, name: "Aún no hay tickets" })).toBeInTheDocument();
    expect(screen.getByText("Cuando llegue una solicitud la verás aquí.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Crear ticket" })).toBeInTheDocument();
  });

  it("el icono es decorativo y el nivel del título es ajustable", () => {
    const { container } = render(<EmptyState icon={Inbox} title="Sin datos" headingLevel="h2" />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("heading", { level: 2, name: "Sin datos" })).toBeInTheDocument();
  });

  it("funciona solo con título", () => {
    render(<EmptyState title="Nada por aquí" />);
    expect(screen.getByRole("heading", { name: "Nada por aquí" })).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("PageHeader", () => {
  it("tiene un h1 con el título, descripción y acciones", () => {
    render(
      <PageHeader
        title="Tickets"
        description="Solicitudes de soporte de todos los proyectos."
        actions={<Button>Nuevo ticket</Button>}
      />,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Tickets" })).toBeInTheDocument();
    expect(screen.getByText("Solicitudes de soporte de todos los proyectos.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nuevo ticket" })).toBeInTheDocument();
    expect(screen.getByRole("banner")).toBeInTheDocument();
  });

  it("sin descripción ni acciones solo muestra el título", () => {
    render(<PageHeader title="Inicio" />);
    expect(screen.getByRole("heading", { level: 1, name: "Inicio" })).toBeInTheDocument();
  });
});

describe("Panel", () => {
  it("es una región con el nombre de su título y renderiza el contenido", () => {
    render(
      <Panel title="Renovaciones" description="Próximos 30 días" actions={<Button>Ver todo</Button>}>
        <p>Hosting vence en 5 días</p>
      </Panel>,
    );
    const region = screen.getByRole("region", { name: "Renovaciones" });
    expect(within(region).getByRole("heading", { level: 2, name: "Renovaciones" })).toBeInTheDocument();
    expect(within(region).getByText("Próximos 30 días")).toBeInTheDocument();
    expect(within(region).getByText("Hosting vence en 5 días")).toBeInTheDocument();
    expect(within(region).getByRole("button", { name: "Ver todo" })).toBeInTheDocument();
  });

  it("carga: aria-busy, texto para lectores y barras con el ritmo del contenido; oculta el contenido", () => {
    render(
      <Panel title="Proyectos" loading skeletonRows={4}>
        <p>Contenido real</p>
      </Panel>,
    );
    const region = screen.getByRole("region", { name: "Proyectos" });
    expect(region).toHaveAttribute("aria-busy", "true");
    expect(within(region).getByText("Cargando…")).toBeInTheDocument();
    expect(screen.getByTestId("panel-loading").querySelectorAll("[aria-hidden='true']")).toHaveLength(4);
    expect(screen.queryByText("Contenido real")).not.toBeInTheDocument();
  });

  it("error: mensaje dentro del bloque como alerta y reintento", () => {
    const onRetry = vi.fn();
    render(
      <Panel title="Tickets" error="No se pudieron cargar los tickets." onRetry={onRetry}>
        <p>Contenido real</p>
      </Panel>,
    );
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("No se pudieron cargar los tickets.");
    fireEvent.click(within(alert).getByRole("button", { name: "Reintentar" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Contenido real")).not.toBeInTheDocument();
  });

  it("error sin onRetry no ofrece botón", () => {
    render(<Panel title="Tickets" error="Algo falló." />);
    expect(screen.queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument();
  });

  it("vacío: conserva marco y título y muestra el estado vacío en lugar del contenido", () => {
    render(
      <Panel title="Solicitudes" isEmpty empty={<EmptyState title="Sin solicitudes pendientes" headingLevel="h3" />}>
        <p>Contenido real</p>
      </Panel>,
    );
    const region = screen.getByRole("region", { name: "Solicitudes" });
    expect(within(region).getByRole("heading", { level: 3, name: "Sin solicitudes pendientes" })).toBeInTheDocument();
    expect(screen.queryByText("Contenido real")).not.toBeInTheDocument();
  });

  it("el nivel del título es ajustable y el pie se muestra", () => {
    render(
      <Panel title="Detalle" headingLevel="h3" footer={<span>3 de 10</span>}>
        <p>x</p>
      </Panel>,
    );
    expect(screen.getByRole("heading", { level: 3, name: "Detalle" })).toBeInTheDocument();
    expect(screen.getByText("3 de 10")).toBeInTheDocument();
  });
});

describe("KpiTile", () => {
  it("es un grupo con el nombre de su etiqueta y muestra la cifra", () => {
    render(<KpiTile label="Proyectos activos" value={12} hint="vs. 30 días anteriores" />);
    const group = screen.getByRole("group", { name: "Proyectos activos" });
    expect(within(group).getByText("12")).toBeInTheDocument();
    expect(within(group).getByText("vs. 30 días anteriores")).toBeInTheDocument();
  });

  it("un cero real se imprime como 0 (no como guion)", () => {
    render(<KpiTile label="Tickets abiertos" value={0} />);
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.queryByText("Sin datos")).not.toBeInTheDocument();
  });

  it("sin dato muestra un guion decorativo con texto «Sin datos» para lectores", () => {
    render(<KpiTile label="Margen" value={null} />);
    const group = screen.getByRole("group", { name: "Margen" });
    expect(within(group).getByText("Sin datos")).toBeInTheDocument();
    expect(group.querySelector("[aria-hidden='true']")?.textContent).toBe("—");
  });

  it("formatea números con es-HN y admite unidad", () => {
    render(<KpiTile label="Horas" value={1234} unit="h" />);
    const group = screen.getByRole("group", { name: "Horas" });
    expect(group.textContent).toMatch(/1\D?234h/);
  });

  it("carga: aria-busy, etiqueta visible y texto para lectores, sin cifra", () => {
    render(<KpiTile label="Renovaciones" value={7} loading hint="oculto mientras carga" />);
    const group = screen.getByRole("group", { name: "Renovaciones" });
    expect(group).toHaveAttribute("aria-busy", "true");
    expect(within(group).getByText("Cargando…")).toBeInTheDocument();
    expect(within(group).queryByText("7")).not.toBeInTheDocument();
    expect(within(group).queryByText("oculto mientras carga")).not.toBeInTheDocument();
  });

  it("restringido: no imprime la cifra aunque se pase", () => {
    render(<KpiTile label="Ingresos" value={99999} restricted />);
    const group = screen.getByRole("group", { name: "Ingresos" });
    expect(within(group).getByText("Restringido")).toBeInTheDocument();
    expect(within(group).queryByText(/99/)).not.toBeInTheDocument();
  });
});
