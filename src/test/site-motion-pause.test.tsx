import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: null, userType: null, loading: false, signOut: vi.fn() }),
}));
vi.mock("@/lib/tickets", () => ({ getOpenTicketsCount: vi.fn() }));
// jsdom no tiene WebGL: el shader tiene sus propias pruebas de pausa en site-waves-shader.test.tsx.
vi.mock("@/components/site/WavesShader", () => ({ WavesShader: () => null }));

import { Hero } from "@/components/site/home/Hero";
import { ServicesBento } from "@/components/site/home/ServicesBento";
import { MOTION_STORAGE_KEY } from "@/components/site/motionPause";
import Index from "@/pages/marketing/Index";
import { SITE_CONTENT } from "@/pages/marketing/siteContent";

// Pausa de las animaciones en bucle (WCAG 2.2.2): el botón del hero alterna, recuerda la elección y detiene a la vez
// las píldoras, la terminal y el chat. Los @keyframes infinitos de site.css se prueban en site-styles.test.ts.

type Watcher = { callback: IntersectionObserverCallback; target: Element };
let watchers: Watcher[] = [];

function setVisible(visible: boolean) {
  act(() => {
    for (const { callback, target } of watchers) {
      callback([{ isIntersecting: visible, target } as IntersectionObserverEntry], {} as IntersectionObserver);
    }
  });
}

function stubMedia(reduce: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reduce && query.includes("prefers-reduced-motion"),
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

beforeEach(() => {
  watchers = [];
  localStorage.clear();
  stubMedia(false);
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      private callback: IntersectionObserverCallback;
      constructor(callback: IntersectionObserverCallback) {
        this.callback = callback;
      }
      observe(target: Element) {
        watchers.push({ callback: this.callback, target });
      }
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
});

const { pause, resume } = SITE_CONTENT.hero.motionToggle;
const inRouter = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);
const rails = (container: HTMLElement) => [...container.querySelectorAll<HTMLElement>("h1 [style*='translateY']")];
const transforms = (container: HTMLElement) => rails(container).map((rail) => rail.style.transform);
const toggle = (name: string) => screen.getByRole("button", { name });

