import { useEffect, useRef } from "react";

/**
 * Shader WebGL de ondas (port del diseño de referencia). Este módulo es el único que contiene el código GLSL y el
 * bucle de dibujo: WavesShader.tsx lo importa con `import()` después del primer pintado, así que queda en su propio
 * chunk y no entra en el de entrada. No lo importes de forma estática.
 */

const VERTEX = `
attribute vec2 a_position;
void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
`;

const FRAGMENT = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec3 u_colors[4];
uniform vec2 u_resolution;
uniform float u_time;
uniform vec4 u_shape;   // scale, intensity, warp, detail
uniform vec4 u_motion;  // seed, rotate, drift, -
uniform vec4 u_finish;  // offset.x, offset.y, vignette, grain

float hash21(vec2 p) {
  p = mod(p, 289.0);
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

float grainHash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
    u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = p * 2.03 + vec2(17.0, 9.2);
    a *= 0.5;
  }
  return v;
}

vec3 srgbToLinear(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}
vec3 linearToSrgb(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
vec3 toOklab(vec3 c) {
  float l = pow(max(0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b, 0.0), 1.0 / 3.0);
  float m = pow(max(0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b, 0.0), 1.0 / 3.0);
  float s = pow(max(0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b, 0.0), 1.0 / 3.0);
  return vec3(
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s);
}
vec3 fromOklab(vec3 c) {
  float l = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z;
  float m = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z;
  float s = c.x - 0.0894841775 * c.y - 1.2914855480 * c.z;
  l = l * l * l; m = m * m * m; s = s * s * s;
  return vec3(
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s);
}
vec3 mixColour(vec3 a, vec3 b, float t) {
  vec3 la = toOklab(srgbToLinear(a));
  vec3 lb = toOklab(srgbToLinear(b));
  return clamp(linearToSrgb(fromOklab(mix(la, lb, t))), 0.0, 1.0);
}

vec3 palette(float x) {
  float f = clamp(x, 0.0, 1.0) * 3.0;
  vec3 col = u_colors[0];
  col = mixColour(col, u_colors[1], smoothstep(0.0, 1.0, clamp(f, 0.0, 1.0)));
  col = mixColour(col, u_colors[2], smoothstep(0.0, 1.0, clamp(f - 1.0, 0.0, 1.0)));
  col = mixColour(col, u_colors[3], smoothstep(0.0, 1.0, clamp(f - 2.0, 0.0, 1.0)));
  return col;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  vec2 p = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
  p *= u_shape.x;
  float cr = cos(u_motion.y), sr = sin(u_motion.y);
  p = mat2(cr, -sr, sr, cr) * p;
  p += u_finish.xy;
  p += u_motion.z * vec2(sin(u_time * 0.31), cos(u_time * 0.23));
  p += u_shape.z * (vec2(fbm(p * u_shape.w + u_motion.x), fbm(p * u_shape.w + vec2(5.2, 1.3))) - 0.5);

  float y = uv.y
    + sin(uv.x * (3.0 + u_shape.y * 9.0) + u_time * 0.8) * 0.08
    + (fbm(p * 2.0 + u_time * 0.1) - 0.5) * u_shape.y * 0.6;
  vec3 col = palette(y);

  float vd = length(uv - 0.5) * 1.41421356;
  col *= 1.0 - u_finish.z * smoothstep(0.35, 1.0, vd);
  col += (grainHash(gl_FragCoord.xy) - 0.5) * u_finish.w;
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** Tope del factor de píxeles del dispositivo: por encima de 2 no se ve la diferencia y se paga en cada píxel. */
const MAX_DPR = 2;

export interface WavesShaderCanvasProps {
  /** Cuatro colores en hex, de abajo hacia arriba. */
  colors: readonly [string, string, string, string];
  /** Escala de resolución interna (0.5 = la mitad); las ondas son suaves y no lo notan. */
  resolution: number;
  /** `true`: no pide más cuadros y deja el último (si aún no dibujó ninguno, dibuja uno). Al volver a `false` sigue. */
  paused: boolean;
  /** Se llama una vez, tras dibujar el primer cuadro. */
  onLive: () => void;
  /** Se llama si no hay WebGL, el shader no compila o el contexto se pierde: el padre deja el degradado de respaldo. */
  onUnavailable: () => void;
}

export default function WavesShaderCanvas({ colors, resolution, paused, onLive, onUnavailable }: WavesShaderCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // La pausa cambia sin reiniciar el contexto WebGL: el efecto principal la lee por ref y registra `syncPause`.
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const syncPause = useRef<() => void>(() => {});
  // Los callbacks del padre no deben reiniciar el contexto WebGL al cambiar de identidad.
  const callbacks = useRef({ onLive, onUnavailable });
  callbacks.current = { onLive, onUnavailable };
  const colorKey = colors.join(",");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
    });
    if (!gl) {
      callbacks.current.onUnavailable();
      return;
    }

    let vs: WebGLShader | null = null;
    let fs: WebGLShader | null = null;
    let program: WebGLProgram | null = null;
    let buffer: WebGLBuffer | null = null;
    let raf: number | null = null;
    let disposed = false;

    /**
     * Suelta los recursos de la GPU; sirve al desmontar, al cambiar de colores y cuando falla la preparación.
     * `loseContext` solo si el lienzo ya salió del documento: con el lienzo vivo (efecto repetido por StrictMode o
     * por un cambio de colores) el siguiente `getContext` devuelve este mismo contexto y no puede estar perdido.
     */
    const release = (loseContext: boolean) => {
      if (raf !== null) cancelAnimationFrame(raf);
      raf = null;
      if (buffer) gl.deleteBuffer(buffer);
      if (program) gl.deleteProgram(program);
      if (vs) gl.deleteShader(vs);
      if (fs) gl.deleteShader(fs);
      // Devuelve el contexto al navegador ya (hay un tope de contextos WebGL por página).
      if (loseContext) gl.getExtension("WEBGL_lose_context")?.loseContext();
    };

    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    vs = compile(gl.VERTEX_SHADER, VERTEX);
    fs = compile(gl.FRAGMENT_SHADER, FRAGMENT);
    program = gl.createProgram();
    if (!vs || !fs || !program) {
      release(true);
      callbacks.current.onUnavailable();
      return;
    }
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      release(true);
      callbacks.current.onUnavailable();
      return;
    }
    gl.useProgram(program);

    buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const uniform = (name: string) => gl.getUniformLocation(program!, name);
    gl.uniform3fv(uniform("u_colors"), new Float32Array(colorKey.split(",").flatMap(hexToRgb)));
    gl.uniform4f(uniform("u_shape"), 1.32, 0.49, 0.01, 1.73);
    gl.uniform4f(uniform("u_motion"), 7.0, 3.37, 0.4, 0);
    gl.uniform4f(uniform("u_finish"), -0.13, 0.05, 0.25, 0.02);
    const uResolution = uniform("u_resolution");
    const uTime = uniform("u_time");

    const resize = () => {
      const scale = Math.min(window.devicePixelRatio || 1, MAX_DPR) * resolution;
      const width = Math.max(1, Math.round(canvas.clientWidth * scale));
      const height = Math.max(1, Math.round(canvas.clientHeight * scale));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }
      gl.uniform2f(uResolution, width, height);
    };

    let elapsed = 0;
    let last: number | null = null;
    let visible = true;
    let firstFrame = true;

    const draw = () => {
      gl.uniform1f(uTime, elapsed * -0.00067);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (firstFrame) {
        firstFrame = false;
        callbacks.current.onLive();
      }
    };
    const tick = (now: number) => {
      if (last !== null) elapsed += now - last;
      last = now;
      draw();
      raf = requestAnimationFrame(tick);
    };
    const stop = () => {
      if (raf !== null) cancelAnimationFrame(raf);
      raf = null;
      last = null;
    };
    // Se dibuja solo con el lienzo a la vista y la pestaña visible.
    const start = () => {
      if (raf === null && visible && !document.hidden && !pausedRef.current) raf = requestAnimationFrame(tick);
    };
    // Pausa o reanuda: en pausa se corta el bucle y, si el lienzo aún no mostraba nada, se dibuja un cuadro.
    syncPause.current = () => {
      if (disposed) return;
      if (pausedRef.current) {
        stop();
        if (firstFrame) draw();
      } else {
        start();
      }
    };

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
      if (visible) start();
      else stop();
    });
    observer.observe(canvas);
    const resizeObserver = new ResizeObserver(() => {
      resize();
      if (raf === null && !disposed) draw();
    });
    resizeObserver.observe(canvas);
    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVisibility);
    // Contexto perdido (GPU reiniciada, demasiados contextos): sin intentar reconstruir, vuelve el degradado.
    const onLost = (event: Event) => {
      event.preventDefault();
      stop();
      callbacks.current.onUnavailable();
    };
    canvas.addEventListener("webglcontextlost", onLost);

    resize();
    syncPause.current();

    return () => {
      disposed = true;
      syncPause.current = () => {};
      observer.disconnect();
      resizeObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("webglcontextlost", onLost);
      release(!canvas.isConnected);
    };
  }, [colorKey, resolution]);

  useEffect(() => syncPause.current(), [paused]);

  return <canvas ref={canvasRef} aria-hidden="true" />;
}
