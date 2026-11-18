import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * `cn` del sitio público: igual que `@/lib/utils`, pero tailwind-merge conoce la escala de radios `rounded-site-*`
 * (tailwind.config.ts). Sin esto trataría `rounded-site-md` y `rounded-full` como clases independientes y el
 * conflicto lo resolvería el orden de la hoja, no el orden de las clases.
 */
const twMergeSite = extendTailwindMerge({
  extend: {
    classGroups: {
      rounded: [{ rounded: ["site-sm", "site-md", "site-lg", "site-xl", "site-2xl", "site-3xl"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMergeSite(clsx(inputs));
}
