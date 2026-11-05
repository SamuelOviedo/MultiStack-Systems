// @vitest-environment node
/**
 * Welcome e-mail on the shared MultiStack design system (same layout as the
 * approved password-recovery and contact e-mails). The sample is also written
 * to _shared/email/__snapshots__/welcome.html — byte-identical to the reviewed
 * snapshot on the e-mail design branch.
 *
 * Invisible and format characters are never written literally in this file:
 * they are built from code points with cp().
 */
import { describe, it, expect } from "vitest";
import { BRAND, COLORS } from "../_shared/email/layout.ts";
import { WELCOME_SUBJECT, toDisplayName, welcomeHtml } from "./templates.ts";

const EMAIL = "cliente@ejemplo.com";
const html = welcomeHtml(EMAIL, "María Fernanda");

describe("welcome e-mail — corporate design", () => {
  it("matches its reviewed HTML snapshot", async () => {
    await expect(html).toMatchFileSnapshot("../_shared/email/__snapshots__/welcome.html");
  });

  it("uses the shared light layout, not the old terminal design", () => {
    expect(html).toContain(`background-color:${COLORS.page}`);
    expect(html).toContain(`background-color:${COLORS.card}`);
    expect(html).toContain("logo-black.png");
    expect(html).not.toMatch(/#0a0e14|#0f1419|Consolas|logo-white/i);
  });

  it("links only to the platform and the support mailbox", () => {
    expect(html).toContain(`href="${BRAND.siteUrl}/dashboard"`);
    expect(html).toContain(BRAND.supportEmail);
    expect(BRAND.supportEmail).toBe("soporte@multistacksystems.com");
  });

  it("escapes the user's name and falls back to the address local part", () => {
    expect(welcomeHtml(EMAIL, "<img src=x onerror=alert(1)>")).not.toContain("<img src=x");
    expect(welcomeHtml("ana.lopez@ejemplo.com", "  ")).toContain("Te damos la bienvenida, ana.lopez");
    expect(WELCOME_SUBJECT).toBe("Te damos la bienvenida a MultiStack Systems");
  });
});

// ── Names that come from user-controlled metadata ───────────────────────────
// `shown` is the exact, already-escaped text expected in <title> and <h1>.
interface NameCase {
  label: string;
  name: string;
  shown: string;
}

/** String built from code points. */
const cp = (...codes: number[]) => String.fromCodePoint(...codes);
const hex = (code: number) => `U+${code.toString(16).toUpperCase().padStart(4, "0")}`;
const codePointsOf = (value: string) => Array.from(value, (ch) => ch.codePointAt(0) as number);

const ZWNJ = 0x200c;
const ZWJ = 0x200d;
const VS16 = 0xfe0f;

/** Tag openings/closings in document order: `<table`, `</td`, … */
const tagSkeleton = (doc: string) => doc.match(/<\/?[a-zA-Z][a-zA-Z0-9]*/g) ?? [];
/** Every `<...>` token, attributes included. */
const allTags = (doc: string) => doc.match(/<[^>]*>/g) ?? [];
const occurrences = (doc: string, part: string) => doc.split(part).length - 1;
const h1Text = (doc: string) => doc.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1];
const titleText = (doc: string) => doc.match(/<title>([\s\S]*?)<\/title>/)?.[1];

/**
 * Code points that must never reach the HTML: controls (all but the "\n" the
 * layout uses), bidi, zero-width, filler and tag characters. ZWNJ/ZWJ and
 * variation selectors are legitimate and stay.
 */
const FORBIDDEN_IN_HTML: ReadonlyArray<readonly [number, number]> = [
  [0x0000, 0x0009], [0x000b, 0x001f], [0x007f, 0x009f], [0x00ad, 0x00ad], [0x061c, 0x061c],
  [0x115f, 0x1160], [0x180e, 0x180e], [0x200b, 0x200b], [0x200e, 0x200f], [0x2028, 0x202e],
  [0x2060, 0x206f], [0x3164, 0x3164], [0xfeff, 0xfeff], [0xffa0, 0xffa0], [0xd800, 0xdfff],
  [0xe0000, 0xe007f],
];
/** Offending code points found in a document (empty when it is clean). */
const forbiddenIn = (doc: string) =>
  codePointsOf(doc)
    .filter((code) => FORBIDDEN_IN_HTML.some(([first, last]) => code >= first && code <= last))
    .map(hex);

/** The same e-mail with a harmless name: the reference for "nothing else changed". */
const INNOCUOUS_HTML = welcomeHtml(EMAIL, "Nombre Inocuo");

