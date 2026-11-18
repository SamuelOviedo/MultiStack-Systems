import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GlowCard } from "@/components/site/GlowCard";

// Cola manual de requestAnimationFrame: el test decide cuándo corre cada cuadro.
let frames = new Map<number, FrameRequestCallback>();
let nextFrame = 1;
const runFrames = () => {
  const pending = [...frames.values()];
  frames = new Map();
  act(() => pending.forEach((cb) => cb(0)));
};

type Observer = { callback: IntersectionObserverCallback; target?: Element; disconnect: ReturnType<typeof vi.fn> };
let observers: Observer[] = [];

function stubMedia(reduce: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reduce && query.includes("prefers-reduced-motion"),
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

beforeEach(() => {
  frames = new Map();
  nextFrame = 1;
  observers = [];
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    const id = nextFrame++;
    frames.set(id, cb);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => void frames.delete(id));
  stubMedia(false);
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      entry: Observer;
      constructor(callback: IntersectionObserverCallback) {
        this.entry = { callback, disconnect: vi.fn() };
        observers.push(this.entry);
      }
      observe(target: Element) {
        this.entry.target = target;
      }
      unobserve() {}
      disconnect() {
        this.entry.disconnect();
      }
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const parts = (container: HTMLElement) => {
  const card = container.firstElementChild as HTMLElement;
  // Primer hijo: la capa de efectos (aria-hidden); el segundo, el contenido.
  const fx = card.firstElementChild as HTMLElement;
  return { card, fx };
};

describe("GlowCard", () => {
  it("es un div sin semántica ni foco propio, y el contenido sigue accesible", () => {
    const { container } = render(
      <GlowCard>
        <a href="/x">Enlace</a>
      </GlowCard>,
    );
    const { card, fx } = parts(container);
    expect(card.tagName).toBe("DIV");
    expect(card).not.toHaveAttribute("role");
    expect(card).not.toHaveAttribute("tabindex");
    expect(fx).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("link", { name: "Enlace" })).toBeInTheDocument();
  });

  it("mover el puntero no re-renderiza: escribe --gx/--gy en el DOM, una vez por cuadro", () => {
    const renders = vi.fn();
    function Probe() {
      renders();
      return <span>contenido</span>;
    }
    const { container } = render(
      <GlowCard>
        <Probe />
      </GlowCard>,
    );
    const { card, fx } = parts(container);
    expect(renders).toHaveBeenCalledTimes(1);

    fireEvent.pointerEnter(card, { clientX: 10, clientY: 5, pointerType: "mouse" });
    expect(fx).toHaveAttribute("data-glow");
    for (let i = 0; i < 20; i++) fireEvent.pointerMove(card, { clientX: 30 + i, clientY: 20, pointerType: "mouse" });
    // Veinte eventos, un solo cuadro pendiente.
    expect(frames.size).toBe(1);
    runFrames();
    expect(fx.style.getPropertyValue("--gx")).toBe("49px");
    expect(fx.style.getPropertyValue("--gy")).toBe("20px");
    expect(renders).toHaveBeenCalledTimes(1);

    fireEvent.pointerLeave(card, { pointerType: "mouse" });
    expect(fx).not.toHaveAttribute("data-glow");
    expect(renders).toHaveBeenCalledTimes(1);
  });

  it("el puntero táctil no enciende el brillo", () => {
    const { container } = render(<GlowCard>x</GlowCard>);
    const { card, fx } = parts(container);
    fireEvent.pointerEnter(card, { clientX: 10, clientY: 5, pointerType: "touch" });
    fireEvent.pointerMove(card, { clientX: 12, clientY: 5, pointerType: "touch" });
    expect(fx).not.toHaveAttribute("data-glow");
    expect(frames.size).toBe(0);
  });

  it("al desmontar cancela el cuadro pendiente", () => {
    const { container, unmount } = render(<GlowCard>x</GlowCard>);
    fireEvent.pointerMove(parts(container).card, { clientX: 1, clientY: 1, pointerType: "mouse" });
    expect(frames.size).toBe(1);
    unmount();
    expect(frames.size).toBe(0);
  });

  it("el foco de teclado dentro enciende y centra el brillo; salir del todo lo apaga", () => {
    const { container } = render(
      <GlowCard>
        <button>Uno</button>
        <button>Dos</button>
      </GlowCard>,
    );
    const { card, fx } = parts(container);
    Object.defineProperty(card, "offsetWidth", { configurable: true, value: 200 });
    Object.defineProperty(card, "offsetHeight", { configurable: true, value: 100 });

    const one = screen.getByRole("button", { name: "Uno" });
    const two = screen.getByRole("button", { name: "Dos" });
    one.focus();
    expect(fx).toHaveAttribute("data-glow");
    expect(fx.style.getPropertyValue("--gx")).toBe("100px");
    expect(fx.style.getPropertyValue("--gy")).toBe("50px");

    // Pasar de un hijo a otro no apaga el brillo.
    two.focus();
    expect(fx).toHaveAttribute("data-glow");
    two.blur();
    expect(fx).not.toHaveAttribute("data-glow");
  });

  it("el puntero y el foco son causas independientes del brillo", () => {
    const { container } = render(
      <GlowCard>
        <button>Uno</button>
      </GlowCard>,
    );
    const { card, fx } = parts(container);
    const button = screen.getByRole("button", { name: "Uno" });
    button.focus();
    fireEvent.pointerEnter(card, { clientX: 1, clientY: 1, pointerType: "mouse" });
    fireEvent.pointerLeave(card, { pointerType: "mouse" });
    expect(fx).toHaveAttribute("data-glow"); // el foco sigue dentro
    button.blur();
    expect(fx).not.toHaveAttribute("data-glow");
  });

  it("acepta radius y marca la esquina con un atributo", () => {
    const { container } = render(<GlowCard radius="2xl">x</GlowCard>);
    expect(parts(container).card).toHaveAttribute("data-radius", "2xl");
    const { container: other } = render(<GlowCard>x</GlowCard>);
    expect(parts(other).card).toHaveAttribute("data-radius", "3xl");
  });

  it("className, edgeClassName, faceClassName y contentClassName llegan a su capa", () => {
    const { container } = render(
      <GlowCard className="mi-tarjeta" edgeClassName="mi-borde" faceClassName="mi-cara" contentClassName="mi-contenido">
        hola
      </GlowCard>,
    );
    const { card, fx } = parts(container);
    expect(card).toHaveClass("mi-tarjeta");
    expect(fx.querySelector(".mi-borde")).not.toBeNull();
    expect(fx.querySelector(".mi-cara")).not.toBeNull();
    expect(container.querySelector(".mi-contenido")).toHaveTextContent("hola");
  });
});

describe("GlowCard: entrada al hacer scroll (reveal)", () => {
  /** El elemento «está» donde diga el test: jsdom devuelve siempre ceros. */
  const placeAt = (top: number) =>
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ top } as DOMRect);

  it("sin reveal no toca nada: visible y sin atributos", () => {
    placeAt(5000);
    const { container } = render(<GlowCard>x</GlowCard>);
    expect(parts(container).card).not.toHaveAttribute("data-site-reveal");
    expect(observers).toHaveLength(0);
  });

  it("ya a la vista: pasa directo a `in`, sin observador, con el retardo escalonado", () => {
    placeAt(10);
    const { container } = render(
      <GlowCard reveal index={3}>
        x
      </GlowCard>,
    );
    const { card } = parts(container);
    expect(card).toHaveAttribute("data-site-reveal", "in");
    expect(card.style.getPropertyValue("--reveal-delay")).toBe("0.18s");
    expect(observers).toHaveLength(0);
  });

  it("bajo el pliegue: queda oculto antes del primer pintado y aparece al cruzar el viewport, una sola vez", () => {
    placeAt(5000);
    const { container } = render(
      <GlowCard reveal index={0}>
        x
      </GlowCard>,
    );
    const { card } = parts(container);
    expect(card).toHaveAttribute("data-site-reveal", "hidden");
    expect(observers).toHaveLength(1);

    act(() => observers[0].callback([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver));
    expect(card).toHaveAttribute("data-site-reveal", "hidden");

    act(() => observers[0].callback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
    expect(card).toHaveAttribute("data-site-reveal", "in");
    expect(observers[0].disconnect).toHaveBeenCalled();
  });

  it("con movimiento reducido no se oculta nunca", () => {
    stubMedia(true);
    placeAt(5000);
    const { container } = render(
      <GlowCard reveal index={2}>
        x
      </GlowCard>,
    );
    expect(parts(container).card).not.toHaveAttribute("data-site-reveal");
    expect(observers).toHaveLength(0);
  });

  it("sin IntersectionObserver el contenido queda visible", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    placeAt(5000);
    const { container } = render(<GlowCard reveal>x</GlowCard>);
    expect(parts(container).card).not.toHaveAttribute("data-site-reveal");
  });

  it("un cambio de className no borra el estado de entrada (vive en un atributo, no en una clase)", () => {
    placeAt(10);
    const { container, rerender } = render(
      <GlowCard reveal className="a">
        x
      </GlowCard>,
    );
    rerender(
      <GlowCard reveal className="b">
        x
      </GlowCard>,
    );
    expect(parts(container).card).toHaveAttribute("data-site-reveal", "in");
  });
});
