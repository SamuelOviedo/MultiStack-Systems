// Reglas puras del Resumen (projectMetrics, loadErrors) y la variante «custom» de StatusBadge.
import { render, screen } from "@testing-library/react";
import { AlertTriangle } from "lucide-react";
import { describe, expect, it } from "vitest";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { actionErrorMessage, errorCode, loadErrorMessage } from "@/components/dashboard/dashboard-home/loadErrors";
import {
  buildActivity,
  formatCalendarDay,
  inStatusGroup,
  isOpenTicket,
  isUrgentRenewal,
  matchesQuery,
  normalizeText,
  projectCounts,
  recentProjects,
  renewalWhen,
  stageProgress,
} from "@/components/dashboard/dashboard-home/projectMetrics";
import { STATUS_CONFIG, type Project, type ProjectStatus } from "@/types/projects";
import { type TicketStatus } from "@/types/tickets";

const p = (id: string, estado: ProjectStatus, updated: string | null = null, creado = "2026-01-01T00:00:00.000Z"): Project => ({
  id,
  user_id: null,
  nombre_proyecto: `Proyecto ${id}`,
  descripcion: null,
  estado,
  fecha_creacion: creado,
  updated_at: updated,
  client_name: null,
  client_email: null,
  client_phone: null,
  client_id: null,
  lead_developer_id: null,
  requirements: {},
  deadline: null,
  source_ticket_id: null,
  google_docs_requirements_url: null,
});

describe("projectCounts · los grupos cubren los 7 estados una sola vez", () => {
  it("todo estado cae en exactamente un grupo (activos, en progreso o pausados)", () => {
    for (const estado of Object.keys(STATUS_CONFIG) as ProjectStatus[]) {
      const grupos = (["activos", "enProgreso", "pausados"] as const).filter((g) => inStatusGroup(estado, g));
      expect(grupos, estado).toHaveLength(1);
      expect(inStatusGroup(estado, "todos")).toBe(true);
    }
  });

  it("las tres categorías suman el total", () => {
    const all = (Object.keys(STATUS_CONFIG) as ProjectStatus[]).map((e, i) => p(String(i), e));
    const c = projectCounts(all);
    expect(c.todos).toBe(7);
    expect(c.activos + c.enProgreso + c.pausados).toBe(c.todos);
  });
});

describe("recentProjects", () => {
  it("ordena por actualización (o alta si no hay), conserva el orden recibido en empates y corta en el límite", () => {
    const list = [
      p("viejo", "activo", "2026-01-02T00:00:00.000Z"),
      p("empate1", "activo", "2026-05-01T00:00:00.000Z"),
      p("empate2", "activo", "2026-05-01T00:00:00.000Z"),
      p("sinUpdate", "activo", null, "2026-06-01T00:00:00.000Z"),
    ];
    expect(recentProjects(list, 3).map((x) => x.id)).toEqual(["sinUpdate", "empate1", "empate2"]);
    expect(recentProjects(list, 10)).toHaveLength(4);
  });

  it("no modifica la lista recibida y tolera fechas inválidas", () => {
    const list = [p("a", "activo", "no-es-fecha"), p("b", "activo", "2026-05-01T00:00:00.000Z")];
    const copia = [...list];
    expect(recentProjects(list).map((x) => x.id)).toEqual(["b", "a"]);
    expect(list).toEqual(copia);
  });
});

describe("stageProgress", () => {
  it("etapas registradas / 6, con la etapa que toca y tope en la última", () => {
    expect(stageProgress(0)).toMatchObject({ done: 0, percent: 0, currentLabel: "Análisis" });
    expect(stageProgress(2)).toMatchObject({ done: 2, percent: 33, currentLabel: "Desarrollo", total: 6 });
    expect(stageProgress(6)).toMatchObject({ done: 6, percent: 100, currentLabel: "Mantenimiento Activo" });
  });

  it("acota valores fuera de rango (negativos o mayores que 6)", () => {
    expect(stageProgress(-3).done).toBe(0);
    expect(stageProgress(11)).toMatchObject({ done: 6, percent: 100 });
  });
});

describe("renovaciones", () => {
  it("7 días o menos es urgente; 8 no", () => {
    expect(isUrgentRenewal(0)).toBe(true);
    expect(isUrgentRenewal(7)).toBe(true);
    expect(isUrgentRenewal(8)).toBe(false);
  });

  it("renewalWhen dice hoy, mañana o en n días", () => {
    expect(renewalWhen(0)).toBe("hoy");
    expect(renewalWhen(-2)).toBe("hoy");
    expect(renewalWhen(1)).toBe("mañana");
    expect(renewalWhen(12)).toBe("en 12 días");
  });

  it("formatCalendarDay no se corre un día (hora local, no UTC) y tolera basura", () => {
    expect(formatCalendarDay("2026-11-14")).toMatch(/^14\s+nov/i);
    expect(formatCalendarDay("2026-01-01")).toMatch(/^1\s+ene/i);
    expect(formatCalendarDay("sin fecha")).toBe("sin fecha");
  });
});

describe("tickets abiertos", () => {
  it("abierto, en_revision y en_progreso (el mismo conjunto que la insignia del menú)", () => {
    const abiertos: TicketStatus[] = ["abierto", "en_revision", "en_progreso"];
    const cerrados: TicketStatus[] = ["asignado", "resuelto", "cerrado", "convertido"];
    for (const s of abiertos) expect(isOpenTicket(s), s).toBe(true);
    for (const s of cerrados) expect(isOpenTicket(s), s).toBe(false);
  });
});

