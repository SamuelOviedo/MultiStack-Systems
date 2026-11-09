// Reglas puras de la lista de tickets y formato de fechas (sin interfaz).
import { describe, expect, it } from "vitest";
import {
  emailLocalPart, formatLongDateTime, formatRelative, formatShortDate, formatShortDateTime,
} from "@/components/dashboard/tickets/ticketFormat";
import {
  ALL, applyFilters, ariaSortFor, assigneeText, countOpen, countUrgentOpen, distinctAssignees, distinctProjects,
  hasActiveFilters, NO_FILTERS, OPEN_STATUSES, sortTickets, UNASSIGNED, type ListTicket,
} from "@/components/dashboard/tickets/ticketList";

const t = (id: string, over: Partial<ListTicket> = {}): ListTicket => ({
  id,
  project_id: "p1",
  client_name: "Cliente Demo",
  client_email: "cliente@example.test",
  type: "bug",
  priority: "media",
  status: "abierto",
  title: `Ticket ${id}`,
  description: null,
  created_at: "2026-10-30T10:00:00.000Z",
  updated_at: "2026-11-01T10:00:00.000Z",
  resolved_at: null,
  assigned_to: null,
  assignee_email: null,
  nombre_proyecto: "Tienda Demo",
  message_count: 0,
  ...over,
});

describe("conteos", () => {
  it("abierto = recibido, en revisión y en progreso (los mismos que la insignia del menú)", () => {
    expect([...OPEN_STATUSES]).toEqual(["abierto", "en_revision", "en_progreso"]);
    const lista = (["abierto", "en_revision", "en_progreso", "asignado", "resuelto", "cerrado", "convertido"] as const).map(
      (status, i) => t(String(i), { status }),
    );
    expect(countOpen(lista)).toBe(3);
  });

  it("urgentes abiertos: solo urgentes que además están abiertos", () => {
    const lista = [
      t("1", { priority: "urgente", status: "abierto" }),
      t("2", { priority: "urgente", status: "resuelto" }),
      t("3", { priority: "alta", status: "abierto" }),
      t("4", { priority: "urgente", status: "en_progreso" }),
    ];
    expect(countUrgentOpen(lista)).toBe(2);
  });

  it("una lista vacía cuenta cero (no inventa cifras)", () => {
    expect(countOpen([])).toBe(0);
    expect(countUrgentOpen([])).toBe(0);
  });
});

