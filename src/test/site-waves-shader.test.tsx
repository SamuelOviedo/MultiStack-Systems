import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MOTION_STORAGE_KEY } from "@/components/site/motionPause";
import { WavesShader } from "@/components/site/WavesShader";

// jsdom no tiene WebGL: `getContext` devuelve null (y avisa «not implemented» por consola). Cada prueba decide qué
// devuelve. `requestIdleCallback` corre al instante para no esperar el primer pintado.

let getContext: ReturnType<typeof vi.fn>;
let frames = new Map<number, FrameRequestCallback>();
let nextFrame = 1;

function stubMedia(reduce: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reduce && query.includes("prefers-reduced-motion"),
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

/** Un WebGLRenderingContext mínimo: todo lo que el shader toca, como espía. */
function fakeGl() {
  const loseContext = vi.fn();
  const gl = {
    VERTEX_SHADER: 1,
    FRAGMENT_SHADER: 2,
    COMPILE_STATUS: 3,
    LINK_STATUS: 4,
    ARRAY_BUFFER: 5,
    STATIC_DRAW: 6,
    FLOAT: 7,
    TRIANGLES: 8,
    createShader: vi.fn(() => ({})),
    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    getShaderParameter: vi.fn(() => true),
    deleteShader: vi.fn(),
    createProgram: vi.fn(() => ({})),
    attachShader: vi.fn(),
    linkProgram: vi.fn(),
    getProgramParameter: vi.fn(() => true),
    useProgram: vi.fn(),
    createBuffer: vi.fn(() => ({})),
    bindBuffer: vi.fn(),
    bufferData: vi.fn(),
    getAttribLocation: vi.fn(() => 0),
    enableVertexAttribArray: vi.fn(),
    vertexAttribPointer: vi.fn(),
    getUniformLocation: vi.fn(() => ({})),
    uniform1f: vi.fn(),
    uniform2f: vi.fn(),
    uniform3fv: vi.fn(),
    uniform4f: vi.fn(),
    viewport: vi.fn(),
    drawArrays: vi.fn(),
    deleteBuffer: vi.fn(),
    deleteProgram: vi.fn(),
    getExtension: vi.fn((name: string) => (name === "WEBGL_lose_context" ? { loseContext } : null)),
  };
  return { gl, loseContext };
}

beforeEach(() => {
  localStorage.clear();
  frames = new Map();
  nextFrame = 1;
  getContext = vi.fn(() => null);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(getContext as never);
  vi.stubGlobal("requestIdleCallback", (cb: () => void) => {
    const id = window.setTimeout(cb, 0);
    return id;
  });
  vi.stubGlobal("cancelIdleCallback", (id: number) => window.clearTimeout(id));
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    const id = nextFrame++;
    frames.set(id, cb);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => void frames.delete(id));
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  stubMedia(false);
});

afterEach(() => {
  cleanup(); // antes de quitar los stubs: el desmontaje usa cancelIdleCallback y cancelAnimationFrame
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
});

const wrapper = (container: HTMLElement) => container.firstElementChild as HTMLElement;

