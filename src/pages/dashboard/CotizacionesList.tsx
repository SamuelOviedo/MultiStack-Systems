import { useEffect, useRef, useState, type FocusEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, FileText } from "lucide-react";
import { EmptyState } from "@/components/admin/EmptyState";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import {
  formatearDia,
  formatearDiaYHora,
  formatearHora,
  presentacionDeEstado,
  SIN_NOMBRE,
  textoONulo,
} from "@/components/admin/cotizaciones/presentacionCotizacion";
import { useRecursoCotizacion } from "@/components/admin/cotizaciones/useRecursoCotizacion";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listarPaginaCotizaciones, TAMANO_PAGINA_PREDETERMINADO, traducirErrorCotizacion } from "@/lib/cotizaciones";
import { cn } from "@/lib/utils";

/**
 * «Anterior» y «Siguiente» no usan `disabled`: un botón que se deshabilita estando enfocado pierde el foco (cae a
 * `<body>`) y, si se rehabilita después, no lo recupera. Con `aria-disabled` conserva el foco y los lectores de pantalla
 * lo anuncian como no disponible; el manejador no hace nada si no procede. El aspecto reutiliza clases que ya existen
 * (el CSS que se carga al inicio no crece). Sin `pointer-events` el ratón no lo activa ni lo resalta.
 */
const NO_DISPONIBLE = "pointer-events-none text-muted-foreground opacity-60";

/**
 * La región de la tabla es más alta que la ventana: si ya asoma, el navegador no la desplaza al enfocarla y su borde
 * superior quedaba bajo la cabecera fija. Solo con foco de teclado de la propia región y solo si hace falta.
 */
function despejarRegionBajoCabecera(e: FocusEvent<HTMLDivElement>) {
  const region = e.currentTarget;
  // jsdom no implementa `scrollIntoView`.
  if (e.target !== region || typeof region.scrollIntoView !== "function") return;
  let porTeclado = false;
  try {
    porTeclado = region.matches(":focus-visible");
  } catch {
    // Un navegador que no reconozca `:focus-visible` lanza aquí: ante la duda no se desplaza nada.
  }
  if (!porTeclado) return;
  const margen = parseFloat(getComputedStyle(region).scrollMarginTop) || 0;
  if (region.getBoundingClientRect().top < margen) region.scrollIntoView({ block: "start", behavior: "instant" });
}

/**
 * Listado de cotizaciones (`/dashboard/cotizaciones`), solo lectura, de la más reciente a la más antigua. La página
 * en pantalla vive en el estado del componente (no en la URL) y se pide al servidor de a `TAMANO_PAGINA_PREDETERMINADO`;
 * no existe el total, así que solo hay «Anterior» y «Siguiente». Todo dato del prospecto se muestra como texto plano.
 * Los datos no se guardan fuera del componente (ver `useRecursoCotizacion`).
 *
 * Foco: tras «Reintentar» y «Volver a la primera página» (que se desmontan al pulsarlos) el foco pasa a la región de
 * resultados, que existe en todos los estados, cuando el nuevo estado ya está pintado. Nunca se mueve en la carga
 * inicial ni por un cambio que la persona no provocó.
 */