describe("filtros", () => {
  const lista = [
    t("a", { title: "Botón de pago", nombre_proyecto: "Tienda", assigned_to: "u1", assignee_email: "ana@example.test" }),
    t("b", { title: "Cañería", nombre_proyecto: "", status: "resuelto", type: "pago", priority: "alta" }),
    t("c", { title: "Otro", nombre_proyecto: "Portal", client_name: "Álvaro Demo", client_email: null }),
  ];

  it("sin filtros devuelve todo y `hasActiveFilters` es falso", () => {
    expect(applyFilters(lista, NO_FILTERS)).toHaveLength(3);
    expect(hasActiveFilters(NO_FILTERS)).toBe(false);
  });

  it("cada filtro y el espacio en blanco de la búsqueda", () => {
    expect(applyFilters(lista, { ...NO_FILTERS, status: "resuelto" }).map((x) => x.id)).toEqual(["b"]);
    expect(applyFilters(lista, { ...NO_FILTERS, type: "pago" }).map((x) => x.id)).toEqual(["b"]);
    expect(applyFilters(lista, { ...NO_FILTERS, priority: "alta" }).map((x) => x.id)).toEqual(["b"]);
    expect(applyFilters(lista, { ...NO_FILTERS, project: "Portal" }).map((x) => x.id)).toEqual(["c"]);
    expect(applyFilters(lista, { ...NO_FILTERS, assignee: "ana@example.test" }).map((x) => x.id)).toEqual(["a"]);
    expect(applyFilters(lista, { ...NO_FILTERS, assignee: UNASSIGNED }).map((x) => x.id)).toEqual(["b", "c"]);
    expect(applyFilters(lista, { ...NO_FILTERS, query: "   " })).toHaveLength(3);
    expect(hasActiveFilters({ ...NO_FILTERS, query: "  " })).toBe(false);
    expect(hasActiveFilters({ ...NO_FILTERS, query: "x" })).toBe(true);
    expect(hasActiveFilters({ ...NO_FILTERS, project: "Portal" })).toBe(true);
  });

  it("la búsqueda ignora mayúsculas y acentos y mira título, proyecto, cliente y responsable", () => {
    expect(applyFilters(lista, { ...NO_FILTERS, query: "BOTON" }).map((x) => x.id)).toEqual(["a"]);
    expect(applyFilters(lista, { ...NO_FILTERS, query: "caneria" }).map((x) => x.id)).toEqual(["b"]);
    expect(applyFilters(lista, { ...NO_FILTERS, query: "portal" }).map((x) => x.id)).toEqual(["c"]);
    expect(applyFilters(lista, { ...NO_FILTERS, query: "alvaro" }).map((x) => x.id)).toEqual(["c"]);
    expect(applyFilters(lista, { ...NO_FILTERS, query: "ana@" }).map((x) => x.id)).toEqual(["a"]);
    expect(applyFilters(lista, { ...NO_FILTERS, query: "no existe" })).toEqual([]);
  });

  it("proyectos y responsables distintos, ordenados y sin vacíos", () => {
    expect(distinctProjects(lista)).toEqual(["Portal", "Tienda"]);
    expect(distinctAssignees(lista)).toEqual(["ana@example.test"]);
  });

  it("ALL y UNASSIGNED no chocan con valores reales", () => {
    expect(ALL).not.toBe(UNASSIGNED);
    expect(ALL).toMatch(/^__/);
  });
});

describe("orden", () => {
  const lista = [
    t("1", { priority: "baja", updated_at: "2026-11-02T10:00:00.000Z", created_at: "2026-10-01T10:00:00.000Z" }),
    t("2", { priority: "urgente", updated_at: "2026-11-01T10:00:00.000Z", created_at: "2026-10-03T10:00:00.000Z" }),
    t("3", { priority: "baja", updated_at: "2026-10-30T10:00:00.000Z", created_at: "2026-10-02T10:00:00.000Z" }),
    t("4", { priority: "alta", updated_at: "2026-10-29T10:00:00.000Z", created_at: "2026-10-04T10:00:00.000Z" }),
  ];
  const ids = (xs: ListTicket[]) => xs.map((x) => x.id);

  it("prioridad: urgente > alta > media > baja y los empates conservan el orden recibido en los dos sentidos", () => {
    expect(ids(sortTickets(lista, "priority", "desc"))).toEqual(["2", "4", "1", "3"]);
    expect(ids(sortTickets(lista, "priority", "asc"))).toEqual(["1", "3", "4", "2"]);
  });

  it("actividad y creación, en los dos sentidos", () => {
    expect(ids(sortTickets(lista, "updated_at", "desc"))).toEqual(["1", "2", "3", "4"]);
    expect(ids(sortTickets(lista, "updated_at", "asc"))).toEqual(["4", "3", "2", "1"]);
    expect(ids(sortTickets(lista, "created_at", "desc"))).toEqual(["4", "2", "3", "1"]);
  });

  it("no modifica la lista original", () => {
    const copia = [...lista];
    sortTickets(lista, "priority", "desc");
    expect(lista).toEqual(copia);
  });

  it("`aria-sort` de cada columna", () => {
    expect(ariaSortFor("priority", "priority", "desc")).toBe("descending");
    expect(ariaSortFor("priority", "priority", "asc")).toBe("ascending");
    expect(ariaSortFor("created_at", "priority", "asc")).toBe("none");
  });
});

describe("responsable en palabras", () => {
  it("correo, «Asignado» si falta el correo y «Sin asignar»", () => {
    expect(assigneeText(t("1", { assigned_to: "u1", assignee_email: "ana@example.test" }))).toBe("ana@example.test");
    expect(assigneeText(t("1", { assigned_to: "u1", assignee_email: null }))).toBe("Asignado");
    expect(assigneeText(t("1"))).toBe("Sin asignar");
  });
});

