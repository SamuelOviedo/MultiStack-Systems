/**
 * Cabecera HTML propia por ruta, para el HTML estático.
 *
 * Vite emite un solo `index.html` (el de la home) y Vercel lo sirve para cualquier ruta del SPA (rewrite
 * `/(.*)` -> `/index.html`). Los rastreadores sin JavaScript, el bot de calidad de Google Ads y las vistas
 * previas de WhatsApp y Facebook solo ven ese HTML: las metas y el canonical de la home. `withRouteHead`
 * parte de él y devuelve el de otra ruta con su propio title, description, canonical, Open Graph y Twitter.
 * El plugin de build (`build/routeHeadPlugin.ts`) lo emite como `<ruta>/index.html`, que Vercel sirve
 * antes de aplicar el rewrite.
 *
 * Módulo puro: sin DOM, React, `import.meta`, dependencias ni alias `@/` (solo un `import type` relativo),
 * porque lo importa el plugin de build, que corre en Node.
 */

import type { RouteMeta } from "./routeMeta";

/** Un atributo de una etiqueta, con la posición exacta de su valor para poder reescribirlo. */
interface Attr {
  /** Nombre en minúsculas. */
  readonly name: string;
  /** Valor literal (sin comillas ni decodificar entidades); `undefined` si el atributo no lleva `=`. */
  readonly value: string | undefined;
  /** Posición del valor en el HTML, sin comillas: [valueStart, valueEnd). Sin sentido si `value` es `undefined`. */
  readonly valueStart: number;
  readonly valueEnd: number;
  /** Comilla que envuelve el valor; vacía si no lleva. */
  readonly quote: '"' | "'" | "";
}

/** Etiqueta de apertura de `<title>`, `<meta>` o `<link>` leída del HTML. */
interface Tag {
  readonly name: "title" | "meta" | "link";
  /** Posición del `<` y posición siguiente al `>`: [start, end). */
  readonly start: number;
  readonly end: number;
  readonly attrs: readonly Attr[];
  /** Solo `<title>`: el texto entre `>` y `</title>`, [textStart, textEnd). En las demás etiquetas, -1. */
  readonly textStart: number;
  readonly textEnd: number;
}

/** Cambio sobre el HTML original: sustituye [start, end) por `text` (vacío = borrar). */
interface Edit {
  start: number;
  end: number;
  text: string;
}

/** Metas que se reescriben (atributo `content`): de dónde se leen y qué campo de `RouteMeta` llevan. */
const META_TARGETS: ReadonlyArray<{ attr: "name" | "property"; key: string; field: keyof RouteMeta }> = [
  { attr: "name", key: "description", field: "description" },
  { attr: "property", key: "og:title", field: "ogTitle" },
  { attr: "property", key: "og:description", field: "ogDescription" },
  { attr: "property", key: "og:url", field: "ogUrl" },
  { attr: "property", key: "og:image", field: "ogImage" },
  { attr: "property", key: "og:image:alt", field: "ogImageAlt" },
  { attr: "name", key: "twitter:title", field: "ogTitle" },
  { attr: "name", key: "twitter:description", field: "ogDescription" },
  { attr: "name", key: "twitter:image", field: "ogImage" },
  { attr: "name", key: "twitter:image:alt", field: "ogImageAlt" },
];

const META_FIELDS: ReadonlyArray<keyof RouteMeta> = [
  "title",
  "description",
  "canonical",
  "ogTitle",
  "ogDescription",
  "ogUrl",
  "ogImage",
  "ogImageAlt",
];

/** Elementos cuyo contenido es texto, no marcado: lo que haya dentro no son etiquetas. */
const TEXT_ELEMENTS = ["script", "style", "title", "textarea"];

/**
 * Devuelve `html` (el `index.html` de la home) con la cabecera de `meta`. Es pura: no modifica la entrada.
 * Reemplaza title, description, canonical y las metas Open Graph y Twitter de `META_TARGETS`, y elimina
 * `<meta name="keywords">` (sería la de la home; es opcional). Todo lo demás queda igual, carácter por
 * carácter. Los valores nuevos se escapan y se insertan con corte y empalme, no con `String.replace`,
 * así que un `$&` o `$$` en un texto se conserva.
 *
 * Lanza un `Error` que lista todo lo que falla, para que el build falle a gritos y no emita una cabecera
 * a medias: una etiqueta objetivo que no está exactamente una vez, sin un solo `content` o `href` con valor
 * o con el atributo equivocado (`<meta name="og:title">`); un campo de `meta` que no es un texto no vacío
 * (se nombra como `meta.<campo>`); un `<title>` sin cierre; dos reemplazos sobre la misma parte.
 *
 * Tolera lo que Vite puede reescribir (orden y capitalización de atributos, comillas dobles, simples o
 * ninguna, `rel` como lista, `>` o saltos de línea dentro de un valor, `/>`). Lo escrito dentro de
 * comentarios, `<script>` o `<style>` (el JSON-LD) no cuenta.
 */
