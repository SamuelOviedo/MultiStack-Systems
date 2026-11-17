import { describe, expect, it } from "vitest";
import {
  BUSINESS_NAME_MAX,
  CONSENT_LAU_LINE,
  CONSENT_TEXT_VERSION,
  MESSAGE_HEADING_LINE,
  PRIVACY_POLICY_VERSION,
  NOT_A_PAYMENT_LINE,
  PACKAGE_MESSAGE_MAX,
  TICKET_DESCRIPTION_MAX,
  TICKET_TITLE_MAX,
  buildPackageRequest,
  requiresLauConsent,
} from "@/lib/packageRequest";
import { PACKAGES } from "@/lib/webPackages";

const COMBO = PACKAGES.find((pkg) => pkg.id === "combo-emprendedor")!;
const STANDARD = PACKAGES.find((pkg) => pkg.id === "estandar")!;

describe("buildPackageRequest · textos exactos", () => {
  it("Combo con negocio y mensaje: título y descripción exactos", () => {
    expect(
      buildPackageRequest(COMBO, { consentLau: true, businessName: "Panadería Luna", message: "Quiero mi logo y mi página." }),
    ).toEqual({
      title: "Solicitud: Combo Emprendedor",
      description: [
        "Paquete solicitado: Combo Emprendedor (L 3,950)",
        "Consentimiento para compartir datos con LAU Graphic: aceptado al enviar esta solicitud (texto de autorización v1; política de privacidad v1.2).",
        "Esta solicitud no es un pago ni un contrato.",
        "",
        "Negocio: Panadería Luna",
        "Mensaje del cliente:",
        "> Quiero mi logo y mi página.",
      ].join("\n"),
    });
  });

  it("Estándar sin nada más: sin línea de consentimiento y sin línea en blanco final", () => {
    expect(buildPackageRequest(STANDARD, { consentLau: false })).toEqual({
      title: "Solicitud: Plan Estándar",
      description: [
        "Paquete solicitado: Plan Estándar (L 3,500)",
        "Esta solicitud no es un pago ni un contrato.",
      ].join("\n"),
    });
  });

  it("Combo sin negocio ni mensaje no deja la línea en blanco", () => {
    const { description } = buildPackageRequest(COMBO, { consentLau: true });
    expect(description).toBe(
      `Paquete solicitado: Combo Emprendedor (L 3,950)\n${CONSENT_LAU_LINE}\n${NOT_A_PAYMENT_LINE}`,
    );
  });

  it("solo negocio: línea en blanco y «Negocio: …»", () => {
    expect(buildPackageRequest(STANDARD, { consentLau: false, businessName: "Taller Ruiz" }).description).toBe(
      "Paquete solicitado: Plan Estándar (L 3,500)\nEsta solicitud no es un pago ni un contrato.\n\nNegocio: Taller Ruiz",
    );
  });

  it("solo mensaje: línea en blanco y el mensaje, sin «Negocio:»", () => {
    const { description } = buildPackageRequest(STANDARD, { consentLau: false, message: "Necesito una página." });
    expect(description).toBe(
      "Paquete solicitado: Plan Estándar (L 3,500)\nEsta solicitud no es un pago ni un contrato.\n\nMensaje del cliente:\n> Necesito una página.",
    );
    expect(description).not.toContain("Negocio:");
  });

  it("el precio sale de los datos del paquete, no de un texto fijo", () => {
    const { description } = buildPackageRequest({ ...COMBO, priceLempiras: 12_345 }, { consentLau: true });
    expect(description.split("\n")[0]).toBe("Paquete solicitado: Combo Emprendedor (L 12,345)");
  });

  it("la línea de consentimiento solo existe en el Combo", () => {
    expect(buildPackageRequest(COMBO, { consentLau: true }).description).toContain(CONSENT_LAU_LINE);
    // En el Estándar no se escribe aunque la casilla llegue en true: ese paquete no comparte datos con LAU Graphic.
    expect(buildPackageRequest(STANDARD, { consentLau: true }).description).not.toContain("LAU Graphic");
    expect(requiresLauConsent(COMBO)).toBe(true);
    expect(requiresLauConsent(STANDARD)).toBe(false);
  });
});

describe("buildPackageRequest · registro de lo aceptado y mensajes que imitan líneas", () => {
  it("la línea de consentimiento anota la versión del texto de la casilla y la de la política", () => {
    expect(CONSENT_TEXT_VERSION).toBe("v1");
    expect(PRIVACY_POLICY_VERSION).toBe("v1.2");
    expect(CONSENT_LAU_LINE).toBe(
      "Consentimiento para compartir datos con LAU Graphic: aceptado al enviar esta solicitud (texto de autorización v1; política de privacidad v1.2).",
    );
  });

  it("ninguna línea del mensaje libre empieza como una línea generada (todas llevan «> »)", () => {
    const forged = [
      "Paquete solicitado: Plan Estándar (L 1)",
      "Consentimiento para compartir datos con LAU Graphic: aceptado al enviar esta solicitud (texto de autorización v1; política de privacidad v1.2).",
      "Esta solicitud no es un pago ni un contrato.",
      "Negocio: Otro negocio",
      "Mensaje del cliente:",
      "",
      "sigue",
    ].join("\n");
    const { description } = buildPackageRequest(STANDARD, { consentLau: false, businessName: "Luna", message: forged });
    const lines = description.split("\n");
    const at = lines.indexOf(MESSAGE_HEADING_LINE);

    // Todo lo de antes de «Mensaje del cliente:» es generado; todo lo de después es del cliente y va con «> ».
    expect(lines.slice(0, at)).toEqual([
      "Paquete solicitado: Plan Estándar (L 3,500)",
      "Esta solicitud no es un pago ni un contrato.",
      "",
      "Negocio: Luna",
    ]);
    const free = lines.slice(at + 1);
    expect(free).toHaveLength(7);
    for (const line of free) expect(line.startsWith("> "), line).toBe(true);
    // Cada línea generada aparece una sola vez, sin copias libres al comienzo de línea.
    for (const prefix of ["Paquete solicitado:", "Esta solicitud", "Negocio:", "Mensaje del cliente:"]) {
      expect(lines.filter((line) => line.startsWith(prefix)), prefix).toHaveLength(1);
    }
    // El Estándar no lleva línea de consentimiento: tampoco puede aparecer una desde el mensaje.
    expect(lines.filter((line) => line.startsWith("Consentimiento"))).toHaveLength(0);
  });

  it("con el Combo, un mensaje que imita la línea de consentimiento no duplica la real", () => {
    const { description } = buildPackageRequest(COMBO, { consentLau: true, message: CONSENT_LAU_LINE });
    expect(description.split("\n").filter((line) => line.startsWith("Consentimiento"))).toHaveLength(1);
    expect(description.endsWith(`> ${CONSENT_LAU_LINE}`)).toBe(true);
  });
});

