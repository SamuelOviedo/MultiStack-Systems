import { describe, expect, it } from "vitest";

import { getProduct } from "@/lib/products";
import {
  buildViewMetas,
  HOME_META,
  ROUTE_META,
  ROUTE_META_FACTS,
  type RouteMeta,
  type SiteView,
  type ViewMetaCopy,
  type ViewMetaFacts,
} from "@/lib/routeMeta";
import { lempiras, SITE_PLANS } from "@/lib/webPackages";
import { CHANNELS, COMMITMENTS } from "@/pages/marketing/paginasWebContent";
import { SITE_CONTENT } from "@/pages/marketing/siteContent";

// Los textos de SEO de las cuatro vistas viven en routeMeta.ts (buildViewMetas) y se repiten en tres sitios: SITE_CONTENT.meta
// (lo que lee la página), ROUTE_META / HOME_META (lo que pone el plugin de build y lo que restaura el SPA) e index.html
// (la home, comparada en seo-files.test.ts). Aquí se prueba que no se separen entre sí ni de las fuentes de sus datos.

const copyOf = (meta: RouteMeta): ViewMetaCopy => ({
  title: meta.title,
  description: meta.description,
  ogTitle: meta.ogTitle,
  ogDescription: meta.ogDescription,
});

const FROM_ROUTE_META: Record<SiteView, RouteMeta> = {
  home: HOME_META,
  planes: ROUTE_META["/planes"],
  servicios: ROUTE_META["/servicios"],
  contacto: ROUTE_META["/contacto"],
};

describe("metas de las vistas: SITE_CONTENT.meta frente a ROUTE_META y HOME_META", () => {
  it.each(["home", "planes", "servicios", "contacto"] as const)("%s: título, descripción y og:* son idénticos", (view) => {
    expect(SITE_CONTENT.meta[view]).toEqual(copyOf(FROM_ROUTE_META[view]));
  });

  it("SITE_CONTENT.meta tiene exactamente las cuatro vistas", () => {
    expect(Object.keys(SITE_CONTENT.meta).sort()).toEqual(["contacto", "home", "planes", "servicios"]);
  });

  it("las tres rutas del sitio llevan su propio canonical y og:url (sin barra final) y la imagen social de la home", () => {
    for (const path of ["/planes", "/servicios", "/contacto"] as const) {
      const meta = ROUTE_META[path];
      expect(meta.canonical).toBe(`https://www.multistacksystems.com${path}`);
      expect(meta.ogUrl).toBe(meta.canonical);
      expect(meta.ogImage).toBe(HOME_META.ogImage);
      expect(meta.ogImageAlt).toBe(HOME_META.ogImageAlt);
    }
  });

  it("las metas de las cuatro vistas son distintas entre sí (ninguna hereda el título de otra)", () => {
    const titles = Object.values(SITE_CONTENT.meta).map((meta) => meta.title);
    const descriptions = Object.values(SITE_CONTENT.meta).map((meta) => meta.description);
    expect(new Set(titles).size).toBe(4);
    expect(new Set(descriptions).size).toBe(4);
  });

  it.each(["home", "planes", "servicios", "contacto"] as const)("%s: título de hasta 60 caracteres y descripción de hasta 155", (view) => {
    const meta = SITE_CONTENT.meta[view];
    expect(meta.title.length).toBeLessThanOrEqual(60);
    expect(meta.description.length).toBeLessThanOrEqual(155);
    expect(meta.title.length).toBeGreaterThan(0);
    expect(meta.description.length).toBeGreaterThan(0);
  });
});

describe("ROUTE_META_FACTS frente a las fuentes de cada dato", () => {
  it("el teléfono es el de CHANNELS", () => {
    expect(ROUTE_META_FACTS.phoneDisplay).toBe(CHANNELS.phoneDisplay);
  });

  it("las horas de respuesta son las de COMMITMENTS", () => {
    expect(ROUTE_META_FACTS.responseBusinessHours).toBe(COMMITMENTS.responseBusinessHours);
  });

  it("el nombre del producto de soporte es el de products.ts, con su grafía (TechOn)", () => {
    expect(ROUTE_META_FACTS.techonName).toBe(getProduct("techon").name);
    expect(ROUTE_META_FACTS.techonName).toBe("TechOn");
  });

  it("los planes son los de SITE_PLANS, en su orden", () => {
    expect(ROUTE_META_FACTS.plans.map((plan) => [plan.name, plan.priceLempiras])).toEqual(
      SITE_PLANS.map((plan) => [plan.name, plan.priceLempiras]),
    );
  });

  it("las metas que lee la página salen de esos mismos datos: reconstruirlas con las fuentes da lo mismo", () => {
    const rebuilt = buildViewMetas({
      plans: SITE_PLANS,
      techonName: getProduct("techon").name,
      phoneDisplay: CHANNELS.phoneDisplay,
      responseBusinessHours: COMMITMENTS.responseBusinessHours,
    });
    expect(SITE_CONTENT.meta).toEqual(rebuilt);
  });
});

