// Tokens del panel de administración (ámbito `.erp`):
//   1. contraste WCAG >= 4,5:1 en los pares fijados, en claro y oscuro;
//   2. aislamiento: los valores nuevos solo viven bajo `.erp`, y `:root`/`.dark`
//      solo ganan `--info`/`--subtle` con valores inertes.
// Lee `src/index.css` tal cual está en disco, así que una edición que rompa un
// par o filtre un token fuera del ámbito falla aquí.
import { readFileSync } from "node:fs";
import path from "node:path";
import postcss, { type Rule } from "postcss";
import { describe, expect, it } from "vitest";

const css = readFileSync(path.resolve(__dirname, "../index.css"), "utf8");
const root = postcss.parse(css);

function rulesBySelector(selector: string): Rule[] {
  const found: Rule[] = [];
  root.walkRules((rule) => {
    if (rule.selectors.length === 1 && rule.selector.replace(/\s+/g, " ").trim() === selector) found.push(rule);
  });
  return found;
}

function declsOf(selector: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rule of rulesBySelector(selector)) {
    rule.walkDecls((d) => {
      if (d.prop.startsWith("--")) out[d.prop] = d.value.trim();
    });
  }
  return out;
}

const ROOT = declsOf(":root");
const DARK = declsOf(".dark");
const ERP = declsOf(".erp");
const DARK_ERP = declsOf(".dark .erp");
const JADE = declsOf('.erp[data-accent="jade"]');
const DARK_JADE = declsOf('.dark .erp[data-accent="jade"]');

// Valor efectivo dentro del ámbito (más específico = último en la cadena).
const LIGHT_ERP = { ...ROOT, ...ERP };
const DARK_ERP_EFFECTIVE = { ...ROOT, ...DARK, ...ERP, ...DARK_ERP };
const LIGHT_JADE = { ...LIGHT_ERP, ...JADE };
const DARK_JADE_EFFECTIVE = { ...DARK_ERP_EFFECTIVE, ...JADE, ...DARK_JADE };

// ---- WCAG 2.x ---------------------------------------------------------------
type RGB = [number, number, number];

