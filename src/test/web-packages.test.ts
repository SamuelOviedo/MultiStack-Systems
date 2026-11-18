import { describe, expect, it } from "vitest";
import { PACKAGES, PAYMENT_TERMS, PLAN_COMPARISON, SITE_PLANS, type PaginasWebPackage } from "@/lib/webPackages";
import { COMMITMENTS, PAGINAS_WEB_CONTENT } from "@/pages/marketing/paginasWebContent";

const ids = (list: readonly PaginasWebPackage[]): string[] => list.map((pkg) => pkg.id);
const plan = (id: PaginasWebPackage["id"]): PaginasWebPackage => SITE_PLANS.find((pkg) => pkg.id === id)!;
const row = (label: string) => {
  const found = PLAN_COMPARISON.find((r) => r.label === label);
  expect(found, `fila «${label}»`).toBeDefined();
  return found!;
};
/** Un valor por plan del sitio, calculado de sus datos: así deben salir las filas de rondas y de entrega. */
const fromPlans = (pick: (pkg: PaginasWebPackage) => string): Record<string, string> =>
  Object.fromEntries(SITE_PLANS.map((pkg) => [pkg.id, pick(pkg)]));

describe("webPackages · SITE_PLANS", () => {
  it("son los tres planes del sitio en el orden de pantalla: Estándar, Intermedio y Combo", () => {
    expect(ids(SITE_PLANS)).toEqual(["estandar", "intermedio", "combo-emprendedor"]);
    expect(new Set(ids(SITE_PLANS)).size).toBe(SITE_PLANS.length);
  });

  it("los términos aprobados: nombre, precio, frase, insignia, plazo y rondas", () => {
    expect(
      SITE_PLANS.map((pkg) => [pkg.id, pkg.name, pkg.priceLempiras, pkg.tagline, pkg.badge ?? null, pkg.deliveryBusinessDays, pkg.revisionRounds]),
    ).toEqual([
      ["estandar", "Plan Estándar", 3500, "Tu página de una sola sección, lista para vender. Tú aportas tu logo.", null, 10, 2],
      [
        "intermedio",
        "Plan Intermedio",
        7500,
        "Un sitio completo para negocios que quieren crecer y aparecer en Google.",
        "Más elegido",
        15,
        3,
      ],
      [
        "combo-emprendedor",
        "Combo Emprendedor",
        3950,
        "Todo el Plan Estándar más tu logo profesional diseñado por LAU Graphic.",
        "Promoción del año",
        10,
        2,
      ],
    ]);
  });

  it("hay un solo plan destacado, el Intermedio, y va al centro", () => {
    expect(ids(SITE_PLANS.filter((pkg) => pkg.highlight === true))).toEqual(["intermedio"]);
    expect(SITE_PLANS.findIndex((pkg) => pkg.highlight === true)).toBe((SITE_PLANS.length - 1) / 2);
  });

  it("lo que incluye cada tarjeta; el Intermedio llega a 8 páginas", () => {
    expect(plan("estandar").features).toEqual([
      "Una página con hasta 6 secciones",
      "Diseño propio en React, sin plantillas",
      "Adaptada al celular",
      "Formulario de contacto",
      "Botón de WhatsApp y redes sociales",
      "Ubicación con Google Maps",
      "Velocidad medida con Lighthouse",
      "Dominio y hosting por 12 meses",
      "2 rondas de revisión",
    ]);
    expect(plan("intermedio").features).toEqual([
      "Hasta 8 páginas independientes",
      "Blog o sección de noticias",
      "Posicionamiento local en Google",
      "Configuración de tu perfil en Google Maps",
      "Estadísticas de visitas",
      "Catálogo con pedidos por WhatsApp",
      "Correo con tu dominio",
      "Dominio y hosting por 12 meses",
      "3 rondas de revisión",
    ]);
    expect(plan("combo-emprendedor").features).toEqual([
      "Todo lo del Plan Estándar",
      "Logo profesional por LAU Graphic",
      "Variaciones de color del logo",
      "Archivos PNG, JPG, PDF y editable",
      "Paleta oficial y tipografías",
      "Alta resolución para redes e impresos",
    ]);
    expect(JSON.stringify({ SITE_PLANS, PLAN_COMPARISON })).not.toContain("Hasta 5");
  });

  it("si una tarjeta menciona las rondas de revisión, dice las de revisionRounds", () => {
    for (const pkg of SITE_PLANS) {
      const rounds = pkg.features.filter((feature) => /rondas? de revisión/.test(feature));
      for (const line of rounds) expect(line, pkg.id).toBe(`${pkg.revisionRounds} rondas de revisión`);
    }
  });

  it("el Intermedio trae summary y extras para el modo paquete del portal", () => {
    const intermedio = plan("intermedio");
    expect(intermedio.summary).toBe("Hasta 8 páginas, con blog y posicionamiento local en Google.");
    expect(intermedio.extrasTitle).toBe("Tu sitio completo incluye");
    // Sus extras son lo que suma al Estándar: todo está en su tarjeta, y nada de lo que ya trae el Estándar.
    expect(intermedio.extras.length).toBeGreaterThan(0);
    for (const extra of intermedio.extras) {
      expect(intermedio.features, extra).toContain(extra);
      expect(plan("estandar").features, extra).not.toContain(extra);
    }
  });

  it("el Estándar dice lo mismo que los compromisos de /paginas-web: secciones, meses, rondas y plazo", () => {
    const standard = plan("estandar");
    expect(standard.revisionRounds).toBe(COMMITMENTS.revisionRounds);
    expect(standard.deliveryBusinessDays).toBe(COMMITMENTS.deliveryBusinessDays);
    expect(standard.features).toContain(`Una página con hasta ${COMMITMENTS.maxSections} secciones`);
    expect(standard.features).toContain(`Dominio y hosting por ${COMMITMENTS.domainHostingMonths} meses`);
    expect(row("Páginas").values.estandar).toBe(`1 (${COMMITMENTS.maxSections} secciones)`);
    expect(row(`Dominio y hosting ${COMMITMENTS.domainHostingMonths} meses`).values.estandar).toBe(true);
  });
});

