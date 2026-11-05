// Caracterización: la conversión de una solicitud en proyecto (`ProjectScopingModal`, compartido por
// el Resumen, la lista de tickets y el cajón de tickets). Escrito contra el código ANTERIOR; solo los textos y el
// marcado que cambian a propósito viven en `ADAPTADOR`.
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { campoPorEtiqueta, elegirOpcion, escribirEn, opcionesDe, valorMostrado } from "./helpers/campos";
import { ticket } from "./helpers/projectFixtures";

process.env.TZ = "UTC";

const WAIT = { timeout: 8000 };
vi.setConfig({ testTimeout: 20000 });

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => {
      throw new Error("supabase.from no está simulado: cada consulta debe pasar por un mock de src/lib");
    },
  },
}));
const toastSpy = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: toastSpy }) }));
const libs = vi.hoisted(() => ({ convertTicketToProject: vi.fn(), getTeamMembers: vi.fn() }));
vi.mock("@/lib/projects", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/projects")>()),
  convertTicketToProject: libs.convertTicketToProject,
}));
vi.mock("@/lib/tickets", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tickets")>()),
  getTeamMembers: libs.getTeamMembers,
}));

import ProjectScopingModal from "@/components/dashboard/requests/ProjectScopingModal";

const ADAPTADOR = {
  /** «$ convertir a proyecto oficial» pasa a «Convertir en proyecto». */
  titulo: /convertir (a|en) proyecto/i,
  /** «[ CREAR PROYECTO ]» pasa a «Crear proyecto». */
  crear: /^\[ crear proyecto \]$|^crear proyecto$/i,
  convirtiendo: /convirtiendo/i,
  cancelar: /^cancelar$/i,
  campos: {
    titulo: () => campoPorEtiqueta("Título del proyecto", /^título del proyecto/i),
    descripcion: () => campoPorEtiqueta("Descripción objetivo", /^descripción/i),
    lead: () => campoPorEtiqueta("Lead developer", /desarrollador responsable|lead developer/i),
    fecha: () => campoPorEtiqueta("Fecha límite", /^fecha límite/i),
    docs: () => campoPorEtiqueta("Google Docs de requerimientos", /google docs de requerimientos/i),
    stack: () => campoPorEtiqueta("Stack propuesto", /stack propuesto/i),
    alcance: () => campoPorEtiqueta("Alcance / especificaciones", /alcance/i),
    entregables: () => campoPorEtiqueta("Entregables", /^entregables/i),
  },
  /** «— sin asignar —» (antes) y «Sin asignar» (ahora) en la lista de responsables. */
  sinAsignar: /sin asignar/i,
};

const EQUIPO = [
  { id: "aaaaaaaa-0000-4000-8000-000000000001", email: "admin@example.test", user_type: 0 },
  { id: "bbbbbbbb-0000-4000-8000-000000000002", email: "colab@example.test", user_type: 1 },
  { id: "cccccccc-0000-4000-8000-000000000003", email: null, user_type: 1 },
];

const solicitud = (over = {}) =>
  ticket({ id: "t-sol", project_id: null, type: "solicitud", status: "en_revision", title: "Solicitud: sitio web", description: "Quiero un sitio nuevo", ...over });

beforeAll(() => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.releasePointerCapture = vi.fn();
});
beforeEach(() => {
  toastSpy.mockReset();
  libs.convertTicketToProject.mockReset().mockResolvedValue("p-nuevo");
  libs.getTeamMembers.mockReset().mockResolvedValue(EQUIPO);
});
afterEach(() => cleanup());

function montar(over: { ticket?: ReturnType<typeof solicitud> | null; open?: boolean } = {}) {
  const onClose = vi.fn();
  const onConverted = vi.fn();
  const props = { ticket: over.ticket === undefined ? solicitud() : over.ticket, open: over.open ?? true, onClose, onConverted };
  const vista = (p: typeof props) => (
    <MemoryRouter initialEntries={["/origen"]}>
      <Routes>
        <Route path="/origen" element={<ProjectScopingModal {...p} />} />
        <Route path="/dashboard/project/:id" element={<p>DETALLE-STUB</p>} />
      </Routes>
    </MemoryRouter>
  );
  const r = render(vista(props));
  return { onClose, onConverted, rerender: (p: Partial<typeof props>) => r.rerender(vista({ ...props, ...p })) };
}
const crear = () => screen.getByRole("button", { name: ADAPTADOR.crear });
const equipoCargado = () => waitFor(() => expect(libs.getTeamMembers).toHaveBeenCalled(), WAIT);

