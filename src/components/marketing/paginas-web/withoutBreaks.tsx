import type { ReactNode } from "react";

const NO_BREAK = "One-Page";

/**
 * El guion de «One-Page» es un punto de corte para el navegador («One-» / «Page»). Se envuelve en un span
 * sin saltos: el texto del DOM no cambia, solo que no se parte. Vive aparte de PwPrice para que ese archivo
 * exporte solo componentes (react-refresh).
 */
export const withoutBreaks = (text: string): ReactNode =>
  text
    .split(NO_BREAK)
    .flatMap((part, i) => (i === 0 ? [part] : [<span key={i} className="ms-pw-nowrap">{NO_BREAK}</span>, part]));