const MARKUP_CASES: NameCase[] = [
  { label: "script tag", name: "<script>alert(1)</script>", shown: "&lt;script&gt;alert(1)&lt;/script&gt;" },
  { label: "img onerror", name: "<img src=x onerror=alert(1)>", shown: "&lt;img src=x onerror=alert(1)&gt;" },
  { label: "attribute breakout + svg onload", name: '"><svg/onload=alert(1)>', shown: "&quot;&gt;&lt;svg/onload=alert(1)&gt;" },
  { label: "single-quote breakout", name: "'><b>x</b>", shown: "&#39;&gt;&lt;b&gt;x&lt;/b&gt;" },
  {
    label: "closes <h1> and opens a link",
    name: '</h1><a href="https://evil.example">pulsa</a>',
    shown: "&lt;/h1&gt;&lt;a href=&quot;https://evil.example&quot;&gt;pulsa&lt;/a&gt;",
  },
  { label: "closes <title> and opens a script", name: "</title><script>x</script>", shown: "&lt;/title&gt;&lt;script&gt;x&lt;/script&gt;" },
  { label: "comment opener", name: "<!-- x", shown: "&lt;!-- x" },
  { label: "CDATA terminator", name: "x ]]>", shown: "x ]]&gt;" },
  // Punctuation alone shows nothing, so the greeting falls back to the address local part ("cliente").
  { label: "comment opener alone", name: "<!--", shown: "cliente" },
  { label: "CDATA terminator alone", name: "]]>", shown: "cliente" },
  { label: "only angle brackets and quotes", name: `"><'<`, shown: "cliente" },
  { label: "javascript: URL", name: "javascript:alert(1)", shown: "javascript:alert(1)" },
  // Already-encoded input must stay literal text, not turn into a tag when decoded.
  { label: "double encoding", name: "&lt;b&gt;", shown: "&amp;lt;b&amp;gt;" },
  { label: "template literal syntax", name: "${process.env.X}", shown: "${process.env.X}" },
  { label: "template engine syntax", name: "{{7*7}}", shown: "{{7*7}}" },
];

const INVISIBLE_CASES: NameCase[] = [
  { label: "bidi override U+202E", name: `Ana${cp(0x202e)}srevni`, shown: "Anasrevni" },
  { label: "bidi isolates U+2066/U+2069", name: `${cp(0x2066)}Ana${cp(0x2069)}`, shown: "Ana" },
  { label: "LRM and RLM", name: `${cp(0x200e)}Ana${cp(0x200f)}`, shown: "Ana" },
  { label: "zero-width space U+200B", name: `Ana${cp(0x200b)}López`, shown: "AnaLópez" },
  { label: "BOM U+FEFF", name: `${cp(0xfeff)}Ana`, shown: "Ana" },
  { label: "NUL", name: `Ana${cp(0)}López`, shown: "AnaLópez" },
  { label: "C1 control U+009B", name: `Ana${cp(0x9b)}López`, shown: "AnaLópez" },
  { label: "CRLF becomes a space", name: "Ana\r\nLópez", shown: "Ana López" },
  { label: "tabs become one space", name: "Ana\t\tLópez", shown: "Ana López" },
  { label: "line separator U+2028", name: `Ana${cp(0x2028)}López`, shown: "Ana López" },
  { label: "tag characters U+E0041", name: `Ana${cp(0xe0041, 0xe0042)}`, shown: "Ana" },
  { label: "lone surrogate", name: `Ana${cp(0xd800)}`, shown: "Ana" },
  { label: "soft hyphen U+00AD", name: `Ana${cp(0xad)}López`, shown: "AnaLópez" },
  { label: "Hangul filler U+3164", name: `Ana${cp(0x3164)}López`, shown: "AnaLópez" },
  { label: "halfwidth Hangul filler U+FFA0", name: `Ana${cp(0xffa0)}López`, shown: "AnaLópez" },
  { label: "Hangul Jamo fillers U+115F/U+1160", name: `Ana${cp(0x115f, 0x1160)}López`, shown: "AnaLópez" },
  { label: "Mongolian vowel separator U+180E", name: `Ana${cp(0x180e)}López`, shown: "AnaLópez" },
  // ZWNJ/ZWJ are kept wherever they are: invisible and harmless.
  { label: "lone ZWJ at the start is kept", name: `${cp(ZWJ)}Ana`, shown: `${cp(ZWJ)}Ana` },
  { label: "lone ZWNJ at the end is kept", name: `Ana${cp(ZWNJ)}`, shown: `Ana${cp(ZWNJ)}` },
  // Invisible characters must not let markup slip past a check on the raw string.
  { label: "zero-width space inside a tag name", name: `<scr${cp(0x200b)}ipt>alert(1)</scr${cp(0x200b)}ipt>`, shown: "&lt;script&gt;alert(1)&lt;/script&gt;" },
  // A joiner between letters is kept as text; the markup around it is still escaped.
  { label: "ZWJ between letters keeps escaping", name: `<scr${cp(ZWJ)}ipt>x`, shown: `&lt;scr${cp(ZWJ)}ipt&gt;x` },
];

