// `safeExternalUrl`: única puerta para que un texto escrito por una persona (o por la API) llegue a un `<a href>`.
// Solo pasa una URL absoluta http(s) con host y sin credenciales; el resto es `null`. Las URL son inventadas
// (dominios reservados `.example`).
import { describe, expect, it } from "vitest";
import { EXTERNAL_URL_ERROR, safeExternalUrl } from "@/lib/safeUrl";

describe("safeExternalUrl · esquemas ejecutables y otros esquemas", () => {
  const maliciosas: [string, string][] = [
    ["javascript básico", "javascript:alert(1)"],
    ["mayúsculas mezcladas", "JaVaScRiPt:alert(1)"],
    ["espacios iniciales", "  javascript:alert(1)"],
    ["tabulador inicial", "\tjavascript:alert(1)"],
    ["salto de línea dentro del esquema", "java\nscript:alert(1)"],
    ["tabulador dentro del esquema", "java\tscript:alert(1)"],
    ["carácter nulo dentro del esquema", "java\u0000script:alert(1)"],
    ["carga con porcentaje", "javascript:%61lert(1)"],
    ["data", "data:text/html,<script>alert(1)</script>"],
    ["vbscript", "vbscript:msgbox(1)"],
    ["file", "file:///etc/passwd"],
    ["blob", "blob:https://x.example/1"],
    ["about", "about:blank"],
    ["mailto", "mailto:a@example.com"],
    ["tel", "tel:+50400000000"],
  ];

  it.each(maliciosas)("rechaza %s", (_nombre, valor) => {
    expect(safeExternalUrl(valor)).toBeNull();
  });
});

describe("safeExternalUrl · entradas ambiguas", () => {
  // Resultado del analizador estándar (`new URL(valor)` sin base):
  //  · lanza para: relativas, protocolo-relativas, sin esquema, sin host y vacías → `null`.
  //  · acepta `https:evil.example` y `http:evil.example` (esquema especial sin barras) y las normaliza a
  //    `https://evil.example/`: es una URL http(s) con host, y se devuelve la forma normalizada para que lo
  //    pintado sea lo comprobado (en un `href` crudo, un navegador la resolvería contra la página actual).
  //  · acepta pero deja pasar las credenciales en `username`/`password`, por eso se comprueban aparte.
  const rechazadas: [string, unknown][] = [
    ["protocolo-relativa", "//evil.example/x"],
    ["ruta relativa", "/docs/req.pdf"],
    ["sin esquema", "docs.example.com/req.pdf"],
    ["sin esquema y con puerto (se lee como esquema)", "docs.example.com:8080/req"],
    ["http sin host", "http://"],
    ["https sin host", "https://"],
    ["con usuario y clave", "https://user:pass@evil.example"],
    ["con solo usuario", "https://user@evil.example"],
    ["con solo clave", "https://:pass@evil.example"],
    ["con espacio en el host", "https://exa mple.example"],
    ["puerto fuera de rango", "https://a.example:99999/"],
    ["cadena vacía", ""],
    ["solo espacios", "   "],
    ["null", null],
    ["undefined", undefined],
    ["número", 42],
    ["objeto", {}],
    ["objeto con toString que devuelve una URL", { toString: () => "https://docs.example.com/" }],
    ["arreglo con una URL", ["https://docs.example.com/"]],
    ["booleano", true],
  ];

  it.each(rechazadas)("rechaza %s", (_nombre, valor) => {
    expect(safeExternalUrl(valor)).toBeNull();
  });

  it("acepta `https:evil.example` solo en su forma normalizada (decisión documentada arriba)", () => {
    expect(safeExternalUrl("https:evil.example")).toBe("https://evil.example/");
    expect(safeExternalUrl("http:evil.example")).toBe("http://evil.example/");
    expect(safeExternalUrl("https:/evil.example")).toBe("https://evil.example/");
  });

  it("un `@` sin usuario ni clave no cuenta como credencial y se normaliza", () => {
    expect(safeExternalUrl("https://@evil.example")).toBe("https://evil.example/");
  });
});

describe("safeExternalUrl · URL legítimas", () => {
  it.each([
    ["https simple", "https://docs.example.com/req.pdf", "https://docs.example.com/req.pdf"],
    ["http", "http://intranet.example/req", "http://intranet.example/req"],
    ["esquema y host en mayúsculas", "HTTPS://EXAMPLE.COM/A", "https://example.com/A"],
    ["query y fragmento", "https://docs.example.com/d/abc?tab=t.0&x=1#heading=h.2", "https://docs.example.com/d/abc?tab=t.0&x=1#heading=h.2"],
    ["puerto", "https://docs.example.com:8443/d", "https://docs.example.com:8443/d"],
    ["IPv6", "https://[::1]/x", "https://[::1]/x"],
    ["espacios alrededor", "  https://docs.example.com/req.pdf  ", "https://docs.example.com/req.pdf"],
    ["tabulador y salto dentro del host", "https://ex\tam\nple.example/x", "https://example.example/x"],
    ["espacio y comillas en la ruta, escapados", 'https://docs.example.com/a b?r="x"', "https://docs.example.com/a%20b?r=%22x%22"],
    ["IDN a punycode, ruta y query", "https://bücher.example/ü?q=ñ#frag", "https://xn--bcher-kva.example/%C3%BC?q=%C3%B1#frag"],
  ])("acepta %s", (_nombre, valor, esperado) => {
    expect(safeExternalUrl(valor)).toBe(esperado);
  });

  it("lo devuelto vuelve a pasar sin cambios (idempotente)", () => {
    const una = safeExternalUrl("HTTPS://Bücher.Example/ü?q=ñ#x") as string;
    expect(safeExternalUrl(una)).toBe(una);
  });

  it("lo devuelto nunca trae espacios, comillas ni signos de marcado sin escapar", () => {
    const href = safeExternalUrl('https://docs.example.com/a b"c<d>e') as string;
    expect(href).not.toMatch(/[\s"<>]/);
  });
});

describe("safeExternalUrl · mensaje compartido", () => {
  it("el mensaje de error explica cómo corregir el enlace", () => {
    expect(EXTERNAL_URL_ERROR).toMatch(/https:\/\//);
  });
});
