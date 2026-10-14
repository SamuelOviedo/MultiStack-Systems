import { describe, expect, it } from "vitest";
import { PRODUCTS, getProduct, getTechonHref, isExternalHref } from "@/lib/products";

describe("products config", () => {
  it("expone 4 productos sin URLs inventadas", () => {
    expect(PRODUCTS).toHaveLength(4);
    expect(PRODUCTS.map((p) => p.slug)).toEqual(["techon", "licensing", "development", "whatsapp"]);
  });

  it("licensing no tiene href hasta existir plataforma", () => {
    expect(getProduct("licensing").href).toBeUndefined();
    expect(getProduct("licensing").status).toBe("soon");
  });

  it("whatsapp queda en desarrollo sin CTA", () => {
    const w = getProduct("whatsapp");
    expect(w.status).toBe("dev");
    expect(w.href).toBeUndefined();
    expect(w.ctaLabel).toBeUndefined();
  });

  it("techon redirige a /login sin env", () => {
    expect(getTechonHref()).toBe("/login");
  });

  it("detecta href externo", () => {
    expect(isExternalHref("https://techon.example.com")).toBe(true);
    expect(isExternalHref("/login")).toBe(false);
    expect(isExternalHref("#contacto")).toBe(false);
  });
});
