// Estado tras la home web-first (home-landing.test.tsx): la home ya no monta las escenas cinemáticas ni el catálogo
// de servicios de IA. Siguen aquí, pasando, porque sus archivos aún existen y se retiran en un commit aparte:
//   - «useActiveScene» y «AiServicesCatalog»: huérfanos (los borra ese commit junto con sus archivos).
//   - «ContactForm · prefill»: vigente (la home lo usa con los mensajes de HOME_CONTENT).
//   - «Navbar · variant»: vigente (la variante «overlay» sigue en la barra, aunque la home ya no la pide).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: null, userType: null, loading: false, signOut: vi.fn() }),
}));
vi.mock("@/lib/tickets", () => ({ getOpenTicketsCount: vi.fn().mockResolvedValue(0) }));

import Navbar from "@/components/common/Navbar";
import ContactForm from "@/components/marketing/ContactForm";
import AiServicesCatalog from "@/components/marketing/AiServicesCatalog";
import { useActiveScene } from "@/hooks/useActiveScene";
import { AI_SERVICES, getAiService, serviceContactMessage } from "@/lib/aiServices";

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

// ---------------------------------------------------------------- F2

describe("useActiveScene", () => {
  const SECTIONS = { hero: "hero", agente: "agent" } as const;

  it("activa la escena cuya sección cruza el centro del viewport", () => {
    document.body.innerHTML = '<section id="hero"></section><section id="agente"></section>';
    const { result } = renderHook(() => useActiveScene(SECTIONS));
    expect(result.current).toBe("hero");

    act(() => {
      ioCallbacks.at(-1)!([{ target: document.getElementById("agente")!, isIntersecting: true }]);
    });
    expect(result.current).toBe("agent");
  });
});

// ---------------------------------------------------------------- F3

describe("AiServicesCatalog", () => {
  it("lista los 3 servicios aprobados y delega el CTA", () => {
    const onSelect = vi.fn();
    render(<AiServicesCatalog onSelect={onSelect} />);
    expect(AI_SERVICES.map((s) => s.slug)).toEqual(["agente-rag", "cero-papel", "integracion-a-medida"]);
    expect(document.getElementById("productos")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Automatización Cero Papel/ }));
    expect(onSelect).toHaveBeenCalledWith(getAiService("cero-papel"));
  });

  it("no publica precios ni URLs mientras no estén confirmados", () => {
    for (const s of AI_SERVICES) {
      expect(s.priceFrom).toBeUndefined();
      expect(JSON.stringify(s)).not.toMatch(/https?:\/\//);
    }
  });
});

describe("ContactForm · prefill", () => {
  it("prellena el mensaje y lo reaplica con cada nonce nuevo", () => {
    const text = serviceContactMessage(getAiService("agente-rag"));
    const { rerender } = render(<ContactForm idPrefix="t" prefill={{ text, nonce: 1 }} />);
    const textarea = screen.getByLabelText("Mensaje") as HTMLTextAreaElement;
    expect(textarea.value).toBe(text);
    expect(textarea.value).toContain("Agente de Atención IA");
    expect(document.activeElement).toBe(screen.getByLabelText("Nombre completo"));

    fireEvent.change(textarea, { target: { value: "otra cosa" } });
    rerender(<ContactForm idPrefix="t" prefill={{ text, nonce: 2 }} />);
    expect(textarea.value).toBe(text);
  });
});

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