function hslToRgb(triplet: string): RGB {
  const [h, s, l] = triplet.trim().split(/\s+/).map((v) => parseFloat(v));
  const sat = s / 100;
  const lig = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(lig, 1 - lig);
  const f = (n: number) => lig - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

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

type Vars = Record<string, string>;
const color = (vars: Vars, token: string): RGB => {
  const value = vars[token];
  if (!value) throw new Error(`Token ausente: ${token}`);
  return hslToRgb(value);
};

const THEMES: Array<[string, Vars]> = [
  ["claro", LIGHT_ERP],
  ["oscuro", DARK_ERP_EFFECTIVE],
];
const SURFACES = ["--background", "--card", "--subtle", "--muted"];
const STATUS_TEXT = ["--success", "--warning", "--destructive", "--info"];
const MIN = 4.5;

describe("contraste de tokens .erp (>= 4,5:1)", () => {
  describe.each(THEMES)("tema %s", (_name, vars) => {
    it.each(SURFACES)("texto principal sobre %s", (surface) => {
      expect(ratio(color(vars, "--foreground"), color(vars, surface))).toBeGreaterThanOrEqual(MIN);
    });

    it.each(SURFACES)("texto atenuado (muted-foreground) sobre %s", (surface) => {
      expect(ratio(color(vars, "--muted-foreground"), color(vars, surface))).toBeGreaterThanOrEqual(MIN);
    });

    it.each(STATUS_TEXT.flatMap((t) => SURFACES.map((s) => [t, s] as const)))(
      "%s como texto sobre %s",
      (token, surface) => {
        expect(ratio(color(vars, token), color(vars, surface))).toBeGreaterThanOrEqual(MIN);
      },
    );

    // Píldora: texto del estado sobre su tinte al 10 % encima de la superficie.
    it.each(STATUS_TEXT.flatMap((t) => ["--background", "--card", "--subtle"].map((s) => [t, s] as const)))(
      "píldora %s al 10 %% sobre %s",
      (token, surface) => {
        const fg = color(vars, token);
        const tinted = mix(fg, color(vars, surface), 0.1);
        expect(ratio(fg, tinted)).toBeGreaterThanOrEqual(MIN);
      },
    );
  });

  // Texto sobre relleno sólido de estado. En claro los *-foreground son blancos
  // heredados de :root; en oscuro, los de .dark.
  it.each(THEMES)("tema %s: texto sobre relleno sólido de success/warning/destructive", (_n, vars) => {
    for (const token of ["success", "warning", "destructive"]) {
      expect(ratio(color(vars, `--${token}-foreground`), color(vars, `--${token}`))).toBeGreaterThanOrEqual(MIN);
    }
  });

  it("acento jade: texto sobre botón y acento sobre superficies, en claro y oscuro", () => {
    for (const vars of [LIGHT_JADE, DARK_JADE_EFFECTIVE]) {
      expect(ratio(color(vars, "--primary-foreground"), color(vars, "--primary"))).toBeGreaterThanOrEqual(MIN);
      expect(ratio(color(vars, "--primary"), color(vars, "--background"))).toBeGreaterThanOrEqual(MIN);
      expect(ratio(color(vars, "--primary"), color(vars, "--card"))).toBeGreaterThanOrEqual(MIN);
    }
  });

  it("acento teal luminoso en oscuro: texto sobre botón y acento sobre tarjeta", () => {
    expect(ratio(color(DARK_ERP_EFFECTIVE, "--primary-foreground"), color(DARK_ERP_EFFECTIVE, "--primary"))).toBeGreaterThanOrEqual(MIN);
    expect(ratio(color(DARK_ERP_EFFECTIVE, "--primary"), color(DARK_ERP_EFFECTIVE, "--card"))).toBeGreaterThanOrEqual(MIN);
  });

  // Componentes de interfaz (WCAG 1.4.11, >= 3:1): pista apagada del Switch
  // (`bg-muted-foreground/70`) y relleno de Progress sobre su pista (`/20`).
  it.each(THEMES)("tema %s: la pista apagada del Switch alcanza 3:1 sobre las superficies", (_n, vars) => {
    for (const surface of ["--background", "--card", "--subtle"]) {
      const track = mix(color(vars, "--muted-foreground"), color(vars, surface), 0.7);
      expect(ratio(track, color(vars, surface))).toBeGreaterThanOrEqual(3);
    }
  });

  it.each(THEMES)("tema %s: el relleno de Progress alcanza 3:1 sobre su pista", (_n, vars) => {
    const track = mix(color(vars, "--muted-foreground"), color(vars, "--card"), 0.2);
    expect(ratio(color(vars, "--primary"), track)).toBeGreaterThanOrEqual(3);
  });

  it("el contraste medido de muted-foreground mejora el valor previo (2,81:1)", () => {
    expect(ratio(color(LIGHT_ERP, "--muted-foreground"), color(LIGHT_ERP, "--card"))).toBeGreaterThan(2.81 * 2);
  });

  // Identidad oficial. Antes: el azul de marca en claro (200 98% 39%) con texto blanco daba 4,11:1
  // (hover 3,57:1, enlace 3,95-4,11:1) y se bajó a 200 98% 33%. El teal oficial #137590 (193 77% 32%) con texto
  // blanco da 5,3:1; `--primary`, `--primary-foreground` y `--ring` viven solo en `.erp`.
  describe("teal de marca en claro (AA)", () => {
    const white = color(LIGHT_ERP, "--primary-foreground");
    const primary = color(LIGHT_ERP, "--primary");

    it("texto blanco sobre el botón primario alcanza 4,5:1", () => {
      expect(ratio(white, primary)).toBeGreaterThanOrEqual(MIN);
    });

    it("el hover del botón (`--primary-hover`, #10677E) con texto blanco alcanza 4,5:1", () => {
      expect(ratio(white, color(LIGHT_ERP, "--primary-hover"))).toBeGreaterThanOrEqual(MIN);
    });

    // button.tsx (compartido) sigue con `hover:bg-primary/90`, que con el teal oficial da 4,38:1 sobre `--background`.
    // El hover real lo resuelve la regla `.erp [class~="hover:bg-primary/90"]:hover` -> `--primary-hover`
    // (ver el bloque «accesibilidad · hover del botón primario» más abajo).

    it("el enlace `text-primary` alcanza 4,5:1 sobre fondo, tarjeta, muted y subtle", () => {
      for (const surface of SURFACES) {
        expect(ratio(primary, color(LIGHT_ERP, surface)), surface).toBeGreaterThanOrEqual(MIN);
      }
    });

    it("el teal de marca (#137590) difiere del azul de :root: el cambio queda dentro del ámbito", () => {
      expect(ERP["--primary"]).toBe("193 77% 32%");
      expect(ROOT["--primary"]).toBe("200 98% 39%");
    });
  });

  it("anillo de foco (--ring) alcanza 3:1 sobre fondo y tarjeta, en claro y oscuro (WCAG 1.4.11)", () => {
    for (const [, vars] of THEMES) {
      for (const surface of ["--background", "--card"]) {
        expect(ratio(color(vars, "--ring"), color(vars, surface)), surface).toBeGreaterThanOrEqual(3);
      }
    }
  });

  // Insignia sobre una fila con hover (`hover:bg-muted/40` sobre la tarjeta): el caso real de listas y tablas.
  // StatusBadge usa tinte al 10 % en claro y al 8 % en oscuro (con 10 % el rojo oscuro daba 4,496:1).
  it.each([
    ["claro", LIGHT_ERP, 0.1],
    ["oscuro", DARK_ERP_EFFECTIVE, 0.08],
  ] as const)("tema %s: la píldora de estado alcanza 4,5:1 sobre una fila con hover (muted/40)", (_n, vars, tint) => {
    const row = mix(color(vars, "--muted"), color(vars, "--card"), 0.4);
    for (const token of STATUS_TEXT) {
      const fg = color(vars, token);
      expect(ratio(fg, mix(fg, row, tint)), token).toBeGreaterThanOrEqual(MIN);
    }
  });

  it("StatusBadge declara el tinte oscuro al 8 % de cada tono de estado", () => {
    const source = readFileSync(path.resolve(__dirname, "../components/admin/StatusBadge.tsx"), "utf8");
    for (const tone of ["info", "success", "warning", "destructive"]) {
      expect(source).toContain(`dark:bg-${tone}/[0.08]`);
    }
  });
});

// ---- Cierre de accesibilidad con la identidad oficial (WCAG 2.2 AA) ---------------------------------------
// Cada razón se calcula con los tokens reales de src/index.css. button.tsx, input.tsx, select.tsx y tailwind.config.ts
// son compartidos con login, portal y landing: todo el arreglo vive en el ámbito `.erp`.
const HUE = (triplet: string) => parseFloat(triplet.trim().split(/\s+/)[0]);
const LIGHTNESS = (triplet: string) => parseFloat(triplet.trim().split(/\s+/)[2]);
const srcFile = (rel: string) => readFileSync(path.resolve(__dirname, "..", rel), "utf8");

describe("accesibilidad · hover del botón primario", () => {
  const HOVER_SELECTOR = '.erp [class~="hover:bg-primary/90"]:hover:not(:disabled):not([aria-disabled="true"])';

  it.each([
    ["claro", LIGHT_ERP],
    ["oscuro", DARK_ERP_EFFECTIVE],
    ["jade claro", LIGHT_JADE],
    ["jade oscuro", DARK_JADE_EFFECTIVE],
  ] as const)("tema %s: texto del botón sobre `--primary-hover` alcanza 4,5:1", (_n, vars) => {
    expect(ratio(color(vars, "--primary-foreground"), color(vars, "--primary-hover"))).toBeGreaterThanOrEqual(MIN);
  });

  it("la regla del ámbito reemplaza el fondo del hover por `--primary-hover` y respeta `disabled`", () => {
    const rules = rulesBySelector(HOVER_SELECTOR);
    expect(rules).toHaveLength(1);
    const background: string[] = [];
    rules[0].walkDecls((d) => void background.push(`${d.prop}: ${d.value}`));
    expect(background).toEqual(["background-color: hsl(var(--primary-hover))"]);
  });

  it("button.tsx (compartido) sigue con `hover:bg-primary/90`: la regla depende de esa clase y no se toca el botón", () => {
    const button = srcFile("components/ui/button.tsx");
    expect(button).toContain("hover:bg-primary/90");
    expect(button).toContain("disabled:pointer-events-none");
    expect(button).not.toContain("primary-hover");
  });

  it("especificidad: la regla (0,5,0) gana a la utilidad `.hover:bg-primary/90:hover` (0,2,0)", () => {
    // Clases + atributos + pseudoclases de la regla; `:not(x)` cuenta como `x`.
    const specificity = (sel: string) => (sel.replace(/:not\(/g, "(").match(/\.[\w-]+|\[[^\]]+\]|:(?!:)[\w-]+/g) ?? []).length;
    expect(specificity(HOVER_SELECTOR)).toBeGreaterThan(2);
  });

  it("solo actúa dentro de `.erp`: ninguna regla fuera del ámbito usa `--primary-hover` como relleno", () => {
    const offenders: string[] = [];
    root.walkDecls((d) => {
      if (!d.value.includes("var(--primary-hover)")) return;
      const selector = (d.parent as Rule).selector.replace(/\s+/g, " ").trim();
      if (!selector.startsWith(".erp ")) offenders.push(selector);
    });
    expect(offenders).toEqual([]);
  });
});

describe("accesibilidad · enlaces y texto `text-primary` (--link)", () => {
  const LINK_SURFACES = ["--background", "--card", "--popover", "--subtle", "--muted", "--card-muted", "--accent", "--row-selected"];

  describe.each(THEMES)("tema %s", (_n, vars) => {
    it.each(LINK_SURFACES)("`--link` sobre %s alcanza 4,5:1", (surface) => {
      expect(ratio(color(vars, "--link"), color(vars, surface))).toBeGreaterThanOrEqual(MIN);
    });

    it("`--link` sobre las filas con hover (muted/40 y muted/50 sobre la tarjeta) alcanza 4,5:1", () => {
      for (const alpha of [0.4, 0.5]) {
        const row = mix(color(vars, "--muted"), color(vars, "--card"), alpha);
        expect(ratio(color(vars, "--link"), row), String(alpha)).toBeGreaterThanOrEqual(MIN);
      }
    });
  });

  it("claro: el enlace es el propio teal de marca (ya pasaba en todas las superficies); no hay regla de color en claro", () => {
    expect(ERP["--link"]).toBe(ERP["--primary"]);
    expect(rulesBySelector(".erp .text-primary")).toHaveLength(0);
  });

  it("oscuro: `--link` es el teal luminoso aclarado (mismo matiz y saturación, luminosidad <= +5) y solo se aplica a texto", () => {
    expect(HUE(DARK_ERP["--link"])).toBeCloseTo(HUE(DARK_ERP["--primary"]), 5);
    expect(parseFloat(DARK_ERP["--link"].split(/\s+/)[1])).toBeCloseTo(parseFloat(DARK_ERP["--primary"].split(/\s+/)[1]), 5);
    const delta = LIGHTNESS(DARK_ERP["--link"]) - LIGHTNESS(DARK_ERP["--primary"]);
    expect(delta).toBeGreaterThan(0);
    expect(delta).toBeLessThanOrEqual(5);
    // El relleno `bg-primary` y su texto no cambian: sigue el teal luminoso aprobado.
    expect(DARK_ERP["--primary"]).toBe("193.2 93.5% 36.3%");

    const rules = rulesBySelector(".dark .erp .text-primary");
    expect(rules).toHaveLength(1);
    const props: string[] = [];
    rules[0].walkDecls((d) => void props.push(`${d.prop}: ${d.value}`));
    expect(props).toEqual(["color: hsl(var(--link))"]);
  });

  it("el jade conserva su propio enlace (no hereda el teal)", () => {
    expect(JADE["--link"]).toBe(JADE["--primary"]);
    expect(DARK_JADE["--link"]).toBe(DARK_JADE["--primary"]);
  });
});

describe("accesibilidad · bordes de control (WCAG 1.4.11, 3:1)", () => {
  describe.each(THEMES)("tema %s", (_n, vars) => {
    it.each(["--background", "--card", "--popover", "--subtle"])("`--input` sobre %s alcanza 3:1", (surface) => {
      expect(ratio(color(vars, "--input"), color(vars, surface))).toBeGreaterThanOrEqual(3);
    });

    it("`--input` no es el borde decorativo y no pesa de más (<= 3,6:1 sobre fondo y tarjeta)", () => {
      expect(vars["--input"]).not.toBe(vars["--border"]);
      for (const surface of ["--background", "--card"]) {
        expect(ratio(color(vars, "--input"), color(vars, surface)), surface).toBeLessThanOrEqual(3.6);
      }
    });

    it("`--input` es del matiz 213 (neutro de la marca)", () => {
      expect(Math.abs(HUE(vars["--input"]) - 213)).toBeLessThanOrEqual(1);
    });
  });

  it("claro: también alcanza 3:1 sobre muted (los controles dentro de un panel gris)", () => {
    expect(ratio(color(LIGHT_ERP, "--input"), color(LIGHT_ERP, "--muted"))).toBeGreaterThanOrEqual(3);
  });

  it("`--border` (divisores y tarjetas) no cambia: sigue siendo decorativo", () => {
    expect(ERP["--border"]).toBe("212 21% 88%");
    expect(DARK_ERP["--border"]).toBe("213 28% 17%");
  });

  it("los controles compartidos leen `border-input` (un solo token para inputs, selects, textarea y botón outline)", () => {
    for (const rel of ["components/ui/input.tsx", "components/ui/select.tsx", "components/ui/textarea.tsx", "components/ui/button.tsx"]) {
      expect(srcFile(rel), rel).toContain("border-input");
    }
  });
});

describe("accesibilidad · superficie de hover (--accent) de outline y ghost", () => {
  describe.each(THEMES)("tema %s", (_n, vars) => {
    it("tinta principal y texto atenuado sobre `--accent` alcanzan 4,5:1", () => {
      expect(ratio(color(vars, "--accent-foreground"), color(vars, "--accent"))).toBeGreaterThanOrEqual(MIN);
      expect(ratio(color(vars, "--muted-foreground"), color(vars, "--accent"))).toBeGreaterThanOrEqual(MIN);
    });

    it("`--accent-foreground` es la tinta principal y `--accent` es del matiz 213", () => {
      expect(vars["--accent-foreground"]).toBe(vars["--foreground"]);
      expect(Math.abs(HUE(vars["--accent"]) - 213)).toBeLessThanOrEqual(1);
    });

    it("el hover se distingue de la tarjeta (>= 1,1:1) y el icono destructivo encima alcanza 3:1", () => {
      expect(ratio(color(vars, "--accent"), color(vars, "--card"))).toBeGreaterThanOrEqual(1.1);
      expect(ratio(color(vars, "--destructive"), color(vars, "--accent"))).toBeGreaterThanOrEqual(3);
    });
  });

  it("los pasos de luminosidad siguen a `--muted`: claro un escalón más oscuro, oscuro un escalón más claro", () => {
    expect(LIGHTNESS(ERP["--accent"])).toBeLessThan(LIGHTNESS(ERP["--muted"]));
    expect(LIGHTNESS(DARK_ERP["--accent"])).toBeGreaterThan(LIGHTNESS(DARK_ERP["--muted"]));
  });

  it("el cian heredado de :root/.dark no cambia (landing, login y portal)", () => {
    expect(ROOT["--accent"]).toBe("192 91% 36%");
    expect(ROOT["--accent-foreground"]).toBe("0 0% 100%");
    expect(DARK["--accent"]).toBe("187 92% 43%");
  });
});

describe("accesibilidad · anillo de foco", () => {
  it.each([
    ["claro", ["--background", "--card", "--popover"], 5, LIGHT_ERP],
    ["claro", ["--subtle", "--muted"], 4.5, LIGHT_ERP],
    ["oscuro", ["--background", "--card", "--popover", "--subtle"], 4.8, DARK_ERP_EFFECTIVE],
    ["oscuro", ["--muted"], 4, DARK_ERP_EFFECTIVE],
  ] as const)("tema %s: `--ring` sobre %j alcanza %s:1 (el mínimo de 1.4.11 es 3:1)", (_n, surfaces, min, vars) => {
    for (const surface of surfaces) {
      expect(ratio(color(vars, "--ring"), color(vars, surface)), surface).toBeGreaterThanOrEqual(min);
    }
  });

  it("claro: el anillo es el teal principal; oscuro, el teal luminoso", () => {
    expect(ERP["--ring"]).toBe(ERP["--primary"]);
    expect(DARK_ERP["--ring"]).toBe(DARK_ERP["--primary"]);
  });

  it("el desfase del anillo usa el fondo (`ring-offset-background`) en los controles compartidos", () => {
    expect(srcFile("components/ui/button.tsx")).toContain("ring-offset-background");
    expect(srcFile("components/ui/input.tsx")).toContain("ring-offset-background");
  });
});

describe("accesibilidad · fila seleccionada de Tickets y textos pequeños", () => {
  const PILL_TINT = { claro: 0.1, oscuro: 0.08 } as const;

  it.each(THEMES)("tema %s: todas las insignias de StatusBadge alcanzan 4,5:1 sobre `--row-selected`", (name, vars) => {
    const row = color(vars, "--row-selected");
    const tint = PILL_TINT[name as keyof typeof PILL_TINT];
    for (const token of STATUS_TEXT) {
      const fg = color(vars, token);
      expect(ratio(fg, mix(fg, row, tint)), token).toBeGreaterThanOrEqual(MIN);
    }
    // primary: texto `foreground` sobre el tinte del 10 %; neutral: `muted-foreground` sobre `muted`.
    expect(ratio(color(vars, "--foreground"), mix(color(vars, "--primary"), row, 0.1)), "primary").toBeGreaterThanOrEqual(MIN);
    expect(ratio(color(vars, "--muted-foreground"), color(vars, "--muted")), "neutral").toBeGreaterThanOrEqual(MIN);
    expect(ratio(color(vars, "--muted-foreground"), row), "texto atenuado").toBeGreaterThanOrEqual(MIN);
  });

  it("la fila seleccionada se distingue de la tarjeta (>= 1,05:1) y lleva una barra de marca que no depende del tono", () => {
    for (const [, vars] of THEMES) {
      expect(ratio(color(vars, "--row-selected"), color(vars, "--card"))).toBeGreaterThanOrEqual(1.05);
      expect(ratio(color(vars, "--primary"), color(vars, "--card"))).toBeGreaterThanOrEqual(3);
    }
    const table = srcFile("components/dashboard/tickets/TicketTable.tsx");
    expect(table).toContain("data-[state=selected]:bg-[hsl(var(--row-selected))]");
    expect(table).toContain("group-data-[state=selected]:bg-[hsl(var(--row-selected))]");
    expect(table).toContain("group-data-[state=selected]:before:bg-primary");
    expect(table).not.toContain("group-data-[state=selected]:bg-muted");
  });

  it("`--row-selected` existe en claro y oscuro y solo dentro de `.erp`", () => {
    expect(ERP["--row-selected"]).toBeDefined();
    expect(DARK_ERP["--row-selected"]).toBeDefined();
    expect(ROOT["--row-selected"]).toBeUndefined();
    expect(DARK["--row-selected"]).toBeUndefined();
  });

  it.each(THEMES)("tema %s: insignias de la navegación y del hilo (12 px) alcanzan 4,5:1", (_n, vars) => {
    const subtle = color(vars, "--subtle");
    const card = color(vars, "--card");
    // Contador de tickets: tinta principal sobre la tarjeta.
    expect(ratio(color(vars, "--foreground"), card), "contador").toBeGreaterThanOrEqual(MIN);
    // «Próximamente»: contador atenuado sobre la barra lateral; con hover pasa a la tinta principal sobre la tarjeta.
    expect(ratio(color(vars, "--muted-foreground"), subtle), "Próximamente").toBeGreaterThanOrEqual(MIN);
    // Etiqueta «Equipo»/«Cliente» del hilo: atenuado sobre `bg-background`.
    expect(ratio(color(vars, "--muted-foreground"), color(vars, "--background")), "etiqueta del hilo").toBeGreaterThanOrEqual(MIN);
  });
});

describe("accesibilidad · aislamiento de las reglas nuevas", () => {
  it("`--link` y `--row-selected` solo se declaran en `.erp`, `.dark .erp` y el jade", () => {
    const offenders: string[] = [];
    root.walkDecls((d) => {
      if (d.prop !== "--link" && d.prop !== "--row-selected") return;
      const selector = (d.parent as Rule).selector.replace(/\s+/g, " ").trim();
      if (!/^(\.dark )?\.erp(\[data-accent="jade"\])?$/.test(selector)) offenders.push(selector);
    });
    expect(offenders).toEqual([]);
  });

  it("ninguna regla con `.text-primary` o `hover:bg-primary/90` existe fuera de `.erp`", () => {
    const offenders: string[] = [];
    root.walkRules((rule) => {
      for (const s of rule.selectors) {
        const sel = s.replace(/\s+/g, " ").trim();
        if (/text-primary|hover:bg-primary\/90/.test(sel) && !/^(\.dark )?\.erp /.test(sel)) offenders.push(sel);
      }
    });
    expect(offenders).toEqual([]);
  });
});

describe("aislamiento del ámbito .erp", () => {
  const SCOPED_TOKENS = [
    "--background",
    "--card",
    "--popover",
    "--card-muted",
    "--subtle",
    "--secondary",
    "--muted",
    "--muted-foreground",
    "--border",
    "--input",
    "--success",
    "--warning",
    "--destructive",
    "--destructive-foreground",
    "--info",
    "--shadow-card",
    "--primary",
    "--primary-foreground",
    "--primary-hover",
    "--link",
    "--accent",
    "--accent-foreground",
    "--row-selected",
    "--ring",
    "--foreground",
    "--card-foreground",
    "--popover-foreground",
    "--secondary-foreground",
    "--body-foreground",
    "--brand-gradient",
  ];

  it("existen los bloques claro y oscuro del ámbito", () => {
    expect(Object.keys(ERP).length).toBeGreaterThan(0);
    expect(Object.keys(DARK_ERP).length).toBeGreaterThan(0);
  });

  it("cada token de .erp tiene su par en .dark .erp (si no, el valor claro se filtra al oscuro)", () => {
    const missing = Object.keys(ERP).filter((t) => !(t in DARK_ERP));
    expect(missing).toEqual([]);
  });

  it("cada token del acento jade tiene su par oscuro", () => {
    expect(Object.keys(JADE).sort()).toEqual(Object.keys(DARK_JADE).sort());
  });

  it("el jade solo toca primary/ring/sidebar-primary/sidebar-ring (y sus foreground, hover y enlace)", () => {
    // `--primary-hover` y `--link` del teal no deben filtrarse al jade (el hover del botón y el texto `text-primary`).
    const allowed = new Set([
      "--primary",
      "--primary-foreground",
      "--primary-hover",
      "--link",
      "--ring",
      "--sidebar-primary",
      "--sidebar-primary-foreground",
      "--sidebar-ring",
    ]);
    for (const t of [...Object.keys(JADE), ...Object.keys(DARK_JADE)]) expect(allowed.has(t)).toBe(true);
  });

  it("ninguna regla fuera de :root, .dark y .erp declara los tokens con ámbito", () => {
    const offenders: string[] = [];
    root.walkRules((rule) => {
      const hasScoped = rule.nodes?.some((n) => n.type === "decl" && SCOPED_TOKENS.includes(n.prop));
      if (!hasScoped) return;
      const selector = rule.selector.replace(/\s+/g, " ").trim();
      // `.ms-chat-panel` ya redefinía estos tokens antes de este cambio (panel del chat de la landing).
      const ok =
        selector === ":root" ||
        selector === ".dark" ||
        selector === ".ms-chat-panel" ||
        selector === ".dark .ms-chat-panel" ||
        /(^|\s)\.erp(\s|\[|$|,)/.test(selector);
      if (!ok) offenders.push(selector);
    });
    expect(offenders).toEqual([]);
  });

  it("los selectores del ámbito siempre parten de .erp o de .dark .erp", () => {
    const erpSelectors: string[] = [];
    root.walkRules((rule) => {
      for (const s of rule.selectors) if (s.includes(".erp")) erpSelectors.push(s.replace(/\s+/g, " ").trim());
    });
    expect(erpSelectors.length).toBeGreaterThan(0);
    // `:where(.erp) p` es el mismo ámbito con especificidad 0 (así `text-2xl` & co. ganan a la regla de `p`).
    // Tipografía del ámbito. `.erp :is(h1…h6)`, `.erp nav[aria-label="Principal"]` y `.erp .tabular` también parten de `.erp`.
    // Hover del botón primario (`.erp [class~="hover:bg-primary/90"]:hover…`) y el enlace oscuro (`.dark .erp .text-primary`).
    for (const s of erpSelectors) {
      expect(s).toMatch(
        /^((\.dark )?\.erp(\[data-accent="jade"\])?| ?:where\(\.erp\) p|\.erp :is\(h1, h2, h3, h4, h5, h6\)|\.erp nav\[aria-label="Principal"\]|\.erp \.tabular|\.erp \[class~="hover:bg-primary\/90"\]:hover:not\(:disabled\):not\(\[aria-disabled="true"\]\)|\.dark \.erp \.text-primary)$/,
      );
    }
  });

  it(":root y .dark solo ganan --info y --subtle, con los valores inertes actuales", () => {
    // Valores previos de los tokens de la landing/dashboard: no deben haber cambiado.
    expect(ROOT["--background"]).toBe("0 0% 100%");
    expect(ROOT["--card"]).toBe("0 0% 100%");
    expect(ROOT["--border"]).toBe("40 8% 91%");
    expect(ROOT["--muted-foreground"]).toBe("40 2% 60%");
    expect(ROOT["--success"]).toBe("160 84% 31%");
    expect(ROOT["--warning"]).toBe("32 95% 44%");
    expect(ROOT["--destructive"]).toBe("0 72% 51%");
    expect(ROOT["--primary"]).toBe("200 98% 39%");
    expect(DARK["--background"]).toBe("222 43% 7%");
    expect(DARK["--card"]).toBe("218 56% 14%");
    expect(DARK["--border"]).toBe("213 52% 24%");
    expect(DARK["--muted-foreground"]).toBe("215 16% 47%");
    expect(DARK["--primary"]).toBe("199 89% 48%");

    // Inertes: info = primary; subtle = card-muted.
    expect(ROOT["--info"]).toBe(ROOT["--primary"]);
    expect(ROOT["--subtle"]).toBe(ROOT["--card-muted"]);
    expect(DARK["--info"]).toBe(DARK["--primary"]);
    expect(DARK["--subtle"]).toBe(DARK["--card-muted"]);
  });

  it("el jade solo se activa con data-accent; el acento por defecto es el teal oficial, solo dentro de .erp", () => {
    // Identidad oficial. Claro #137590 con texto blanco; oscuro #068DB3 con texto medianoche #080D13. El jade
    // (opción) sigue igual y gana por especificidad con `data-accent`.
    expect(ERP["--primary"]).toBe("193 77% 32%");
    expect(ERP["--primary-foreground"]).toBe("0 0% 100%");
    // El anillo claro pasa al teal principal (margen cómodo); el oscuro conserva el teal luminoso.
    expect(ERP["--ring"]).toBe("193 77% 32%");
    expect(DARK_ERP["--primary"]).toBe("193.2 93.5% 36.3%");
    expect(DARK_ERP["--primary-foreground"]).toBe("212.7 40.7% 5.3%");
    expect(DARK_ERP["--primary"]).not.toBe(DARK["--primary"]);
    expect(JADE["--primary"]).toBe("166 100% 24%");
    expect(DARK_JADE["--primary"]).toBe("162 53% 56%");
  });

  it("los radios de Tailwind no cambian (tailwind.config.ts)", () => {
    const config = readFileSync(path.resolve(__dirname, "../../tailwind.config.ts"), "utf8");
    expect(config).toMatch(/xl:\s*"16px"/);
    expect(config).toMatch(/lg:\s*"12px"/);
    expect(config).toMatch(/md:\s*"8px"/);
    expect(config).toMatch(/sm:\s*"4px"/);
  });

  it("las utilidades nuevas no usan gradientes ni vidrio (`--brand-gradient` solo se define, no se aplica)", () => {
    let block = "";
    root.walkRules((rule) => {
      if (rule.selector === ".shadow-card" || rule.selector === ".tabular" || rule.selector.includes(".erp")) {
        // La variable `--brand-gradient` queda definida para uso futuro; cualquier otra mención sigue prohibida.
        const clone = rule.clone();
        clone.walkDecls("--brand-gradient", (d) => void d.remove());
        block += clone.toString();
      }
    });
    expect(block).not.toMatch(/gradient|backdrop|blur/i);
    expect(block).toMatch(/shadow-card/);
  });
});
