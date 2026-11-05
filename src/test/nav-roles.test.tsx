// Navegación según el rol (Navbar pública, escritorio y cajón móvil) y salidas coherentes del panel (AdminShell):
// administrador (0), colaborador (1), cliente (2), rol sin resolver y anónimo. Ocultar enlaces no es una barrera
// (la barrera real es ProtectedRoute y RLS): aquí solo se comprueba lo que la interfaz ofrece.
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const authState = vi.hoisted(() => ({
  user: null as { id: string; email: string } | null,
  userType: null as number | null,
  loading: false,
  signOut: vi.fn(),
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => authState }));

const ticketsMock = vi.hoisted(() => ({ getOpenTicketsCount: vi.fn() }));
vi.mock("@/lib/tickets", () => ticketsMock);

vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: "dark", setTheme: vi.fn() }) }));

import AdminShell from "@/components/admin/AdminShell";
import Navbar from "@/components/common/Navbar";

class FakeIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

beforeAll(() => {
  vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.releasePointerCapture = vi.fn();
});

beforeEach(() => {
  authState.user = null;
  authState.userType = null;
  authState.signOut = vi.fn().mockResolvedValue(undefined);
  ticketsMock.getOpenTicketsCount.mockReset().mockResolvedValue(3);
});
afterEach(cleanup);

const WAIT = { timeout: 8000 };
const signIn = (userType: number | null) => {
  authState.user = { id: "u-1", email: "persona@example.test" };
  authState.userType = userType;
};
const Where = () => <p data-testid="donde">{useLocation().pathname}</p>;
const montarNavbar = (path = "/") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Navbar />
      <Where />
    </MemoryRouter>,
  );
const hrefs = (scope: HTMLElement) => within(scope).queryAllByRole("link").map((a) => a.getAttribute("href"));
const NO_ADMIN = ["/dashboard", "/dashboard/tickets", "/dashboard/proyectos"];

describe("Navbar · escritorio", () => {
  it("anónimo: [ ACCEDER ] y [ REGISTRARSE ], ningún enlace administrativo", () => {
    montarNavbar();
    const nav = screen.getByRole("navigation", { name: "Principal" });
    expect(within(nav).getByRole("link", { name: "[ ACCEDER ]" })).toHaveAttribute("href", "/login");
    expect(within(nav).getByRole("link", { name: "[ REGISTRARSE ]" })).toHaveAttribute("href", "/signup");
    for (const h of NO_ADMIN) expect(hrefs(nav)).not.toContain(h);
    expect(ticketsMock.getOpenTicketsCount).not.toHaveBeenCalled();
  });

  it("administrador: [ PANEL ] → /dashboard, [ TICKETS ] → /dashboard/tickets con la insignia de abiertos y [ SALIR ]", async () => {
    signIn(0);
    montarNavbar();
    const nav = screen.getByRole("navigation", { name: "Principal" });
    expect(within(nav).getByRole("link", { name: "[ PANEL ]" })).toHaveAttribute("href", "/dashboard");
    const tickets = within(nav).getByRole("link", { name: /\[ TICKETS \]/ });
    expect(tickets).toHaveAttribute("href", "/dashboard/tickets");
    await waitFor(() => expect(tickets).toHaveTextContent("3"), WAIT);
    expect(within(nav).getByRole("button", { name: "[ SALIR ]" })).toBeInTheDocument();
    expect(within(nav).queryByText(/SOPORTE/)).toBeNull();
    expect(ticketsMock.getOpenTicketsCount).toHaveBeenCalled();
  });

  it("colaborador: solo [ SALIR ]; ningún enlace al panel ni a tickets y ninguna consulta administrativa", () => {
    signIn(1);
    montarNavbar();
    const nav = screen.getByRole("navigation", { name: "Principal" });
    expect(within(nav).getByRole("button", { name: "[ SALIR ]" })).toBeInTheDocument();
    for (const h of NO_ADMIN) expect(hrefs(nav)).not.toContain(h);
    expect(within(nav).queryByText(/PANEL|TICKETS|SOPORTE|SOLICITUDES/)).toBeNull();
    expect(ticketsMock.getOpenTicketsCount).not.toHaveBeenCalled();
  });

  it("cliente: [ SOLICITUDES ] y [ SALIR ] como siempre, sin enlaces administrativos ni consultas", () => {
    signIn(2);
    montarNavbar();
    const nav = screen.getByRole("navigation", { name: "Principal" });
    expect(within(nav).getByRole("link", { name: "[ SOLICITUDES ]" })).toHaveAttribute("href", "/solicitudes");
    expect(within(nav).getByRole("button", { name: "[ SALIR ]" })).toBeInTheDocument();
    for (const h of NO_ADMIN) expect(hrefs(nav)).not.toContain(h);
    expect(ticketsMock.getOpenTicketsCount).not.toHaveBeenCalled();
  });

  it("con sesión y el rol sin resolver no se ofrece nada administrativo ni se consulta", () => {
    signIn(null);
    montarNavbar();
    const nav = screen.getByRole("navigation", { name: "Principal" });
    for (const h of NO_ADMIN) expect(hrefs(nav)).not.toContain(h);
    expect(ticketsMock.getOpenTicketsCount).not.toHaveBeenCalled();
  });

  it("[ SALIR ] cierra la sesión una vez y lleva a la landing", async () => {
    signIn(0);
    montarNavbar("/dashboard/project/p1");
    fireEvent.click(screen.getByRole("button", { name: "[ SALIR ]" }));
    await waitFor(() => expect(authState.signOut).toHaveBeenCalledTimes(1), WAIT);
    await waitFor(() => expect(screen.getByTestId("donde")).toHaveTextContent(/^\/$/), WAIT);
  });
});

