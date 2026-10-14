import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, renderHook, waitFor } from "@testing-library/react";
import { motionValue } from "framer-motion";
import CinematicBackground from "@/components/marketing/cinematic/CinematicBackground";
import AnimatedSequence from "@/components/marketing/cinematic/AnimatedSequence";
import { useCinematicEnabled } from "@/hooks/useCinematicEnabled";
import { CINEMATIC_SCENES, getScene, imageSrcSet } from "@/lib/cinematicScenes";

const defaultMatchMedia = window.matchMedia;

function mockReducedMotion(reduce: boolean) {
  window.matchMedia = ((query: string) => ({
    ...defaultMatchMedia(query),
    matches: reduce && query.includes("prefers-reduced-motion"),
  })) as typeof window.matchMedia;
}

const layers = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLDivElement>(".ms-cine-layer"));

const tick = () => act(() => new Promise((r) => setTimeout(r, 20)));

beforeEach(() => {
  // Idle callback fires on the next tick so the post-LCP gate opens in tests.
  window.requestIdleCallback = ((cb: IdleRequestCallback) =>
    window.setTimeout(() => cb({} as IdleDeadline), 0)) as typeof window.requestIdleCallback;
  window.cancelIdleCallback = (id: number) => window.clearTimeout(id);
});

afterEach(() => {
  window.matchMedia = defaultMatchMedia;
  vi.restoreAllMocks();
});

describe("cinematic scenes config", () => {
  it("define secuencias .webp por escena, en dos anchos", () => {
    for (const s of CINEMATIC_SCENES) {
      expect(s.images.length).toBeGreaterThanOrEqual(2);
      s.images.forEach((img, i) => {
        const nn = String(i + 1).padStart(2, "0");
        expect(img.desktop).toBe(`/assets/scenes/${s.id}/${s.id}-${nn}.1080.webp`);
        expect(img.mobile).toBe(`/assets/scenes/${s.id}/${s.id}-${nn}.720.webp`);
      });
    }
    expect(getScene("hero").mode).toBe("loop");
    expect(getScene("agent").mode).toBe("scrub");
    expect(imageSrcSet(getScene("hero").images[0])).toBe(
      "/assets/scenes/hero/hero-01.720.webp 1280w, /assets/scenes/hero/hero-01.1080.webp 1920w",
    );
  });
});

describe("useCinematicEnabled", () => {
  it("permite animar por defecto", () => {
    const { result } = renderHook(() => useCinematicEnabled());
    expect(result.current).toBe(true);
  });

  it("se desactiva con prefers-reduced-motion", () => {
    mockReducedMotion(true);
    const { result } = renderHook(() => useCinematicEnabled());
    expect(result.current).toBe(false);
  });
});

describe("CinematicBackground", () => {
  it("es decorativo y pinta el primer frame estático de inmediato (LCP)", () => {
    const { container } = render(<CinematicBackground scenes={CINEMATIC_SCENES} activeSceneId="hero" />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
    const imgs = container.querySelectorAll("img");
    expect(imgs).toHaveLength(1); // aún sin capa animada (antes de load + idle)
    expect(imgs[0]).toHaveAttribute("src", "/assets/scenes/hero/hero-01.1080.webp");
    expect(container.querySelector("video")).toBeNull();
  });

  it("monta la secuencia animada (lazy) solo después de load + idle", async () => {
    const { container } = render(<CinematicBackground scenes={CINEMATIC_SCENES} activeSceneId="hero" />);
    await waitFor(() => expect(container.querySelectorAll("img").length).toBeGreaterThan(1));
  });

  it("con prefers-reduced-motion se queda en el frame estático", async () => {
    mockReducedMotion(true);
    const { container } = render(<CinematicBackground scenes={CINEMATIC_SCENES} activeSceneId="hero" />);
    await tick();
    await tick();
    expect(container.querySelectorAll("img")).toHaveLength(1);
  });

  it("doble búfer: la escena nueva carga oculta y entra encima solo cuando su frame está listo", async () => {
    mockReducedMotion(true); // aislar el A/B de la capa animada
    vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(false);
    const { container, rerender } = render(<CinematicBackground scenes={CINEMATIC_SCENES} activeSceneId="hero" />);
    fireEvent.load(container.querySelector("img")!);

    rerender(<CinematicBackground scenes={CINEMATIC_SCENES} activeSceneId="agent" />);
    let [a, b] = layers(container);
    expect(a.style.zIndex).toBe("2");
    expect(a.style.opacity).toBe("1");
    expect(b.style.zIndex).toBe("1");
    expect(b.style.opacity).toBe("0");

    fireEvent.load(b.querySelector("img")!);
    await waitFor(() => expect(layers(container)[1].style.zIndex).toBe("2"));
    [a, b] = layers(container);
    expect(b.style.opacity).toBe("1");
    expect(b.querySelector("img")).toHaveAttribute("src", "/assets/scenes/agent/agent-01.1080.webp");
    // La capa saliente queda opaca debajo: sin bajón de brillo en el fundido.
    expect(a.style.zIndex).toBe("1");
    expect(a.style.opacity).toBe("1");
  });
});

describe("AnimatedSequence · scrub", () => {
  it("el progreso del scroll funde los frames de forma acumulativa (sin bajón de brillo)", async () => {
    const progress = motionValue(0);
    const { container } = render(<AnimatedSequence scene={getScene("agent")} playing scrub={progress} />);
    const opacities = () => Array.from(container.querySelectorAll("img")).map((img) => Number(img.style.opacity));

    expect(opacities()).toEqual([1, 0, 0]);
    act(() => progress.set(0.75)); // frame 2 completo, frame 3 a la mitad
    await waitFor(() => expect(opacities()).toEqual([1, 1, 0.5]));
    act(() => progress.set(1));
    await waitFor(() => expect(opacities()).toEqual([1, 1, 1]));
  });

  it("sin fuente de progreso cae al slideshow (Ken Burns) del primer frame", () => {
    const { container } = render(<AnimatedSequence scene={getScene("agent")} playing={false} />);
    const imgs = container.querySelectorAll("img");
    expect(imgs).toHaveLength(1);
    expect(imgs[0]).toHaveAttribute("src", "/assets/scenes/agent/agent-01.1080.webp");
  });
});
