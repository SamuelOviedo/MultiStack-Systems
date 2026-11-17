// Encabezado de /solicitudes con el isotipo oficial: (1) el espacio entre el título y el botón lo garantiza el
// contenedor (`gap-3`, grupo del título con `min-w-0`) y no depende de lo que mida el isotipo; (2) el isotipo del
// encabezado es decorativo, así que el nombre «MultiStack Systems» solo lo da el logo de la barra.
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import Logo from "@/components/common/Logo";
import MisSolicitudes from "@/pages/client/MisSolicitudes";

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { email: "cliente@example.test" } }) }));
vi.mock("@/lib/tickets", () => ({ createSolicitud: vi.fn(), getSolicitudesByEmail: vi.fn().mockResolvedValue([]) }));
// La barra real depende de rutas y sesión: se sustituye por un logo con nombre, como el que pone la barra.
vi.mock("@/components/common/Navbar", () => ({
  default: () => (
    <nav>
      <Logo className="h-7" />
    </nav>
  ),
}));

afterEach(cleanup);

// La página lee la URL (paquete elegido en /paginas-web), así que necesita un enrutador.
const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/solicitudes"]}>
      <MisSolicitudes />
    </MemoryRouter>,
  );

const hasClass = (el: Element, name: string) => el.className.split(/\s+/).includes(name);

describe("/solicitudes · encabezado", () => {
  it("el contenedor separa título y botón con gap-3 y el grupo del título puede encogerse (min-w-0)", async () => {
    renderPage();
    const header = await screen.findByTestId("solicitudes-header");
    expect(hasClass(header, "gap-3")).toBe(true);
    expect(hasClass(header, "justify-between")).toBe(true);
    const group = within(header).getByRole("heading", { name: "MIS SOLICITUDES" }).parentElement!;
    expect(hasClass(group, "min-w-0")).toBe(true);
    // El isotipo no se comprime: el título cede el espacio, no la marca.
    expect(hasClass(group.querySelector("[data-brand-variant]")!, "shrink-0")).toBe(true);
  });

  it("el isotipo del encabezado es decorativo: aria-hidden, sin role ni aria-label", async () => {
    renderPage();
    const header = await screen.findByTestId("solicitudes-header");
    const mark = header.querySelector<HTMLElement>('[data-brand-variant="isotipo"]')!;
    expect(mark).toHaveAttribute("aria-hidden", "true");
    expect(mark).not.toHaveAttribute("role");
    expect(mark).not.toHaveAttribute("aria-label");
  });

  it("tras cargar, el nombre «MultiStack Systems» se expone una sola vez (el logo de la barra)", async () => {
    renderPage();
    // Mientras carga la lista aparece el cargador de marca (otro logo con nombre): se cuenta cuando ya terminó.
    await screen.findByText("No hay solicitudes aún.");
    const named = screen.getAllByRole("img", { name: "MultiStack Systems" });
    expect(named).toHaveLength(1);
    expect(named[0].closest("nav")).not.toBeNull();
    expect(screen.getAllByRole("img")).toHaveLength(1);
  });
});

describe("Logo · decorative", () => {
  it("por defecto conserva role=img y el nombre accesible", () => {
    const { container } = render(<Logo />);
    const root = container.firstElementChild!;
    expect(root).toHaveAttribute("role", "img");
    expect(root).toHaveAttribute("aria-label", "MultiStack Systems");
    expect(root).not.toHaveAttribute("aria-hidden");
  });

  it("decorative quita role y nombre y oculta el conjunto a los lectores de pantalla", () => {
    const { container } = render(<Logo decorative />);
    const root = container.firstElementChild!;
    expect(root).toHaveAttribute("aria-hidden", "true");
    expect(root).not.toHaveAttribute("role");
    expect(root).not.toHaveAttribute("aria-label");
  });
});