describe("Navbar · cajón móvil", () => {
  async function abrir() {
    fireEvent.click(screen.getByRole("button", { name: "Abrir menú" }));
    return screen.findByRole("dialog", {}, WAIT);
  }

  it("administrador: PANEL, TICKETS (con insignia) y SALIR dentro del cajón", async () => {
    signIn(0);
    montarNavbar();
    const d = await abrir();
    expect(within(d).getByRole("link", { name: "[ PANEL ]" })).toHaveAttribute("href", "/dashboard");
    expect(within(d).getByRole("link", { name: /\[ TICKETS \]/ })).toHaveAttribute("href", "/dashboard/tickets");
    expect(within(d).getByRole("button", { name: "[ SALIR ]" })).toBeInTheDocument();
    expect(within(d).queryByText(/SOPORTE/)).toBeNull();
  });

  it("colaborador: solo SALIR dentro del cajón", async () => {
    signIn(1);
    montarNavbar();
    const d = await abrir();
    expect(within(d).getByRole("button", { name: "[ SALIR ]" })).toBeInTheDocument();
    for (const h of NO_ADMIN) expect(hrefs(d)).not.toContain(h);
    expect(within(d).queryByText(/PANEL|TICKETS|SOPORTE/)).toBeNull();
  });

  it("cliente: SOLICITUDES y SALIR; anónimo: ACCEDER y REGISTRARSE", async () => {
    signIn(2);
    montarNavbar();
    let d = await abrir();
    expect(within(d).getByRole("link", { name: "[ SOLICITUDES ]" })).toHaveAttribute("href", "/solicitudes");
    expect(within(d).getByRole("button", { name: "[ SALIR ]" })).toBeInTheDocument();
    expect(within(d).queryByText(/PANEL|TICKETS/)).toBeNull();
    cleanup();
    authState.user = null;
    authState.userType = null;
    montarNavbar();
    d = await abrir();
    expect(within(d).getByRole("link", { name: "[ ACCEDER ]" })).toBeInTheDocument();
    expect(within(d).getByRole("link", { name: "[ REGISTRARSE ]" })).toBeInTheDocument();
    for (const h of NO_ADMIN) expect(hrefs(d)).not.toContain(h);
  });

  it("[ SALIR ] del cajón cierra la sesión y lleva a la landing (igual que en escritorio)", async () => {
    signIn(0);
    montarNavbar("/dashboard/project/p1");
    const d = await abrir();
    fireEvent.click(within(d).getByRole("button", { name: "[ SALIR ]" }));
    await waitFor(() => expect(authState.signOut).toHaveBeenCalledTimes(1), WAIT);
    await waitFor(() => expect(screen.getByTestId("donde")).toHaveTextContent(/^\/$/), WAIT);
  });
});

describe("AdminShell · salidas coherentes", () => {
  const montarShell = (path = "/dashboard/tickets") =>
    render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/" element={<p>Landing</p>} />
          <Route
            path="/dashboard/tickets"
            element={
              <AdminShell>
                <h1>Tickets</h1>
              </AdminShell>
            }
          />
        </Routes>
        <Where />
      </MemoryRouter>,
    );

  it("«Ver sitio» es un enlace a la landing y no cierra la sesión", async () => {
    signIn(0);
    montarShell();
    const ver = await screen.findByRole("link", { name: /Ver sitio/ }, WAIT);
    expect(ver).toHaveAttribute("href", "/");
    fireEvent.click(ver);
    await waitFor(() => expect(screen.getByTestId("donde")).toHaveTextContent(/^\/$/), WAIT);
    expect(authState.signOut).not.toHaveBeenCalled();
  });

  it("«Cerrar sesión» hace lo mismo que [ SALIR ] de la Navbar: signOut una vez y a la landing", async () => {
    signIn(0);
    montarShell();
    fireEvent.keyDown(await screen.findByRole("button", { name: /Cuenta/ }, WAIT), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Cerrar sesión" }, WAIT));
    await waitFor(() => expect(authState.signOut).toHaveBeenCalledTimes(1), WAIT);
    await waitFor(() => expect(screen.getByTestId("donde")).toHaveTextContent(/^\/$/), WAIT);
  });

  it("el panel no repite la barra pública: ni [ PANEL ] ni [ SOPORTE ] ni [ SALIR ]; el logotipo lleva al Resumen y «Tickets» queda marcado", async () => {
    signIn(0);
    montarShell();
    await screen.findByRole("main", {}, WAIT);
    expect(screen.queryByText(/\[ PANEL \]|\[ SOPORTE \]|\[ SALIR \]|\[ TICKETS \]/)).toBeNull();
    const nav = within(screen.getByRole("navigation", { name: "Principal" }));
    expect(nav.getByRole("link", { name: /Tickets/ })).toHaveAttribute("aria-current", "page");
    const logos = screen.getAllByRole("link").filter((a) => a.getAttribute("href") === "/dashboard" && !a.textContent?.trim());
    expect(logos.length).toBeGreaterThan(0);
  });

  it("migas «Soporte / Tickets» con el menú y la cabecera presentes", async () => {
    signIn(0);
    montarShell();
    const migas = within(await screen.findByRole("navigation", { name: "Migas de pan" }, WAIT));
    expect(migas.getByText("Soporte")).toBeInTheDocument();
    expect(migas.getByText("Tickets")).toHaveAttribute("aria-current", "page");
  });
});
