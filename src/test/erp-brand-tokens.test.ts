// Identidad corporativa oficial en el administrador: tokens del ámbito `.erp`.
//   a. valores de marca aprobados (HEX exactos al resolver el HSL) y razones de contraste WCAG calculadas desde
//      los tokens reales de `src/index.css`, en claro y oscuro;
//   b. aislamiento: `:root` y `.dark` no cambiaron y ningún color nuevo vive fuera de `.erp`;
//   c. `--brand-gradient` solo se define, ningún componente lo usa.
// Los pares que ya cubre `erp-tokens.test.ts` (Switch, Progress, filas con hover de estados) no se repiten aquí.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import postcss, { type AtRule, type Comment, type Rule } from "postcss";
import { describe, expect, it } from "vitest";

const SRC = path.resolve(__dirname, "..");
const css = readFileSync(path.join(SRC, "index.css"), "utf8");
const root = postcss.parse(css);

const norm = (selector: string) => selector.replace(/\s+/g, " ").trim();

function declsOf(selector: string, only?: (rule: Rule) => boolean): Record<string, string> {
  const out: Record<string, string> = {};
  root.walkRules((rule) => {
    if (rule.selectors.length === 1 && norm(rule.selector) === selector && (!only || only(rule))) {
      rule.walkDecls((d) => {
        if (d.prop.startsWith("--")) out[d.prop] = d.value.trim();
      });
    }
  });
  return out;
}

const ROOT = declsOf(":root");
const DARK = declsOf(".dark");
const ERP = declsOf(".erp");
const DARK_ERP = declsOf(".dark .erp");

type RGB = [number, number, number];
type Vars = Record<string, string>;

// Valor efectivo dentro del ámbito (más específico = último en la cadena).
const LIGHT: Vars = { ...ROOT, ...ERP };
const NIGHT: Vars = { ...ROOT, ...DARK, ...ERP, ...DARK_ERP };

// ---- Color ------------------------------------------------------------------
function hslToRgb(triplet: string): RGB {
  const [h, s, l] = triplet
    .trim()
    .split(/\s+/)
    .map((v) => parseFloat(v));
  const sat = s / 100;
  const lig = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(lig, 1 - lig);
  const f = (n: number) => lig - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}
const hue = (triplet: string) => parseFloat(triplet.trim().split(/\s+/)[0]);
const toHex = (rgb: RGB) => "#" + rgb.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase();

