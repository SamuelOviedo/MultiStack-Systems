// Enlace directo a un ticket: /dashboard/tickets?ticket=<id> abre su cajón; un id que la sesión no puede ver se
// ignora sin mostrar nada ni dejar rastro en la dirección; abrir y cerrar el cajón mantiene la dirección en
// sincronía (sin entradas nuevas en el historial); los filtros no se pierden.
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

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
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
const libs = vi.hoisted(() => ({ getAllTickets: vi.fn(), getTicketMessages: vi.fn(), getTeamMembers: vi.fn() }));
vi.mock("@/lib/tickets", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tickets")>()),
  ...libs,
}));

import TicketsGlobal from "@/pages/dashboard/TicketsGlobal";

const ticket = (id: string, title: string) => ({
  id,
  project_id: "p1",
  client_name: "Cliente Demo",
  client_email: "cliente@example.test",
  type: "bug",
  priority: "media",
  status: "abierto",
  title,
  description: `Descripción de ${title}`,
  created_at: "2026-10-30T10:00:00.000Z",
  updated_at: "2026-11-01T10:00:00.000Z",
  resolved_at: null,
  assigned_to: null,
  assignee_email: null,
  nombre_proyecto: "Tienda Demo",
  message_count: 0,
});
const TICKETS = [ticket("t1", "Botón de pago roto"), ticket("t2", "Servidor caído")];

const Donde = () => {
  const l = useLocation();
  return <p data-testid="donde">{l.pathname + l.search}</p>;
};
const montar = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <TicketsGlobal />
      <Donde />
    </MemoryRouter>,
  );
const donde = () => screen.getByTestId("donde").textContent;

beforeAll(() => {
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
  libs.getAllTickets.mockReset().mockResolvedValue(TICKETS);
  libs.getTicketMessages.mockReset().mockResolvedValue([]);
  libs.getTeamMembers.mockReset().mockResolvedValue([]);
});
afterEach(cleanup);

describe("/dashboard/tickets?ticket=<id>", () => {
  it("abre el cajón del ticket pedido cuando la lista ya cargó", async () => {
    montar("/dashboard/tickets?ticket=t2");
    const dialogo = await screen.findByRole("dialog", {}, WAIT);
    expect(within(dialogo).getByText("Servidor caído")).toBeInTheDocument();
    expect(donde()).toBe("/dashboard/tickets?ticket=t2");
  });

  it("un id que no está entre los tickets visibles no abre nada y se quita de la dirección", async () => {
    montar("/dashboard/tickets?ticket=de-otra-persona");
    await screen.findByText("Botón de pago roto", {}, WAIT);
    await waitFor(() => expect(donde()).toBe("/dashboard/tickets"), WAIT);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByText(/de-otra-persona/)).toBeNull();
  });

  it("sin el parámetro no se abre nada; abrir una fila lo pone y cerrar el cajón lo quita (sin recargar la lista)", async () => {
    montar("/dashboard/tickets");
    fireEvent.click(await screen.findByText("Botón de pago roto", {}, WAIT));
    await screen.findByRole("dialog", {}, WAIT);
    await waitFor(() => expect(donde()).toBe("/dashboard/tickets?ticket=t1"), WAIT);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), WAIT);
    await waitFor(() => expect(donde()).toBe("/dashboard/tickets"), WAIT);
    expect(libs.getAllTickets).toHaveBeenCalledTimes(1);
  });

  it("un parámetro desconocido se conserva y no se entra en bucle", async () => {
    montar("/dashboard/tickets?otro=1&ticket=t1");
    await screen.findByRole("dialog", {}, WAIT);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), WAIT);
    await waitFor(() => expect(donde()).toBe("/dashboard/tickets?otro=1"), WAIT);
    expect(libs.getAllTickets).toHaveBeenCalledTimes(1);
  });
});
