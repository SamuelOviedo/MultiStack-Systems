import { cva } from "class-variance-authority";

/**
 * Botones del sitio público (variantes `hero` y `glass` de la referencia). `rounded-site-md` y `rounded-full` se
 * resuelven por orden de clases (ver cn.ts): `sm` y `lg` quedan con esquina de 12 px y `xl`, `default` y los de
 * `hero`/`glass` sin tamaño propio, en píldora, igual que la referencia.
 */
export const siteButtonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium cursor-pointer transition-[color,background-color,filter,transform] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-ring focus-visible:ring-offset-2 focus-visible:ring-offset-site-background active:scale-[0.97] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        hero: "bg-brand text-site-primary-foreground glow rounded-full hover:brightness-105",
        glass: "glass glass-hover text-site-foreground rounded-full",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-site-md px-3 text-xs",
        lg: "h-10 rounded-site-md px-8",
        xl: "h-12 px-7 text-base",
      },
    },
    defaultVariants: { variant: "hero", size: "default" },
  },
);
