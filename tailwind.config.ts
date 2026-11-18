import type { Config } from "tailwindcss";

/**
 * Sitio público (`.ms-site`): sus tokens viven en el espacio de nombres `--site-*` (src/components/site/site.css) y
 * son canales oklch sin alfa, para que `bg-site-primary/40` funcione. Fuera de `.ms-site` las variables no existen,
 * así que estas utilidades no hacen nada en el panel, el acceso ni el portal.
 */
const siteColor = (token: string) => `oklch(var(--site-${token}) / <alpha-value>)`;

/** Bordes translúcidos de la referencia: el alfa base va aparte y el modificador (`/60`) lo multiplica. */
const siteColorWithBaseAlpha =
  (token: string, baseAlpha: number) =>
  ({ opacityValue }: { opacityValue?: string }) =>
    `oklch(var(--site-${token}) / ${opacityValue === undefined ? baseAlpha : `calc(${baseAlpha} * ${opacityValue})`})`;

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans:    ["Hanken Grotesk", "system-ui", "sans-serif"],
        display: ["Sora", "system-ui", "sans-serif"],
        mono:    ["JetBrains Mono", "monospace"],
        site:    ["Poppins", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        // Sitio público (solo oscuro). Mismos nombres que la referencia con el prefijo `site-`.
        site: {
          background:           siteColor("background"),
          foreground:           siteColor("foreground"),
          surface:              siteColor("surface"),
          card:                 siteColor("card"),
          "card-foreground":    siteColor("card-foreground"),
          popover:              siteColor("popover"),
          "popover-foreground": siteColor("popover-foreground"),
          primary:              siteColor("primary"),
          "primary-text":       siteColor("primary-text"),
          "primary-deep":       siteColor("primary-deep"),
          "primary-foreground": siteColor("primary-foreground"),
          secondary:            siteColor("secondary"),
          "secondary-foreground": siteColor("secondary-foreground"),
          muted:                siteColor("muted"),
          "muted-foreground":   siteColor("muted-foreground"),
          "hero-muted":         siteColor("hero-muted"),
          accent:               siteColor("accent"),
          "accent-foreground":  siteColor("accent-foreground"),
          destructive:          siteColor("destructive"),
          "destructive-foreground": siteColor("destructive-foreground"),
          success:              siteColor("success"),
          ring:                 siteColor("ring"),
          border:               siteColorWithBaseAlpha("border", 0.09),
          input:                siteColorWithBaseAlpha("input", 0.14),
        },
        border:      "hsl(var(--border))",
        input:       "hsl(var(--input))",
        ring:        "hsl(var(--ring))",
        background:  "hsl(var(--background))",
        foreground:  "hsl(var(--foreground))",
        primary: {
          DEFAULT:    "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT:    "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT:    "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT:    "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT:    "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        success: {
          DEFAULT:    "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT:    "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        // Panel de administración (valores inertes fuera del ámbito `.erp`)
        info:        "hsl(var(--info))",
        subtle:      "hsl(var(--subtle))",
        popover: {
          DEFAULT:    "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT:    "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
          muted:      "hsl(var(--card-muted))",
        },
        sidebar: {
          DEFAULT:              "hsl(var(--sidebar-background))",
          foreground:           "hsl(var(--sidebar-foreground))",
          primary:              "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent:               "hsl(var(--sidebar-accent))",
          "accent-foreground":  "hsl(var(--sidebar-accent-foreground))",
          border:               "hsl(var(--sidebar-border))",
          ring:                 "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        xl: "16px",
        lg: "12px",
        md: "8px",
        sm: "4px",
        // Escala de radios del sitio público (`--site-radius` = 0.875rem, como la referencia).
        "site-sm":  "calc(var(--site-radius) - 4px)",
        "site-md":  "calc(var(--site-radius) - 2px)",
        "site-lg":  "var(--site-radius)",
        "site-xl":  "calc(var(--site-radius) + 4px)",
        "site-2xl": "calc(var(--site-radius) + 8px)",
        "site-3xl": "calc(var(--site-radius) + 12px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