describe("los datos llegan al texto de las metas", () => {
  const lowest = lempiras(Math.min(...SITE_PLANS.map((plan) => plan.priceLempiras)));

  it("home: el «desde» es el precio del plan más barato, en la descripción y en el og:description", () => {
    expect(SITE_CONTENT.meta.home.description).toContain(lowest);
    expect(SITE_CONTENT.meta.home.ogDescription).toContain(lowest);
  });

  it("planes: la descripción nombra cada plan con su precio; el og:description, el «desde»", () => {
    for (const plan of SITE_PLANS) {
      expect(SITE_CONTENT.meta.planes.description).toContain(`${plan.name} ${lempiras(plan.priceLempiras)}`);
    }
    expect(SITE_CONTENT.meta.planes.ogDescription).toContain(lowest);
  });

  it("servicios: la descripción escribe TechOn con la grafía del producto", () => {
    expect(SITE_CONTENT.meta.servicios.description).toContain("TechOn");
    expect(SITE_CONTENT.meta.servicios.description).not.toMatch(/Techon/);
  });

  it("contacto: el teléfono de CHANNELS y las horas hábiles de COMMITMENTS", () => {
    expect(SITE_CONTENT.meta.contacto.description).toContain(CHANNELS.phoneDisplay);
    expect(SITE_CONTENT.meta.contacto.ogDescription).toContain(
      `${COMMITMENTS.responseBusinessHours} horas hábiles`,
    );
  });
});

describe("buildViewMetas no escribe ningún dato a mano", () => {
  // Valores que no se parecen a ninguno de los reales ni entre sí.
  const OTHER: ViewMetaFacts = {
    plans: [
      { name: "Plan Alfa", priceLempiras: 4100 },
      { name: "Plan Beta", priceLempiras: 8200 },
      { name: "Plan Gamma", priceLempiras: 4650 },
    ],
    techonName: "SoporteX",
    phoneDisplay: "+504 9988-7766",
    responseBusinessHours: 36,
  };

  it("con otros precios, teléfono, horas y producto, el texto sigue a los datos y no queda ninguno de los reales", () => {
    const metas = buildViewMetas(OTHER);
    const all = JSON.stringify(metas);

    expect(metas.home.description).toContain("L 4,100");
    expect(metas.planes.description).toContain("Plan Alfa L 4,100, Plan Beta L 8,200 y Plan Gamma L 4,650");
    expect(metas.planes.ogDescription).toContain("L 4,100");
    expect(metas.servicios.description).toContain("SoporteX");
    expect(metas.contacto.description).toContain("+504 9988-7766");
    expect(metas.contacto.ogDescription).toContain("36 horas hábiles");

    for (const plan of ROUTE_META_FACTS.plans) {
      expect(all).not.toContain(lempiras(plan.priceLempiras));
      expect(all).not.toContain(plan.name);
    }
    expect(all).not.toContain(ROUTE_META_FACTS.phoneDisplay);
    expect(all).not.toContain(ROUTE_META_FACTS.techonName);
    expect(all).not.toMatch(/\b24 horas/);
  });

  it("el «desde» es el más bajo aunque los planes no vengan ordenados por precio", () => {
    const metas = buildViewMetas({ ...OTHER, plans: [...OTHER.plans].reverse() });
    expect(metas.home.description).toContain("L 4,100");
    expect(metas.home.description).not.toContain("L 8,200");
  });

  it("con una sola hora hábil usa el singular", () => {
    const metas = buildViewMetas({ ...OTHER, responseBusinessHours: 1 });
    expect(metas.contacto.ogDescription).toContain("1 hora hábil");
    expect(metas.contacto.ogDescription).not.toContain("horas");
  });
});