export default function CotizacionesList() {
  const [pagina, setPagina] = useState(1);
  const recurso = useRecursoCotizacion(`lista:${pagina}:${TAMANO_PAGINA_PREDETERMINADO}`, (signal) =>
    listarPaginaCotizaciones({ pagina, tamano: TAMANO_PAGINA_PREDETERMINADO, signal }),
  );
  const regionRef = useRef<HTMLDivElement>(null);
  // Se levanta solo al pulsar un botón que se desmonta; el efecto de abajo lo consume al terminar la carga.
  const devolverFoco = useRef(false);

  useEffect(() => {
    if (!devolverFoco.current) return;
    if (recurso.estado !== "listo" && recurso.estado !== "error") return;
    devolverFoco.current = false;
    // Solo si el foco se perdió (el botón pulsado se desmontó). Si la persona ya eligió otro control, se respeta.
    const activo = document.activeElement;
    if (activo === null || activo === document.body) regionRef.current?.focus();
  }, [recurso.estado]);

  const cargando = recurso.estado === "inactivo" || recurso.estado === "cargando";
  const haySiguiente = recurso.estado === "listo" && recurso.datos.haySiguiente;
  const hayAnterior = pagina > 1;
  // Con la primera página vacía no hay nada que paginar. En cualquier otro caso los controles siguen montados
  // (también mientras carga o si falla), para poder volver atrás.
  const primeraPaginaVacia = pagina === 1 && recurso.estado === "listo" && recurso.datos.cotizaciones.length === 0;

  const retroceder = () => {
    if (!hayAnterior) return;
    devolverFoco.current = false;
    setPagina((p) => Math.max(1, p - 1));
  };
  const avanzar = () => {
    if (!haySiguiente) return;
    devolverFoco.current = false;
    setPagina((p) => p + 1);
  };
  const reintentar = () => {
    devolverFoco.current = true;
    recurso.reintentar();
  };
  const volverALaPrimera = () => {
    devolverFoco.current = true;
    setPagina(1);
  };

  let cuerpo: ReactNode;
  switch (recurso.estado) {
    case "inactivo":
    case "cargando":
      cuerpo = (
        <div aria-busy="true" className="space-y-2">
          <span className="sr-only">Cargando cotizaciones…</span>
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-11 w-full" />
          ))}
        </div>
      );
      break;
    case "error":
      cuerpo = (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4 text-sm">
          <p>{traducirErrorCotizacion(recurso.error)}</p>
          <Button type="button" variant="outline" size="sm" onClick={reintentar}>
            Reintentar
          </Button>
        </div>
      );
      break;
    case "listo":
      if (recurso.datos.cotizaciones.length === 0) {
        cuerpo =
          pagina > 1 ? (
            <EmptyState
              icon={FileText}
              headingLevel="h2"
              title="Esta página no tiene cotizaciones"
              description="Puede que ya no haya más resultados."
              action={
                <Button type="button" variant="outline" size="sm" onClick={volverALaPrimera}>
                  Volver a la primera página
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={FileText}
              headingLevel="h2"
              title="Aún no hay cotizaciones"
              description="Las cotizaciones que se creen aparecerán aquí."
            />
          );
      } else {
        cuerpo = (
          <div className="overflow-hidden rounded-lg border bg-card">
            <Table
              containerProps={{
                role: "region",
                tabIndex: 0,
                onFocus: despejarRegionBajoCabecera,
                "aria-label": "Tabla de cotizaciones, se desplaza en horizontal",
                className:
                  "scroll-mt-16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
              }}
            >
              <TableCaption className="sr-only">Cotizaciones, de la más reciente a la más antigua.</TableCaption>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Referencia</TableHead>
                  <TableHead>Prospecto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha de creación</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recurso.datos.cotizaciones.map((c) => {
                  const nombre = textoONulo(c.prospecto_nombre);
                  const hora = formatearHora(c.creado_at);
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="whitespace-nowrap font-medium">
                        <Link
                          to={`/dashboard/cotizaciones/${c.id}`}
                          className="scroll-mt-16 rounded-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {c.referencia_interna}
                        </Link>
                      </TableCell>
                      <TableCell className="max-w-sm break-words">
                        {/* `bdi` aísla el sentido de escritura del nombre: un control bidi del texto no invierte lo de alrededor. */}
                        {nombre !== null ? <bdi>{nombre}</bdi> : <span className="text-muted-foreground">{SIN_NOMBRE}</span>}
                      </TableCell>
                      <TableCell>
                        <StatusBadge kind="custom" {...presentacionDeEstado(c.estado)} />
                      </TableCell>
                      <TableCell className="tabular whitespace-nowrap text-muted-foreground">
                        <time dateTime={c.creado_at} title={formatearDiaYHora(c.creado_at)}>
                          {formatearDia(c.creado_at)}
                        </time>
                        {/* El título no se anuncia de forma fiable: la hora exacta también va para los lectores de pantalla. */}
                        {hora !== null && <span className="sr-only">{`, ${hora}`}</span>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        );
      }
      break;
  }

  return (
    <div className="container mx-auto max-w-7xl space-y-5 px-4 pb-10 sm:px-6">
      <PageHeader
        title="Cotizaciones"
        description="Cotizaciones registradas, de la más reciente a la más antigua."
        actions={
          <Button asChild variant="outline" size="sm" className="scroll-mt-16">
            <Link to="/dashboard/cotizaciones/catalogo">Ver catálogo</Link>
          </Button>
        }
      />

      {/* Destino estable del foco (existe en todos los estados). Solo recibe el foco por código, no por tabulador. */}
      <div
        ref={regionRef}
        tabIndex={-1}
        role="group"
        aria-label="Listado de cotizaciones"
        className="scroll-mt-16 rounded-lg outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {cuerpo}
      </div>

      {/* Con la primera página vacía no hay nada que paginar: los controles se quitan y el aviso queda solo para lectores. */}
      <div className={cn("flex flex-wrap items-center justify-between gap-3", primeraPaginaVacia && "sr-only")}>
        {/* Región de aviso estable: siempre montada y la misma en todos los estados. Solo dice qué página es y si
            terminó de cargar; nunca repite datos del prospecto. El error lo anuncia su propio `role="alert"`. */}
        <p aria-live="polite" aria-atomic="true" className="tabular text-sm text-muted-foreground">
          {cargando ? (
            `Cargando página ${pagina}…`
          ) : (
            <>
              <span>{`Página ${pagina}`}</span>
              {recurso.estado === "listo" && <span className="sr-only"> cargada</span>}
            </>
          )}
        </p>
        {!primeraPaginaVacia && (
          <nav aria-label="Paginación de cotizaciones" className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label="Página anterior"
              aria-disabled={!hayAnterior || undefined}
              className={cn(!hayAnterior && NO_DISPONIBLE)}
              onClick={retroceder}
            >
              <ChevronLeft aria-hidden="true" />
              Anterior
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label="Página siguiente"
              aria-disabled={!haySiguiente || undefined}
              className={cn(!haySiguiente && NO_DISPONIBLE)}
              onClick={avanzar}
            >
              Siguiente
              <ChevronRight aria-hidden="true" />
            </Button>
          </nav>
        )}
      </div>
    </div>
  );
}