export function withRouteHead(html: string, meta: RouteMeta): string {
  const problems: string[] = [];

  // Los campos se validan primero; desde aquí `meta` solo se lee con `metaText`.
  for (const field of META_FIELDS) {
    if (metaText(meta, field) === "") problems.push(`meta.${field}: debe ser un texto no vacío.`);
  }

  const tags = scanTags(html);
  const edits: Edit[] = [];

  /** Exige exactamente una etiqueta; si no, anota el problema y devuelve `undefined`. */
  const one = (found: readonly Tag[], label: string): Tag | undefined => {
    if (found.length === 1) return found[0];
    problems.push(`${label}: se esperaba exactamente una y hay ${found.length}.`);
    return undefined;
  };

  /** Edición del valor de `attr` (`content` o `href`); exige uno solo con valor. */
  const setValue = (tag: Tag | undefined, attr: "content" | "href", label: string, text: string) => {
    if (!tag) return;
    const withValue = tag.attrs.filter((a) => a.name === attr && a.value !== undefined);
    if (withValue.length !== 1) {
      problems.push(`${label}: debe llevar exactamente un atributo ${attr} con valor y lleva ${withValue.length}.`);
      return;
    }
    const { valueStart, valueEnd, quote } = withValue[0];
    const escaped = escapeHtml(text);
    edits.push({ start: valueStart, end: valueEnd, text: quote ? escaped : `"${escaped}"` });
  };

  /**
   * Anota las metas de `key` escritas con el atributo que no es: no se ignoran, porque si alguien añade
   * `<meta name="og:title">` a la home, la ruta heredaría su valor sin aviso.
   */
  const wrongAttribute = (attr: "name" | "property", key: string, label: string) => {
    const found = attr === "name" ? "property" : "name";
    const wrong = metaTags(tags, found, key);
    if (wrong.length === 0) return;
    problems.push(`${label}: la clave "${key}" se escribe con ${attr}=, pero hay ${wrong.length} con ${found}=.`);
  };

  const title = one(
    tags.filter((t) => t.name === "title"),
    "<title>",
  );
  if (title) edits.push({ start: title.textStart, end: title.textEnd, text: escapeHtml(metaText(meta, "title")) });

  for (const { attr, key, field } of META_TARGETS) {
    const label = `<meta ${attr}="${key}">`;
    setValue(one(metaTags(tags, attr, key), label), "content", label, metaText(meta, field));
    wrongAttribute(attr, key, label);
  }

  const canonicalLabel = '<link rel="canonical">';
  setValue(one(canonicalLinks(tags), canonicalLabel), "href", canonicalLabel, metaText(meta, "canonical"));

  // keywords es opcional: no exigirla evita que el build falle el día que la home la quite.
  const keywordsLabel = '<meta name="keywords">';
  const keywords = metaTags(tags, "name", "keywords");
  if (keywords.length > 1) {
    problems.push(`${keywordsLabel}: se esperaba como máximo una y hay ${keywords.length}.`);
  } else if (keywords.length === 1) {
    const [start, end] = wholeLineIfAlone(html, keywords[0].start, keywords[0].end);
    edits.push({ start, end, text: "" });
  }
  wrongAttribute("name", "keywords", keywordsLabel);

  if (problems.length > 0) {
    throw new Error(`withRouteHead: el HTML o las metas no tienen la forma esperada.\n- ${problems.join("\n- ")}`);
  }

  // De atrás hacia adelante, para que cada corte no desplace las posiciones de los que faltan.
  edits.sort((a, b) => b.start - a.start);
  for (let i = 1; i < edits.length; i++) {
    if (edits[i].end > edits[i - 1].start) {
      throw new Error("withRouteHead: dos reemplazos caen sobre la misma parte del HTML (¿una etiqueta cuenta para dos metas?).");
    }
  }

  let out = html;
  for (const { start, end, text } of edits) {
    out = out.slice(0, start) + text + out.slice(end);
  }
  return out;
}

/**
 * Texto de un campo de `meta`, o "" si no es un texto no vacío (undefined, null, un número, "" o solo
 * espacios). Es la única lectura de `meta`, así que `escapeHtml` nunca recibe otra cosa; `withRouteHead`
 * anota el campo como problema y lanza al final.
 */
function metaText(meta: RouteMeta, field: keyof RouteMeta): string {
  const value: unknown = meta[field];
  return typeof value === "string" && value.trim() !== "" ? value : "";
}

