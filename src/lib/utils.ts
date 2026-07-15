import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind class names, resolving conflicts.
 *
 * `clsx` flattens conditional/array/object class inputs; `twMerge` then dedupes
 * conflicting Tailwind utilities so the last one wins (e.g. `cn("p-2", "p-4")`
 * → `"p-4"`). This is the project's single class-composition helper and the
 * most widely imported module in the codebase — keep its signature stable.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