const channel = (c: number) => {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const luminance = ([r, g, b]: RGB) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
function ratio(a: RGB, b: RGB): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
const mix = (fg: RGB, bg: RGB, alpha: number): RGB => fg.map((v, i) => v * alpha + bg[i] * (1 - alpha)) as RGB;

const color = (vars: Vars, token: string): RGB => {
  const value = vars[token];
  if (!value) throw new Error(`Token ausente: ${token}`);
  return hslToRgb(value);
};
const hex = (vars: Vars, token: string) => toHex(color(vars, token));

// [nombre, tokens efectivos, opacidad del tinte de la insignia (StatusBadge: 10 % claro, 8 % oscuro)]
const THEMES: Array<[string, Vars, number]> = [
  ["claro", LIGHT, 0.1],
  ["oscuro", NIGHT, 0.08],
];
const SURFACES = ["--background", "--card", "--subtle", "--muted"];
const AA = 4.5;

// ---- a. Valores de marca ------------------------------------------------------
describe("identidad oficial: valores aprobados (HEX al resolver el HSL)", () => {
  const LIGHT_HEX = {
    "--background": "#F9FAFB",
    "--card": "#FFFFFF",
    "--popover": "#FFFFFF",
    "--foreground": "#080D13",
    "--muted-foreground": "#4E5A6A",
    "--border": "#DAE0E7",
    // El borde de control (`--input`) se separa del divisor (`--border`); el anillo claro pasa al teal principal.
    "--input": "#7F8D9F",
    "--primary": "#137590",
    "--primary-foreground": "#FFFFFF",
    "--primary-hover": "#10677E",
    "--ring": "#137590",
    "--link": "#137590",
    "--accent": "#EDEFF3",
    "--accent-foreground": "#080D13",
  };
  const DARK_HEX = {
    "--background": "#080D13",
    "--card": "#0D141C",
    "--popover": "#0D141C",
    "--foreground": "#EFF2F5",
    "--muted-foreground": "#96A2B0",
    "--border": "#1F2A37",
    "--input": "#586779",
    "--primary": "#068DB3",
    "--primary-foreground": "#080D13",
    "--primary-hover": "#1FA3C8",
    "--ring": "#068DB3",
    "--link": "#079BC5",
    "--accent": "#1D2835",
    "--accent-foreground": "#EFF2F5",
  };

  it("tema claro", () => {
    for (const [token, value] of Object.entries(LIGHT_HEX)) expect(hex(LIGHT, token), token).toBe(value);
  });

  it("tema oscuro", () => {
    for (const [token, value] of Object.entries(DARK_HEX)) expect(hex(NIGHT, token), token).toBe(value);
  });

  it("los textos de tarjeta, popover, secundario y párrafo siguen a la tinta principal", () => {
    for (const [, vars] of THEMES) {
      for (const t of ["--card-foreground", "--popover-foreground", "--secondary-foreground", "--body-foreground"]) {
        expect(vars[t], t).toBe(vars["--foreground"]);
      }
    }
  });

  it("popover y card-muted siguen a la tarjeta (mismos escalones que antes)", () => {
    for (const [, vars] of THEMES) expect(vars["--popover"]).toBe(vars["--card"]);
    expect(NIGHT["--card-muted"]).toBe(NIGHT["--card"]);
  });

  it("las superficies derivadas son del matiz 213 (+-1) y conservan el orden de luminosidad", () => {
    for (const t of ["--card-muted", "--subtle", "--secondary", "--muted"]) {
      expect(Math.abs(hue(ERP[t]) - 213), `claro ${t}`).toBeLessThanOrEqual(1);
    }
    for (const t of ["--subtle", "--secondary", "--muted"]) {
      expect(Math.abs(hue(DARK_ERP[t]) - 213), `oscuro ${t}`).toBeLessThanOrEqual(1);
    }
    const lum = (vars: Vars, t: string) => luminance(color(vars, t));
    // Claro: tarjeta > fondo > superficies grises. Oscuro: fondo < subtle < tarjeta < muted.
    expect(lum(LIGHT, "--card")).toBeGreaterThan(lum(LIGHT, "--background"));
    expect(lum(LIGHT, "--background")).toBeGreaterThan(lum(LIGHT, "--muted"));
    expect(lum(NIGHT, "--background")).toBeLessThan(lum(NIGHT, "--subtle"));
    expect(lum(NIGHT, "--subtle")).toBeLessThan(lum(NIGHT, "--card"));
    expect(lum(NIGHT, "--card")).toBeLessThan(lum(NIGHT, "--muted"));
  });

  it("--input ya no es --border: el divisor sigue siendo el aprobado y el borde de control lo supera", () => {
    for (const [, vars] of THEMES) expect(vars["--input"]).not.toBe(vars["--border"]);
    expect(hex(LIGHT, "--border")).toBe("#DAE0E7");
    expect(hex(NIGHT, "--border")).toBe("#1F2A37");
  });

  it("los estados success/warning/destructive no cambian (claro ni oscuro)", () => {
    expect(ERP["--success"]).toBe("160 84% 24%");
    expect(ERP["--warning"]).toBe("32 95% 31%");
    expect(ERP["--destructive"]).toBe("0 72% 44%");
    expect(ERP["--destructive-foreground"]).toBe("0 0% 100%");
    expect(DARK_ERP["--success"]).toBe("158 84% 39%");
    expect(DARK_ERP["--warning"]).toBe("38 92% 50%");
    expect(DARK_ERP["--destructive"]).toBe("0 84% 63%");
    expect(DARK_ERP["--destructive-foreground"]).toBe("217 14% 6%");
  });

  it("--info se deriva del teal de marca (mismo matiz +-3) en claro y oscuro", () => {
    for (const [, vars] of THEMES) {
      expect(Math.abs(hue(vars["--info"]) - hue(vars["--primary"]))).toBeLessThanOrEqual(3);
    }
  });

  it("--accent y --accent-foreground se redefinen en .erp: hover sutil del matiz 213 en vez del cian de :root", () => {
    for (const t of ["--accent", "--accent-foreground"]) {
      expect(ERP[t], t).toBeDefined();
      expect(DARK_ERP[t], t).toBeDefined();
      expect(ERP[t]).not.toBe(ROOT[t]);
      expect(DARK_ERP[t]).not.toBe(DARK[t]);
    }
  });
});

// ---- a. Contraste ---------------------------------------------------------------
describe.each(THEMES)("contraste WCAG · tema %s", (_name, vars, tint) => {
  it.each(SURFACES)("texto principal sobre %s alcanza 7:1 (AAA)", (surface) => {
    expect(ratio(color(vars, "--foreground"), color(vars, surface))).toBeGreaterThanOrEqual(7);
  });

  it.each(SURFACES)("texto atenuado sobre %s alcanza 4,5:1", (surface) => {
    expect(ratio(color(vars, "--muted-foreground"), color(vars, surface))).toBeGreaterThanOrEqual(AA);
  });

  it("botón primario: texto sobre el relleno y sobre su hover alcanzan 4,5:1", () => {
    const fg = color(vars, "--primary-foreground");
    expect(ratio(fg, color(vars, "--primary"))).toBeGreaterThanOrEqual(AA);
    expect(ratio(fg, color(vars, "--primary-hover"))).toBeGreaterThanOrEqual(AA);
  });

  it.each(["--background", "--card", "--subtle"])("enlace (`text-primary`) sobre %s alcanza 4,5:1", (surface) => {
    expect(ratio(color(vars, "--primary"), color(vars, surface))).toBeGreaterThanOrEqual(AA);
  });

  it("enlace sobre una fila con hover (`muted/40` sobre la tarjeta) alcanza 4,5:1", () => {
    const row = mix(color(vars, "--muted"), color(vars, "--card"), 0.4);
    expect(ratio(color(vars, "--primary"), row)).toBeGreaterThanOrEqual(AA);
  });

  it.each(["--background", "--card", "--subtle"])(
    "anillo de foco (--ring) sobre %s alcanza 3:1 (WCAG 1.4.11)",
    (surface) => {
      expect(ratio(color(vars, "--ring"), color(vars, surface))).toBeGreaterThanOrEqual(3);
    },
  );

  it.each(["--success", "--warning", "--destructive", "--info"])(
    "insignia %s: texto sobre su tinte alcanza 4,5:1 en fondo, tarjeta y subtle",
    (token) => {
      const fg = color(vars, token);
      for (const surface of ["--background", "--card", "--subtle"]) {
        expect(ratio(fg, mix(fg, color(vars, surface), tint)), surface).toBeGreaterThanOrEqual(AA);
      }
    },
  );

  it.each(["--success", "--warning", "--destructive", "--info"])(
    "%s como texto sobre cada superficie alcanza 4,5:1",
    (token) => {
      for (const surface of SURFACES) {
        expect(ratio(color(vars, token), color(vars, surface)), surface).toBeGreaterThanOrEqual(AA);
      }
    },
  );
});

describe("hover real del botón (`hover:bg-primary/90` en button.tsx; `--primary-hover` en .erp)", () => {
  // button.tsx (compartido) conserva `hover:bg-primary/90`: con el teal oficial, la mezcla al 90 % con el fondo queda
  // por debajo de AA en los dos temas (en oscuro el relleno se oscurece hacia el fondo). Se resuelve dentro del
  // ámbito con la regla `.erp [class~="hover:bg-primary/90"]:hover` -> `--primary-hover` (ver erp-tokens.test.ts).
  it("registro histórico: sin la regla, el hover mezclado daría 4,38:1 en claro y 4,30:1 en oscuro sobre --background", () => {
    const over = (vars: Vars) =>
      ratio(color(vars, "--primary-foreground"), mix(color(vars, "--primary"), color(vars, "--background"), 0.9));
    expect(over(LIGHT)).toBeCloseTo(4.38, 1);
    expect(over(NIGHT)).toBeCloseTo(4.3, 1);
    expect(over(LIGHT)).toBeLessThan(AA);
    expect(over(NIGHT)).toBeLessThan(AA);
  });

  it("con la regla, el hover efectivo (--primary-hover) alcanza 4,5:1 en claro y oscuro", () => {
    for (const [, vars] of THEMES) {
      expect(ratio(color(vars, "--primary-foreground"), color(vars, "--primary-hover"))).toBeGreaterThanOrEqual(AA);
    }
  });
});

// ---- b. Aislamiento -----------------------------------------------------------
// Valores de `:root` y `.dark` (primer bloque de cada uno) tal como estaban antes de esta rama. Si cambian,
// cambia la landing, el login o el portal.
const ROOT_BASE: Vars = {
  "--background": "0 0% 100%",
  "--foreground": "40 4% 10%",
  "--card": "0 0% 100%",
  "--card-foreground": "40 4% 10%",
  "--card-muted": "40 11% 96%",
  "--popover": "0 0% 100%",
  "--popover-foreground": "40 4% 10%",
  "--primary": "200 98% 39%",
  "--primary-foreground": "0 0% 100%",
  "--accent": "192 91% 36%",
  "--accent-foreground": "0 0% 100%",
  "--secondary": "40 11% 96%",
  "--secondary-foreground": "40 4% 10%",
  "--muted": "40 11% 96%",
  "--muted-foreground": "40 2% 60%",
  "--body-foreground": "35 6% 25%",
  "--border": "40 8% 91%",
  "--input": "40 8% 91%",
  "--ring": "200 98% 39%",
  "--success": "160 84% 31%",
  "--success-foreground": "0 0% 100%",
  "--warning": "32 95% 44%",
  "--warning-foreground": "0 0% 100%",
  "--destructive": "0 72% 51%",
  "--destructive-foreground": "0 0% 100%",
  "--sidebar-background": "0 0% 100%",
  "--sidebar-foreground": "40 4% 10%",
  "--sidebar-primary": "200 98% 39%",
  "--sidebar-primary-foreground": "0 0% 100%",
  "--sidebar-accent": "40 11% 96%",
  "--sidebar-accent-foreground": "40 4% 10%",
  "--sidebar-border": "40 8% 91%",
  "--sidebar-ring": "200 98% 39%",
  "--radius": "0.5rem",
  "--glow-focus": "0 0 0 3px rgba(2,132,199,0.18)",
  "--glow-primary": "0 1px 2px rgba(2,132,199,0.12)",
  "--glow-primary-light": "0 1px 2px rgba(2,132,199,0.08)",
  "--glow-cyan": "0 1px 2px rgba(8,145,178,0.10)",
  "--ease-brand": "cubic-bezier(0.2, 0, 0, 1)",
  "--dur-fast": "150ms",
  "--dur-base": "300ms",
  "--dur-slow": "500ms",
};

const DARK_BASE: Vars = {
  "--background": "222 43% 7%",
  "--foreground": "216 100% 97%",
  "--card": "218 56% 14%",
  "--card-foreground": "216 100% 97%",
  "--card-muted": "218 56% 14%",
  "--popover": "218 56% 14%",
  "--popover-foreground": "216 100% 97%",
  "--primary": "199 89% 48%",
  "--primary-foreground": "222 43% 7%",
  "--accent": "187 92% 43%",
  "--accent-foreground": "222 43% 7%",
  "--secondary": "213 52% 24%",
  "--secondary-foreground": "216 100% 97%",
  "--muted": "213 52% 24%",
  "--muted-foreground": "215 16% 47%",
  "--body-foreground": "215 20% 65%",
  "--border": "213 52% 24%",
  "--input": "213 52% 24%",
  "--ring": "199 89% 48%",
  "--success": "158 84% 39%",
  "--success-foreground": "222 43% 7%",
  "--warning": "38 92% 50%",
  "--warning-foreground": "222 43% 7%",
  "--destructive": "0 84% 60%",
  "--destructive-foreground": "216 100% 97%",
  "--sidebar-background": "222 43% 7%",
  "--sidebar-foreground": "216 100% 97%",
  "--sidebar-primary": "199 89% 48%",
  "--sidebar-primary-foreground": "222 43% 7%",
  "--sidebar-accent": "213 52% 24%",
  "--sidebar-accent-foreground": "216 100% 97%",
  "--sidebar-border": "213 52% 24%",
  "--sidebar-ring": "199 89% 48%",
  "--glow-focus": "0 0 0 3px rgba(14,165,233,0.25)",
  "--glow-primary": "0 0 16px rgba(14,165,233,0.30)",
  "--glow-primary-light": "0 0 12px rgba(14,165,233,0.20)",
  "--glow-cyan": "0 0 16px rgba(6,182,212,0.22)",
};

describe("aislamiento: nada de la marca nueva sale de .erp", () => {
  const without = (vars: Vars, drop: string[]) => Object.fromEntries(Object.entries(vars).filter(([k]) => !drop.includes(k)));

  it(":root conserva todos sus tokens (solo gana --info y --subtle, inertes)", () => {
    expect(without(ROOT, ["--info", "--subtle"])).toEqual(ROOT_BASE);
  });

  it(".dark conserva todos sus tokens (solo gana --info y --subtle, inertes)", () => {
    expect(without(DARK, ["--info", "--subtle"])).toEqual(DARK_BASE);
  });

  // Reglas añadidas por el bloque del panel: todo lo que está después de su comentario de cabecera.
  const section: Rule[] = [];
  let started = false;
  for (const node of root.nodes) {
    if (node.type === "comment" && (node as Comment).text.includes("Panel de administración")) started = true;
    if (started && node.type === "atrule") (node as AtRule).walkRules((r) => void section.push(r));
  }

  it("el bloque del panel existe y tiene reglas", () => {
    expect(started).toBe(true);
    expect(section.length).toBeGreaterThan(5);
  });

  it("fuera de .erp, el bloque solo toca --info y --subtle (en :root y .dark) y no declara colores", () => {
    const offenders: string[] = [];
    for (const rule of section) {
      const selector = norm(rule.selector);
      if (selector === ":root" || selector === ".dark") {
        rule.walkDecls((d) => {
          if (!["--info", "--subtle"].includes(d.prop)) offenders.push(`${selector} { ${d.prop} }`);
        });
        continue;
      }
      if (/(^|[\s(])\.erp(\s|\[|\)|$)/.test(selector)) continue;
      rule.walkDecls((d) => {
        if (d.prop.startsWith("--") || /color|background|fill|stroke|border|outline|gradient/i.test(d.prop)) {
          offenders.push(`${selector} { ${d.prop} }`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });

  it("Poppins e Inter solo se declaran en reglas de .erp", () => {
    const offenders: string[] = [];
    root.walkDecls("font-family", (d) => {
      if (!/\b(Poppins|Inter)\b/.test(d.value)) return;
      const rule = d.parent as Rule;
      if (!/(^|[\s(])\.erp(\s|\[|\)|$)/.test(norm(rule.selector))) offenders.push(norm(rule.selector));
    });
    expect(offenders).toEqual([]);
  });

  it("la tipografía global no cambia: Hanken Grotesk en el documento y Sora en h1-h6", () => {
    const families: Record<string, string> = {};
    root.walkRules((rule) => {
      const sel = norm(rule.selector);
      if (sel === "html, body" || sel === "h1, h2, h3, h4, h5, h6") {
        rule.walkDecls("font-family", (d) => void (families[sel] = d.value));
      }
    });
    expect(families["html, body"]).toContain("Hanken Grotesk");
    expect(families["h1, h2, h3, h4, h5, h6"]).toContain("Sora");
  });
});

// ---- c. Degradado de marca ----------------------------------------------------
describe("--brand-gradient: definido, sin uso", () => {
  it("se define igual en claro y oscuro, solo con los teales de marca", () => {
    expect(ERP["--brand-gradient"]).toBeDefined();
    expect(DARK_ERP["--brand-gradient"]).toBe(ERP["--brand-gradient"]);
    expect(ERP["--brand-gradient"]).toMatch(/hsl\(193 77% 32%\).*hsl\(193\.2 93\.5% 36\.3%\)/);
  });

  function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) return name === "test" ? [] : sourceFiles(full);
      return /\.(tsx?|css)$/.test(name) ? [full] : [];
    });
  }

  it("ningún componente ni hoja de estilos lo usa (el CSS solo lo declara)", () => {
    const users = sourceFiles(SRC)
      .filter((f) => readFileSync(f, "utf8").includes("brand-gradient"))
      .map((f) => path.relative(SRC, f).replace(/\\/g, "/"));
    expect(users).toEqual(["index.css"]);
    expect(css).not.toMatch(/var\(\s*--brand-gradient/);
  });
});