describe("conversión de solicitud · apertura", () => {
  it("cerrado no pinta nada ni consulta al equipo", () => {
    montar({ open: false });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(libs.getTeamMembers).not.toHaveBeenCalled();
  });

  it("abierto: diálogo con título, el título y la descripción de la solicitud precargados y el resto vacío", async () => {
    montar();
    const dialogo = within(await screen.findByRole("dialog", {}, WAIT));
    expect(dialogo.getByText(ADAPTADOR.titulo)).toBeInTheDocument();
    expect((ADAPTADOR.campos.titulo() as HTMLInputElement).value).toBe("Solicitud: sitio web");
    expect((ADAPTADOR.campos.descripcion() as HTMLTextAreaElement).value).toBe("Quiero un sitio nuevo");
    for (const c of ["fecha", "docs", "stack", "alcance", "entregables"] as const) {
      expect((ADAPTADOR.campos[c]() as HTMLInputElement).value).toBe("");
    }
    await equipoCargado();
    expect(libs.getTeamMembers).toHaveBeenCalledTimes(1);
  });

  it("una solicitud sin descripción deja la descripción vacía", async () => {
    montar({ ticket: solicitud({ description: null }) });
    await screen.findByRole("dialog", {}, WAIT);
    expect((ADAPTADOR.campos.descripcion() as HTMLTextAreaElement).value).toBe("");
  });

  it("el responsable lista «sin asignar» y al equipo con «correo (rol)» (sin correo: el comienzo del id)", async () => {
    montar();
    await screen.findByRole("dialog", {}, WAIT);
    await waitFor(() => expect(opcionesDe(ADAPTADOR.campos.lead()).length).toBe(4), WAIT);
    const opciones = opcionesDe(ADAPTADOR.campos.lead());
    expect(opciones[0]).toMatch(ADAPTADOR.sinAsignar);
    expect(opciones.slice(1)).toEqual(["admin@example.test (Admin)", "colab@example.test (Colaborador)", "cccccccc (Colaborador)"]);
    expect(valorMostrado(ADAPTADOR.campos.lead())).toMatch(ADAPTADOR.sinAsignar);
  });

  it("si el equipo no carga, el formulario funciona igual (solo «sin asignar»)", async () => {
    libs.getTeamMembers.mockRejectedValue(new Error("falla simulada"));
    montar();
    await screen.findByRole("dialog", {}, WAIT);
    await equipoCargado();
    expect(opcionesDe(ADAPTADOR.campos.lead())).toHaveLength(1);
  });

  it("al abrir con otra solicitud se reinician los campos", async () => {
    const { rerender } = montar();
    await screen.findByRole("dialog", {}, WAIT);
    escribirEn(ADAPTADOR.campos.stack(), "React");
    escribirEn(ADAPTADOR.campos.titulo(), "Título editado");
    rerender({ ticket: solicitud({ id: "t-otra", title: "Solicitud: tienda", description: "Otra" }) });
    await waitFor(() => expect((ADAPTADOR.campos.titulo() as HTMLInputElement).value).toBe("Solicitud: tienda"), WAIT);
    expect((ADAPTADOR.campos.stack() as HTMLInputElement).value).toBe("");
    expect((ADAPTADOR.campos.descripcion() as HTMLTextAreaElement).value).toBe("Otra");
  });
});