/** Escapa un texto para usarlo como contenido de elemento o como valor de atributo entre comillas. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** `<meta {attr}="clave">`, sin distinguir mayúsculas ni espacios alrededor de la clave. */
function metaTags(tags: readonly Tag[], attr: "name" | "property", key: string): Tag[] {
  return tags.filter(
    (t) =>
      t.name === "meta" &&
      t.attrs.some((a) => a.name === attr && a.value !== undefined && a.value.trim().toLowerCase() === key),
  );
}

/** `<link rel="canonical">`; `rel` es una lista de palabras, así que basta con que la incluya. */
function canonicalLinks(tags: readonly Tag[]): Tag[] {
  return tags.filter(
    (t) =>
      t.name === "link" &&
      t.attrs.some(
        (a) => a.name === "rel" && a.value !== undefined && a.value.toLowerCase().split(/\s+/).includes("canonical"),
      ),
  );
}

/**
 * Rango que se borra al quitar una etiqueta: si está sola en su línea (solo espacios o tabuladores
 * alrededor), la línea entera con su salto; si comparte línea con otro marcado, solo la etiqueta.
 */
function wholeLineIfAlone(html: string, start: number, end: number): [number, number] {
  let from = start;
  while (from > 0 && (html[from - 1] === " " || html[from - 1] === "\t")) from--;
  if (from > 0 && html[from - 1] !== "\n") return [start, end];

  let to = end;
  while (to < html.length && (html[to] === " " || html[to] === "\t")) to++;
  if (html.startsWith("\r\n", to)) return [from, to + 2];
  if (html[to] === "\n") return [from, to + 1];
  if (to >= html.length) return [from, to];
  return [start, end];
}

/**
 * Recorre el HTML una sola vez, en orden, y devuelve las etiquetas `<title>`, `<meta>` y `<link>`.
 * Salta los comentarios y el contenido de `<script>`, `<style>`, `<title>` y `<textarea>`, y lee cada
 * etiqueta respetando las comillas (un `>` dentro de un valor no la corta).
 */
function scanTags(html: string): Tag[] {
  const openTag = /<([a-z][^\s/>]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/iy;
  const tags: Tag[] = [];
  let pos = 0;

  while (pos < html.length) {
    const lt = html.indexOf("<", pos);
    if (lt === -1) break;

    if (html.startsWith("<!--", lt)) {
      const close = html.indexOf("-->", lt + 4);
      if (close === -1) break; // comentario sin cierre: todo lo que sigue es comentario
      pos = close + 3;
      continue;
    }

    openTag.lastIndex = lt;
    const open = openTag.exec(html);
    if (!open) {
      pos = lt + 1; // `<!doctype`, `</head>` o un `<` suelto
      continue;
    }

    const name = open[1].toLowerCase();
    const end = lt + open[0].length;
    pos = end;

    let textStart = -1;
    let textEnd = -1;
    if (TEXT_ELEMENTS.includes(name)) {
      const closing = new RegExp(`</${name}(?=[\\s/>])`, "gi");
      closing.lastIndex = end;
      const close = closing.exec(html);
      if (name === "title") {
        if (!close) throw new Error("withRouteHead: <title> no tiene </title> de cierre.");
        textStart = end;
        textEnd = close.index;
      }
      const gt = close ? html.indexOf(">", close.index) : -1;
      pos = gt === -1 ? html.length : gt + 1;
    }

    if (name === "title" || name === "meta" || name === "link") {
      tags.push({ name, start: lt, end, attrs: readAttrs(open[2], lt + 1 + open[1].length), textStart, textEnd });
    }
  }

  return tags;
}

/** Atributos de una etiqueta. `source` es el texto entre el nombre y el `>`; `offset`, su posición en el HTML. */
function readAttrs(source: string, offset: number): Attr[] {
  const attribute = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  const attrs: Attr[] = [];
  let m: RegExpExecArray | null;

  while ((m = attribute.exec(source)) !== null) {
    const name = m[1].toLowerCase();
    const [doubleQuoted, singleQuoted, bare] = [m[2], m[3], m[4]];
    const value = doubleQuoted ?? singleQuoted ?? bare;
    if (value === undefined) {
      attrs.push({ name, value, valueStart: -1, valueEnd: -1, quote: "" });
      continue;
    }
    const quote = doubleQuoted !== undefined ? '"' : singleQuoted !== undefined ? "'" : "";
    const matchEnd = offset + m.index + m[0].length;
    const valueEnd = quote ? matchEnd - 1 : matchEnd; // el valor es lo último del atributo; la comilla de cierre queda fuera
    attrs.push({ name, value, valueStart: valueEnd - value.length, valueEnd, quote });
  }

  return attrs;
}