const HOSTILE_CASES = [...MARKUP_CASES, ...INVISIBLE_CASES];

describe("welcome e-mail — hostile names render as inert text", () => {
  it("has detectors that are sound", () => {
    expect(forbiddenIn(INNOCUOUS_HTML)).toEqual([]);
    for (const code of [0x202e, 0x2066, 0x200b, 0xfeff, 0, 0x0d, 0x09, 0x9b, 0xd800, 0xad, 0x3164, 0xffa0, 0x115f, 0x1160, 0x180e, 0xe0041]) {
      expect(forbiddenIn(`a${cp(code)}b`)).toEqual([hex(code)]);
    }
    for (const code of [ZWNJ, ZWJ, VS16]) expect(forbiddenIn(`a${cp(code)}b`)).toEqual([]);
    expect(tagSkeleton("<p>x</p><script>")).toEqual(["<p", "</p", "<script"]);
    expect(allTags('<h1 class="a">x</h1>')).toEqual(['<h1 class="a">', "</h1>"]);
    expect(h1Text('<h1 class="a">Hola</h1>')).toBe("Hola");
    expect(titleText("<title>Hola</title>")).toBe("Hola");
  });

  it.each(HOSTILE_CASES)("keeps the tag skeleton of an innocuous name: $label", ({ name }) => {
    expect(tagSkeleton(welcomeHtml(EMAIL, name))).toEqual(tagSkeleton(INNOCUOUS_HTML));
  });

  it.each(HOSTILE_CASES)("adds no executable fragment: $label", ({ name }) => {
    const out = welcomeHtml(EMAIL, name);
    expect(allTags(out)).toEqual(allTags(INNOCUOUS_HTML));
    for (const fragment of ["<script", "<img src=x", "<svg", "<b>x</b>", '<a href="https://evil', "</h1><a", "</title><script"]) {
      expect(out).not.toContain(fragment);
    }
    for (const tag of allTags(out)) expect(tag).not.toMatch(/[\s/"']on(error|load)\s*=/i);
  });

  it.each(HOSTILE_CASES)("shows the escaped name in <title> and <h1>: $label", ({ name, shown }) => {
    const out = welcomeHtml(EMAIL, name);
    expect(h1Text(out)).toBe(`Te damos la bienvenida, ${shown}`);
    expect(titleText(out)).toBe(`Te damos la bienvenida, ${shown} — ${BRAND.name}`);
  });

  it.each(HOSTILE_CASES)("leaves no unescaped quote or angle bracket from the name: $label", ({ name }) => {
    const out = welcomeHtml(EMAIL, name);
    for (const ch of ["<", ">", '"', "'"]) {
      expect(occurrences(out, ch)).toBe(occurrences(INNOCUOUS_HTML, ch));
    }
  });

  it.each(HOSTILE_CASES)("contains no bidi, filler, zero-width or control characters: $label", ({ name }) => {
    expect(forbiddenIn(welcomeHtml(EMAIL, name))).toEqual([]);
  });
});

describe("welcome e-mail — legitimate names are kept as written", () => {
  const LEGIT_CASES: NameCase[] = [
    { label: "accents", name: "María Fernanda", shown: "María Fernanda" },
    { label: "eñe and accents", name: "José Ñandú", shown: "José Ñandú" },
    { label: "CJK", name: "日本語", shown: "日本語" },
    { label: "diaeresis", name: "Zoë", shown: "Zoë" },
    { label: "emoji", name: `Ana ${cp(0x1f642)}`, shown: `Ana ${cp(0x1f642)}` },
    { label: "apostrophe is escaped but kept", name: "Seán O'Neill", shown: "Seán O&#39;Neill" },
  ];

  it.each(LEGIT_CASES)("does not alter: $label", ({ name, shown }) => {
    expect(toDisplayName(name, EMAIL)).toBe(name);
    const out = welcomeHtml(EMAIL, name);
    expect(h1Text(out)).toBe(`Te damos la bienvenida, ${shown}`);
    expect(titleText(out)).toBe(`Te damos la bienvenida, ${shown} — ${BRAND.name}`);
  });

  // The snapshot itself is checked in the first test above and in _shared/email/templates.test.ts;
  // this one only proves that stray spaces change nothing compared with `html`.
  it("renders a normal name with stray spaces exactly like the same name without them", () => {
    expect(welcomeHtml(EMAIL, "  María   Fernanda  ")).toBe(html);
  });

  const INTERNATIONAL = [
    "María Fernanda", "José Ñandú", "O'Brien", "Jean-Luc", "Zoë", "Müller", "Łukasz", "Nguyễn Văn An",
    "Δημήτρης", "Владимир", "محمد", "שלום", "日本語", "김민준", "Åsa", "Ólafur", "Seán",
  ];
  const INTERNATIONAL_FORMS = INTERNATIONAL.flatMap((name) => [
    { label: `${name} (NFC)`, name: name.normalize("NFC") },
    { label: `${name} (NFD, combining marks and Jamo)`, name: name.normalize("NFD") },
  ]);

  it.each(INTERNATIONAL_FORMS)("keeps an international name intact, byte for byte: $label", ({ name }) => {
    expect(toDisplayName(name, EMAIL)).toBe(name);
    // Same name rebuilt from its code points: the e-mail must be identical.
    const rebuilt = cp(...codePointsOf(name));
    expect(welcomeHtml(EMAIL, name)).toBe(welcomeHtml(EMAIL, rebuilt));
    expect(h1Text(welcomeHtml(EMAIL, name))).toBe(`Te damos la bienvenida, ${name.replace(/'/g, "&#39;")}`);
    expect(forbiddenIn(welcomeHtml(EMAIL, name))).toEqual([]);
  });
});

describe("welcome e-mail — ZWNJ and ZWJ are kept wherever they are", () => {
  const LEGIT_JOINERS = [
    { label: "Persian with ZWNJ between letters", name: cp(0x645, 0x6cc, ZWNJ, 0x62e, 0x648, 0x627, 0x647, 0x645) },
    { label: "Arabic with ZWJ between letters", name: cp(0x628, ZWJ, 0x628) },
    { label: "woman technologist", name: cp(0x1f469, ZWJ, 0x1f4bb) },
    { label: "family of three", name: cp(0x1f468, ZWJ, 0x1f469, ZWJ, 0x1f467) },
    { label: "rainbow flag (VS16 before the ZWJ)", name: cp(0x1f3f3, VS16, ZWJ, 0x1f308) },
    { label: "heart on fire", name: cp(0x2764, VS16, ZWJ, 0x1f525) },
    { label: "woman technologist with a skin tone", name: cp(0x1f469, 0x1f3fd, ZWJ, 0x1f4bb) },
    { label: "Devanagari kssa with ZWJ", name: cp(0x915, 0x94d, ZWJ, 0x937) },
    { label: "Devanagari kssa with ZWNJ", name: cp(0x915, 0x94d, ZWNJ, 0x937) },
    { label: "Devanagari kssa without a joiner", name: cp(0x915, 0x94d, 0x937) },
    { label: "Malayalam chillu: ZWJ last, after a virama", name: cp(0xd05, 0xd35, 0xd28, 0xd4d, ZWJ) },
    { label: "Bengali ZWNJ before a virama", name: cp(0x9b0, ZWNJ, 0x9cd, 0x9af) },
    { label: "Tamil ZWNJ after a virama", name: cp(0xb95, 0xbcd, ZWNJ, 0xbb7) },
    { label: "joiners in the first of two words", name: `${cp(0x1f469, ZWJ, 0x1f4bb)} Ana` },
  ];

  it.each(LEGIT_JOINERS)("keeps $label", ({ name }) => {
    expect(toDisplayName(name, EMAIL)).toBe(name);
    const out = welcomeHtml(EMAIL, name);
    expect(h1Text(out)).toBe(`Te damos la bienvenida, ${name}`);
    expect(titleText(out)).toBe(`Te damos la bienvenida, ${name} — ${BRAND.name}`);
    expect(forbiddenIn(out)).toEqual([]);
  });

  // No contextual policy: a joiner at the start, at the end, repeated or beside a space is invisible and harmless.
  const ODD_JOINERS = [
    { label: "ZWJ at the start", name: `${cp(ZWJ)}Ana`, expected: `${cp(ZWJ)}Ana` },
    { label: "ZWNJ at the start", name: `${cp(ZWNJ)}Ana`, expected: `${cp(ZWNJ)}Ana` },
    { label: "ZWJ at the end, after a letter", name: `Ana${cp(ZWJ)}`, expected: `Ana${cp(ZWJ)}` },
    { label: "ZWNJ at the end, after a letter", name: `Ana${cp(ZWNJ)}`, expected: `Ana${cp(ZWNJ)}` },
    { label: "ZWJ at the end, after an emoji with VS16", name: cp(0x1f3f3, VS16, ZWJ), expected: cp(0x1f3f3, VS16, ZWJ) },
    { label: "repeated ZWJ", name: `a${cp(ZWJ, ZWJ)}b`, expected: `a${cp(ZWJ, ZWJ)}b` },
    { label: "ZWNJ next to ZWJ", name: `a${cp(ZWNJ, ZWJ)}b`, expected: `a${cp(ZWNJ, ZWJ)}b` },
    { label: "ZWJ before a space", name: `a${cp(ZWJ)} b`, expected: `a${cp(ZWJ)} b` },
    { label: "ZWJ after a space", name: `a ${cp(ZWJ)}b`, expected: `a ${cp(ZWJ)}b` },
    { label: "ZWJ after punctuation", name: `a-${cp(ZWJ)}b`, expected: `a-${cp(ZWJ)}b` },
    { label: "ZWJ before a number", name: `a${cp(ZWJ)}1`, expected: `a${cp(ZWJ)}1` },
    { label: "ZWJ keeps its place when the spaces around it collapse", name: `a  ${cp(ZWJ)}   b`, expected: `a ${cp(ZWJ)} b` },
    { label: "ZWJ beside a removed character", name: `a${cp(0x200b, ZWJ, 0x200b)}b`, expected: `a${cp(ZWJ)}b` },
    { label: "padding spaces around a joiner-ended name", name: `  Ana${cp(ZWJ)}  `, expected: `Ana${cp(ZWJ)}` },
  ];

  it.each(ODD_JOINERS)("keeps $label", ({ name, expected }) => {
    expect(toDisplayName(name, EMAIL)).toBe(expected);
    expect(h1Text(welcomeHtml(EMAIL, name))).toBe(`Te damos la bienvenida, ${expected}`);
  });

  it("falls back when the name is only joiners, with or without spaces", () => {
    const local = "ana.lopez@ejemplo.com";
    expect(toDisplayName(cp(ZWJ, ZWNJ, ZWJ), local)).toBe("ana.lopez");
    expect(toDisplayName(` ${cp(ZWJ)}  ${cp(ZWNJ)} `, local)).toBe("ana.lopez");
  });
});

describe("welcome e-mail — subdivision flags lose their tags (accepted trade-off)", () => {
  const BLACK_FLAG = cp(0x1f3f4);
  const SCOTLAND = cp(0x1f3f4, 0xe0067, 0xe0062, 0xe0073, 0xe0063, 0xe0074, 0xe007f);
  const ENGLAND = cp(0x1f3f4, 0xe0067, 0xe0062, 0xe0065, 0xe006e, 0xe0067, 0xe007f);
  const WALES = cp(0x1f3f4, 0xe0067, 0xe0062, 0xe0077, 0xe006c, 0xe0073, 0xe007f);

  const CASES = [
    { label: "the Scotland flag becomes a black flag", name: SCOTLAND, expected: BLACK_FLAG },
    { label: "the England flag becomes a black flag", name: ENGLAND, expected: BLACK_FLAG },
    { label: "the Wales flag becomes a black flag", name: WALES, expected: BLACK_FLAG },
    { label: "a flag after a name", name: `Ana ${SCOTLAND}`, expected: `Ana ${BLACK_FLAG}` },
    { label: "a plain black flag is untouched", name: BLACK_FLAG, expected: BLACK_FLAG },
    { label: "a lone tag letter", name: `Ana${cp(0xe0067)}x`, expected: "Anax" },
    { label: "a lone language tag U+E0001", name: `Ana${cp(0xe0001)}`, expected: "Ana" },
    { label: "a lone cancel tag", name: `Ana${cp(0xe007f)}`, expected: "Ana" },
    { label: "tags without a flag base", name: `${cp(0xe0067, 0xe0062, 0xe007f)}Ana`, expected: "Ana" },
    { label: "a truncated sequence (no cancel tag)", name: cp(0x1f3f4, 0xe0067, 0xe0062), expected: BLACK_FLAG },
    { label: "a sequence with no tag letters", name: cp(0x1f3f4, 0xe007f), expected: BLACK_FLAG },
    { label: "tags on a base that is not the black flag", name: cp(0x1f3f3, 0xe0067, 0xe0062, 0xe007f), expected: cp(0x1f3f3) },
    { label: "a long tag run", name: `a${BLACK_FLAG}${cp(0xe0061).repeat(500)}b`, expected: `a${BLACK_FLAG}b` },
    { label: "hidden text spelled with tag characters", name: `Ana${cp(0xe0065, 0xe0076, 0xe0069, 0xe006c)}`, expected: "Ana" },
  ];

  it.each(CASES)("$label", ({ name, expected }) => {
    expect(toDisplayName(name, EMAIL)).toBe(expected);
    const out = welcomeHtml(EMAIL, name);
    expect(h1Text(out)).toBe(`Te damos la bienvenida, ${expected}`);
    expect(forbiddenIn(out)).toEqual([]);
  });
});

describe("welcome e-mail — a name must show something", () => {
  const LOCAL = "ana.lopez@ejemplo.com";
  const NOTHING_VISIBLE = [
    { label: "only combining marks", name: cp(0x301, 0x301, 0x301) },
    { label: "only a Braille blank U+2800", name: cp(0x2800) },
    { label: "only joiners", name: cp(ZWJ, ZWNJ) },
    { label: "only variation selectors", name: cp(VS16, 0xfe0e) },
    { label: "only fillers", name: cp(0x3164, 0xffa0, 0x115f, 0x1160, 0xad) },
    { label: "only tag characters", name: cp(0xe0067, 0xe0062, 0xe007f) },
    { label: "only punctuation", name: "...-- ()" },
    { label: "only symbols that are not emoji", name: "@#$%" },
    { label: "only whitespace", name: " \t\r\n " },
    { label: "an empty string", name: "" },
  ];

  it.each(NOTHING_VISIBLE)("treats $label as empty and uses the local part", ({ name }) => {
    expect(toDisplayName(name, LOCAL)).toBe("ana.lopez");
    expect(h1Text(welcomeHtml(LOCAL, name))).toBe("Te damos la bienvenida, ana.lopez");
  });

  const SOMETHING_VISIBLE = [
    { label: "a digit", name: "7" },
    { label: "a number", name: "2024" },
    { label: "one letter", name: "Ñ" },
    { label: "one CJK character", name: "日" },
    { label: "an emoji", name: cp(0x1f642) },
    { label: "a black flag", name: cp(0x1f3f4) },
    { label: "a letter with its marks", name: `a${cp(0x301)}` },
    { label: "a letter between punctuation", name: "-a-" },
    { label: "a superscript number (No)", name: cp(0xb2) },
    { label: "a Roman numeral (Nl)", name: cp(0x2167) },
    { label: "a letter with many marks", name: `${cp(0x301).repeat(50)}a` },
  ];

  it.each(SOMETHING_VISIBLE)("keeps $label", ({ name }) => {
    expect(toDisplayName(name, LOCAL)).toBe(name);
  });

  it("drops the name from the greeting when neither name nor address has anything visible", () => {
    for (const name of [cp(0x2800), cp(ZWJ), ""]) {
      const out = welcomeHtml("+++@ejemplo.com", name);
      expect(h1Text(out)).toBe("Te damos la bienvenida");
      expect(titleText(out)).toBe(`Te damos la bienvenida — ${BRAND.name}`);
    }
  });
});

describe("welcome e-mail — code points inside a name, at the edges of every rule", () => {
  const cases = (cps: number[]) => cps.map((code) => ({ label: hex(code), cp: code }));
  /** "Ma" + one code point + "ría": the character sits in the middle, not at an end. */
  const inName = (code: number) => `Ma${cp(code)}ría`;

  // First, last and one-inside code point of each removed range, plus the single ones.
  const REMOVED = cases([
    0x0000, 0x0001, 0x0007, 0x0008,
    0x000e, 0x000f, 0x0010, 0x001e, 0x001f,
    0x007f, 0x0080, 0x0083, 0x0084,
    0x0086, 0x0087, 0x009e, 0x009f,
    0x00ad, 0x061c, 0x115f, 0x1160, 0x180e,
    0x200b, 0x200e, 0x200f,
    0x202a, 0x202b, 0x202c, 0x202d, 0x202e,
    0x2060, 0x2061, 0x2066, 0x2069, 0x206e, 0x206f,
    0x3164, 0xfeff, 0xffa0,
    0xe0000, 0xe0001, 0xe0020, 0xe0061, 0xe007a, 0xe007e, 0xe007f, // tag characters
    0xd800, 0xd801, 0xdffe, 0xdfff, // lone surrogates
  ]);

  // Any whitespace collapses to one space; it must not simply disappear.
  const SPACES = cases([
    0x0009, 0x000a, 0x000b, 0x000c, 0x000d, 0x0020, 0x0085, 0x00a0, 0x1680,
    0x2000, 0x200a, 0x2028, 0x2029, 0x202f, 0x205f, 0x3000,
  ]);

  // Just outside each range, and the invisible-looking code points that stay on purpose.
  const KEPT = cases([
    0x007e, 0x00ac, 0x00ae, 0x061b, 0x061d, 0x115e, 0x1161, 0x2010, 0x2070,
    0x3163, 0x3165, 0xfefe, 0xff00, 0xff9f, 0xffa1, 0xd7ff, 0xe000, 0xdffff, 0xe0080,
    0x034f, 0x17b4, 0x17b5, 0x180b, 0x180c, 0x180d, 0x180f, 0xfe00, 0xfe0e, 0xfe0f, 0x2800, 0x0301,
    ZWNJ, ZWJ,
  ]);

  it.each(REMOVED)("removes $label", ({ cp: code }) => {
    expect(toDisplayName(inName(code), EMAIL)).toBe("María");
    const out = welcomeHtml(EMAIL, inName(code));
    expect(h1Text(out)).toBe("Te damos la bienvenida, María");
    expect(forbiddenIn(out)).toEqual([]);
  });

  it.each(SPACES)("turns $label into one space, even repeated or next to a space", ({ cp: code }) => {
    const ch = cp(code);
    expect(toDisplayName(inName(code), EMAIL)).toBe("Ma ría");
    expect(toDisplayName(`Ma${ch}${ch} ${ch}ría`, EMAIL)).toBe("Ma ría");
    const out = welcomeHtml(EMAIL, inName(code));
    expect(h1Text(out)).toBe("Te damos la bienvenida, Ma ría");
    expect(forbiddenIn(out)).toEqual([]);
  });

  it.each(KEPT)("keeps $label", ({ cp: code }) => {
    expect(toDisplayName(inName(code), EMAIL)).toBe(inName(code));
  });
});

describe("welcome e-mail — name length", () => {
  const ellipsized = (n: number, ch: string) => `${ch.repeat(n)}…`;
  const codePoints = (value: string) => Array.from(value).length;
  const baselineLength = html.length;
  const baselineNameLength = codePoints("María Fernanda");

  it("caps a 10 000-character name at 80 code points and the HTML grows only by that", () => {
    const name = toDisplayName("A".repeat(10_000), EMAIL);
    expect(name).toBe(ellipsized(79, "A"));
    expect(codePoints(name)).toBe(80);
    // The name appears twice (<title> and <h1>); nothing else depends on it.
    expect(welcomeHtml(EMAIL, "A".repeat(10_000)).length).toBe(baselineLength + 2 * (80 - baselineNameLength));
  });

  it("keeps the HTML bounded when every character expands under escaping", () => {
    // "<b<b<b…" cut at 79 code points is 40 "<" and 39 "b", then the ellipsis.
    const out = welcomeHtml(EMAIL, "<b".repeat(5_000));
    expect(occurrences(out, "&lt;")).toBe(2 * 40);
    expect(out.length).toBeLessThan(baselineLength + 2 * 80 * "&lt;".length);
    expect(tagSkeleton(out)).toEqual(tagSkeleton(INNOCUOUS_HTML));
  });

  it("does not split surrogate pairs when cutting", () => {
    const name = toDisplayName(cp(0x1f642).repeat(10_000), EMAIL);
    expect(codePoints(name)).toBe(80);
    expect(name.endsWith("…")).toBe(true);
    expect(() => encodeURIComponent(name)).not.toThrow(); // throws on a lone surrogate
    // 78 letters + emoji + tail: a cut by UTF-16 units would land inside the emoji.
    expect(toDisplayName(`${"a".repeat(78)}${cp(0x1f642)}bbbbb`, EMAIL)).toBe(`${"a".repeat(78)}${cp(0x1f642)}…`);
  });

  it("keeps exactly 80 code points and cuts from 81", () => {
    expect(toDisplayName("B".repeat(80), EMAIL)).toBe("B".repeat(80));
    expect(toDisplayName("B".repeat(81), EMAIL)).toBe(ellipsized(79, "B"));
  });

  it("does not leave a space before the ellipsis", () => {
    expect(toDisplayName(`${"a".repeat(78)} ${"b".repeat(20)}`, EMAIL)).toBe(ellipsized(78, "a"));
  });

  it("measures the cap after cleaning, so invisible padding cannot eat the budget", () => {
    expect(toDisplayName(`Ana${cp(0x200b).repeat(10_000)}López`, EMAIL)).toBe("AnaLópez");
  });

  it("falls back when a long name is only whitespace or invisible characters", () => {
    expect(toDisplayName(" ".repeat(10_000), "ana.lopez@ejemplo.com")).toBe("ana.lopez");
    expect(toDisplayName(cp(0x200b).repeat(10_000), "ana.lopez@ejemplo.com")).toBe("ana.lopez");
  });

  // After a cut, no space or joiner is left hanging before the ellipsis.
  it("drops a ZWJ left at the end by the cut", () => {
    expect(toDisplayName(`${"a".repeat(77)}${cp(0x1f469, ZWJ, 0x1f4bb)}x`, EMAIL)).toBe(`${"a".repeat(77)}${cp(0x1f469)}…`);
  });

  it("drops a ZWNJ left at the end by the cut", () => {
    expect(toDisplayName(`${cp(0x628).repeat(78)}${cp(ZWNJ, 0x645)}x`, EMAIL)).toBe(`${cp(0x628).repeat(78)}…`);
  });

  it("drops a run of spaces and joiners left at the end by the cut, in any order", () => {
    expect(toDisplayName(`${"a".repeat(75)} ${cp(ZWJ)} ${cp(ZWNJ)}bbbbb`, EMAIL)).toBe(ellipsized(75, "a"));
    expect(toDisplayName(`${"a".repeat(77)}${cp(ZWNJ)} bbbbb`, EMAIL)).toBe(ellipsized(77, "a"));
    expect(toDisplayName(`${"a".repeat(77)} ${cp(ZWJ)}bbbbb`, EMAIL)).toBe(ellipsized(77, "a"));
  });

  it("keeps a joiner that is not at the end of the cut text", () => {
    expect(toDisplayName(`${"a".repeat(40)}${cp(ZWJ)}${"b".repeat(60)}`, EMAIL)).toBe(`${"a".repeat(40)}${cp(ZWJ)}${"b".repeat(38)}…`);
  });

  it("keeps a variation selector that is attached to its base", () => {
    expect(toDisplayName(`${"a".repeat(77)}${cp(0x263a, VS16)}bbbbb`, EMAIL)).toBe(`${"a".repeat(77)}${cp(0x263a, VS16)}…`);
  });
});

describe("welcome e-mail — names that are not strings", () => {
  const NON_STRINGS = [
    { label: "number", value: 123 },
    { label: "empty object", value: {} },
    { label: "empty array", value: [] },
    { label: "array with a string", value: ["x"] },
    { label: "boolean", value: true },
    { label: "null", value: null },
    { label: "undefined", value: undefined },
    { label: "bigint", value: 10n },
    { label: "symbol", value: Symbol("x") },
    { label: "String object", value: Object("Ana") },
    {
      label: "object whose toString throws",
      value: { toString: () => { throw new Error("must not be called"); } },
    },
  ];
  const FALLBACK_EMAIL = "ana.lopez@ejemplo.com";

  it.each(NON_STRINGS)("does not throw and uses the address local part: $label", ({ value }) => {
    expect(() => welcomeHtml(FALLBACK_EMAIL, value)).not.toThrow();
    const out = welcomeHtml(FALLBACK_EMAIL, value);
    expect(h1Text(out)).toBe("Te damos la bienvenida, ana.lopez");
    expect(out).toBe(welcomeHtml(FALLBACK_EMAIL, ""));
  });
});

describe("welcome e-mail — address local part fallback", () => {
  const LOCAL_CASES: Array<{ label: string; email: string; shown: string }> = [
    { label: "plus tag", email: "ana.lopez+ventas@ejemplo.com", shown: "ana.lopez+ventas" },
    { label: "apostrophe", email: "o'brien@ejemplo.com", shown: "o&#39;brien" },
    { label: "ampersand", email: "a&b@ejemplo.com", shown: "a&amp;b" },
    { label: "quoted local part with markup", email: '"<b>x</b>"@ejemplo.com', shown: "&quot;&lt;b&gt;x&lt;/b&gt;&quot;" },
    { label: "bidi override", email: `${cp(0x202e)}ana@ejemplo.com`, shown: "ana" },
    { label: "Hangul filler", email: `ana${cp(0x3164)}@ejemplo.com`, shown: "ana" },
    { label: "no @ at all", email: "sinarroba", shown: "sinarroba" },
    { label: "overlong local part", email: `${"l".repeat(100)}@ejemplo.com`, shown: `${"l".repeat(79)}…` },
  ];

  it.each(LOCAL_CASES)("escapes and cleans it: $label", ({ email, shown }) => {
    const out = welcomeHtml(email, "");
    expect(h1Text(out)).toBe(`Te damos la bienvenida, ${shown}`);
    expect(titleText(out)).toBe(`Te damos la bienvenida, ${shown} — ${BRAND.name}`);
    expect(tagSkeleton(out)).toEqual(tagSkeleton(INNOCUOUS_HTML));
    expect(forbiddenIn(out)).toEqual([]);
  });

  it("drops the name from the greeting when nothing usable is left", () => {
    const out = welcomeHtml("@ejemplo.com", cp(0x200b));
    expect(h1Text(out)).toBe("Te damos la bienvenida");
    expect(titleText(out)).toBe(`Te damos la bienvenida — ${BRAND.name}`);
  });

  it("prefers a valid name over the local part", () => {
    expect(toDisplayName("María Fernanda", "ana.lopez@ejemplo.com")).toBe("María Fernanda");
  });
});
