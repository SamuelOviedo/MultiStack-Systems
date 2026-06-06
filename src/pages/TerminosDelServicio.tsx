import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowUp } from "lucide-react";
import Navbar from "@/components/Navbar";

const CANONICAL = "https://multi-stack-systems.vercel.app/terminos-del-servicio";
const META_DESC  =
  "Términos y condiciones de uso de MultiStack Systems. Conoce tus derechos, obligaciones y la jurisdicción aplicable como usuario de nuestra plataforma.";

export default function TerminosDelServicio() {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = "Términos del Servicio — MultiStack Systems";

    const setMeta = (name: string, content: string) => {
      let el = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
      if (!el) { el = document.createElement("meta"); el.name = name; document.head.appendChild(el); }
      el.content = content;
      return el;
    };
    const setLink = (rel: string, href: string) => {
      let el = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
      if (!el) { el = document.createElement("link"); el.rel = rel; document.head.appendChild(el); }
      el.href = href;
      return el;
    };

    const desc      = setMeta("description", META_DESC);
    const canonical = setLink("canonical", CANONICAL);

    return () => {
      document.title = prevTitle;
      desc.remove();
      canonical.remove();
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container mx-auto max-w-3xl px-6 pt-28 pb-28">

        {/* Back */}
        <Link
          to="/"
          className="inline-flex items-center gap-2 font-mono text-xs text-muted-foreground hover:text-primary transition-colors mb-10"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver al inicio
        </Link>

        {/* Header */}
        <header className="mb-14 border-b border-border/40 pb-10">
          <p className="font-mono text-xs text-accent tracking-widest uppercase mb-4">
            // legal
          </p>
          <h1 className="font-display text-4xl sm:text-5xl font-semibold tracking-tighter text-foreground mb-3">
            Términos del Servicio
          </h1>
          <p className="font-mono text-xs text-muted-foreground">
            Vigentes desde: Junio 2026&nbsp;&nbsp;|&nbsp;&nbsp;Versión 1.0
          </p>
        </header>

        {/* Body */}
        <div className="space-y-14 text-[hsl(var(--body-foreground))] text-base leading-[1.8]">

          {/* 1 */}
          <section>
            <SectionTitle num="01" title="Aceptación de los Términos" />
            <p>
              Al acceder, registrarse o utilizar cualquier servicio ofrecido a través de la
              plataforma de MultiStack Systems (
              <a
                href="https://multi-stack-systems.vercel.app/"
                className="text-primary hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                multi-stack-systems.vercel.app
              </a>
              ), usted declara haber leído, comprendido y aceptado íntegramente los presentes
              Términos del Servicio. Si no está de acuerdo con alguna de estas condiciones, deberá
              abstenerse de utilizar la plataforma.
            </p>
            <p className="mt-4">
              Estos términos constituyen un acuerdo legalmente vinculante entre usted (el "Cliente" o
              "Usuario") y <strong className="text-foreground">MultiStack Systems</strong> (el
              "Proveedor"), plataforma digital de tecnología e ingeniería de software, conforme a las
              leyes de la República de Honduras.
            </p>
          </section>

          {/* 2 */}
          <section>
            <SectionTitle num="02" title="Descripción de los Servicios" />
            <p className="mb-4">
              MultiStack Systems es una plataforma tecnológica multiservicios que ofrece:
            </p>
            <BulletList items={[
              "Soporte técnico: diagnóstico, mantenimiento preventivo y correctivo de equipos, redes e infraestructura tecnológica.",
              "Desarrollo de software: creación de sistemas web, móviles y aplicaciones a medida.",
              "Consultoría tecnológica: análisis, planificación y modernización de infraestructura digital.",
              "Licenciamiento de software: reventa autorizada de herramientas como Microsoft Office, Windows y Kaspersky.",
              "Integración de Inteligencia Artificial: automatización de procesos empresariales.",
              "Ciberseguridad: auditorías de vulnerabilidades y fortalecimiento de infraestructura.",
            ]} />
            <p className="mt-4">
              La disponibilidad de servicios específicos puede variar según la modalidad contratada y
              las condiciones del mercado.
            </p>
          </section>

          {/* 3 */}
          <section>
            <SectionTitle num="03" title="Cuentas de Usuario" />
            <SubHeading>3.1 Registro</SubHeading>
            <p>
              Para acceder a funcionalidades avanzadas de la plataforma, el usuario debe crear una
              cuenta mediante autenticación OAuth con Google. El usuario es responsable de
              proporcionar información veraz y mantenerla actualizada.
            </p>
            <SubHeading>3.2 Seguridad</SubHeading>
            <p>
              El usuario es el único responsable de la confidencialidad de su cuenta y de todas las
              actividades realizadas bajo la misma. Cualquier acceso no autorizado debe reportarse
              inmediatamente a MultiStack Systems.
            </p>
            <SubHeading>3.3 Prohibiciones</SubHeading>
            <p className="mb-4">Queda expresamente prohibido:</p>
            <BulletList items={[
              "Intentar acceder sin autorización a sistemas, servidores o bases de datos de MultiStack Systems.",
              "Realizar ingeniería inversa sobre la plataforma.",
              "Transmitir malware, virus o código malicioso.",
              "Suplantar la identidad de otros usuarios.",
              "Utilizar la plataforma con fines ilegales.",
            ]} />
            <p className="mt-4">
              El incumplimiento podrá resultar en la suspensión inmediata de la cuenta y en las
              acciones legales correspondientes.
            </p>
          </section>

          {/* 4 */}
          <section>
            <SectionTitle num="04" title="Contratación de Servicios" />
            <SubHeading>4.1 Propuestas y cotizaciones</SubHeading>
            <p>
              Ningún servicio de desarrollo de software o consultoría se iniciará sin una propuesta
              formal aprobada y firmada por ambas partes. Las cotizaciones tienen validez de{" "}
              <strong className="text-foreground">15 días calendario</strong> desde su emisión.
            </p>
            <SubHeading>4.2 Pagos</SubHeading>
            <p>
              Los términos de pago se especifican en cada propuesta o contrato de servicio. Los
              contratos de mantenimiento mensual (SLA) se facturan por adelantado. Los proyectos de
              desarrollo se facturan en hitos acordados.
            </p>
            <SubHeading>4.3 Retrasos por parte del cliente</SubHeading>
            <p>
              Si el cliente no provee información, accesos o retroalimentación necesaria dentro de
              los plazos acordados, MultiStack Systems no será responsable de retrasos en la entrega
              y podrá ajustar los tiempos del proyecto.
            </p>
          </section>

          {/* 5 */}
          <section>
            <SectionTitle num="05" title="Propiedad Intelectual" />
            <SubHeading>5.1 Plataforma y código base</SubHeading>
            <p>
              Todos los derechos sobre la plataforma MultiStack Systems, su diseño, arquitectura,
              código fuente y marca son propiedad exclusiva de MultiStack Systems.
              Queda prohibida su reproducción, distribución o modificación sin autorización expresa
              y por escrito.
            </p>
            <SubHeading>5.2 Software a medida</SubHeading>
            <p>
              El software desarrollado a medida para un cliente específico, una vez liquidado el
              pago total acordado, transfiere al cliente los derechos de uso sobre los entregables
              finales acordados en el contrato. MultiStack Systems se reserva el derecho de utilizar
              las metodologías, frameworks y componentes genéricos empleados en futuros proyectos.
            </p>
            <SubHeading>5.3 Contenido del cliente</SubHeading>
            <p>
              El cliente conserva la titularidad sobre todos los datos, contenidos e información que
              provea para la realización del proyecto. Al compartirlos con MultiStack Systems, otorga
              una licencia limitada para utilizarlos exclusivamente en la ejecución del servicio
              contratado.
            </p>
          </section>

          {/* 6 */}
          <section>
            <SectionTitle num="06" title="Garantía Limitada y Limitación de Responsabilidad" />
            <p className="mb-4">
              MultiStack Systems garantiza que los servicios serán ejecutados con profesionalismo y
              conforme a los estándares técnicos acordados. Sin embargo:
            </p>
            <BulletList items={[
              "No garantizamos disponibilidad ininterrumpida ni libre de errores de la plataforma.",
              "No somos responsables de pérdidas de datos causadas por factores externos (fallos del proveedor de hosting, desastres naturales, ataques de terceros).",
              "La responsabilidad total de MultiStack Systems por cualquier reclamación no excederá el monto pagado por el cliente por el servicio específico en los 30 días anteriores al incidente.",
            ]} />
          </section>

          {/* 7 */}
          <section>
            <SectionTitle num="07" title="Confidencialidad" />
            <p>
              Ambas partes se comprometen a mantener confidencial toda información técnica, comercial
              o estratégica compartida durante la prestación del servicio. Esta obligación se extiende
              por un período de <strong className="text-foreground">2 años</strong> tras la
              finalización del contrato.
            </p>
          </section>

          {/* 8 */}
          <section>
            <SectionTitle num="08" title="Suspensión y Terminación" />
            <p>
              MultiStack Systems se reserva el derecho de suspender o cancelar el acceso a la
              plataforma o los servicios en caso de: incumplimiento de estos Términos, falta de pago,
              uso fraudulento o actividad que ponga en riesgo la seguridad de la plataforma.
            </p>
            <p className="mt-4">
              En casos de terminación justificada por parte del cliente, se facturarán los trabajos
              realizados hasta la fecha de notificación formal.
            </p>
          </section>

          {/* 9 */}
          <section>
            <SectionTitle num="09" title="Modificaciones" />
            <p>
              MultiStack Systems podrá modificar estos Términos del Servicio en cualquier momento.
              Las modificaciones entrarán en vigor a los{" "}
              <strong className="text-foreground">15 días</strong> de su publicación en la
              plataforma. El uso continuado de los servicios constituye aceptación de los nuevos
              términos.
            </p>
          </section>

          {/* 10 */}
          <section>
            <SectionTitle num="10" title="Jurisdicción y Resolución de Disputas" />
            <p>
              Estos Términos del Servicio se rigen por las leyes vigentes de la República de
              Honduras. Ante cualquier controversia derivada de la interpretación, ejecución o
              incumplimiento de estos Términos, las partes se someten a la jurisdicción de los
              tribunales competentes de la ciudad de{" "}
              <strong className="text-foreground">Comayagua, Honduras</strong>, renunciando
              expresamente a cualquier otro fuero que pudiera corresponderles.
            </p>
          </section>

        </div>

        {/* Footer nav */}
        <div className="mt-16 pt-8 border-t border-border/40 flex flex-wrap items-center justify-between gap-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 font-mono text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver al inicio
          </Link>
          <Link
            to="/politica-de-privacidad"
            className="font-mono text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            ← Política de Privacidad
          </Link>
        </div>
      </main>

      {/* Scroll to top */}
      <ScrollTopButton />
    </div>
  );
}

/* ── Shared sub-components ─────────────────────────────────────────────────── */

function SectionTitle({ num, title }: { num: string; title: string }) {
  return (
    <div className="flex items-baseline gap-3 mb-5">
      <span className="font-mono text-[11px] text-primary/60 shrink-0">{num}</span>
      <h2 className="font-display text-xl font-semibold tracking-tight text-foreground">
        {title}
      </h2>
    </div>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-display text-[15px] font-semibold text-foreground/90 mt-6 mb-2">
      {children}
    </h3>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-3">
          <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function ScrollTopButton() {
  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Volver arriba"
      className="fixed bottom-8 right-8 z-40 rounded-sm p-3 border border-border/40 bg-card/80 backdrop-blur-sm text-muted-foreground hover:text-primary hover:border-primary/30 hover:bg-primary/5 transition-all duration-200 shadow-lg"
    >
      <ArrowUp className="h-4 w-4" />
    </button>
  );
}
