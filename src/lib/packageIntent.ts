import { PACKAGES, type PaginasWebPackage } from "@/lib/webPackages";

/**
 * Intención de paquete: qué paquete de página web quiso solicitar la persona antes de llegar al flujo de
 * solicitudes (que puede pasar por login o registro). El enlace lleva `?paquete=<id>`, pero la URL solo basta si ya
 * hay sesión; sin sesión, ProtectedRoute manda a /login sin ella y lo que sobrevive al login es lo guardado en
 * localStorage durante 24 horas. Solo se guarda el id del paquete y su caducidad: nada personal.
 */

export type PackageIntentId = PaginasWebPackage["id"];

/** Clave de localStorage. */
export const PACKAGE_INTENT_KEY = "ms.paquete-solicitado";

/** Parámetro de la URL: `/solicitudes?paquete=combo-emprendedor`. */
export const PACKAGE_INTENT_PARAM = "paquete";

/** La intención caduca a las 24 horas. */
export const PACKAGE_INTENT_TTL_MS = 24 * 60 * 60 * 1000;

/** Lista blanca: solo los ids de PACKAGES. Cualquier otro valor (de la URL o del almacenamiento) se ignora. */
export function isPackageId(value: unknown): value is PackageIntentId {
  return typeof value === "string" && PACKAGES.some((pkg) => pkg.id === value);
}

/** Destino del flujo de solicitudes para un paquete: `/solicitudes?paquete=<id>`. */
export const packageRequestPath = (id: PackageIntentId): string =>
  `/solicitudes?${PACKAGE_INTENT_PARAM}=${encodeURIComponent(id)}`;

/** localStorage puede faltar o lanzar al leerlo (modo privado, políticas del navegador): entonces no hay almacenamiento. */
function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Guarda la intención por 24 horas. Si el id no es de un paquete o el almacenamiento falla, no hace nada. */
export function rememberPackageIntent(id: string, now: number = Date.now()): void {
  if (!isPackageId(id)) return;
  try {
    storage()?.setItem(PACKAGE_INTENT_KEY, JSON.stringify({ id, exp: now + PACKAGE_INTENT_TTL_MS }));
  } catch {
    // Sin almacenamiento la intención solo viaja en la URL: no es motivo para romper el clic.
  }
}

/** Borra la intención guardada (p. ej. cuando la solicitud ya se envió). */
export function clearPackageIntent(): void {
  try {
    storage()?.removeItem(PACKAGE_INTENT_KEY);
  } catch {
    // Nada que borrar si no hay almacenamiento.
  }
}

/**
 * Paquete pedido: primero `?paquete=<id>` de `search` (con o sin «?») y, si no trae un id válido, el guardado.
 * Lo guardado que caducó o que no tiene la forma esperada se borra del almacenamiento; no guarda nada nuevo
 * (la URL tampoco se guarda).
 */
export function readPackageIntent(search?: string, now: number = Date.now()): PackageIntentId | null {
  if (search) {
    const fromUrl = new URLSearchParams(search).get(PACKAGE_INTENT_PARAM);
    if (isPackageId(fromUrl)) return fromUrl;
  }

  try {
    const store = storage();
    const raw = store?.getItem(PACKAGE_INTENT_KEY);
    if (!store || raw == null) return null;

    let stored: unknown = null;
    try {
      stored = JSON.parse(raw);
    } catch {
      // Valor que no es JSON: se trata como inválido y se borra abajo.
    }
    const record = stored !== null && typeof stored === "object" ? (stored as { id?: unknown; exp?: unknown }) : null;
    // Una caducidad más lejana que el plazo máximo no la escribimos nosotros: se descarta como inválida.
    if (
      record &&
      isPackageId(record.id) &&
      typeof record.exp === "number" &&
      record.exp > now &&
      record.exp <= now + PACKAGE_INTENT_TTL_MS
    ) {
      return record.id;
    }

    store.removeItem(PACKAGE_INTENT_KEY);
  } catch {
    // Un almacenamiento que lanza equivale a no tener intención guardada.
  }
  return null;
}
