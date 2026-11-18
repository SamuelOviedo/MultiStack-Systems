import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: null, userType: null, loading: false, signOut: vi.fn() }),
}));
vi.mock("@/lib/tickets", () => ({ getOpenTicketsCount: vi.fn() }));
// jsdom no tiene WebGL: las ondas son decorativas y no se prueban aquí.
vi.mock("@/components/site/WavesShader", () => ({ WavesShader: () => null }));

import { Hero } from "@/components/site/home/Hero";
import { HomePlans } from "@/components/site/home/HomePlans";
import { ServicesBento } from "@/components/site/home/ServicesBento";
import { HOME_META } from "@/lib/routeMeta";
import { readPackageIntent } from "@/lib/packageIntent";
import { SITE_PLANS } from "@/lib/webPackages";
import Index from "@/pages/marketing/Index";
import { SITE_CONTENT } from "@/pages/marketing/siteContent";

// IntersectionObserver a mano: cada prueba decide cuándo algo entra o sale de pantalla.
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
});

function Where() {
  const { pathname, search } = useLocation();
  return <output data-testid="where">{`${pathname}${search}`}</output>;
}

const inRouter = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

/** Los dos carriles de las píldoras del titular: el desplazamiento vertical dice cuál se ve. */
const rails = (container: HTMLElement) => [...container.querySelectorAll<HTMLElement>("h1 [style*='translateY']")];

describe("home /", () => {
  it("tiene un solo H1, con el titular en texto plano, y aplica sus metas", () => {
    inRouter(<Index />);
    const h1 = screen.getAllByRole("heading", { level: 1 });
    expect(h1).toHaveLength(1);
    expect(h1[0]).toHaveAccessibleName(SITE_CONTENT.hero.title.plainText);
    expect(document.title).toBe(HOME_META.title);
  });

  // Anclas antiguas de la home anterior que se quedan en `/` (lib/legacyHomeHash.ts, LegacyHomeGate): cada id debe
  // existir en la sección equivalente o el enlace antiguo dejaría de bajar sin que nada más lo note.
  it("tiene los ids de las anclas antiguas: inicio (hero), por-que-elegirnos y proceso (pasos)", () => {
    inRouter(<Index />);
    const inicio = document.getElementById("inicio");
    expect(inicio?.tagName).toBe("SECTION");
    expect(within(inicio as HTMLElement).getByRole("heading", { level: 1 })).toBeInTheDocument();

    const why = document.getElementById("por-que-elegirnos");
    expect(why?.tagName).toBe("SECTION");
    expect(within(why as HTMLElement).getByRole("heading", { level: 2 })).toHaveTextContent(SITE_CONTENT.why.title);

    const proceso = document.getElementById("proceso");
    expect(proceso?.tagName).toBe("OL");
    expect(why).toContainElement(proceso);
    expect(within(proceso as HTMLElement).getAllByRole("listitem")).toHaveLength(SITE_CONTENT.why.steps.length);

    for (const id of ["inicio", "por-que-elegirnos", "proceso"]) {
      expect(document.querySelectorAll(`[id="${id}"]`)).toHaveLength(1);
    }
  });

  it("enlaza a las políticas desde el pie y a /servicios desde cada servicio", () => {
    inRouter(<Index />);
    const footer = screen.getByRole("contentinfo");
    expect(within(footer).getByRole("link", { name: "Política de privacidad" })).toHaveAttribute(
      "href",
      "/politica-de-privacidad",
    );
    expect(within(footer).getByRole("link", { name: "Términos del servicio" })).toHaveAttribute(
      "href",
      "/terminos-del-servicio",
    );
    for (const service of SITE_CONTENT.bento.services) {
      expect(screen.getByRole("link", { name: service.title })).toHaveAttribute("href", "/servicios");
    }
  });

  it("los enlaces externos abren en pestaña nueva y lo avisan", () => {
    inRouter(<Index />);
    const { secondaryCta } = SITE_CONTENT.hero;
    const whatsapp = screen.getByRole("link", { name: secondaryCta.ariaLabel });
    expect(whatsapp).toHaveAttribute("target", "_blank");
    expect(whatsapp).toHaveAttribute("rel", expect.stringContaining("noopener"));
    const lau = screen.getByRole("link", { name: SITE_CONTENT.portfolio.project.link.ariaLabel });
    expect(lau).toHaveAttribute("target", "_blank");
    expect(screen.getByRole("img", { name: SITE_CONTENT.portfolio.project.imageAlt })).toHaveAttribute("loading", "lazy");
  });
});

describe("planes de la home", () => {
  it("el CTA de un plan guarda la intención y va a /solicitudes?paquete=<id>", () => {
    inRouter(
      <>
        <HomePlans content={SITE_CONTENT.homePlans} plans={SITE_PLANS} cardText={SITE_CONTENT.planCard} />
        <Where />
      </>,
    );
    expect(readPackageIntent()).toBeNull();
    fireEvent.click(screen.getByRole("link", { name: "Solicitar Intermedio" }));
    expect(screen.getByTestId("where")).toHaveTextContent("/solicitudes?paquete=intermedio");
    expect(readPackageIntent()).toBe("intermedio");
  });
});

