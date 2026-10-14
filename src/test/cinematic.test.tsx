import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, renderHook, waitFor } from "@testing-library/react";
import { motionValue } from "framer-motion";

// Theme under test (next-themes' resolvedTheme), switchable per test.
const themeState = vi.hoisted(() => ({ resolvedTheme: "dark" as string | undefined }));
vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: themeState.resolvedTheme, setTheme: vi.fn() }),
}));
vi.mock("@/lib/preloadImage", () => ({ preloadImage: vi.fn(() => Promise.resolve()) }));

import CinematicBackground from "@/components/marketing/cinematic/CinematicBackground";
import AnimatedSequence from "@/components/marketing/cinematic/AnimatedSequence";
import { useCinematicEnabled } from "@/hooks/useCinematicEnabled";
import { useCinematicTheme } from "@/hooks/useCinematicTheme";
import { CINEMATIC_SCENES, getScene, sceneImages } from "@/lib/cinematicScenes";
import { preloadImage } from "@/lib/preloadImage";

const defaultMatchMedia = window.matchMedia;

function mockReducedMotion(reduce: boolean) {
  window.matchMedia = ((query: string) => ({
    ...defaultMatchMedia(query),
    matches: reduce && query.includes("prefers-reduced-motion"),
  })) as typeof window.matchMedia;
}

const layers = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLDivElement>(".ms-cine-layer"));

const staticFrame = (layer: Element) => layer.querySelector("img")!.getAttribute("src");

const tick = () => act(() => new Promise((r) => setTimeout(r, 20)));

beforeEach(() => {
  themeState.resolvedTheme = "dark";
  // Idle callback fires on the next tick so the post-LCP gate opens in tests.
  window.requestIdleCallback = ((cb: IdleRequestCallback) =>
    window.setTimeout(() => cb({} as IdleDeadline), 0)) as typeof window.requestIdleCallback;
  window.cancelIdleCallback = (id: number) => window.clearTimeout(id);
  vi.mocked(preloadImage).mockClear();
});

afterEach(() => {
  window.matchMedia = defaultMatchMedia;
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, "connection");
});

describe("cinematic scenes config", () => {
  it("define secuencias .webp por escena y por tema, con el mismo número de frames", () => {
    for (const s of CINEMATIC_SCENES) {
      expect(s.imagesDark.length).toBeGreaterThanOrEqual(2);
      expect(s.imagesLight).toHaveLength(s.imagesDark.length);
      s.imagesDark.forEach((src, i) => expect(src).toBe(`/assets/scenes/${s.id}/${s.id}-dark-${i + 1}.webp`));
      s.imagesLight.forEach((src, i) => expect(src).toBe(`/assets/scenes/${s.id}/${s.id}-light-${i + 1}.webp`));
    }
    expect(getScene("hero").mode).toBe("loop");
    expect(getScene("agent").mode).toBe("scrub");
    expect(sceneImages(getScene("hero"), "light")[0]).toBe("/assets/scenes/hero/hero-light-1.webp");
  });
});

describe("hooks", () => {
  it("useCinematicEnabled: permite animar por defecto y se desactiva con reduced motion", () => {
    expect(renderHook(() => useCinematicEnabled()).result.current).toBe(true);
    mockReducedMotion(true);
    expect(renderHook(() => useCinematicEnabled()).result.current).toBe(false);
  });

  it("useCinematicTheme: sigue a next-themes y por defecto es oscuro", () => {
    themeState.resolvedTheme = "light";
    expect(renderHook(() => useCinematicTheme()).result.current).toBe("light");
    themeState.resolvedTheme = undefined;
    expect(renderHook(() => useCinematicTheme()).result.current).toBe("dark");
  });
});