describe("webPackages · /paginas-web sigue con dos paquetes", () => {
  it("PACKAGES son el Estándar y el Combo, en ese orden, y los mismos objetos de SITE_PLANS", () => {
    expect(ids(PACKAGES)).toEqual(["estandar", "combo-emprendedor"]);
    for (const pkg of PACKAGES) expect(pkg, pkg.id).toBe(plan(pkg.id));
  });

  it("el contenido de /paginas-web solo trae esos dos paquetes y no nombra el Intermedio ni su precio", () => {
    expect(PAGINAS_WEB_CONTENT.price.packages.map((pkg) => pkg.id)).toEqual(["estandar", "combo-emprendedor"]);
    const serialized = JSON.stringify(PAGINAS_WEB_CONTENT);
    expect(serialized).not.toMatch(/intermedio/i);
    expect(serialized).not.toMatch(/7,?500/);
  });
});

describe("webPackages · PAYMENT_TERMS", () => {
  it("la mitad para arrancar y la otra mitad al entregar", () => {
    expect(PAYMENT_TERMS).toEqual({ upfrontPercent: 50, onDeliveryPercent: 50 });
    expect(PAYMENT_TERMS.upfrontPercent + PAYMENT_TERMS.onDeliveryPercent).toBe(100);
  });
});

describe("webPackages · PLAN_COMPARISON", () => {
  it("las filas de la comparación completa, en orden", () => {
    expect(PLAN_COMPARISON.map((r) => r.label)).toEqual([
      "Páginas",
      "Logo profesional (LAU Graphic)",
      "Adaptada al celular",
      "WhatsApp, redes y Google Maps",
      "Dominio y hosting 12 meses",
      "Blog o noticias",
      "Posicionamiento local en Google",
      "Perfil de Google Maps configurado",
      "Estadísticas de visitas",
      "Catálogo con pedidos por WhatsApp",
      "Correo con tu dominio",
      "Rondas de revisión",
      "Entrega (días hábiles)",
    ]);
  });

  it("cada fila trae un valor por plan del sitio, y ninguna queda vacía en todos", () => {
    const planIds = [...ids(SITE_PLANS)].sort();
    for (const r of PLAN_COMPARISON) {
      expect(Object.keys(r.values).sort(), r.label).toEqual(planIds);
      expect(Object.values(r.values).some((value) => value !== false), r.label).toBe(true);
    }
  });

  it("Páginas: «1 (6 secciones)» en el Estándar y el Combo, «Hasta 8» en el Intermedio", () => {
    expect(row("Páginas").values).toEqual({
      estandar: "1 (6 secciones)",
      intermedio: "Hasta 8",
      "combo-emprendedor": "1 (6 secciones)",
    });
  });

  it("el logo de LAU Graphic solo viene en el Combo; blog, Google y correo, solo en el Intermedio", () => {
    expect(row("Logo profesional (LAU Graphic)").values).toEqual({ estandar: false, intermedio: false, "combo-emprendedor": true });
    for (const label of [
      "Blog o noticias",
      "Posicionamiento local en Google",
      "Perfil de Google Maps configurado",
      "Estadísticas de visitas",
      "Catálogo con pedidos por WhatsApp",
      "Correo con tu dominio",
    ]) {
      expect(row(label).values, label).toEqual({ estandar: false, intermedio: true, "combo-emprendedor": false });
    }
  });

  it("las rondas y la entrega salen de revisionRounds y deliveryBusinessDays de cada plan", () => {
    expect(row("Rondas de revisión").values).toEqual(fromPlans((pkg) => String(pkg.revisionRounds)));
    expect(row("Entrega (días hábiles)").values).toEqual(fromPlans((pkg) => String(pkg.deliveryBusinessDays)));
    expect(row("Rondas de revisión").values).toEqual({ estandar: "2", intermedio: "3", "combo-emprendedor": "2" });
    expect(row("Entrega (días hábiles)").values).toEqual({ estandar: "10", intermedio: "15", "combo-emprendedor": "10" });
  });
});
