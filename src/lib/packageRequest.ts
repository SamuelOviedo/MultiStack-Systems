import { lempiras, type PaginasWebPackage } from "@/lib/webPackages";

/**
 * Solicitud de un paquete de página web, lista para `createSolicitud`: título y descripción de un ticket tipo
 * `solicitud`. Es una solicitud, no un pago ni un contrato. Función pura: sin red ni almacenamiento.
 */

/** Límites de la base de datos para `tickets.title` y `tickets.description`. */
export const TICKET_TITLE_MAX = 200;
export const TICKET_DESCRIPTION_MAX = 10_000;

/** Límites de los campos del formulario del paquete. */
export const BUSINESS_NAME_MAX = 120;
export const PACKAGE_MESSAGE_MAX = 2000;

/**
 * Versión del texto de la casilla de autorización y de la política de privacidad vigentes al aceptar: quedan
 * escritas en la solicitud para saber qué se aceptó. Al cambiar el texto de la casilla sube CONSENT_TEXT_VERSION;
 * al publicar otra versión de la política sube PRIVACY_POLICY_VERSION (una prueba la compara con la cabecera).
 */
export const CONSENT_TEXT_VERSION = "v1";
export const PRIVACY_POLICY_VERSION = "v1.2";

export const CONSENT_LAU_LINE = `Consentimiento para compartir datos con LAU Graphic: aceptado al enviar esta solicitud (texto de autorización ${CONSENT_TEXT_VERSION}; política de privacidad ${PRIVACY_POLICY_VERSION}).`;
export const MESSAGE_HEADING_LINE = "Mensaje del cliente:";
export const NOT_A_PAYMENT_LINE = "Esta solicitud no es un pago ni un contrato.";

/** Lo que usa esta función de un paquete: el id, el nombre y el precio. */
export type PackageRequestPackage = Pick<PaginasWebPackage, "id" | "name" | "priceLempiras">;

export interface PackageRequestInput {
  /** Casilla de autorización para compartir datos con LAU Graphic. Obligatoria (true) en el Combo. */
  readonly consentLau: boolean;
  readonly businessName?: string;
  readonly message?: string;
}

export interface PackageRequest {
  readonly title: string;
  readonly description: string;
}

/** El Combo incluye el diseño del logo por LAU Graphic: pide compartirle datos, y eso exige consentimiento. */
export const requiresLauConsent = (pkg: Pick<PaginasWebPackage, "id">): boolean => pkg.id === "combo-emprendedor";

/** Recorta a `max` unidades sin dejar a medias un par sustituto (emoji): la base cuenta caracteres, JS unidades UTF-16. */
function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const last = cut.charCodeAt(cut.length - 1);
  return last >= 0xd800 && last <= 0xdbff ? cut.slice(0, -1) : cut;
}

/**
 * Arma el título y la descripción exactos:
 *
 *   Paquete solicitado: <nombre> (L 3,950)
 *   Consentimiento para compartir datos con LAU Graphic: aceptado al enviar esta solicitud (texto de autorización
 *   v1; política de privacidad v1.2).                                                          (solo el Combo)
 *   Esta solicitud no es un pago ni un contrato.
 *
 *   Negocio: <nombre del negocio>   (si hay)
 *   Mensaje del cliente:            (si hay)
 *   > <cada línea del mensaje>
 *
 * Lanza un error si el paquete es el Combo y `consentLau` no es exactamente `true`. Lo que escribe el cliente no puede
 * imitar las líneas generadas: el nombre del negocio va en una sola línea y detrás de «Negocio: », y cada línea del
 * mensaje empieza con «> », así que ninguna línea libre empieza con «Paquete solicitado:», «Consentimiento…»,
 * «Esta solicitud…» ni «Negocio:».
 */
export function buildPackageRequest(pkg: PackageRequestPackage, input: PackageRequestInput): PackageRequest {
  const consentLau = input.consentLau === true;
  if (requiresLauConsent(pkg) && !consentLau) {
    throw new Error(`El ${pkg.name} requiere el consentimiento para compartir datos con LAU Graphic.`);
  }

  const businessName = clip((input.businessName ?? "").replace(/\s+/g, " ").trim(), BUSINESS_NAME_MAX).trim();
  const message = clip((input.message ?? "").replace(/\r\n?/g, "\n").trim(), PACKAGE_MESSAGE_MAX).trim();

  const lines = [
    `Paquete solicitado: ${pkg.name} (${lempiras(pkg.priceLempiras)})`,
    ...(requiresLauConsent(pkg) ? [CONSENT_LAU_LINE] : []),
    NOT_A_PAYMENT_LINE,
  ];
  const quoted = message.split("\n").map((line) => `> ${line}`);
  const details = [...(businessName ? [`Negocio: ${businessName}`] : []), ...(message ? [MESSAGE_HEADING_LINE, ...quoted] : [])];
  if (details.length > 0) lines.push("", ...details);

  return {
    title: clip(`Solicitud: ${pkg.name}`, TICKET_TITLE_MAX),
    description: clip(lines.join("\n"), TICKET_DESCRIPTION_MAX),
  };
}