describe("CinematicBackground", () => {
  it("es decorativo y pinta de inmediato el primer frame del tema activo (LCP)", () => {
    const { container, unmount } = render(<CinematicBackground scenes={CINEMATIC_SCENES} activeSceneId="hero" />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelectorAll("img")).toHaveLength(1); // sin capa animada antes de load + idle
    expect(staticFrame(layers(container)[0])).toBe("/assets/scenes/hero/hero-dark-1.webp");
    unmount();

    themeState.resolvedTheme = "light";
    const light = render(<CinematicBackground scenes={CINEMATIC_SCENES} activeSceneId="hero" />);
    expect(staticFrame(layers(light.container)[0])).toBe("/assets/scenes/hero/hero-light-1.webp");
    expect(layers(light.container)[0]).toHaveAttribute("data-theme", "light");
  });

  it("cada capa lleva sus propios scrims (se funden junto con la imagen)", () => {
    const { container } = render(<CinematicBackground scenes={CINEMATIC_SCENES} activeSceneId="hero" />);
    const [layer] = layers(container);
    expect(layer.querySelector(".ms-cine-scrim")).not.toBeNull();
    expect(layer.querySelector(".ms-cine-scrim-side")).not.toBeNull(); // hero usa scrim lateral
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

  it("cambio de tema: el nuevo tema carga oculto y entra con fundido solo cuando su frame está listo", async () => {
    mockReducedMotion(true); // aislar el A/B de la capa animada
    vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(false);
    const { container, rerender } = render(<CinematicBackground scenes={CINEMATIC_SCENES} activeSceneId="hero" />);
    fireEvent.load(container.querySelector("img")!);

    themeState.resolvedTheme = "light";
    rerender(<CinematicBackground scenes={CINEMATIC_SCENES} activeSceneId="hero" />);
    let [dark, light] = layers(container);
    // Pendiente: el oscuro sigue al frente y opaco; el claro, oculto debajo.
    expect(dark.style.zIndex).toBe("2");
    expect(light.style.zIndex).toBe("1");
    expect(light.style.opacity).toBe("0");
    expect(staticFrame(light)).toBe("/assets/scenes/hero/hero-light-1.webp");

    fireEvent.load(light.querySelector("img")!);
    await waitFor(() => expect(layers(container)[1].style.zIndex).toBe("2"));
    [dark, light] = layers(container);
    expect(light.style.opacity).toBe("1");
    // El saliente queda opaco debajo durante el fundido: sin bajón de brillo.
    expect(dark.style.zIndex).toBe("1");
    expect(dark.style.opacity).toBe("1");
  });

  it("al cambiar de tema retoma el mismo plano (índice de frame) que estaba en pantalla", async () => {
    // Animated layer stand-in that reports "frame 3 on screen" (index 2) as soon as it mounts.
    vi.resetModules();
    vi.doMock("@/components/marketing/cinematic/AnimatedSequence", async () => {
      const { useEffect } = await import("react");
      const FrameReporter = ({ onFrameChange }: { onFrameChange?: (index: number) => void }) => {
        useEffect(() => onFrameChange?.(2), [onFrameChange]);
        return null;
      };
      return { default: FrameReporter };
    });
    const { default: Background } = await import("@/components/marketing/cinematic/CinematicBackground");
    vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(false);

    const { container, rerender } = render(<Background scenes={CINEMATIC_SCENES} activeSceneId="hero" />);
    fireEvent.load(container.querySelector("img")!);
    await tick(); // load + idle → animated layer mounts → reports frame index 2
    await tick();

    themeState.resolvedTheme = "light";
    rerender(<Background scenes={CINEMATIC_SCENES} activeSceneId="hero" />);
    expect(staticFrame(layers(container)[1])).toBe("/assets/scenes/hero/hero-light-3.webp");
    vi.doUnmock("@/components/marketing/cinematic/AnimatedSequence");
  });

  it("precarga en silencio el frame del tema opuesto tras load + idle", async () => {
    render(<CinematicBackground scenes={CINEMATIC_SCENES} activeSceneId="hero" />);
    await waitFor(() => expect(preloadImage).toHaveBeenCalledWith("/assets/scenes/hero/hero-light-1.webp"));
  });

  it("no precarga el tema opuesto con Save-Data", async () => {
    Object.defineProperty(navigator, "connection", {
      configurable: true,
      value: { saveData: true, addEventListener() {}, removeEventListener() {} },
    });
    render(<CinematicBackground scenes={CINEMATIC_SCENES} activeSceneId="hero" />);
    await tick();
    await tick();
    expect(preloadImage).not.toHaveBeenCalledWith("/assets/scenes/hero/hero-light-1.webp");
  });
});

describe("AnimatedSequence", () => {
  it("scrub: el progreso funde los frames de forma acumulativa (sin bajón de brillo)", async () => {
    const progress = motionValue(0);
    const { container } = render(
      <AnimatedSequence images={getScene("agent").imagesDark} mode="scrub" playing scrub={progress} />,
    );
    const opacities = () => Array.from(container.querySelectorAll("img")).map((img) => Number(img.style.opacity));

    expect(opacities()).toEqual([1, 0, 0]);
    act(() => progress.set(0.75)); // frame 2 completo, frame 3 a la mitad
    await waitFor(() => expect(opacities()).toEqual([1, 1, 0.5]));
    act(() => progress.set(1));
    await waitFor(() => expect(opacities()).toEqual([1, 1, 1]));
  });

  it("loop: arranca en startIndex y lo reporta (continuidad al cambiar de tema)", () => {
    const onFrameChange = vi.fn();
    const { container } = render(
      <AnimatedSequence
        images={getScene("hero").imagesLight}
        mode="loop"
        playing={false}
        startIndex={2}
        onFrameChange={onFrameChange}
      />,
    );
    const imgs = container.querySelectorAll("img");
    expect(imgs).toHaveLength(1);
    expect(imgs[0]).toHaveAttribute("src", "/assets/scenes/hero/hero-light-3.webp");
    expect(onFrameChange).toHaveBeenCalledWith(2);
  });
});
