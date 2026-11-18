import { describe, expect, it } from "vitest";

import { PAYMENT_TERMS, SITE_PLANS, type PaginasWebPackage } from "@/lib/webPackages";
import { CHANNELS, COMMITMENTS, type Channels, type Commitments } from "@/pages/marketing/paginasWebContent";
import { buildSiteContent, SITE_CONTENT, type PaymentTerms } from "@/pages/marketing/siteContent";

// Todo número del texto del sitio sale de una constante (precios, meses de dominio y hosting, días de entrega, horas de
// respuesta, teléfono y porcentajes de pago). Se construye el contenido con otros valores y no debe quedar ninguno de los
// de siempre: si alguien teclea «12 meses» o «50%» en siteContent.ts, esta prueba lo encuentra.

/** Valores que no se parecen a ninguno de los reales ni a los números fijos del texto (versiones del stack, «01»..«04», «#0142», «4 p. m.»). */
const COMMITMENTS_OTHER: Commitments = {
  maxSections: 9,
  revisionRounds: 5,
  deliveryBusinessDays: 14,
  responseBusinessHours: 36,
  domainHostingMonths: 18,
};
const CHANNELS_OTHER: Channels = {
  whatsappUrl: "https://wa.me/50499887766",
  phoneDisplay: "+504 9988-7766",
  phoneHref: "tel:+50499887766",
  instagramUrl: CHANNELS.instagramUrl,
  facebookUrl: CHANNELS.facebookUrl,
  location: CHANNELS.location,
};
const PAYMENT_OTHER: PaymentTerms = { upfrontPercent: 30, onDeliveryPercent: 70 };

const PRICES_OTHER: Record<PaginasWebPackage["id"], number> = {
  estandar: 4100,
  intermedio: 8200,
  "combo-emprendedor": 4650,
};
const PLANS_OTHER: readonly PaginasWebPackage[] = SITE_PLANS.map((plan) => ({
  ...plan,
  priceLempiras: PRICES_OTHER[plan.id],
  deliveryBusinessDays: 9,
}));

const build = (overrides: { commitments?: Commitments; plans?: readonly PaginasWebPackage[]; channels?: Channels; payment?: PaymentTerms } = {}) =>
  buildSiteContent(
    overrides.commitments ?? COMMITMENTS_OTHER,
    overrides.plans ?? PLANS_OTHER,
    overrides.channels ?? CHANNELS_OTHER,
    overrides.payment ?? PAYMENT_OTHER,
  );

/** Todos los textos de un valor, también los que se calculan con una función (pie, tarjeta de plan). */
function collectStrings(value: unknown, into: string[] = []): string[] {
  if (typeof value === "string") into.push(value);
  else if (Array.isArray(value)) for (const item of value) collectStrings(item, into);
  else if (value && typeof value === "object") for (const item of Object.values(value)) collectStrings(item, into);
  return into;
}

function allText(content: ReturnType<typeof build>): string {
  const strings = collectStrings(content);
  // Las funciones: se llaman con valores de ejemplo y su resultado también cuenta.
  strings.push(content.footer.copyright(2031));
  for (const plan of PLANS_OTHER) {
    strings.push(content.planCard.requestLabel(plan.name), content.planCard.deliveryLine(plan.deliveryBusinessDays));
  }
  return strings.join("\n");
}

/** Los números reales que no deben quedar: precios (con y sin coma), meses, días, horas, porcentaje y teléfono. */
const OLD_NUMBERS = [
  ...SITE_PLANS.flatMap((plan) => [plan.priceLempiras.toLocaleString("en-US"), String(plan.priceLempiras)]),
  String(COMMITMENTS.domainHostingMonths),
  String(COMMITMENTS.deliveryBusinessDays),
  String(COMMITMENTS.responseBusinessHours),
  String(PAYMENT_TERMS.upfrontPercent),
  String(PAYMENT_TERMS.onDeliveryPercent),
  "3302",
  "3042",
  "50433023042",
];

/** Un número suelto: sin otra cifra, coma o punto pegados («12» no es «2012», «1,2» ni «#0142»). */
const standalone = (n: string) => new RegExp(`(?<![\\d.,#:-])${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\d])`);

const found = (text: string) => OLD_NUMBERS.filter((n) => standalone(n).test(text));

describe("buildSiteContent: ningún número escrito a mano", () => {
  it("control: el escáner sí encuentra los números reales en el contenido real (no pasa en vacío)", () => {
    const real = found(allText(SITE_CONTENT));
    for (const expected of ["3,500", "12", "10", "24", "50", "3302"]) {
      expect(real, expected).toContain(expected);
    }
  });

  it("el contenido con los valores reales es el de SITE_CONTENT", () => {
    const real = buildSiteContent(COMMITMENTS, SITE_PLANS, CHANNELS, PAYMENT_TERMS);
    expect(JSON.stringify(real)).toBe(JSON.stringify(SITE_CONTENT));
    expect(allText(real)).toBe(allText(SITE_CONTENT));
  });

  it("con otros precios, meses, días, horas, teléfono y porcentajes no queda ninguno de los anteriores", () => {
    expect(found(allText(build()))).toEqual([]);
  });
});