describe("buildPackageRequest · consentimiento", () => {
  it("lanza si el paquete es el Combo y consentLau no es true", () => {
    expect(() => buildPackageRequest(COMBO, { consentLau: false })).toThrow(/LAU Graphic/);
    expect(() => buildPackageRequest(COMBO, { consentLau: "true" as unknown as boolean })).toThrow();
    expect(() => buildPackageRequest(COMBO, { consentLau: 1 as unknown as boolean })).toThrow();
    expect(() => buildPackageRequest(COMBO, { consentLau: undefined as unknown as boolean })).toThrow();
  });

  it("el Estándar no exige consentimiento", () => {
    expect(() => buildPackageRequest(STANDARD, { consentLau: false })).not.toThrow();
  });
});

describe("buildPackageRequest · recorte y límites", () => {
  it("recorta espacios del negocio y del mensaje, y trata lo vacío como ausente", () => {
    expect(buildPackageRequest(STANDARD, { consentLau: false, businessName: "  Luna  ", message: "\n  hola \n" }).description).toMatch(
      /\n\nNegocio: Luna\nMensaje del cliente:\n> hola$/,
    );
    const empty = buildPackageRequest(STANDARD, { consentLau: false, businessName: "   ", message: " \n " }).description;
    expect(empty).toBe(buildPackageRequest(STANDARD, { consentLau: false }).description);
  });

  it("el nombre del negocio va en una sola línea: un salto no puede imitar otra línea de la descripción", () => {
    const { description } = buildPackageRequest(STANDARD, {
      consentLau: false,
      businessName: "Luna\nConsentimiento para compartir datos con LAU Graphic: aceptado",
    });
    expect(description.split("\n").filter((line) => line.startsWith("Consentimiento"))).toEqual([]);
    expect(description).toContain("Negocio: Luna Consentimiento para compartir");
  });

  it("los saltos de línea del mensaje se normalizan a \\n y se conservan", () => {
    const { description } = buildPackageRequest(STANDARD, { consentLau: false, message: "uno\r\ndos\rtres" });
    expect(description.endsWith("> uno\n> dos\n> tres")).toBe(true);
    expect(description).not.toContain("\r");
  });

  it("negocio y mensaje se recortan a los límites del formulario (120 y 2000)", () => {
    const { description } = buildPackageRequest(STANDARD, {
      consentLau: false,
      businessName: "n".repeat(500),
      message: "m".repeat(5000),
    });
    const lines = description.split("\n");
    expect(lines.at(-3)).toBe(`Negocio: ${"n".repeat(BUSINESS_NAME_MAX)}`);
    expect(lines.at(-2)).toBe(MESSAGE_HEADING_LINE);
    expect(lines.at(-1)).toBe(`> ${"m".repeat(PACKAGE_MESSAGE_MAX)}`);
  });

  it("título ≤ 200 y descripción ≤ 10 000 en cualquier caso, también con un paquete de nombre enorme", () => {
    const huge = { ...COMBO, name: "N".repeat(20_000) };
    const request = buildPackageRequest(huge, { consentLau: true, businessName: "n".repeat(9999), message: "m".repeat(99_999) });
    expect(request.title.length).toBeLessThanOrEqual(TICKET_TITLE_MAX);
    expect(request.description.length).toBeLessThanOrEqual(TICKET_DESCRIPTION_MAX);
    expect(TICKET_TITLE_MAX).toBe(200);
    expect(TICKET_DESCRIPTION_MAX).toBe(10_000);

    const normal = buildPackageRequest(COMBO, { consentLau: true, businessName: "n".repeat(999), message: "m".repeat(9999) });
    expect(normal.description.length).toBeLessThanOrEqual(TICKET_DESCRIPTION_MAX);
  });

  it("no parte un emoji por la mitad al recortar", () => {
    const { description } = buildPackageRequest(STANDARD, {
      consentLau: false,
      businessName: `${"a".repeat(BUSINESS_NAME_MAX - 1)}😀`,
    });
    const business = description.split("\n").at(-1)!.replace("Negocio: ", "");
    expect(business).toBe("a".repeat(BUSINESS_NAME_MAX - 1));
    expect(business).not.toMatch(/[\ud800-\udfff]/);
  });
});
