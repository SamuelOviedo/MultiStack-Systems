// Refinamiento visual del Resumen: jerarquía de los indicadores, legibilidad y robustez de los textos.
// Lo que depende del color (contraste) vive en erp-tokens.test.ts; aquí, la estructura y las clases.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { KpiTile } from "@/components/admin/KpiTile";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { PROJECT_STATUS_TONE, TICKET_PRIORITY_TONE, TICKET_STATUS_TONE } from "@/components/admin/statusTones";
import DashboardStats from "@/components/dashboard/dashboard-home/DashboardStats";
import { STATUS_CONFIG, type ProjectStatus } from "@/types/projects";
import { type Project } from "@/types/projects";
import { TICKET_PRIORITY_CONFIG, TICKET_STATUS_CONFIG, type TicketPriority, type TicketStatus } from "@/types/tickets";

const SRC = path.resolve(__dirname, "..");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8");

/** Archivos de la presentación del Resumen y átomos del administrador. */
const HOME_DIR = "components/dashboard/dashboard-home";
const RESUMEN_FILES = [
  "components/admin/KpiTile.tsx",
  "components/admin/Panel.tsx",
  "components/admin/StatusBadge.tsx",
  "components/admin/statusTones.ts",
  "components/admin/PageHeader.tsx",
  "components/admin/EmptyState.tsx",
  "pages/dashboard/Dashboard.tsx",
  ...readdirSync(path.join(SRC, HOME_DIR))
    .filter((f) => /\.(ts|tsx)$/.test(f))
    .map((f) => `${HOME_DIR}/${f}`),
];

