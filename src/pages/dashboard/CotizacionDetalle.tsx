import { useEffect, useRef, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, FileSearch } from "lucide-react";
import { EmptyState } from "@/components/admin/EmptyState";
import { PageHeader } from "@/components/admin/PageHeader";
import { Panel } from "@/components/admin/Panel";
import { StatusBadge } from "@/components/admin/StatusBadge";
import {
  formatearDiaYHora,
  presentacionDeEstado,
  SIN_DATO,
  textoONulo,
} from "@/components/admin/cotizaciones/presentacionCotizacion";
import { useRecursoCotizacion } from "@/components/admin/cotizaciones/useRecursoCotizacion";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { esUuid, obtenerCotizacion, traducirErrorCotizacion } from "@/lib/cotizaciones";

/** Un dato de la lista de definición. Sin valor, el marcador neutro. El valor es siempre texto plano. */
function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{etiqueta}</dt>
      <dd className="mt-0.5 break-words text-sm">{children}</dd>
    </div>
  );
}

function DatoDeTexto({ etiqueta, valor }: { etiqueta: string; valor: string | null }) {
  const texto = textoONulo(valor);
  // `bdi` aísla el sentido de escritura del valor: un control bidi del texto del prospecto no invierte lo de alrededor.
  return (
    <Dato etiqueta={etiqueta}>
      {texto !== null ? <bdi>{texto}</bdi> : <span className="text-muted-foreground">{SIN_DATO}</span>}
    </Dato>
  );
}

function DatoDeFecha({ etiqueta, iso }: { etiqueta: string; iso: string }) {
  return (
    <Dato etiqueta={etiqueta}>
      <time dateTime={iso}>{formatearDiaYHora(iso)}</time>
    </Dato>
  );
}

/**
 * Detalle de una cotización (`/dashboard/cotizaciones/:id`), solo lectura. Si `:id` no es un UUID (también
 * «catalogo» o «xyz») no se consulta nada. Un UUID que no existe y uno que la persona no puede ver (RLS) dan el
 * MISMO mensaje: la interfaz no distingue «no existe» de «no es tuya» ni muestra texto técnico. El nombre, el
 * contacto, el correo y el teléfono del prospecto salen como texto plano: sin HTML y sin enlaces de correo ni de
 * teléfono. Las migas las pinta `AdminShell`; el enlace «Volver» es el de cada detalle del panel.
 *
 * Foco: «Reintentar» se desmonta al pulsarlo, así que cuando el nuevo estado ya está pintado el foco pasa a la
 * región del contenido, que existe en todos los estados. Nunca se mueve en la carga inicial.
 */
export default function CotizacionDetalle() {
  const { id } = useParams<{ id: string }>();
  const idValido = esUuid(id) ? id : null;
  const recurso = useRecursoCotizacion(idValido === null ? null : `detalle:${idValido}`, (signal) =>
    idValido === null ? Promise.resolve(null) : obtenerCotizacion(idValido, { signal }),
  );
  const regionRef = useRef<HTMLDivElement>(null);
  // Se levanta solo al pulsar «Reintentar»; el efecto de abajo lo consume al terminar la carga.
  const devolverFoco = useRef(false);

  useEffect(() => {
    if (!devolverFoco.current) return;
    if (recurso.estado !== "listo" && recurso.estado !== "error") return;
    devolverFoco.current = false;
    // Solo si el foco se perdió (el botón pulsado se desmontó). Si la persona ya eligió otro control, se respeta.
    const activo = document.activeElement;
    if (activo === null || activo === document.body) regionRef.current?.focus();
  }, [recurso.estado]);

  const reintentar = () => {
    devolverFoco.current = true;
    recurso.reintentar();
  };

  const volver = (
    <Link
      to="/dashboard/cotizaciones"
      className="inline-flex items-center gap-1 rounded-sm text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
    >
      <ArrowLeft aria-hidden="true" className="size-3.5" />
      Volver a cotizaciones
    </Link>
  );

  const noEncontrada = (
    <EmptyState
      icon={FileSearch}
      headingLevel="h2"
      title="Cotización no encontrada"
      description="Revisa el enlace o vuelve al listado de cotizaciones."
    />
  );

  let titulo = "Cotización";
  let cuerpo: ReactNode;
  if (idValido === null) {
    cuerpo = noEncontrada;
  } else {
    switch (recurso.estado) {
      case "inactivo":
      case "cargando":
        cuerpo = (
          <div aria-busy="true" className="grid gap-4 md:grid-cols-2">
            <span className="sr-only">Cargando la cotización…</span>
            <Skeleton className="h-44 w-full" />
            <Skeleton className="h-44 w-full" />
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
      case "listo": {
        const cotizacion = recurso.datos;
        if (cotizacion === null) {
          cuerpo = noEncontrada;
          break;
        }
        titulo = `Cotización ${cotizacion.referencia_interna}`;
        cuerpo = (
          <div className="grid items-start gap-4 md:grid-cols-2">
            <Panel title="Datos de la cotización">
              <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                <Dato etiqueta="Referencia interna">{cotizacion.referencia_interna}</Dato>
                <Dato etiqueta="Estado">
                  <StatusBadge kind="custom" {...presentacionDeEstado(cotizacion.estado)} />
                </Dato>
                <DatoDeFecha etiqueta="Creada" iso={cotizacion.creado_at} />
                <DatoDeFecha etiqueta="Última actualización" iso={cotizacion.actualizado_at} />
              </dl>
            </Panel>
            <Panel title="Prospecto">
              <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                <DatoDeTexto etiqueta="Nombre" valor={cotizacion.prospecto_nombre} />
                <DatoDeTexto etiqueta="Contacto" valor={cotizacion.prospecto_contacto} />
                <DatoDeTexto etiqueta="Correo" valor={cotizacion.prospecto_email} />
                <DatoDeTexto etiqueta="Teléfono" valor={cotizacion.prospecto_telefono} />
              </dl>
            </Panel>
          </div>
        );
        break;
      }
    }
  }

  return (
    <div className="container mx-auto max-w-6xl space-y-5 px-4 pb-10 sm:px-6">
      <PageHeader breadcrumb={volver} title={titulo} />
      {/* Destino estable del foco (existe en todos los estados). Solo recibe el foco por código, no por tabulador. */}
      <div
        ref={regionRef}
        tabIndex={-1}
        role="group"
        aria-label="Detalle de la cotización"
        className="rounded-lg outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {cuerpo}
      </div>
    </div>
  );
}