describe("bucles del bento", () => {
  const terminalLines = SITE_CONTENT.bento.terminal.lines;
  const rendered = () => terminalLines.filter((line) => screen.queryAllByText(line.text).length > 0).length;

  it("con movimiento reducido no hay reloj y se ve el estado final", () => {
    stubMedia(true);
    const setIntervalSpy = vi.spyOn(window, "setInterval");
    inRouter(<ServicesBento bento={SITE_CONTENT.bento} />);
    setVisible(true);
    expect(rendered()).toBe(terminalLines.length);
    const messages = SITE_CONTENT.bento.chat.messages;
    expect(screen.getByText(messages[messages.length - 1]!.text)).toBeInTheDocument();
    expect(setIntervalSpy).not.toHaveBeenCalled();
  });

  it("corren solo a la vista: avanzan al entrar y se detienen al salir", () => {
    vi.useFakeTimers();
    inRouter(<ServicesBento bento={SITE_CONTENT.bento} />);
    expect(rendered()).toBe(0);

    setVisible(true);
    act(() => void vi.advanceTimersByTime(850 * 3));
    expect(rendered()).toBe(3);

    setVisible(false);
    act(() => void vi.advanceTimersByTime(850 * 5));
    expect(rendered()).toBe(3);
  });
});

describe("pastillas del titular", () => {
  it("no se mueven con movimiento reducido", () => {
    stubMedia(true);
    vi.useFakeTimers();
    const { container } = inRouter(<Hero hero={SITE_CONTENT.hero} />);
    setVisible(true);
    const before = rails(container).map((rail) => rail.style.transform);
    act(() => void vi.advanceTimersByTime(10_000));
    expect(rails(container).map((rail) => rail.style.transform)).toEqual(before);
  });

  it("alternan con un solo reloj y se detienen con el cursor sobre el titular", () => {
    vi.useFakeTimers();
    const { container } = inRouter(<Hero hero={SITE_CONTENT.hero} />);
    // Fuera de pantalla el reloj no corre.
    act(() => void vi.advanceTimersByTime(6000));
    expect(rails(container).map((rail) => rail.style.transform)).toEqual(["translateY(-0%)", "translateY(-0%)"]);
    setVisible(true);
    const [projects, features] = rails(container) as [HTMLElement, HTMLElement];
    expect(projects.style.transform).toBe("translateY(-0%)");

    // Primer tick: cambia la de proyectos; segundo: la de funciones. Nunca las dos a la vez.
    act(() => void vi.advanceTimersByTime(1500));
    expect([projects.style.transform, features.style.transform]).toEqual(["translateY(-100%)", "translateY(-0%)"]);
    act(() => void vi.advanceTimersByTime(1500));
    expect([projects.style.transform, features.style.transform]).toEqual(["translateY(-100%)", "translateY(-100%)"]);

    const h1 = screen.getByRole("heading", { level: 1 });
    fireEvent.pointerEnter(h1);
    act(() => void vi.advanceTimersByTime(9000));
    expect([projects.style.transform, features.style.transform]).toEqual(["translateY(-100%)", "translateY(-100%)"]);

    fireEvent.pointerLeave(h1);
    act(() => void vi.advanceTimersByTime(1500));
    expect(projects.style.transform).toBe("translateY(-200%)");
  });
});

describe("stack", () => {
  const react = SITE_CONTENT.bento.stack.items[0]!;
  const vite = SITE_CONTENT.bento.stack.items[3]!;
  const live = () => document.querySelector("[aria-live='polite']") as HTMLElement;

  it("muestra la descripción con el foco y vuelve a la ayuda al salir", () => {
    inRouter(<ServicesBento bento={SITE_CONTENT.bento} />);
    expect(live()).toHaveTextContent(SITE_CONTENT.bento.stack.help);
    const button = screen.getByRole("button", { name: new RegExp(react.name) });
    fireEvent.focus(button);
    expect(live()).toHaveTextContent(react.description);
    fireEvent.blur(button);
    expect(live()).toHaveTextContent(SITE_CONTENT.bento.stack.help);
  });

  it("con el toque la descripción se queda hasta tocar otra tecnología", () => {
    inRouter(<ServicesBento bento={SITE_CONTENT.bento} />);
    const first = screen.getByRole("button", { name: new RegExp(react.name) });
    // Un toque: el puntero entra y «sale» al levantar el dedo; la descripción no debe irse con él.
    fireEvent.pointerEnter(first, { pointerType: "touch" });
    fireEvent.pointerLeave(first, { pointerType: "touch" });
    expect(live()).toHaveTextContent(react.description);
    // En cambio, el cursor sí la quita al salir.
    const mouse = screen.getByRole("button", { name: new RegExp(vite.name) });
    fireEvent.pointerEnter(mouse, { pointerType: "mouse" });
    expect(live()).toHaveTextContent(vite.description);
    fireEvent.pointerLeave(mouse, { pointerType: "mouse" });
    expect(live()).toHaveTextContent(SITE_CONTENT.bento.stack.help);
    fireEvent.click(first);
    expect(live()).toHaveTextContent(react.description);

    fireEvent.click(screen.getByRole("button", { name: new RegExp(vite.name) }));
    expect(live()).toHaveTextContent(vite.description);
  });
});
