// Ayudas para las pruebas de formularios que se escribieron contra el marcado anterior (etiquetas sin `htmlFor`,
// del estilo «nombre_campo:») y siguen valiendo con las etiquetas enlazadas del rediseño.
import { fireEvent, screen } from "@testing-library/react";

/**
 * El control de un campo. Primero se busca por etiqueta enlazada (`nueva`); si no hay, por el `<label>` anterior
 * cuyo texto era exactamente `vieja` (el control es su hermano siguiente).
 */
export function campoPorEtiqueta(vieja: string, nueva: RegExp | string): HTMLElement {
  const enlazado = screen.queryAllByLabelText(nueva)[0];
  if (enlazado) return enlazado;
  const label = Array.from(document.querySelectorAll("label")).find((l) => l.textContent === vieja);
  if (!label) throw new Error(`No encuentro el campo «${vieja}» ni la etiqueta ${String(nueva)}`);
  const control = label.nextElementSibling as HTMLElement | null;
  if (!control) throw new Error(`El campo «${vieja}» no tiene control a continuación`);
  return control;
}

/** Cambia un campo de texto/área/fecha/número. */
export function escribirEn(control: HTMLElement, valor: string): void {
  fireEvent.change(control, { target: { value: valor } });
}

/** Elige una opción por su texto en un `<select>` nativo (antes) o en el `Select` de Radix (ahora). */
export function elegirOpcion(control: HTMLElement, texto: string): void {
  if (control.tagName === "SELECT") {
    const s = control as HTMLSelectElement;
    const opt = Array.from(s.options).find((o) => o.text === texto || o.value === texto);
    if (!opt) throw new Error(`No hay opción «${texto}»`);
    fireEvent.change(s, { target: { value: opt.value } });
  } else {
    fireEvent.keyDown(control, { key: "ArrowDown" });
    fireEvent.click(screen.getAllByRole("option").find((o) => o.textContent === texto)!);
  }
}

/** Texto elegido en un selector (nativo o de Radix). */
export function valorMostrado(control: HTMLElement): string {
  if (control.tagName === "SELECT") {
    const s = control as HTMLSelectElement;
    return s.options[s.selectedIndex]?.text ?? "";
  }
  return control.textContent ?? "";
}

/** Textos de las opciones de un selector (nativo o de Radix); cierra el de Radix al terminar. */
export function opcionesDe(control: HTMLElement): string[] {
  if (control.tagName === "SELECT") {
    return Array.from((control as HTMLSelectElement).options).map((o) => o.text);
  }
  fireEvent.keyDown(control, { key: "ArrowDown" });
  const out = screen.getAllByRole("option").map((o) => o.textContent ?? "");
  fireEvent.keyDown(screen.getByRole("listbox"), { key: "Escape" });
  return out;
}
