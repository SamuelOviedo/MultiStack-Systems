import { useEffect, useState } from "react";

interface NetworkInformationLike extends EventTarget {
  saveData?: boolean;
  effectiveType?: string;
}

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
const SLOW_NETWORKS = new Set(["slow-2g", "2g"]);

const getConnection = (): NetworkInformationLike | undefined =>
  typeof navigator !== "undefined"
    ? (navigator as Navigator & { connection?: NetworkInformationLike }).connection
    : undefined;

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia(REDUCED_MOTION).matches
    : false;
}

/** Save-Data or a 2g-class connection: skip anything optional (animation, preloads). */
export function isConstrainedNetwork(): boolean {
  const c = getConnection();
  return !!c && (c.saveData === true || SLOW_NETWORKS.has(c.effectiveType ?? ""));
}

const computeEnabled = () => !prefersReducedMotion() && !isConstrainedNetwork();

/**
 * Whether the cinematic backdrop may animate at all (spec FR-011).
 * false → static first frames only: reduced motion, Save-Data, or a 2g-class connection.
 * Reacts to live changes of either preference.
 */
export function useCinematicEnabled(): boolean {
  const [enabled, setEnabled] = useState(computeEnabled);

  useEffect(() => {
    const update = () => setEnabled(computeEnabled());
    const mql = typeof window.matchMedia === "function" ? window.matchMedia(REDUCED_MOTION) : null;
    const conn = getConnection();
    mql?.addEventListener("change", update);
    conn?.addEventListener?.("change", update);
    return () => {
      mql?.removeEventListener("change", update);
      conn?.removeEventListener?.("change", update);
    };
  }, []);

  return enabled;
}

/**
 * Flips to true once the page has fired `load` AND the browser is idle
 * (fallback: 1.5 s). Gates the animated sequences (and their extra frames) so nothing competes with LCP
 * (spec R-1, SC-003).
 */
export function useAfterLoadIdle(): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let idleId: number | undefined;
    let timeoutId: number | undefined;

    const markReady = () => {
      if (!cancelled) setReady(true);
    };
    const scheduleIdle = () => {
      if (typeof window.requestIdleCallback === "function") {
        idleId = window.requestIdleCallback(markReady, { timeout: 2000 });
      } else {
        timeoutId = window.setTimeout(markReady, 1500);
      }
    };

    if (document.readyState === "complete") scheduleIdle();
    else window.addEventListener("load", scheduleIdle, { once: true });

    return () => {
      cancelled = true;
      window.removeEventListener("load", scheduleIdle);
      if (idleId !== undefined) window.cancelIdleCallback?.(idleId);
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, []);

  return ready;
}
