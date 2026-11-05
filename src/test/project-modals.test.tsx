// Los dos modales (`ProjectScopingModal` y `NewProjectModal`): título y descripción accesibles, etiquetas
// asociadas, errores enlazados con `aria-describedby`, «Cerrar» en español, foco devuelto y el título de la solicitud
// completo en pantallas angostas. Las reglas de negocio las fijan `project-scoping-characterization` y las del Resumen.
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ticket } from "./helpers/projectFixtures";

const WAIT = { timeout: 8000 };
vi.setConfig({ testTimeout: 20000 });

const auth = vi.hoisted(() => ({
  session: null as unknown,
  user: { id: "u-admin", email: "persona@example.test" } as { id: string; email: string } | null,
  userType: 0 as number | null,
  loading: false,
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => {
      throw new Error("supabase.from no está simulado: cada consulta debe pasar por un mock de src/lib");
    },
  },
}));
const toastSpy = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: toastSpy }) }));
const libs = vi.hoisted(() => ({ convertTicketToProject: vi.fn(), createProject: vi.fn(), getTeamMembers: vi.fn() }));
vi.mock("@/lib/projects", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/projects")>()),
  convertTicketToProject: libs.convertTicketToProject,
  createProject: libs.createProject,
}));
vi.mock("@/lib/tickets", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tickets")>()),
  getTeamMembers: libs.getTeamMembers,
}));

import NewProjectModal from "@/components/dashboard/dashboard-home/NewProjectModal";
import ProjectScopingModal from "@/components/dashboard/requests/ProjectScopingModal";

const TITULO_LARGO = "Solicitud: rediseño completo del portal de clientes con panel de facturación y reportes mensuales";

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
  libs.createProject.mockReset().mockResolvedValue({});
  libs.getTeamMembers.mockReset().mockResolvedValue([{ id: "aaaaaaaa-0000-4000-8000-000000000001", email: "admin@example.test", user_type: 0 }]);
});
afterEach(() => cleanup());

function etiquetasAsociadas(raiz: ParentNode) {
  const labels = Array.from(raiz.querySelectorAll("label"));
  expect(labels.length).toBeGreaterThan(0);
  for (const l of labels) {
    expect(l.htmlFor, `«${l.textContent}» sin htmlFor`).not.toBe("");
    expect(document.getElementById(l.htmlFor), `«${l.textContent}» apunta a un id inexistente`).not.toBeNull();
  }
}

/** Abre el modal desde un botón real para comprobar la devolución del foco. */
function ConAbridor({ children }: { children: (props: { open: boolean; onClose: () => void }) => React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <MemoryRouter>
      <button type="button" onClick={() => setOpen(true)}>Abrir modal</button>
      {children({ open, onClose: () => setOpen(false) })}
    </MemoryRouter>
  );
}

