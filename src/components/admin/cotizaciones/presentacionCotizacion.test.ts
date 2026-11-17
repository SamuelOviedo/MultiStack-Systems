// Regla de color de los estados de una cotización (regla de color del panel): el rojo (`destructive`) queda para
// errores y condiciones críticas y el ámbar (`warning`) para lo que requiere atención. Ningún estado de una
// cotización es ninguna de las dos cosas, y «Rechazada» es un resultado comercial, no un fallo: va en tono neutro.
// Se recorren TODOS los valores de `ESTADOS_COTIZACION` (la fuente de los tipos), así que un estado nuevo entra
// solo en la regla y quien vuelva a poner `destructive` rompe esta prueba.
import { describe, expect, it } from "vitest";
import { ESTADOS_COTIZACION, type EstadoCotizacion } from "@/types/cotizaciones";
import { presentacionDeEstado } from "./presentacionCotizacion";

const TONO_ESPERADO: Record<EstadoCotizacion, string> = {
  borrador: "neutral",
  emitida: "info",
  aceptada_firmada: "success",
  rechazada: "neutral",
  cancelada: "neutral",
};

describe("presentacionDeEstado · tono de cada estado", () => {
  it("la lista de estados no está vacía y la tabla de esta prueba los cubre todos", () => {
    expect(ESTADOS_COTIZACION.length).toBeGreaterThanOrEqual(5);
    expect(Object.keys(TONO_ESPERADO).sort()).toEqual([...ESTADOS_COTIZACION].sort());
  });

  it.each(ESTADOS_COTIZACION)("%s: no usa el tono destructivo (el rojo es de errores y condiciones críticas)", (estado) => {
    const { tone } = presentacionDeEstado(estado);
    expect(tone, `«${estado}» usa «${tone}»: el rojo se reserva para errores y condiciones críticas`).not.toBe("destructive");
  });

  it.each(ESTADOS_COTIZACION)("%s: tampoco usa el ámbar, que se reserva para lo que requiere atención", (estado) => {
    expect(presentacionDeEstado(estado).tone).not.toBe("warning");
  });

  it.each(ESTADOS_COTIZACION)("%s: lleva el tono acordado", (estado) => {
    expect(presentacionDeEstado(estado).tone).toBe(TONO_ESPERADO[estado]);
  });

  it("«Rechazada» es neutral y sigue diciendo «Rechazada» (el color nunca es la única señal)", () => {
    expect(presentacionDeEstado("rechazada")).toMatchObject({ label: "Rechazada", tone: "neutral" });
    // Sin punto hueco: el punto relleno la separa de «Borrador», que es el único hueco.
    expect(presentacionDeEstado("rechazada").hollow).toBeFalsy();
  });
});