describe("buildActivity", () => {
  const t = (id: string, updated: string, created = updated) => ({
    id,
    title: `Ticket ${id}`,
    status: "abierto" as const,
    created_at: created,
    updated_at: updated,
    nombre_proyecto: "Proyecto Uno",
  });
  const proj = (id: string, fecha: string) => ({ id, nombre_proyecto: `Proyecto ${id}`, client_name: "Cliente", fecha_creacion: fecha });

  it("mezcla tickets y proyectos, recientes primero, con el límite pedido", () => {
    const items = buildActivity(
      [t("1", "2026-10-03T00:00:00.000Z"), t("2", "2026-10-09T00:00:00.000Z", "2026-10-01T00:00:00.000Z")],
      [proj("a", "2026-10-05T00:00:00.000Z")],
      2,
    );
    expect(items.map((i) => i.id)).toEqual(["ticket-2", "project-a"]);
    expect(items[0]).toMatchObject({ what: "Ticket actualizado", subject: "Ticket 2", context: "Proyecto Uno" });
    expect(items[1]).toMatchObject({ what: "Proyecto creado", subject: "Proyecto a", context: "Cliente", kind: "project" });
  });

  it("un ticket que nunca cambió es «nuevo»; sin datos devuelve una lista vacía", () => {
    expect(buildActivity([t("1", "2026-10-03T00:00:00.000Z")], [])[0].what).toBe("Ticket nuevo");
    expect(buildActivity([], [])).toEqual([]);
  });
});

describe("búsqueda", () => {
  it("normalizeText quita acentos y mayúsculas", () => {
    expect(normalizeText("  ÁNÁLISIS Ñandú ")).toBe("analisis nandu");
  });

  it("matchesQuery: vacío deja pasar todo; busca en nombre, cliente y descripción (campos nulos incluidos)", () => {
    const base = { nombre_proyecto: "Tienda", client_name: null, descripcion: "Sitio de ventas" };
    expect(matchesQuery(base, "")).toBe(true);
    expect(matchesQuery(base, "   ")).toBe(true);
    expect(matchesQuery(base, "TIENDA")).toBe(true);
    expect(matchesQuery(base, "ventas")).toBe(true);
    expect(matchesQuery(base, "otro")).toBe(false);
    expect(matchesQuery({ ...base, client_name: "Cliénte Uno" }, "cliente uno")).toBe(true);
  });
});

describe("loadErrors · nada técnico en pantalla", () => {
  it("errorCode acepta códigos cortos y seguros, el estado HTTP o «desconocido»", () => {
    expect(errorCode({ code: "42501" })).toBe("42501");
    expect(errorCode({ code: "PGRST301" })).toBe("PGRST301");
    expect(errorCode({ status: 503 })).toBe("503");
    expect(errorCode(new Error("hola"))).toBe("desconocido");
    expect(errorCode(null)).toBe("desconocido");
    expect(errorCode("texto")).toBe("desconocido");
    // Un «código» largo o con datos NO se registra: podría traer contenido.
    expect(errorCode({ code: "usuario ana@example.test no existe" })).toBe("desconocido");
  });

  it("loadErrorMessage: permisos distinto de conexión; nunca incluye el mensaje original", () => {
    const secreto = new Error("relation \"profiles\" does not exist ana@example.test");
    expect(loadErrorMessage(secreto, "los proyectos")).toBe("No se pudieron cargar los proyectos. Revisa tu conexión e inténtalo de nuevo.");
    expect(loadErrorMessage(Object.assign(secreto, { code: "42501" }), "los proyectos")).toMatch(/^No tienes permiso para ver los proyectos\./);
    expect(loadErrorMessage(Object.assign(new Error("x"), { status: 403 }), "las alertas")).toMatch(/permiso/);
  });

  it("actionErrorMessage: mensaje fijo en español", () => {
    expect(actionErrorMessage(new Error("duplicate key"), "crear proyecto")).toBe("No se pudo completar la acción. Inténtalo de nuevo.");
    expect(actionErrorMessage({ code: "42501" }, "crear proyecto")).toBe("No tienes permiso para hacer esto.");
  });
});

describe("StatusBadge · variante «custom» (urgencia y «Pronto»)", () => {
  it("lleva el texto que se le da, el tono en data-tone y un icono decorativo opcional", () => {
    const { container } = render(<StatusBadge kind="custom" label="Urgente" tone="destructive" icon={AlertTriangle} />);
    expect(container.textContent).toBe("Urgente");
    const badge = container.firstElementChild!;
    expect(badge).toHaveAttribute("data-kind", "custom");
    expect(badge).toHaveAttribute("data-tone", "destructive");
    expect(badge.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(badge.className).toMatch(/text-destructive/);
    expect(badge.className).not.toMatch(/#[0-9a-f]{3,8}/i);
  });

  it("sin icono usa el punto (hueco si se pide) y no depende solo del color: el texto es lo accesible", () => {
    render(<StatusBadge kind="custom" label="Pronto" tone="neutral" hollow />);
    const badge = screen.getByText("Pronto");
    expect(badge.querySelector("svg")).toBeNull();
    expect(badge.querySelector("[aria-hidden='true']")?.className).toMatch(/border-muted-foreground/);
  });
});
