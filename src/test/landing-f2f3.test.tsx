// Quedan solo lo que sigue vivo tras retirar la landing de IA: el prefill de ContactForm (lo usa la home con los
// mensajes de la home anterior) y las variantes de la barra («overlay» sigue en el Navbar).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: null, userType: null, loading: false, signOut: vi.fn() }),
}));
vi.mock("@/lib/tickets", () => ({ getOpenTicketsCount: vi.fn().mockResolvedValue(0) }));

import Navbar from "@/components/common/Navbar";
import ContactForm from "@/components/marketing/ContactForm";

// ---------------------------------------------------------------- helpers

type IOCallback = (entries: Partial<IntersectionObserverEntry>[]) => void;
let ioCallbacks: IOCallback[] = [];

class FakeIntersectionObserver {
  constructor(cb: IOCallback) {
    ioCallbacks.push(cb);
  }
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

beforeEach(() => {
  ioCallbacks = [];
  vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
  window.requestIdleCallback = ((cb: IdleRequestCallback) =>
    window.setTimeout(() => cb({} as IdleDeadline), 0)) as typeof window.requestIdleCallback;
  window.cancelIdleCallback = (id: number) => window.clearTimeout(id);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

// ---------------------------------------------------------------- ContactForm

describe("ContactForm · prefill", () => {
  it("prellena el mensaje y lo reaplica con cada nonce nuevo", () => {
    const text = "Hola, quiero cotizar un software a medida.";
    const { rerender } = render(<ContactForm idPrefix="t" prefill={{ text, nonce: 1 }} />);
    const textarea = screen.getByLabelText("Mensaje") as HTMLTextAreaElement;
    expect(textarea.value).toBe(text);
    expect(document.activeElement).toBe(screen.getByLabelText("Nombre completo"));

    fireEvent.change(textarea, { target: { value: "otra cosa" } });
    rerender(<ContactForm idPrefix="t" prefill={{ text, nonce: 2 }} />);
    expect(textarea.value).toBe(text);
  });
});

// ---------------------------------------------------------------- Navbar

describe("Navbar · variant", () => {
  const renderNav = (variant?: "default" | "overlay") =>
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Navbar variant={variant} />
      </MemoryRouter>,
    );

  it("default conserva el fondo y el logo con tema (resto de páginas)", () => {
    const { container } = renderNav();
    const nav = container.querySelector("nav")!;
    // jsdom descarta `var(--nav-bg)` en el shorthand; basta con verificar que
    // no aplica el vidrio del overlay ni fuerza el logo blanco.
    expect(nav.style.background).not.toBe("rgba(8, 15, 30, 0.3)");
    expect(container.querySelectorAll("nav img")).toHaveLength(4); // isotipo + rótulo, claro y oscuro (auto)
  });

  it("overlay usa vidrio oscuro y logo blanco mientras hay escena cinemática debajo", () => {
    const cine = document.createElement("div");
    cine.setAttribute("data-nav-overlay", "");
    cine.getBoundingClientRect = () => ({ bottom: 900 }) as DOMRect;
    document.body.appendChild(cine);

    const { container } = renderNav("overlay");
    const nav = container.querySelector("nav")!;
    expect(nav.style.background).toBe("rgba(8, 15, 30, 0.3)");
    const logos = container.querySelectorAll("nav img");
    expect(logos).toHaveLength(2); // isotipo + rótulo, solo la versión «oscuro»
    for (const logo of logos) expect(logo).toHaveAttribute("data-brand-theme", "oscuro");
  });
});
