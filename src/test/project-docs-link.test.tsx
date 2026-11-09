// El enlace del «Documento de requerimientos» es texto escrito por el equipo (o por la API). Solo se pinta como
// enlace si es http(s); el resto se muestra como texto plano con el aviso «Enlace no válido». Los formularios que
// lo guardan (editar proyecto y convertir solicitud) lo rechazan con un error asociado al campo.
// Datos inventados (dominios reservados `.example`/`.test`).
import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { project, ticket } from "./helpers/projectFixtures";

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
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
const libs = vi.hoisted(() => ({ convertTicketToProject: vi.fn(), getTeamMembers: vi.fn() }));
vi.mock("@/lib/projects", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/projects")>()),
  convertTicketToProject: libs.convertTicketToProject,
}));
vi.mock("@/lib/tickets", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tickets")>()),
  getTeamMembers: libs.getTeamMembers,
}));

import ProjectIdentityCard, { type ProjectEditForm } from "@/components/dashboard/project-detail/ProjectIdentityCard";
import ProjectScopingModal from "@/components/dashboard/requests/ProjectScopingModal";

const MENSAJE = /empiece por https:\/\/ o http:\/\//;

const MALICIOSAS = [
  "javascript:alert(1)",
  "JaVaScRiPt:alert(1)",
  "  javascript:alert(1)",
  "\tjavascript:alert(1)",
  "java\nscript:alert(1)",
  "java\u0000script:alert(1)",
  "javascript:%61lert(1)",
  "data:text/html,<script>alert(1)</script>",
  "vbscript:msgbox(1)",
  "file:///etc/passwd",
  "blob:https://x.example/1",
  "//evil.example/x",
  "/docs/req.pdf",
  "docs.example.com/req.pdf",
  "https://user:pass@evil.example",
];

const LEGITIMAS: [string, string][] = [
  ["https://docs.example.com/req.pdf", "https://docs.example.com/req.pdf"],
  ["http://intranet.example/req", "http://intranet.example/req"],
  ["HTTPS://EXAMPLE.COM/A", "https://example.com/A"],
  ["https://docs.example.com/d/abc?tab=t.0#h.2", "https://docs.example.com/d/abc?tab=t.0#h.2"],
  ["https://bücher.example/ü", "https://xn--bcher-kva.example/%C3%BC"],
];

const FORM = (docs: string): ProjectEditForm => ({
  nombre_proyecto: "Portal Corporativo Alfa",
  descripcion: "",
  client_name: "",
  client_email: "",
  client_phone: "",
  estado: "activo",
  google_docs_requirements_url: docs,
});

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
  libs.convertTicketToProject.mockReset().mockResolvedValue("p-nuevo");
  libs.getTeamMembers.mockReset().mockResolvedValue([]);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function lectura(docs: string | null) {
  return render(
    <ProjectIdentityCard
      project={project({ google_docs_requirements_url: docs })}
      editing={false}
      editForm={FORM("")}
      setEditForm={vi.fn()}
      onStartEdit={vi.fn()}
      onSaveEdit={vi.fn()}
      onCancelEdit={vi.fn()}
      saving={false}
    />,
  );
}

function edicion(docs: string, onSaveEdit = vi.fn()) {
  function Envoltura() {
    const [form, setForm] = useState<ProjectEditForm>(FORM(docs));
    return (
      <ProjectIdentityCard
        project={project()}
        editing
        editForm={form}
        setEditForm={setForm}
        onStartEdit={vi.fn()}
        onSaveEdit={onSaveEdit}
        onCancelEdit={vi.fn()}
        saving={false}
      />
    );
  }
  render(<Envoltura />);
  return { onSaveEdit, campo: () => screen.getByLabelText("Documento de requerimientos") as HTMLInputElement };
}

const guardar = () => fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

/** Todo `href` que pinta la tarjeta (correo y teléfono incluidos) y el del documento, por separado. */
function enlaces(contenedor: HTMLElement) {
  const todos = Array.from(contenedor.querySelectorAll("a")).map((a) => a.getAttribute("href") ?? "");
  const documento = screen.queryByRole("link", { name: /documento de requerimientos/i });
  return { todos, documento };
}