describe("parte local del correo (columna «Asignado»)", () => {
  it("devuelve lo que va antes de la arroba", () => {
    expect(emailLocalPart("ana@example.test")).toBe("ana");
    expect(emailLocalPart("ana.maria@sub.example.test")).toBe("ana.maria");
  });
  it("con varias arrobas corta en la última (la parte local puede ir entrecomillada)", () => {
    expect(emailLocalPart('"a@b"@example.test')).toBe('"a@b"');
  });
  it("sin arroba, o sin nada antes de ella, devuelve el texto completo (nunca una cadena vacía)", () => {
    expect(emailLocalPart("sin-arroba")).toBe("sin-arroba");
    expect(emailLocalPart("@example.test")).toBe("@example.test");
    expect(emailLocalPart("")).toBe("");
  });
});

describe("fechas", () => {
  const now = new Date("2026-11-02T15:00:00.000Z");
  // La zona de la máquina puede cambiar el día; se construyen las fechas con el mismo «ahora» local.
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();
  const MIN = 60_000;
  const HOUR = 60 * MIN;

  it("relativo: ahora, minutos y horas del mismo día", () => {
    expect(formatRelative(ago(10_000), now)).toBe("justo ahora");
    expect(formatRelative(ago(5 * MIN), now)).toBe("hace 5 min");
    const local = new Date(2026, 10, 2, 14, 0, 0);
    const nowLocal = new Date(2026, 10, 2, 15, 30, 0);
    expect(formatRelative(local.toISOString(), nowLocal)).toBe("hace 1 h");
  });

  it("relativo: ayer, hace n días y, desde 7 días, la fecha corta", () => {
    const nowLocal = new Date(2026, 10, 2, 12, 0, 0);
    const dia = (d: number, h = 12) => new Date(2026, 10, d, h, 0, 0).toISOString();
    expect(formatRelative(dia(1, 23), nowLocal)).toBe("ayer");
    expect(formatRelative(dia(1, 9), nowLocal)).toBe("ayer");
    expect(formatRelative(new Date(2026, 9, 30, 12).toISOString(), nowLocal)).toBe("hace 3 días");
    expect(formatRelative(new Date(2026, 9, 26, 12).toISOString(), nowLocal)).toBe(formatShortDate(new Date(2026, 9, 26, 12).toISOString(), nowLocal));
    expect(formatRelative(new Date(2026, 9, 27, 12).toISOString(), nowLocal)).toBe("hace 6 días");
  });

  it("una fecha futura (reloj desfasado) no dice «hace -3 min»", () => {
    expect(formatRelative(new Date(now.getTime() + 3 * MIN).toISOString(), now)).toBe("justo ahora");
    expect(formatRelative(new Date(now.getTime() + 3 * HOUR).toISOString(), now)).toBe("justo ahora");
  });

  it("una fecha ilegible se muestra «—», nunca «Invalid Date»", () => {
    for (const bad of ["", "no es fecha", "2026-13-45"]) {
      expect(formatRelative(bad, now)).toBe("—");
      expect(formatShortDate(bad, now)).toBe("—");
      expect(formatShortDateTime(bad, now)).toBe("—");
      expect(formatLongDateTime(bad)).toBe("—");
    }
  });

  it("fecha corta: sin año en el año actual y con año en otro", () => {
    const nowLocal = new Date(2026, 10, 2, 12, 0, 0);
    expect(formatShortDate(new Date(2026, 9, 3, 12).toISOString(), nowLocal)).not.toMatch(/2026/);
    expect(formatShortDate(new Date(2025, 9, 3, 12).toISOString(), nowLocal)).toMatch(/2025/);
  });

  it("fecha larga con mes completo y año", () => {
    expect(formatLongDateTime(new Date(2026, 10, 2, 9, 5).toISOString())).toMatch(/noviembre/i);
    expect(formatLongDateTime(new Date(2026, 10, 2, 9, 5).toISOString())).toMatch(/2026/);
  });
});
