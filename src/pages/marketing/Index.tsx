import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Navbar from "@/components/common/Navbar";
import Footer from "@/components/common/Footer";
import type { ContactPrefill } from "@/components/marketing/ContactForm";
import HomeCombo from "@/components/marketing/home/HomeCombo";
import HomeFinalCta from "@/components/marketing/home/HomeFinalCta";
import HomeHero from "@/components/marketing/home/HomeHero";
import HomePlans from "@/components/marketing/home/HomePlans";
import HomeProcess from "@/components/marketing/home/HomeProcess";
import HomeServices from "@/components/marketing/home/HomeServices";
import HomeWhy from "@/components/marketing/home/HomeWhy";
import PwContact from "@/components/marketing/paginas-web/PwContact";
import PwFaq from "@/components/marketing/paginas-web/PwFaq";
import { CONTACT_MESSAGE_ID } from "@/components/marketing/paginas-web/ids";
import { useCinematicTheme } from "@/hooks/useCinematicTheme";
import { useRevealOnScroll } from "@/hooks/useRevealOnScroll";
import { cinematicVars } from "@/lib/msTokens";
import { HOME_CONTENT as CONTENT, HOME_SECTION_IDS, type HomeService } from "./homeContent";

const COMBO_ID = CONTENT.combo.packageId;
// El otro paquete de la tarjeta de planes: el contenido los trae en orden, Combo primero.
const STANDARD_ID = CONTENT.plans.packages.filter((pkg) => pkg.id !== COMBO_ID)[0].id;

const prefersReducedMotion = () =>
  typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Home pública: MultiStack Systems como negocio de páginas web. Combo Emprendedor primero, Plan Estándar
 * después; el software a medida y los agentes de IA son servicios secundarios, solo bajo cotización. Todo el
 * texto y las cifras salen de HOME_CONTENT (homeContent.ts), que a su vez toma los precios de PACKAGES.
 * `/paginas-web` sigue siendo una landing aparte.
 */
const Index = () => {
  const { hash, key } = useLocation();
  const navigate = useNavigate();
  // Tokens MS con los tonos AA del conjunto cinemático (los mismos de /paginas-web); contrastes en msTokens.ts.
  const vars = cinematicVars(useCinematicTheme());
  const rootRef = useRef<HTMLDivElement>(null);
  useRevealOnScroll(rootRef);

  // Solo la acción de una persona crea el prefill: ContactForm mueve el foco al nombre al recibirlo.
  const [contactPrefill, setContactPrefill] = useState<ContactPrefill>();
  const defaultPrefillApplied = useRef(false);

  // Con hash en la URL (p. ej. /#planes al volver de otra ruta) el navegador no encuentra la ancla a tiempo. `key`
  // cambia con cada navegación, también hacia el mismo hash: el segundo CTA de servicio vuelve a desplazar.
  useEffect(() => {
    const id = hash.replace(/^#/, "");
    if (!id) return;
    const frame = requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth" });
    });
    return () => cancelAnimationFrame(frame);
  }, [hash, key]);

  // CTA de un servicio: reemplaza el mensaje por el de ese servicio (cada clic aplica de nuevo: nonce nuevo) y va a
  // #contacto con el router. La navegación nativa a un ancla quitaría el foco que ContactForm acaba de poner en el nombre.
  const requestService = useCallback(
    (service: HomeService) => {
      setContactPrefill((prev) => ({ text: service.messagePrefill, nonce: (prev?.nonce ?? 0) + 1 }));
      navigate({ hash: HOME_SECTION_IDS.contact });
    },
    [navigate],
  );

  // Llegada a #contacto desde la barra: prellena el mensaje por defecto una sola vez y sin pisar lo que la
  // persona ya escribió. El valor del campo se lee del DOM porque ContactForm es dueño de su estado.
  const requestDefaultPrefill = useCallback((id: string) => {
    if (id !== HOME_SECTION_IDS.contact || defaultPrefillApplied.current) return;
    const field = document.getElementById(CONTACT_MESSAGE_ID);
    if (field instanceof HTMLTextAreaElement && field.value.trim() !== "") return;
    defaultPrefillApplied.current = true;
    setContactPrefill((prev) => prev ?? { text: CONTENT.contact.messagePrefill, nonce: 1 });
  }, []);

  return (
    <>
      <Navbar homeNav={CONTENT.nav} onHomeNavigate={requestDefaultPrefill} />
      <div
        ref={rootRef}
        className="ms-landing ms-home"
        style={{
          ...vars,
          minHeight: "100vh",
          width: "100%",
          fontFamily: "'Hanken Grotesk', system-ui, sans-serif",
          background: "var(--bg)",
          color: "var(--text)",
        }}
      >
        <main>
          <HomeHero hero={CONTENT.hero} primaryPackageId={COMBO_ID} />
          <HomeCombo combo={CONTENT.combo} />
          <HomePlans plans={CONTENT.plans} />
          <HomeWhy why={CONTENT.why} />
          <HomeProcess process={CONTENT.process} />
          <HomeServices services={CONTENT.services} onRequest={requestService} />
          <PwFaq faq={CONTENT.faq} alt />
          <HomeFinalCta cta={CONTENT.finalCta} comboId={COMBO_ID} standardId={STANDARD_ID} />
          <PwContact contact={CONTENT.contact} prefill={contactPrefill} />
        </main>
        <Footer />
      </div>
    </>
  );
};

export default Index;