describe("ProjectScopingModal · accesibilidad", () => {
  const montar = (t = ticket({ title: TITULO_LARGO, type: "solicitud", status: "en_revision", project_id: null })) =>
    render(
      <ConAbridor>
        {(p) => <ProjectScopingModal ticket={t} onConverted={vi.fn()} {...p} />}
      </ConAbridor>,
    );
  const abrir = async () => {
    montar();
    fireEvent.click(screen.getByRole("button", { name: "Abrir modal" }));
    return screen.findByRole("dialog", { name: "Convertir en proyecto" }, WAIT);
  };

  it("tiene nombre y descripción accesibles; la descripción nombra la solicitud COMPLETA (sin recortarla)", async () => {
    const dialogo = await abrir();
    expect(dialogo).toHaveAccessibleDescription(new RegExp(TITULO_LARGO.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    const descripcion = within(dialogo).getByText(/Se creará un proyecto a partir de la solicitud/);
    expect(descripcion.className).toMatch(/break-words/);
    expect(descripcion.className).not.toMatch(/truncate|line-clamp|text-ellipsis|whitespace-nowrap/);
  });

  it("en pantallas angostas el modal ocupa el ancho, se desplaza si es alto y su cabecera no recorta texto", async () => {
    const dialogo = await abrir();
    expect(dialogo.className).toMatch(/\bw-full\b/);
    expect(dialogo.className).toMatch(/max-h-\[90dvh\]/);
    expect(dialogo.className).toMatch(/overflow-y-auto/);
    const cabecera = within(dialogo).getByRole("heading", { name: "Convertir en proyecto" }).parentElement!;
    expect(cabecera.innerHTML).not.toMatch(/truncate|line-clamp|text-ellipsis/);
  });

  it("todas las etiquetas están asociadas a un control y los textos no usan estilo de consola", async () => {
    const dialogo = await abrir();
    etiquetasAsociadas(dialogo);
    expect(dialogo.textContent).not.toMatch(/\$ |\[ |\/\/ |Lead developer|Close/);
    expect(within(dialogo).getByLabelText("Título del proyecto")).toHaveAttribute("aria-required", "true");
    for (const nombre of ["Descripción del proyecto", "Fecha límite", "Google Docs de requerimientos", "Stack propuesto", "Alcance y especificaciones", "Entregables"]) {
      expect(within(dialogo).getByLabelText(nombre)).toBeInTheDocument();
    }
    expect(within(dialogo).getByRole("combobox", { name: "Desarrollador responsable" })).toBeInTheDocument();
    expect(within(dialogo).getByRole("group", { name: "Requerimientos técnicos" })).toBeInTheDocument();
  });

  it("el cierre dice «Cerrar» y los botones llevan texto de acción en español", async () => {
    const dialogo = await abrir();
    expect(within(dialogo).getByRole("button", { name: "Cerrar" })).toBeInTheDocument();
    expect(within(dialogo).getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
    expect(within(dialogo).getByRole("button", { name: "Crear proyecto" })).toBeInTheDocument();
  });

  it("un título de 1 o 2 letras muestra un error enlazado al campo (aria-describedby, aria-invalid) y bloquea el envío", async () => {
    const dialogo = await abrir();
    const titulo = within(dialogo).getByLabelText("Título del proyecto");
    fireEvent.change(titulo, { target: { value: "ab" } });
    const mensaje = await within(dialogo).findByText("Escribe al menos 3 letras para el título.", {}, WAIT);
    expect(mensaje).toHaveAttribute("role", "alert");
    await waitFor(() => expect(titulo).toHaveAttribute("aria-invalid", "true"), WAIT);
    expect(titulo.getAttribute("aria-describedby")).toContain(mensaje.id);
    expect(within(dialogo).getByRole("button", { name: "Crear proyecto" })).toBeDisabled();
    fireEvent.change(titulo, { target: { value: "abc" } });
    await waitFor(() => expect(within(dialogo).queryByText("Escribe al menos 3 letras para el título.")).toBeNull(), WAIT);
    expect(within(dialogo).getByRole("button", { name: "Crear proyecto" })).toBeEnabled();
  });

  it("el selector de responsable ofrece «Sin asignar» y al equipo, y se elige con teclado/puntero", async () => {
    const dialogo = await abrir();
    const selector = within(dialogo).getByRole("combobox", { name: "Desarrollador responsable" });
    expect(selector).toHaveTextContent("Sin asignar");
    await waitFor(() => expect(libs.getTeamMembers).toHaveBeenCalled(), WAIT);
    fireEvent.keyDown(selector, { key: "ArrowDown" });
    const opciones = screen.getAllByRole("option").map((o) => o.textContent);
    expect(opciones).toEqual(["Sin asignar", "admin@example.test (Admin)"]);
    fireEvent.click(screen.getByRole("option", { name: "admin@example.test (Admin)" }));
    expect(selector).toHaveTextContent("admin@example.test");
  });

  it("si la conversión falla el aviso no muestra el texto técnico", async () => {
    libs.convertTicketToProject.mockRejectedValue(Object.assign(new Error("function convert_ticket_to_project(uuid) does not exist"), { code: "42883" }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const dialogo = await abrir();
    fireEvent.click(within(dialogo).getByRole("button", { name: "Crear proyecto" }));
    await waitFor(() => expect(toastSpy).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" })), WAIT);
    const aviso = toastSpy.mock.calls.at(-1)![0];
    expect(aviso.title).toBe("No se pudo convertir la solicitud");
    expect(JSON.stringify(aviso)).not.toMatch(/convert_ticket_to_project|42883|does not exist/);
  });

  it("al cerrar con Escape el foco vuelve al botón que abrió el modal", async () => {
    montar();
    const abridor = screen.getByRole("button", { name: "Abrir modal" });
    abridor.focus();
    fireEvent.click(abridor);
    fireEvent.keyDown(await screen.findByRole("dialog", {}, WAIT), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), WAIT);
    await waitFor(() => expect(abridor).toHaveFocus(), WAIT);
  });
});

describe("NewProjectModal · accesibilidad", () => {
  const montar = (onCreated = vi.fn()) => {
    render(
      <ConAbridor>
        {(p) => <NewProjectModal onCreated={onCreated} {...p} />}
      </ConAbridor>,
    );
    return onCreated;
  };
  const abrir = async () => {
    fireEvent.click(screen.getByRole("button", { name: "Abrir modal" }));
    return screen.findByRole("dialog", { name: "Nuevo proyecto" }, WAIT);
  };

  it("tiene nombre y descripción accesibles y todas sus etiquetas asociadas", async () => {
    montar();
    const dialogo = await abrir();
    expect(dialogo).toHaveAccessibleDescription(/solo el nombre es obligatorio/i);
    etiquetasAsociadas(dialogo);
    expect(within(dialogo).getByLabelText(/Nombre del proyecto/)).toHaveAttribute("aria-required", "true");
    expect(within(dialogo).getByRole("group", { name: "Datos del cliente" })).toBeInTheDocument();
  });

  it("«Cerrar» en español, texto de acción en los botones y teclados adecuados", async () => {
    montar();
    const dialogo = await abrir();
    expect(within(dialogo).getByRole("button", { name: "Cerrar" })).toBeInTheDocument();
    expect(within(dialogo).getByLabelText("Correo")).toHaveAttribute("type", "email");
    expect(within(dialogo).getByLabelText("Correo")).toHaveAttribute("inputmode", "email");
    expect(within(dialogo).getByLabelText("Teléfono")).toHaveAttribute("inputmode", "tel");
    expect(dialogo.textContent).not.toMatch(/Close|\[ |\$ /);
  });

  it("«Crear proyecto» espera un nombre y, al crear, vacía el formulario", async () => {
    const onCreated = montar();
    let dialogo = await abrir();
    expect(within(dialogo).getByRole("button", { name: "Crear proyecto" })).toBeDisabled();
    fireEvent.change(within(dialogo).getByLabelText(/Nombre del proyecto/), { target: { value: "  Proyecto Nuevo  " } });
    fireEvent.change(within(dialogo).getByLabelText("Correo"), { target: { value: "cliente@example.test" } });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Crear proyecto" }));
    await waitFor(() => expect(libs.createProject).toHaveBeenCalledTimes(1), WAIT);
    expect(libs.createProject).toHaveBeenCalledWith("u-admin", {
      nombre_proyecto: "Proyecto Nuevo",
      descripcion: null,
      client_name: null,
      client_email: "cliente@example.test",
      client_phone: null,
    });
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1), WAIT);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), WAIT);
    dialogo = await abrir();
    expect(within(dialogo).getByLabelText(/Nombre del proyecto/)).toHaveValue("");
    expect(within(dialogo).getByLabelText("Correo")).toHaveValue("");
  });

  it("si crear falla el aviso es claro y sin texto técnico", async () => {
    libs.createProject.mockRejectedValue(Object.assign(new Error('null value in column "user_id" violates not-null constraint'), { code: "23502" }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    montar();
    const dialogo = await abrir();
    fireEvent.change(within(dialogo).getByLabelText(/Nombre del proyecto/), { target: { value: "Proyecto X" } });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Crear proyecto" }));
    await waitFor(() => expect(toastSpy).toHaveBeenCalled(), WAIT);
    expect(JSON.stringify(toastSpy.mock.calls.at(-1)![0])).not.toMatch(/user_id|23502|not-null/);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("al cerrar con Escape el foco vuelve al botón que lo abrió", async () => {
    montar();
    const abridor = screen.getByRole("button", { name: "Abrir modal" });
    abridor.focus();
    await abrir();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), WAIT);
    await waitFor(() => expect(abridor).toHaveFocus(), WAIT);
  });
});

describe("ui/dialog · cierre en español sin cambiar el valor por defecto", () => {
  it("sin `closeLabel` sigue diciendo «Close» (otros usos no cambian)", async () => {
    const { Dialog, DialogContent, DialogDescription, DialogTitle } = await import("@/components/ui/dialog");
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Título</DialogTitle>
          <DialogDescription>Descripción</DialogDescription>
        </DialogContent>
      </Dialog>,
    );
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });
});