describe("botón de pausa", () => {
  it("el texto visible es el nombre accesible y cambia al pulsarlo", () => {
    inRouter(<Hero hero={SITE_CONTENT.hero} />);
    expect(toggle(pause)).toHaveTextContent(pause);
    expect(screen.queryByRole("button", { name: resume })).toBeNull();

    fireEvent.click(toggle(pause));
    expect(toggle(resume)).toHaveTextContent(resume);
    expect(screen.queryByRole("button", { name: pause })).toBeNull();

    fireEvent.click(toggle(resume));
    expect(toggle(pause)).toBeInTheDocument();
  });

  it("el ícono es decorativo y el botón no es un enlace ni envía formularios", () => {
    inRouter(<Hero hero={SITE_CONTENT.hero} />);
    const button = toggle(pause);
    expect(button).toHaveAttribute("type", "button");
    expect(button.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("recuerda la elección en localStorage y la restaura al montar de nuevo", () => {
    const first = inRouter(<Hero hero={SITE_CONTENT.hero} />);
    fireEvent.click(toggle(pause));
    expect(localStorage.getItem(MOTION_STORAGE_KEY)).toBe("paused");
    first.unmount();

    inRouter(<Hero hero={SITE_CONTENT.hero} />);
    expect(toggle(resume)).toBeInTheDocument();

    fireEvent.click(toggle(resume));
    expect(localStorage.getItem(MOTION_STORAGE_KEY)).toBe("running");
  });

  it("si localStorage falla, la elección vale mientras dure la página y no lanza", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("bloqueado", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("bloqueado", "SecurityError");
    });
    inRouter(<Hero hero={SITE_CONTENT.hero} />);
    fireEvent.click(toggle(pause));
    expect(toggle(resume)).toBeInTheDocument();
    fireEvent.click(toggle(resume));
    expect(toggle(pause)).toBeInTheDocument();
  });

  it("otra pestaña que cambia la elección se refleja aquí", () => {
    inRouter(<Hero hero={SITE_CONTENT.hero} />);
    expect(toggle(pause)).toBeInTheDocument();
    act(() => {
      localStorage.setItem(MOTION_STORAGE_KEY, "paused");
      window.dispatchEvent(new StorageEvent("storage", { key: MOTION_STORAGE_KEY, newValue: "paused" }));
    });
    expect(toggle(resume)).toBeInTheDocument();
  });

  it("con movimiento reducido no se dibuja: no hay nada en movimiento que pausar", () => {
    stubMedia(true);
    inRouter(<Hero hero={SITE_CONTENT.hero} />);
    expect(screen.queryByRole("button", { name: pause })).toBeNull();
    expect(screen.queryByRole("button", { name: resume })).toBeNull();
  });
});

describe("pausa de los bucles", () => {
  it("las píldoras dejan de alternar al pausar y siguen al reanudar", () => {
    vi.useFakeTimers();
    const { container } = inRouter(<Hero hero={SITE_CONTENT.hero} />);
    setVisible(true);

    act(() => void vi.advanceTimersByTime(1500));
    expect(transforms(container)).toEqual(["translateY(-100%)", "translateY(-0%)"]);

    fireEvent.click(toggle(pause));
    const frozen = transforms(container);
    act(() => void vi.advanceTimersByTime(12_000));
    expect(transforms(container)).toEqual(frozen);

    fireEvent.click(toggle(resume));
    act(() => void vi.advanceTimersByTime(1500));
    expect(transforms(container)).not.toEqual(frozen);
  });

  it("con la pausa guardada desde antes, el hero arranca sin reloj", () => {
    localStorage.setItem(MOTION_STORAGE_KEY, "paused");
    vi.useFakeTimers();
    const setIntervalSpy = vi.spyOn(window, "setInterval");
    const { container } = inRouter(<Hero hero={SITE_CONTENT.hero} />);
    setVisible(true);
    act(() => void vi.advanceTimersByTime(10_000));
    expect(transforms(container)).toEqual(["translateY(-0%)", "translateY(-0%)"]);
    expect(setIntervalSpy).not.toHaveBeenCalled();
  });

  it("la terminal y el chat muestran el estado final, sin reloj, mientras están pausados", () => {
    vi.useFakeTimers();
    // Intervalos vivos: los que se crean y todavía no se cancelaron.
    const alive = new Set<number>();
    const create = window.setInterval.bind(window);
    const cancel = window.clearInterval.bind(window);
    vi.spyOn(window, "setInterval").mockImplementation(((...args: Parameters<typeof setInterval>) => {
      const id = create(...args) as unknown as number;
      alive.add(id);
      return id;
    }) as typeof setInterval);
    vi.spyOn(window, "clearInterval").mockImplementation(((id: number) => {
      alive.delete(id);
      cancel(id);
    }) as typeof clearInterval);
    const lines = SITE_CONTENT.bento.terminal.lines;
    const messages = SITE_CONTENT.bento.chat.messages;
    inRouter(
      <>
        <Hero hero={SITE_CONTENT.hero} />
        <ServicesBento bento={SITE_CONTENT.bento} />
      </>,
    );
    setVisible(true);
    act(() => void vi.advanceTimersByTime(850));
    // En marcha: la terminal va por la primera línea, no por todas, y hay relojes corriendo.
    expect(screen.queryAllByText(lines[lines.length - 1]!.text)).toHaveLength(0);
    expect(alive.size).toBeGreaterThanOrEqual(3); // píldoras, terminal y chat

    fireEvent.click(toggle(pause));
    for (const line of lines) expect(screen.queryAllByText(line.text).length).toBeGreaterThan(0);
    expect(screen.getByText(messages[messages.length - 1]!.text)).toBeInTheDocument();

    // Ningún reloj vivo: ni el de las píldoras ni los de la terminal y el chat. Y con el tiempo corriendo no cambia nada.
    expect(alive.size).toBe(0);
    act(() => void vi.advanceTimersByTime(20_000));
    expect(alive.size).toBe(0);
    for (const line of lines) expect(screen.queryAllByText(line.text).length).toBeGreaterThan(0);
  });
});

describe("SiteLayout", () => {
  it("pone data-motion en .ms-site y lo cambia con el botón (site.css pausa los keyframes infinitos con él)", () => {
    inRouter(<Index />);
    const site = document.querySelector<HTMLElement>(".ms-site")!;
    expect(site).toHaveAttribute("data-motion", "running");
    fireEvent.click(toggle(pause));
    expect(site).toHaveAttribute("data-motion", "paused");
    fireEvent.click(toggle(resume));
    expect(site).toHaveAttribute("data-motion", "running");
  });

  it("el botón es uno solo en la página", () => {
    inRouter(<Index />);
    expect(screen.getAllByRole("button", { name: pause })).toHaveLength(1);
  });
});

describe("datos del hero (dl)", () => {
  it("la etiqueta es el dt y el valor el dd; el valor se ve arriba por CSS, no por el orden del DOM", () => {
    const { container } = inRouter(<Hero hero={SITE_CONTENT.hero} />);
    const groups = [...container.querySelectorAll("dl > div")];
    expect(groups).toHaveLength(SITE_CONTENT.hero.facts.length);
    SITE_CONTENT.hero.facts.forEach((fact, i) => {
      const group = groups[i]!;
      expect(group.querySelector("dt")).toHaveTextContent(fact.label);
      expect(group.querySelector("dd")).toHaveTextContent(fact.valueSpoken ?? fact.value);
      expect(group.firstElementChild?.tagName).toBe("DT");
      expect(group).toHaveClass("flex", "flex-col-reverse");
    });
  });
});