describe("WavesShader", () => {
  it("se pinta con el degradado de respaldo: decorativo, sin lienzo y sin pedir WebGL en el primer cuadro", () => {
    const { container } = render(<WavesShader />);
    const root = wrapper(container);
    expect(root).toHaveAttribute("aria-hidden", "true");
    expect(root).toHaveAttribute("data-state", "fallback");
    expect(root.querySelector("canvas")).toBeNull();
    expect(getContext).not.toHaveBeenCalled();
  });

  it("sin WebGL se queda en el degradado y retira el lienzo", async () => {
    const { container } = render(<WavesShader />);
    await waitFor(() => expect(getContext).toHaveBeenCalledWith("webgl", expect.any(Object)));
    await waitFor(() => expect(wrapper(container).querySelector("canvas")).toBeNull());
    expect(wrapper(container)).toHaveAttribute("data-state", "fallback");
    // No lo vuelve a intentar en bucle.
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(getContext).toHaveBeenCalledTimes(1);
  });

  it("con movimiento reducido no monta el lienzo ni pide WebGL", async () => {
    stubMedia(true);
    const { container } = render(<WavesShader />);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(getContext).not.toHaveBeenCalled();
    expect(wrapper(container).querySelector("canvas")).toBeNull();
    expect(wrapper(container)).toHaveAttribute("data-state", "fallback");
  });

  it("con WebGL: dibuja, pasa a `live` tras el primer cuadro y entrega el contexto al desmontar", async () => {
    const { gl, loseContext } = fakeGl();
    getContext.mockReturnValue(gl);
    const { container, unmount } = render(<WavesShader colors={["#111111", "#222222", "#333333", "#444444"]} />);

    await waitFor(() => expect(wrapper(container).querySelector("canvas")).not.toBeNull());
    expect(wrapper(container)).toHaveAttribute("data-state", "loading");
    // Pidió el primer cuadro; aún no dibujó.
    expect(gl.drawArrays).not.toHaveBeenCalled();
    const pending = [...frames.values()];
    frames.clear();
    act(() => pending.forEach((cb) => cb(16)));
    expect(gl.drawArrays).toHaveBeenCalledTimes(1);
    expect(wrapper(container)).toHaveAttribute("data-state", "live");
    // Los cuatro colores llegaron al shader como 12 flotantes.
    const colors = gl.uniform3fv.mock.calls[0][1] as Float32Array;
    expect(colors).toHaveLength(12);
    expect(colors[0]).toBeCloseTo(0x11 / 255);

    unmount();
    expect(gl.deleteProgram).toHaveBeenCalledTimes(1);
    expect(gl.deleteBuffer).toHaveBeenCalledTimes(1);
    expect(gl.deleteShader).toHaveBeenCalledTimes(2);
    expect(loseContext).toHaveBeenCalledTimes(1);
    expect(frames.size).toBe(0); // sin bucle de dibujo colgado
  });

  it("si el shader no compila, libera lo creado y vuelve al degradado", async () => {
    const { gl, loseContext } = fakeGl();
    gl.getShaderParameter.mockReturnValue(false);
    getContext.mockReturnValue(gl);
    const { container } = render(<WavesShader />);
    await waitFor(() => expect(loseContext).toHaveBeenCalled());
    await waitFor(() => expect(wrapper(container).querySelector("canvas")).toBeNull());
    expect(wrapper(container)).toHaveAttribute("data-state", "fallback");
    expect(gl.drawArrays).not.toHaveBeenCalled();
  });

  it("el contexto perdido devuelve el degradado y detiene el dibujo", async () => {
    const { gl } = fakeGl();
    getContext.mockReturnValue(gl);
    const { container } = render(<WavesShader />);
    const canvas = await waitFor(() => {
      const found = wrapper(container).querySelector("canvas");
      expect(found).not.toBeNull();
      return found as HTMLCanvasElement;
    });
    act(() => void canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true })));
    await waitFor(() => expect(wrapper(container)).toHaveAttribute("data-state", "fallback"));
    expect(wrapper(container).querySelector("canvas")).toBeNull();
  });

  describe("pausa de las animaciones (WCAG 2.2.2)", () => {
    /** Entrega los cuadros pedidos y devuelve cuántos eran. */
    const flush = (now: number) => {
      const pending = [...frames.values()];
      frames.clear();
      act(() => pending.forEach((cb) => cb(now)));
      return pending.length;
    };
    const pauseNow = (paused: boolean) =>
      act(() => {
        localStorage.setItem(MOTION_STORAGE_KEY, paused ? "paused" : "running");
        window.dispatchEvent(new StorageEvent("storage", { key: MOTION_STORAGE_KEY }));
      });

    it("al pausar deja de pedir cuadros, queda en `paused` con el último cuadro y al reanudar sigue sin soltar el contexto", async () => {
      const { gl, loseContext } = fakeGl();
      getContext.mockReturnValue(gl);
      const { container } = render(<WavesShader />);
      await waitFor(() => expect(wrapper(container).querySelector("canvas")).not.toBeNull());
      flush(16);
      expect(wrapper(container)).toHaveAttribute("data-state", "live");
      expect(flush(32)).toBe(1); // en marcha: cada cuadro pide el siguiente

      pauseNow(true);
      expect(wrapper(container)).toHaveAttribute("data-state", "paused");
      expect(wrapper(container).querySelector("canvas")).not.toBeNull(); // conserva el último cuadro
      expect(frames.size).toBe(0); // cancelado el que estaba pedido
      const drawn = gl.drawArrays.mock.calls.length;
      expect(flush(48)).toBe(0);
      expect(gl.drawArrays).toHaveBeenCalledTimes(drawn);
      expect(loseContext).not.toHaveBeenCalled();
      expect(getContext).toHaveBeenCalledTimes(1); // no reinició el contexto

      pauseNow(false);
      expect(wrapper(container)).toHaveAttribute("data-state", "live");
      expect(frames.size).toBe(1);
      flush(64);
      expect(gl.drawArrays.mock.calls.length).toBeGreaterThan(drawn);
    });

    it("en pausa, volver a la pestaña o a la vista no reanuda el dibujo", async () => {
      const { gl } = fakeGl();
      getContext.mockReturnValue(gl);
      const { container } = render(<WavesShader />);
      await waitFor(() => expect(wrapper(container).querySelector("canvas")).not.toBeNull());
      flush(16);
      pauseNow(true);
      const drawn = gl.drawArrays.mock.calls.length;
      // La pestaña vuelve a ser visible: sin la pausa, esto pediría un cuadro.
      act(() => void document.dispatchEvent(new Event("visibilitychange")));
      expect(frames.size).toBe(0);
      expect(flush(48)).toBe(0);
      expect(gl.drawArrays).toHaveBeenCalledTimes(drawn);
    });

    it("pausado desde antes de cargar: no descarga el shader y se ve el degradado; al reanudar lo carga", async () => {
      localStorage.setItem(MOTION_STORAGE_KEY, "paused");
      const { gl } = fakeGl();
      getContext.mockReturnValue(gl);
      const { container } = render(<WavesShader />);
      await new Promise((resolve) => setTimeout(resolve, 30));
      expect(getContext).not.toHaveBeenCalled();
      expect(wrapper(container).querySelector("canvas")).toBeNull();
      expect(wrapper(container)).toHaveAttribute("data-state", "fallback");

      pauseNow(false);
      await waitFor(() => expect(wrapper(container).querySelector("canvas")).not.toBeNull());
      flush(16);
      expect(wrapper(container)).toHaveAttribute("data-state", "live");
    });

    it("pausado con el lienzo montado y sin primer cuadro: dibuja uno y se queda quieto", async () => {
      const { gl } = fakeGl();
      getContext.mockReturnValue(gl);
      const { container } = render(<WavesShader />);
      await waitFor(() => expect(wrapper(container).querySelector("canvas")).not.toBeNull());
      expect(gl.drawArrays).not.toHaveBeenCalled();

      pauseNow(true);
      expect(gl.drawArrays).toHaveBeenCalledTimes(1);
      expect(wrapper(container)).toHaveAttribute("data-state", "paused");
      expect(frames.size).toBe(0);
    });
  });
});