describe("conversión de solicitud · validación y envío", () => {
  it("«Crear proyecto» exige al menos 3 letras en el título (contando sin espacios)", async () => {
    montar();
    await screen.findByRole("dialog", {}, WAIT);
    expect(crear()).toBeEnabled();
    escribirEn(ADAPTADOR.campos.titulo(), "ab");
    expect(crear()).toBeDisabled();
    escribirEn(ADAPTADOR.campos.titulo(), "  ab  ");
    expect(crear()).toBeDisabled();
    escribirEn(ADAPTADOR.campos.titulo(), "abc");
    expect(crear()).toBeEnabled();
    escribirEn(ADAPTADOR.campos.titulo(), "");
    expect(crear()).toBeDisabled();
  });

  it("sin tocar nada manda el título y la descripción de la solicitud; vacíos como null/undefined", async () => {
    const { onConverted, onClose } = montar();
    await screen.findByRole("dialog", {}, WAIT);
    fireEvent.click(crear());
    await waitFor(() => expect(libs.convertTicketToProject).toHaveBeenCalledTimes(1), WAIT);
    expect(libs.convertTicketToProject).toHaveBeenCalledWith({
      ticketId: "t-sol",
      title: "Solicitud: sitio web",
      description: "Quiero un sitio nuevo",
      leadDeveloperId: null,
      deadline: null,
      requirements: { stack: undefined, alcance: undefined, entregables: undefined },
      googleDocsUrl: null,
    });
    await waitFor(() => expect(onConverted).toHaveBeenCalledTimes(1), WAIT);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("con todos los campos: recorta, manda el responsable, la fecha y los requerimientos", async () => {
    montar();
    await screen.findByRole("dialog", {}, WAIT);
    await waitFor(() => expect(opcionesDe(ADAPTADOR.campos.lead()).length).toBe(4), WAIT);
    escribirEn(ADAPTADOR.campos.titulo(), "  Sitio web corporativo  ");
    escribirEn(ADAPTADOR.campos.descripcion(), "  Sitio con blog  ");
    elegirOpcion(ADAPTADOR.campos.lead(), "colab@example.test (Colaborador)");
    escribirEn(ADAPTADOR.campos.fecha(), "2026-12-15");
    escribirEn(ADAPTADOR.campos.docs(), "  https://docs.example.test/d/xyz  ");
    escribirEn(ADAPTADOR.campos.stack(), "  React + Supabase ");
    escribirEn(ADAPTADOR.campos.alcance(), " Módulos de blog y contacto ");
    escribirEn(ADAPTADOR.campos.entregables(), " App en producción ");
    fireEvent.click(crear());
    await waitFor(() => expect(libs.convertTicketToProject).toHaveBeenCalledTimes(1), WAIT);
    expect(libs.convertTicketToProject).toHaveBeenCalledWith({
      ticketId: "t-sol",
      title: "Sitio web corporativo",
      description: "Sitio con blog",
      leadDeveloperId: "bbbbbbbb-0000-4000-8000-000000000002",
      deadline: "2026-12-15",
      requirements: { stack: "React + Supabase", alcance: "Módulos de blog y contacto", entregables: "App en producción" },
      googleDocsUrl: "https://docs.example.test/d/xyz",
    });
  });

  it("al convertir: avisa, recarga el origen, cierra y navega al proyecto nuevo", async () => {
    const { onConverted, onClose } = montar();
    await screen.findByRole("dialog", {}, WAIT);
    fireEvent.click(crear());
    expect(await screen.findByText("DETALLE-STUB", {}, WAIT)).toBeInTheDocument();
    expect(toastSpy).toHaveBeenCalledWith({ title: "Proyecto creado", description: "Ticket convertido a proyecto oficial." });
    expect(onConverted).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("si la conversión falla: aviso destructivo, no navega, no cierra y se puede reintentar", async () => {
    libs.convertTicketToProject.mockRejectedValue(new Error("falla simulada"));
    const { onConverted, onClose } = montar();
    await screen.findByRole("dialog", {}, WAIT);
    fireEvent.click(crear());
    await waitFor(() => expect(toastSpy).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" })), WAIT);
    expect(screen.queryByText("DETALLE-STUB")).toBeNull();
    expect(onConverted).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(crear()).toBeEnabled();
  });

  it("mientras convierte: botón desactivado (sin doble envío), Cancelar desactivado y Escape no cierra", async () => {
    let resolver!: (id: string) => void;
    libs.convertTicketToProject.mockReturnValue(new Promise<string>((r) => (resolver = r)));
    const { onClose } = montar();
    await screen.findByRole("dialog", {}, WAIT);
    fireEvent.click(crear());
    const enCurso = await screen.findByRole("button", { name: ADAPTADOR.convirtiendo }, WAIT);
    expect(enCurso).toBeDisabled();
    fireEvent.click(enCurso);
    expect(libs.convertTicketToProject).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: ADAPTADOR.cancelar })).toBeDisabled();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
    resolver("p-nuevo");
    expect(await screen.findByText("DETALLE-STUB", {}, WAIT)).toBeInTheDocument();
  });

  it("Cancelar y Escape cierran sin convertir", async () => {
    const { onClose } = montar();
    await screen.findByRole("dialog", {}, WAIT);
    fireEvent.click(screen.getByRole("button", { name: ADAPTADOR.cancelar }));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(libs.convertTicketToProject).not.toHaveBeenCalled();
  });

  it("sin solicitud no convierte aunque se envíe el formulario", async () => {
    montar({ ticket: null });
    await screen.findByRole("dialog", {}, WAIT);
    fireEvent.submit(document.querySelector("form")!);
    expect(libs.convertTicketToProject).not.toHaveBeenCalled();
  });
});
