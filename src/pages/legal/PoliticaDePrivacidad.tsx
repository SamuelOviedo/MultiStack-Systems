import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowUp } from "lucide-react";
import Navbar from "@/components/common/Navbar";
import { applyPageMeta } from "@/lib/pageMeta";

const TITLE = "Política de Privacidad — MultiStack Systems";
const CANONICAL = "https://www.multistacksystems.com/politica-de-privacidad";
const META_DESC  =
  "Conoce cómo MultiStack Systems recopila, usa y protege tus datos personales. Plataforma digital de tecnología e ingeniería de software con sede en Honduras.";

const providers = [
  { name: "Vercel Inc.",   role: "Hosting y despliegue de la plataforma web",                  url: "vercel.com/legal/privacy-policy" },
  { name: "Render Inc.",   role: "Despliegue y hosting de servicios backend",                  url: "render.com/privacy" },
  { name: "Supabase Inc.", role: "Base de datos (PostgreSQL), autenticación y almacenamiento", url: "supabase.com/privacy" },
  { name: "Google LLC",    role: "Autenticación OAuth 2.0; tipografías (Google Fonts); y, solo en páginas públicas, medición de conversiones de Google Ads", url: "policies.google.com/privacy" },
];

export default function PoliticaDePrivacidad() {
  useEffect(() => applyPageMeta({ title: TITLE, description: META_DESC, canonical: CANONICAL }), []);

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
            Política de Privacidad
          </h1>
          <p className="font-mono text-xs text-muted-foreground">
            Vigente desde: Octubre 2026&nbsp;&nbsp;|&nbsp;&nbsp;Versión 1.1
          </p>
        </header>

        {/* Body */}
        <div className="space-y-14 text-[hsl(var(--body-foreground))] text-base leading-[1.8]">

          {/* 1 */}
          <section>
            <SectionTitle num="01" title="Responsable del Tratamiento de Datos" />
            <p>
              El responsable del tratamiento de los datos personales recopilados a través de esta
              plataforma es <strong className="text-foreground">MultiStack Systems</strong>,
              plataforma digital de tecnología e ingeniería de software, con operaciones en
              Siguatepeque, Comayagua, Honduras.
            </p>
            <p className="mt-4">
              Para consultas relacionadas con esta Política, puede contactarnos a través de nuestro
              canal oficial de{" "}
              <a
                href="https://wa.me/50433023042"
                className="text-primary hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                WhatsApp Business
              </a>
              , o bien ingresando a nuestra plataforma en{" "}
              <a
                href="https://www.multistacksystems.com"
                className="text-primary hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                www.multistacksystems.com
              </a>{" "}
              donde, una vez autenticado, podrá enviarnos una solicitud directamente desde su cuenta
              seleccionando el tipo de solicitud{" "}
              <strong className="text-foreground">«Otro»</strong> e incluyendo sus observaciones,
              notas o recomendaciones en el campo de comentarios.
            </p>
          </section>

          {/* 2 */}
          <section>
            <SectionTitle num="02" title="Datos que Recopilamos" />
            <SubHeading>2.1 Datos proporcionados mediante autenticación OAuth</SubHeading>
            <p>
              Al iniciar sesión con Google, recopilamos automáticamente: nombre completo, dirección
              de correo electrónico, identificador único de cuenta (UID) y fotografía de perfil
              pública asociada a la cuenta de Google.
            </p>
            <SubHeading>2.2 Datos de uso y operación</SubHeading>
            <p>
              Información técnica como dirección IP, tipo de navegador, sistema operativo, páginas
              visitadas dentro de la plataforma y marcas de tiempo de acceso. Estos datos se
              recopilan de forma automática para garantizar la seguridad y el correcto funcionamiento
              del sistema.
            </p>
            <SubHeading>2.3 Datos de proyectos y tickets</SubHeading>
            <p>
              Información que usted provee voluntariamente al crear solicitudes de soporte técnico,
              tickets de servicio o requerimientos de desarrollo de software, incluyendo
              descripciones, archivos adjuntos y datos de contacto empresarial.
            </p>
            <SubHeading>2.4 Datos de facturación</SubHeading>
            <p>
              Información necesaria para la emisión de cotizaciones y contratos de servicio.
              MultiStack Systems <strong className="text-foreground">NO</strong> almacena datos de
              tarjetas de crédito ni información bancaria directamente en su plataforma.
            </p>
            <SubHeading>2.5 Medición de publicidad (Google Ads)</SubHeading>
            <p>
              Utilizamos la etiqueta de conversiones de Google Ads (Google LLC) para medir cuántas
              solicitudes de contacto provienen de nuestros anuncios. La etiqueta se carga
              únicamente en las páginas públicas: la página de inicio, /paginas-web, la Política de
              Privacidad y los Términos del Servicio. No se carga cuando usted entra directamente
              a las demás páginas del sitio, como el portal de clientes, el panel, «Mis
              solicitudes», el inicio de sesión, el registro o las pantallas de recuperación de
              contraseña. Si usted pasa a alguna de ellas navegando desde una página pública, no
              enviamos a Google ningún evento ni la dirección de esa página. Si la etiqueta todavía
              se estaba cargando en ese momento, queda desactivada hasta que usted vuelva a cargar
              el sitio: no guarda cookies, aunque Google puede recibir un aviso técnico de que su
              código terminó de cargarse, sin la dirección de la página. Tampoco se carga si usted
              abre el sitio con una sesión iniciada en la plataforma o desde un enlace que le
              enviamos por correo (confirmación de cuenta, invitación, acceso directo, cambio de
              correo o recuperación de contraseña), ni siquiera en las páginas públicas. Si usted
              inicia sesión después de que la etiqueta se cargó, dejamos de enviarle eventos a
              Google mientras su sesión siga iniciada.
            </p>
            <p className="mt-4">
              Enviamos a Google la dirección de la página visitada sin parámetros. Por separado,
              enviamos los identificadores de clic y de origen del anuncio que Google Ads agrega a
              esa dirección (como gclid, gbraid, wbraid y gad_source), para atribuir la conversión.
              Google recibe también el título de la página y el sitio desde el que
              usted llega (su dominio y, si ese sitio así lo decide, también su ruta). Cuando usted
              envía con éxito el formulario de contacto y la etiqueta ya terminó de cargarse,
              enviamos además un evento de «contacto enviado».{" "}
              <strong className="text-foreground">NO</strong> enviamos su nombre, correo
              electrónico, teléfono ni el contenido de su mensaje. No usamos conversiones mejoradas
              ni empleamos la etiqueta para personalizar anuncios ni para remarketing.
            </p>
            {/* El inventario es una observación hecha en Chromium; revísalo cuando cambie la
                etiqueta de Google. */}
            <p className="mt-4 mb-4">
              Al cargarse, Google recibe, como en cualquier visita a un sitio web, datos técnicos de
              su navegador (como la dirección IP). Además, la etiqueta puede guardar en su
              navegador los siguientes elementos de medición, todos de hasta 90 días de duración:
            </p>
            <BulletList items={[
              "Cookies en nuestro dominio principal y sus subdominios. La cookie _gcl_au se guarda cuando la etiqueta termina de cargarse mientras usted sigue en una página pública; si para entonces usted ya pasó a una página que no es pública o inició sesión, no se guarda. Si usted llega desde un anuncio de Google Ads, cuya dirección incluye los identificadores de clic o de origen del anuncio, también pueden guardarse _gcl_aw, _gcl_ag, _gcl_gb y _gcl_gs.",
              "Almacenamiento local de su navegador, un espacio parecido al de las cookies: el elemento _gcl_ls, en las mismas condiciones que _gcl_au.",
              "Cookie en los dominios de Google (google.com, doubleclick.net y googleadservices.com): GCL_AW_P, solo si usted llega con un identificador de clic.",
            ]} />
            <p className="mt-4">
              La conversión se informa a través de dominios de Google (googleadservices.com,
              doubleclick.net y google.com) y también de dominios de país de Google, como google.hn.
              La etiqueta se descarga desde googletagmanager.com, que también puede recibir avisos
              técnicos sobre su funcionamiento. Puede bloquear o borrar estas cookies y el
              almacenamiento local desde la configuración de su navegador. Para más información,
              consulte la{" "}
              <a
                href="https://policies.google.com/technologies/ads"
                className="text-primary hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                explicación de Google sobre el uso de cookies en publicidad
              </a>
              .
            </p>
          </section>

          {/* 3 */}
          <section>
            <SectionTitle num="03" title="Finalidad del Tratamiento" />
            <p className="mb-4">Los datos recopilados se utilizan exclusivamente para:</p>
            <BulletList items={[
              "Gestionar la autenticación segura de usuarios en la plataforma.",
              "Atender solicitudes de soporte técnico y proyectos de desarrollo de software.",
              "Emitir propuestas, cotizaciones y contratos de servicio.",
              "Enviar comunicaciones relacionadas con el estado de sus proyectos activos.",
              "Garantizar la seguridad e integridad de la plataforma y sus usuarios.",
              "Cumplir con obligaciones legales aplicables bajo la legislación hondureña.",
              "Medir cuántas solicitudes de contacto provienen de nuestros anuncios, mediante la etiqueta de conversiones de Google Ads (apartado 2.5).",
            ]} />
            <p className="mt-4">
              MultiStack Systems <strong className="text-foreground">NO</strong> vende, arrienda ni
              cede sus datos personales a terceros con fines comerciales o publicitarios, salvo la
              medición de conversiones de Google Ads descrita en el apartado 2.5.
            </p>
          </section>

          {/* 4 */}
          <section>
            <SectionTitle num="04" title="Proveedores de Servicio (Procesadores de Datos de Terceros)" />
            <p className="mb-6">
              Para operar esta plataforma, MultiStack Systems utiliza los siguientes servicios de
              terceros de confianza, los cuales pueden procesar datos en su nombre:
            </p>
            <div className="overflow-x-auto rounded-sm border border-border/40">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/40 bg-card/30">
                    <th className="px-4 py-3 text-left font-mono text-[11px] text-muted-foreground/60 uppercase tracking-widest">Proveedor</th>
                    <th className="px-4 py-3 text-left font-mono text-[11px] text-muted-foreground/60 uppercase tracking-widest">Función</th>
                    <th className="px-4 py-3 text-left font-mono text-[11px] text-muted-foreground/60 uppercase tracking-widest">Política</th>
                  </tr>
                </thead>
                <tbody>
                  {providers.map((p, i) => (
                    <tr key={p.name} className={i < providers.length - 1 ? "border-b border-border/30" : ""}>
                      <td className="px-4 py-3 font-display text-sm text-foreground whitespace-nowrap">{p.name}</td>
                      <td className="px-4 py-3 text-[hsl(var(--body-foreground))]">{p.role}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">{p.url}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4">
              Todos estos proveedores cuentan con certificaciones de seguridad reconocidas
              internacionalmente. Le recomendamos revisar sus políticas individualmente.
            </p>
          </section>

          {/* 5 */}
          <section>
            <SectionTitle num="05" title="Conservación de Datos" />
            <p>
              Sus datos personales se conservarán mientras mantenga una cuenta activa en la
              plataforma o mientras exista una relación comercial vigente. Una vez finalizada la
              relación, los datos se eliminarán dentro de un plazo máximo de{" "}
              <strong className="text-foreground">90 días</strong>, salvo que la legislación
              hondureña exija su conservación por un período mayor.
            </p>
          </section>

          {/* 6 */}
          <section>
            <SectionTitle num="06" title="Derechos del Usuario" />
            <p className="mb-4">Como usuario de nuestra plataforma, usted tiene derecho a:</p>
            <BulletList items={[
              "Acceso: Solicitar información sobre los datos personales que almacenamos sobre usted.",
              "Rectificación: Solicitar la corrección de datos inexactos o incompletos.",
              "Eliminación: Solicitar la supresión de sus datos, sujeto a las obligaciones legales.",
              "Portabilidad: Recibir sus datos en un formato estructurado y legible.",
              "Oposición: Oponerse al tratamiento de sus datos para determinadas finalidades.",
            ]} />
            <p className="mt-4">
              Para ejercer cualquiera de estos derechos, contáctenos a través de nuestros canales
              oficiales.
            </p>
          </section>

          {/* 7 */}
          <section>
            <SectionTitle num="07" title="Seguridad" />
            <p>
              MultiStack Systems implementa medidas técnicas y organizativas apropiadas para
              proteger sus datos contra acceso no autorizado, pérdida, alteración o divulgación.
              Esto incluye comunicaciones cifradas mediante HTTPS/TLS, autenticación segura mediante
              OAuth 2.0 y controles de acceso por roles dentro de la plataforma.
            </p>
            <p className="mt-4">
              Sin embargo, ningún sistema de transmisión por Internet es 100% seguro. El usuario es
              responsable de mantener la confidencialidad de sus credenciales de acceso.
            </p>
          </section>

          {/* 8 */}
          <section>
            <SectionTitle num="08" title="Menores de Edad" />
            <p>
              Nuestra plataforma está dirigida exclusivamente a personas mayores de 18 años o a
              representantes legales de empresas. No recopilamos intencionalmente datos de menores.
            </p>
          </section>

          {/* 9 */}
          <section>
            <SectionTitle num="09" title="Cambios a Esta Política" />
            <p>
              MultiStack Systems se reserva el derecho de actualizar esta Política de Privacidad en
              cualquier momento. Los cambios sustanciales serán notificados mediante aviso visible en
              la plataforma. El uso continuado de los servicios tras la publicación de cambios
              implica la aceptación de la nueva versión.
            </p>
          </section>

          {/* 10 */}
          <section>
            <SectionTitle num="10" title="Jurisdicción Aplicable" />
            <p>
              Esta Política se rige por las leyes vigentes de la República de Honduras. Cualquier
              controversia derivada de la interpretación o aplicación de esta Política será sometida
              a la jurisdicción de los tribunales competentes de Honduras.
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
            to="/terminos-del-servicio"
            className="font-mono text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            Términos del Servicio →
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