describe("tarjeta del proyecto · lectura del documento de requerimientos", () => {
  it.each(MALICIOSAS)("no pinta un enlace activo para %j y lo muestra como texto", (valor) => {
    const consola = vi.spyOn(console, "error").mockImplementation(() => {});
    const { container } = lectura(valor);
    const { todos, documento } = enlaces(container);

    expect(documento).toBeNull();
    // Los únicos `href` de la tarjeta son los que arma ella misma: correo y teléfono.
    expect(todos.every((h) => /^(mailto|tel):/.test(h))).toBe(true);
    expect(screen.getByText("Enlace no válido")).toBeInTheDocument();
    // React no debe haber avisado de un `javascript:` en un href: nunca llegó al DOM como atributo.
    expect(consola).not.toHaveBeenCalled();
  });

  it("el valor rechazado se muestra como texto plano, sin interpretarlo como marcado", () => {
    const { container } = lectura("data:text/html,<script>alert(1)</script>");
    expect(screen.getByText("data:text/html,<script>alert(1)</script>")).toBeInTheDocument();
    expect(container.querySelector("script")).toBeNull();
  });

  it.each(LEGITIMAS)("pinta %j como enlace seguro", (valor, esperado) => {
    const { container } = lectura(valor);
    const { documento } = enlaces(container);

    expect(documento).not.toBeNull();
    expect(documento).toHaveAttribute("href", esperado);
    expect(documento).toHaveAttribute("target", "_blank");
    expect(documento).toHaveAttribute("rel", "noopener noreferrer");
    expect(documento).toHaveAccessibleName(/\(se abre en otra pestaña\)/);
    expect(screen.queryByText("Enlace no válido")).toBeNull();
  });

  it("sin valor (null o solo espacios) sigue diciendo que no hay documento vinculado", () => {
    lectura(null);
    expect(screen.getByText("Sin documento de requerimientos vinculado")).toBeInTheDocument();
    cleanup();
    lectura("   ");
    expect(screen.getByText("Sin documento de requerimientos vinculado")).toBeInTheDocument();
    expect(screen.queryByText("Enlace no válido")).toBeNull();
  });
});

describe("tarjeta del proyecto · formulario de edición", () => {
  it.each(["javascript:alert(1)", "  JaVaScRiPt:alert(1)", "docs.example.com/req.pdf", "//evil.example/x", "mailto:a@example.com"])(
    "no guarda %j: muestra el error asociado al campo y lo enfoca",
    (valor) => {
      const { onSaveEdit, campo } = edicion(valor);
      expect(screen.queryByRole("alert")).toBeNull();

      guardar();

      expect(onSaveEdit).not.toHaveBeenCalled();
      const error = screen.getByRole("alert");
      expect(error).toHaveTextContent(MENSAJE);
      expect(campo()).toHaveAttribute("aria-invalid", "true");
      expect(campo().getAttribute("aria-describedby")).toContain(error.id);
      expect(campo()).toHaveFocus();
    },
  );

  it("el error desaparece al corregir el valor y entonces sí guarda", () => {
    const { onSaveEdit, campo } = edicion("javascript:alert(1)");
    guardar();
    expect(screen.getByRole("alert")).toBeInTheDocument();

    fireEvent.change(campo(), { target: { value: "https://docs.example.com/req.pdf" } });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(campo()).not.toHaveAttribute("aria-invalid");

    guardar();
    expect(onSaveEdit).toHaveBeenCalledTimes(1);
  });

  it.each(["https://docs.example.com/req.pdf", "  http://intranet.example/req  ", "", "   "])(
    "guarda %j sin cambiarlo (el recorte lo hace quien guarda)",
    (valor) => {
      const { onSaveEdit } = edicion(valor);
      guardar();
      expect(onSaveEdit).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole("alert")).toBeNull();
    },
  );
});

describe("convertir solicitud en proyecto · Google Docs de requerimientos", () => {
  function modal() {
    const props = { ticket: ticket({ id: "t-sol", project_id: null, type: "solicitud", title: "Solicitud: sitio web" }), open: true, onClose: vi.fn(), onConverted: vi.fn() };
    render(
      <MemoryRouter initialEntries={["/origen"]}>
        <Routes>
          <Route path="/origen" element={<ProjectScopingModal {...props} />} />
          <Route path="/dashboard/project/:id" element={<p>DETALLE-STUB</p>} />
        </Routes>
      </MemoryRouter>,
    );
  }
  const campo = () => screen.getByLabelText("Google Docs de requerimientos") as HTMLInputElement;
  const crear = () => screen.getByRole("button", { name: "Crear proyecto" });

  it.each(["javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html,<script>alert(1)</script>", "vbscript:msgbox(1)"])(
    "no convierte con %j: error asociado al campo y sin llamada",
    async (valor) => {
      modal();
      await screen.findByRole("dialog", {}, WAIT);
      fireEvent.change(campo(), { target: { value: valor } });
      fireEvent.click(crear());

      const dialogo = within(screen.getByRole("dialog"));
      await waitFor(() => expect(dialogo.getByText(MENSAJE)).toBeInTheDocument(), WAIT);
      expect(campo()).toHaveAttribute("aria-invalid", "true");
      expect(libs.convertTicketToProject).not.toHaveBeenCalled();
    },
  );

  it("con un enlace https válido convierte y guarda el texto recortado, igual que antes", async () => {
    modal();
    await screen.findByRole("dialog", {}, WAIT);
    fireEvent.change(campo(), { target: { value: "  https://docs.example.com/d/abc  " } });
    fireEvent.click(crear());

    await waitFor(() => expect(libs.convertTicketToProject).toHaveBeenCalledTimes(1), WAIT);
    expect(libs.convertTicketToProject.mock.calls[0][0]).toMatchObject({ googleDocsUrl: "https://docs.example.com/d/abc" });
  });

  it("sin enlace convierte con null", async () => {
    modal();
    await screen.findByRole("dialog", {}, WAIT);
    fireEvent.click(crear());

    await waitFor(() => expect(libs.convertTicketToProject).toHaveBeenCalledTimes(1), WAIT);
    expect(libs.convertTicketToProject.mock.calls[0][0]).toMatchObject({ googleDocsUrl: null });
  });
});