describe("buildSiteContent: cada valor nuevo aparece donde corresponde", () => {
  const content = build();

  it("hero: el «desde» (y su lectura en voz alta), los meses y los días", () => {
    const [from, months, days] = content.hero.facts;
    expect(from).toMatchObject({ value: "L 4,100", valueSpoken: "4100 lempiras", label: "desde" });
    expect(months).toMatchObject({ value: "18 meses", label: "dominio y hosting" });
    expect(days).toMatchObject({ value: "14 días", label: "hábiles de entrega" });
  });

  it("el «desde» es el plan más barato aunque los planes no vengan ordenados por precio", () => {
    const reversed = build({ plans: [...PLANS_OTHER].reverse() });
    expect(reversed.hero.facts[0]).toMatchObject({ value: "L 4,100" });
    expect(reversed.servicesView.items[0]).toMatchObject({ price: "Desde L 4,100" });
  });

  it("planes de la home, terminal y pie: meses de dominio y hosting", () => {
    expect(content.homePlans.text).toContain("18 meses");
    expect(content.bento.terminal.lines.map((line) => line.text)).toContain("Dominio y hosting por 18 meses");
  });

  it("porqué: las horas de respuesta; pasos y seguimiento: los dos porcentajes", () => {
    expect(content.why.reasons.find((reason) => reason.icon === "users")?.text).toBe("Respondemos en menos de 36 h hábiles.");
    expect(content.why.steps[1]?.title).toBe("Pagas el 30% y envías material");
    expect(content.why.steps[3]?.title).toBe("Revisión, 70% final y en línea");
    expect(content.tracker.payments.map((payment) => payment.value)).toEqual(["30%", "70%"]);
    expect(content.tracker.phases.map((phase) => phase.name)).toContain("Pago 30%");
    expect(content.tracker.phases.find((phase) => phase.name === "Pago 30%")?.text).toBe("Pagas el 30% del proyecto para arrancar.");
    expect(content.tracker.phases.find((phase) => phase.name === "Pago final")?.text).toBe("Pagas el 70% restante al aprobar la entrega.");
  });

  it("tarjeta de plan: la línea de entrega usa los días de ese plan y los dos porcentajes", () => {
    expect(content.planCard.deliveryLine(9)).toBe("entrega: 9 días hábiles · 30% al iniciar, 70% al entregar");
    expect(content.planCard.deliveryLine(1)).toBe("entrega: 1 día hábil · 30% al iniciar, 70% al entregar");
    expect(content.planCard.requestLabel("Plan Intermedio")).toBe("Solicitar Intermedio");
  });

  it("contacto: horas de respuesta, teléfono y WhatsApp de CHANNELS en la vista, el pie y los enlaces prellenados", () => {
    expect(content.contactView.intro).toContain("menos de 36 horas hábiles");
    expect(content.contactView.phone).toEqual({ label: "Llama al +504 9988-7766", href: "tel:+50499887766" });
    expect(content.contactView.whatsapp.href).toBe("https://wa.me/50499887766");
    expect(content.footer.phone).toEqual({ label: "+504 9988-7766", href: "tel:+50499887766" });
    expect(content.footer.whatsapp.href).toBe("https://wa.me/50499887766");
    expect(content.hero.secondaryCta.href).toMatch(/^https:\/\/wa\.me\/50499887766\?text=/);
    for (const item of content.servicesView.items) {
      expect(item.cta.href, item.id).toMatch(/^https:\/\/wa\.me\/50499887766\?text=/);
    }
  });

  it("metas: precios, teléfono y horas siguen a los datos nuevos", () => {
    expect(content.meta.home.description).toContain("L 4,100");
    expect(content.meta.planes.description).toContain("Plan Intermedio L 8,200");
    expect(content.meta.contacto.description).toContain("+504 9988-7766");
    expect(content.meta.contacto.ogDescription).toContain("36 horas hábiles");
  });

  it("el plan del terminal es el destacado y, si no hay, el primero", () => {
    const line = (c: ReturnType<typeof build>) => c.bento.terminal.lines[0]?.text;
    expect(line(content)).toBe("multistack nuevo --plan intermedio");
    expect(line(build({ plans: PLANS_OTHER.map((plan) => ({ ...plan, highlight: plan.id === "combo-emprendedor" })) }))).toBe(
      "multistack nuevo --plan combo-emprendedor",
    );
    expect(line(build({ plans: PLANS_OTHER.map((plan) => ({ ...plan, highlight: false })) }))).toBe("multistack nuevo --plan estandar");
  });
});

describe("buildSiteContent: singular y plural", () => {
  const one: Commitments = { ...COMMITMENTS_OTHER, domainHostingMonths: 1, deliveryBusinessDays: 1, responseBusinessHours: 1 };
  const content = build({ commitments: one });

  it("1 mes, 1 día hábil y 1 hora hábil", () => {
    expect(content.hero.facts[1]?.value).toBe("1 mes");
    expect(content.hero.facts[2]).toMatchObject({ value: "1 día", label: "hábil de entrega" });
    expect(content.homePlans.text).toContain("por 1 mes incluidos");
    expect(content.contactView.intro).toContain("menos de 1 hora hábil.");
    expect(content.why.reasons.find((reason) => reason.icon === "users")?.text).toBe("Respondemos en menos de 1 h hábil.");
  });
});
