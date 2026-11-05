/**
 * Metadatos de cabecera por página, con restauración exacta al limpiar. Solo DOM: sin React.
 *
 * `index.html` trae el canonical y la description de la home. Una página que los reemplaza al montarse
 * debe devolverlos al desmontarse, no borrarlos: si no, tras visitarla por navegación SPA la home
 * pierde esas metas durante el resto de la sesión.
 *
 * Las rutas de `ROUTE_META` se sirven con su propio head estático (el build emite `<ruta>/index.html`):
 * en una entrada directa, lo «previo» al montar ya es el head de la ruta y restaurarlo dejaría en la
 * home el head de la landing. Para ese caso existe `restoreTo`.
 */

import type { RouteMeta } from "./routeMeta";

export interface PageMeta {
  title: string;
  description: string;
  canonical: string;
  /** Metas adicionales como `[atributo, clave, contenido]`, p. ej. `["property", "og:url", "https://…"]`. */
  extra?: ReadonlyArray<readonly ["name" | "property", string, string]>;
}

export interface ApplyPageMetaOptions {
  /**
   * A qué devolver el head al limpiar. Cada elemento que `meta` gestiona y que `restoreTo` cubre
   * (title, description, canonical, o la pareja [atributo, clave] en `extra`) vuelve a ESE valor y no
   * al que tenía al aplicar; si falta en el documento, se crea. Lo demás se restaura a su estado
   * previo, y lo que solo está en `restoreTo` no se toca.
   */
  readonly restoreTo?: PageMeta;
}

type Restore = () => void;

/** El valor si es un texto; cualquier otra cosa (undefined, null) cuenta como «no cubierto». */
const asText = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined);

/** Busca una meta por atributo y clave, sin armar selectores con texto externo. */
function findMeta(attr: "name" | "property", key: string): HTMLMetaElement | null {
  const metas = Array.from(document.querySelectorAll<HTMLMetaElement>("meta"));
  return metas.find((m) => m.getAttribute(attr) === key) ?? null;
}

function createMeta(attr: "name" | "property", key: string): HTMLMetaElement {
  const el = document.createElement("meta");
  el.setAttribute(attr, key);
  return el;
}

function createCanonicalLink(): HTMLLinkElement {
  const el = document.createElement("link");
  el.setAttribute("rel", "canonical");
  return el;
}

function setAttr(el: Element, attr: string, value: string): Restore {
  const previous = el.getAttribute(attr);
  el.setAttribute(attr, value);
  return () => {
    if (previous === null) el.removeAttribute(attr);
    else el.setAttribute(attr, previous);
  };
}

/**
 * Fija `attr` a `value` en el elemento que devuelve `find`, y lo crea al final del <head> si no
 * existe. Devuelve la función que restaura:
 * - sin `restoreValue`: el valor anterior, o la eliminación si lo creó esta llamada (nunca elimina un
 *   elemento que ya estaba en el documento).
 * - con `restoreValue`: ese valor, sin mirar el estado previo; busca el elemento de nuevo y lo crea si falta.
 */
function upsert(
  find: () => Element | null,
  create: () => Element,
  attr: "content" | "href",
  value: string,
  restoreValue?: string,
): Restore {
  const existing = find();
  let toPrevious: Restore;
  if (existing) {
    toPrevious = setAttr(existing, attr, value);
  } else {
    const created = create();
    created.setAttribute(attr, value);
    document.head.appendChild(created);
    toPrevious = () => created.remove();
  }
  if (restoreValue === undefined) return toPrevious;

  return () => {
    let target = find();
    if (!target) {
      target = create();
      document.head.appendChild(target);
    }
    target.setAttribute(attr, restoreValue);
  };
}

/** Valor de `restoreTo.extra` para la pareja [atributo, clave]; si se repite, gana la última, como al aplicar. */
function extraRestoreValue(
  restoreTo: PageMeta | undefined,
  attr: "name" | "property",
  key: string,
): string | undefined {
  let found: string | undefined;
  for (const [a, k, content] of restoreTo?.extra ?? []) {
    if (a === attr && k === key) found = asText(content);
  }
  return found;
}

/**
 * Aplica title, description, canonical y las metas de `extra`. Devuelve la función que restaura cada
 * elemento a su valor anterior (o lo elimina si lo creó esta llamada), salvo lo que cubra `options.restoreTo`.
 *
 * Segura con React StrictMode (efecto, cleanup, efecto) y con llamadas anidadas; las solapadas deben
 * limpiarse en orden inverso al de aplicación. Llamar dos veces a la función devuelta no hace nada la
 * segunda vez. Sin `document` (SSR) no hace nada.
 */
export function applyPageMeta(meta: PageMeta, options: ApplyPageMetaOptions = {}): () => void {
  if (typeof document === "undefined" || !document.head) return () => undefined;

  const restoreTo = options?.restoreTo;
  const restores: Restore[] = [];

  // `document.title` crea el <title> si falta, así que se anota si ya existía.
  const hadTitle = document.head.querySelector("title") !== null;
  const previousTitle = document.title;
  const titleDestination = asText(restoreTo?.title);
  document.title = meta.title;
  restores.push(() => {
    if (titleDestination !== undefined) document.title = titleDestination;
    else if (hadTitle) document.title = previousTitle;
    else document.head.querySelector("title")?.remove();
  });

  restores.push(
    upsert(
      () => findMeta("name", "description"),
      () => createMeta("name", "description"),
      "content",
      meta.description,
      asText(restoreTo?.description),
    ),
  );

  restores.push(
    upsert(
      () => document.querySelector('link[rel="canonical"]'),
      createCanonicalLink,
      "href",
      meta.canonical,
      asText(restoreTo?.canonical),
    ),
  );

  for (const [attr, key, content] of meta.extra ?? []) {
    restores.push(
      upsert(
        () => findMeta(attr, key),
        () => createMeta(attr, key),
        "content",
        content,
        extraRestoreValue(restoreTo, attr, key),
      ),
    );
  }

  return () => {
    // Orden inverso al de aplicación; al vaciar la lista, una segunda llamada no restaura nada.
    let restore = restores.pop();
    while (restore) {
      restore();
      restore = restores.pop();
    }
  };
}

/**
 * Un `RouteMeta` como `PageMeta`, con las nueve metas de Open Graph y Twitter que el build escribe en
 * el HTML estático de la ruta (la misma lista que `withRouteHead` en routeHead.ts).
 */
export function routeMetaToPageMeta(m: RouteMeta): PageMeta {
  return {
    title: m.title,
    description: m.description,
    canonical: m.canonical,
    extra: [
      ["property", "og:title", m.ogTitle],
      ["property", "og:description", m.ogDescription],
      ["property", "og:url", m.ogUrl],
      ["property", "og:image", m.ogImage],
      ["property", "og:image:alt", m.ogImageAlt],
      ["name", "twitter:title", m.ogTitle],
      ["name", "twitter:description", m.ogDescription],
      ["name", "twitter:image", m.ogImage],
      ["name", "twitter:image:alt", m.ogImageAlt],
    ],
  };
}
