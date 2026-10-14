const requested = new Map<string, Promise<void>>();

/**
 * Fetch + decode an image ahead of time so it can be painted without a
 * half-loaded frame. Deduplicated per URL; never rejects (a failed preload
 * just means the real <img> loads it later).
 */
export function preloadImage(src: string): Promise<void> {
  const cached = requested.get(src);
  if (cached) return cached;
  const el = new Image();
  el.decoding = "async";
  el.src = src;
  const done: Promise<void> =
    typeof el.decode === "function"
      ? el.decode().catch(() => undefined)
      : new Promise((resolve) => {
          el.onload = el.onerror = () => resolve();
        });
  requested.set(src, done);
  return done;
}