describe("legibilidad · tamaños de texto", () => {
  it("hay archivos que revisar", () => {
    expect(RESUMEN_FILES.length).toBeGreaterThanOrEqual(15);
  });

  it("ningún texto con tamaño fijo por debajo de 12 px (11, 10, 9 px…) en los archivos del Resumen", () => {
    const offenders: string[] = [];
    for (const f of RESUMEN_FILES) {
      for (const m of read(f).matchAll(/\btext-\[(\d+(?:\.\d+)?)(px|rem|em)\]/g)) {
        const px = m[2] === "px" ? parseFloat(m[1]) : parseFloat(m[1]) * 16;
        if (px < 12) offenders.push(`${f}: ${m[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("los textos de las filas del Resumen no se recortan con `truncate` (pasan a la línea siguiente)", () => {
    for (const f of ["ProjectRow", "RenewalAlerts", "PendingRequests", "RecentActivity"]) {
      expect(read(`${HOME_DIR}/${f}.tsx`), f).not.toMatch(/\btruncate\b/);
    }
  });

  it("las líneas que llevan correos o nombres largos se pueden romper (break-words)", () => {
    expect(read(`${HOME_DIR}/PendingRequests.tsx`)).toMatch(/break-words text-xs text-muted-foreground/);
    expect(read(`${HOME_DIR}/RecentActivity.tsx`)).toMatch(/break-words text-xs text-muted-foreground/);
    expect(read(`${HOME_DIR}/ProjectRow.tsx`)).toMatch(/whitespace-nowrap/);
  });
});

describe("KpiTile · jerarquía", () => {
  it("por defecto es de contexto: cifra media y etiqueta atenuada", () => {
    render(<KpiTile label="Pausados" value={2} />);
    const group = screen.getByRole("group", { name: "Pausados" });
    expect(group).toHaveAttribute("data-emphasis", "context");
    expect(within(group).getByText("2")).toHaveClass("text-xl", "tabular");
  });

  it("el principal (lead) pesa más: cifra más grande y etiqueta en tinta principal, con el mismo nombre accesible", () => {
    render(<KpiTile label="Tickets abiertos" value={8} emphasis="lead" hint="Recibidos" />);
    const group = screen.getByRole("group", { name: "Tickets abiertos" });
    expect(group).toHaveAttribute("data-emphasis", "lead");
    expect(within(group).getByText("8")).toHaveClass("text-4xl", "font-semibold", "tabular");
    expect(within(group).getByText("Tickets abiertos")).toHaveClass("font-medium", "text-foreground");
    // Sin color nuevo: el único acento es el borde con el primario existente.
    expect(group.className).toMatch(/border-primary\/40/);
    expect(group.className).not.toMatch(/gradient|shadow-(md|lg|xl)|bg-(primary|info|success|warning)/);
  });

  it("la etiqueta de contexto reserva dos líneas para que las cifras de la fila queden alineadas", () => {
    render(<KpiTile label="Proyectos en progreso" value={3} />);
    expect(screen.getByText("Proyectos en progreso")).toHaveClass("min-h-10");
  });

  it("cargando, sin dato y con dato reservan la misma altura de cifra (la fila no salta)", () => {
    for (const emphasis of ["lead", "context"] as const) {
      const min = emphasis === "lead" ? "min-h-9" : "min-h-5";
      const skeleton = emphasis === "lead" ? "h-9" : "h-5";
      const { container, unmount } = render(
        <>
          <KpiTile label="Con dato" value={1} emphasis={emphasis} />
          <KpiTile label="Sin dato" value={null} emphasis={emphasis} />
          <KpiTile label="Cargando" loading emphasis={emphasis} />
        </>,
      );
      expect(within(screen.getByRole("group", { name: "Con dato" })).getByText("1")).toHaveClass(min);
      expect(within(screen.getByRole("group", { name: "Sin dato" })).getByText("Sin datos").parentElement).toHaveClass(min);
      expect(container.querySelector(`[aria-busy="true"] .${skeleton}`)).not.toBeNull();
      unmount();
    }
  });
});

describe("DashboardStats · jerarquía y cuadrícula", () => {
  const sample = [
    { id: "a", estado: "activo" },
    { id: "b", estado: "en_desarrollo" },
    { id: "c", estado: "pausado" },
  ] as unknown as Project[];

  it("«Tickets abiertos» va primero y es el único principal; los cuatro de proyectos son de contexto", () => {
    render(<DashboardStats projects={sample} openTickets={8} />);
    const groups = within(screen.getByRole("region", { name: "Indicadores" })).getAllByRole("group");
    expect(groups).toHaveLength(5);
    expect(groups[0]).toHaveAccessibleName("Tickets abiertos");
    expect(groups[0]).toHaveAttribute("data-emphasis", "lead");
    expect(groups.slice(1).map((g) => g.getAttribute("data-emphasis"))).toEqual(["context", "context", "context", "context"]);
    ["Total de proyectos", "Proyectos activos", "Proyectos en progreso", "Pausados o cancelados"].forEach((name, i) =>
      expect(groups[i + 1]).toHaveAccessibleName(name),
    );
  });

  it("no cambia qué se cuenta ni los textos de definición", () => {
    render(<DashboardStats projects={sample} openTickets={8} />);
    const g = (name: string) => screen.getByRole("group", { name });
    expect(g("Tickets abiertos")).toHaveTextContent("8");
    expect(g("Tickets abiertos")).toHaveTextContent("Recibidos, en revisión o en progreso");
    expect(g("Proyectos activos")).toHaveTextContent("Activos y en mantenimiento");
    expect(g("Proyectos en progreso")).toHaveTextContent("En análisis, desarrollo o despliegue");
    expect(g("Total de proyectos")).toHaveTextContent("3");
  });

  it("ningún indicador queda huérfano: los tramos de cada fila suman las columnas (2 en pequeño, 5 desde xl)", () => {
    render(<DashboardStats projects={sample} openTickets={8} />);
    const section = screen.getByRole("region", { name: "Indicadores" });
    const groups = within(section).getAllByRole("group");

    // Base: dos columnas. El principal ocupa la fila entera; los otros cuatro forman 2 × 2.
    expect(section.className).toMatch(/\bgrid-cols-2\b/);
    const span = (el: Element, prefix: string) => {
      const m = el.className.match(new RegExp(`(?:^|\\s)${prefix}col-span-(\\d)(?:\\s|$)`));
      return m ? Number(m[1]) : null;
    };
    const base = groups.map((g) => span(g, "") ?? 1);
    expect(base).toEqual([2, 1, 1, 1, 1]);
    expect(base.reduce((a, b) => a + b, 0) % 2).toBe(0);

    // xl: cinco columnas y cinco indicadores de un tramo cada uno.
    expect(section.className).toMatch(/xl:grid-cols-\[minmax\(0,1\.5fr\)_repeat\(4,minmax\(0,1fr\)\)\]/);
    const wide = groups.map((g) => span(g, "xl:") ?? span(g, "") ?? 1);
    expect(wide).toEqual([1, 1, 1, 1, 1]);
  });
});

describe("StatusBadge · texto y punto en todos los estados", () => {
  const DOT = "span[aria-hidden='true']";

  it("cada estado de proyecto, ticket y prioridad muestra su texto y un punto decorativo", () => {
    for (const key of Object.keys(PROJECT_STATUS_TONE) as ProjectStatus[]) {
      const { container, unmount } = render(<StatusBadge kind="project" value={key} />);
      expect(screen.getByText(STATUS_CONFIG[key].label)).toBeInTheDocument();
      expect(container.querySelector(DOT)).not.toBeNull();
      unmount();
    }
    for (const key of Object.keys(TICKET_STATUS_TONE) as TicketStatus[]) {
      const { container, unmount } = render(<StatusBadge kind="ticket" value={key} />);
      expect(screen.getByText(TICKET_STATUS_CONFIG[key].label)).toBeInTheDocument();
      expect(container.querySelector(DOT)).not.toBeNull();
      unmount();
    }
    for (const key of Object.keys(TICKET_PRIORITY_TONE) as TicketPriority[]) {
      const { container, unmount } = render(<StatusBadge kind="priority" value={key} />);
      expect(screen.getByText(TICKET_PRIORITY_CONFIG[key].label)).toBeInTheDocument();
      expect(container.querySelector(DOT)).not.toBeNull();
      unmount();
    }
  });

  it("el texto de cada tono usa un token de color con contraste verificado (nunca un hex ni un color crudo)", () => {
    const source = read("components/admin/StatusBadge.tsx");
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgb\(|hsl\(/);
    expect(source).toMatch(/text-success/);
    expect(source).toMatch(/text-warning/);
    expect(source).toMatch(/text-destructive/);
  });
});

// Insignias y textos pequeños del administrador: nada por debajo de 12 px en la navegación ni en Tickets.
describe("legibilidad · tamaños de texto en el administrador y en Tickets", () => {
  function sourceFiles(dir: string): string[] {
    return readdirSync(path.join(SRC, dir), { withFileTypes: true }).flatMap((entry) => {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) return sourceFiles(rel);
      return /\.(ts|tsx)$/.test(entry.name) ? [rel] : [];
    });
  }
  const FILES = [...sourceFiles("components/admin"), ...sourceFiles("components/dashboard/tickets")];

  it("hay archivos que revisar", () => {
    expect(FILES.length).toBeGreaterThanOrEqual(15);
    expect(FILES).toContain("components/admin/AdminNavList.tsx");
    expect(FILES).toContain("components/dashboard/tickets/TicketThread.tsx");
  });

  it("no queda `text-[11px]`, `text-[10px]` ni ningún tamaño fijo < 12 px en components/admin ni en components/dashboard/tickets", () => {
    const offenders: string[] = [];
    for (const f of FILES) {
      for (const m of read(f).matchAll(/\btext-\[(\d+(?:\.\d+)?)(px|rem|em)\]/g)) {
        const px = m[2] === "px" ? parseFloat(m[1]) : parseFloat(m[1]) * 16;
        if (px < 12) offenders.push(`${f}: ${m[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("las dos insignias de la navegación (contador de tickets y Próximamente) usan `text-xs` (12 px)", () => {
    const nav = read("components/admin/AdminNavList.tsx");
    expect(nav.match(/rounded-full[^"]*\btext-xs font-medium leading-4/g) ?? []).toHaveLength(2);
  });

  it("la etiqueta Equipo/Cliente del hilo usa `text-xs`", () => {
    expect(read("components/dashboard/tickets/TicketThread.tsx")).toMatch(/rounded border bg-background px-1\.5 py-px text-xs font-medium/);
  });
});
