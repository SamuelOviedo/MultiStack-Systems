import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, renderHook, waitFor } from "@testing-library/react";
import CinematicBackground from "@/components/marketing/cinematic/CinematicBackground";
import { useCinematicEnabled } from "@/hooks/useCinematicEnabled";
import { CINEMATIC_SCENES, getScene } from "@/lib/cinematicScenes";
import type { CinematicScene } from "@/types/cinematic";

const defaultMatchMedia = window.matchMedia;

function mockReducedMotion(reduce: boolean) {
  window.matchMedia = ((query: string) => ({
    ...defaultMatchMedia(query),
    matches: reduce && query.includes("prefers-reduced-motion"),
  })) as typeof window.matchMedia;
}

const withVideo = (scenes: CinematicScene[]) => scenes.map((s) => ({ ...s, videoReady: true }));

const layers = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLDivElement>(".ms-cine-layer"));

beforeEach(() => {
  // Idle callback fires on the next tick so the post-LCP gate opens in tests.
  window.requestIdleCallback = ((cb: IdleRequestCallback) =>
    window.setTimeout(() => cb({} as IdleDeadline), 0)) as typeof window.requestIdleCallback;
  window.cancelIdleCallback = (id: number) => window.clearTimeout(id);
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
});

afterEach(() => {
  window.matchMedia = defaultMatchMedia;
  vi.restoreAllMocks();
});

describe("cinematic scenes config", () => {
  it("centraliza rutas de assets con formatos web optimizados", () => {
    for (const s of CINEMATIC_SCENES) {
      expect(s.poster.desktop).toMatch(/^\/assets\/posters\/.+\.1080\.webp$/);
      expect(s.poster.mobile).toMatch(/^\/assets\/posters\/.+\.720\.webp$/);
      expect(s.video.desktop.webm).toMatch(/\.webm$/);
      expect(s.video.desktop.mp4).toMatch(/\.mp4$/);
    }
    expect(getScene("hero").mode).toBe("loop");
  });
});

describe("useCinematicEnabled", () => {
  it("permite video por defecto", () => {
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
  it("es decorativo y pinta solo el poster cuando el video no está listo", async () => {
    const { container } = render(
      <CinematicBackground scenes={CINEMATIC_SCENES} activeSceneId="hero" />,
    );
    await act(() => new Promise((r) => setTimeout(r, 10)));
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector("img")).toHaveAttribute("src", "/assets/posters/hero.1080.webp");
    expect(container.querySelector("video")).toBeNull();
  });

  it("no solicita video con prefers-reduced-motion aunque exista", async () => {
    mockReducedMotion(true);
    const { container } = render(
      <CinematicBackground scenes={withVideo(CINEMATIC_SCENES)} activeSceneId="hero" />,
    );
    await act(() => new Promise((r) => setTimeout(r, 10)));
    expect(container.querySelector("video")).toBeNull();
  });

  it("monta el video silenciado e inline solo después de load + idle", async () => {
    const { container } = render(
      <CinematicBackground scenes={withVideo(CINEMATIC_SCENES)} activeSceneId="hero" />,
    );
    expect(container.querySelector("video")).toBeNull();
    await waitFor(() => expect(container.querySelector("video")).not.toBeNull());
    const video = container.querySelector("video")!;
    expect(video.muted).toBe(true);
    expect(video).toHaveAttribute("muted");
    expect(video).toHaveAttribute("playsinline");
    expect(video.getAttribute("src")).toMatch(/hero\.1080\.(webm|mp4)$/);
  });

  it("doble búfer: la escena nueva carga oculta y entra encima solo cuando está lista", async () => {
    const { container, rerender } = render(
      <CinematicBackground scenes={CINEMATIC_SCENES} activeSceneId="hero" />,
    );
    fireEvent.load(container.querySelector("img")!);

    rerender(<CinematicBackground scenes={CINEMATIC_SCENES} activeSceneId="agent" />);
    let [a, b] = layers(container);
    // Pending: hero sigue al frente y opaco; agent oculto debajo.
    expect(a.style.zIndex).toBe("2");
    expect(a.style.opacity).toBe("1");
    expect(b.style.zIndex).toBe("1");
    expect(b.style.opacity).toBe("0");

    fireEvent.load(b.querySelector("img")!);
    await waitFor(() => expect(layers(container)[1].style.zIndex).toBe("2"));
    [a, b] = layers(container);
    expect(b.style.opacity).toBe("1");
    expect(b.querySelector("img")).toHaveAttribute("src", "/assets/posters/agent.1080.webp");
    // La capa saliente queda opaca debajo: sin bajón de brillo en el fundido.
    expect(a.style.zIndex).toBe("1");
    expect(a.style.opacity).toBe("1");
  });
});
