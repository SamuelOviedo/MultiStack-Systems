/**
 * Fechas legibles de los tickets, en es-HN. Todas reciben «ahora» para poder probarse con un reloj fijo.
 * Una fecha que no se puede leer se muestra como «—» (nunca «Invalid Date»).
 */

const LOCALE = "es-HN";
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

const parse = (iso: string): Date | null => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
};

const dayNumber = (d: Date): number => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);

/** La parte local de un correo (lo que va antes de la arroba), para columnas estrechas. Sin arroba (o sin nada antes), el texto tal cual. */
export function emailLocalPart(email: string): string {
  const at = email.lastIndexOf("@");
  return at > 0 ? email.slice(0, at) : email;
}

/** «2 nov» (con el año si no es el actual): corta, para columnas. */
export function formatShortDate(iso: string, now: Date): string {
  const d = parse(iso);
  if (!d) return "—";
  return d.toLocaleDateString(LOCALE, {
    day: "numeric",
    month: "short",
    ...(d.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  });
}

/** «2 de noviembre de 2026, 09:00»: completa, para `title` y para el cajón. */
export function formatLongDateTime(iso: string): string {
  const d = parse(iso);
  if (!d) return "—";
  return d.toLocaleString(LOCALE, { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** «2 nov, 09:00»: corta con hora, para los mensajes del hilo. */
export function formatShortDateTime(iso: string, now: Date): string {
  const d = parse(iso);
  if (!d) return "—";
  return d.toLocaleString(LOCALE, {
    day: "numeric",
    month: "short",
    ...(d.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * «justo ahora», «hace 5 min», «hace 3 h», «ayer», «hace 4 días»; a partir de 7 días, la fecha corta.
 * Los días se cuentan por calendario local (las 23:50 de ayer es «ayer», no «hace 10 min»).
 */
export function formatRelative(iso: string, now: Date): string {
  const d = parse(iso);
  if (!d) return "—";
  const diff = now.getTime() - d.getTime();
  if (diff < MINUTE) return "justo ahora";
  const days = dayNumber(now) - dayNumber(d);
  if (days <= 0) {
    if (diff < HOUR) return `hace ${Math.floor(diff / MINUTE)} min`;
    return `hace ${Math.floor(diff / HOUR)} h`;
  }
  if (days === 1) return "ayer";
  if (days < 7) return `hace ${days} días`;
  return formatShortDate(iso, now);
}
