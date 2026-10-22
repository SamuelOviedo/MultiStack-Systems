import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import Navbar from "@/components/common/Navbar";
import Footer from "@/components/common/Footer";
import type { ContactPrefill } from "@/components/marketing/ContactForm";
import PwChannels from "@/components/marketing/paginas-web/PwChannels";
import PwContact from "@/components/marketing/paginas-web/PwContact";
import PwEngineering from "@/components/marketing/paginas-web/PwEngineering";
import PwFaq from "@/components/marketing/paginas-web/PwFaq";
import PwHero from "@/components/marketing/paginas-web/PwHero";
import PwHonduras from "@/components/marketing/paginas-web/PwHonduras";
import PwIncludes from "@/components/marketing/paginas-web/PwIncludes";
import PwPrice from "@/components/marketing/paginas-web/PwPrice";
import PwTimeline from "@/components/marketing/paginas-web/PwTimeline";
import { CONTACT_MESSAGE_ID } from "@/components/marketing/paginas-web/ids";
import { useCinematicTheme } from "@/hooks/useCinematicTheme";
import { cinematicVars } from "@/lib/msTokens";
import { applyPageMeta, routeMetaToPageMeta } from "@/lib/pageMeta";
import { HOME_META, ROUTE_META } from "@/lib/routeMeta";
import { PAGINAS_WEB_CONTENT as CONTENT } from "./paginasWebContent";

const META = ROUTE_META["/paginas-web"];

/** Al salir por el SPA se devuelve el head de la home, no el de la landing (ver `restoreTo` en pageMeta.ts). */
const PAGE_META = routeMetaToPageMeta(META);
const HOME_PAGE_META = routeMetaToPageMeta(HOME_META);

/**
 * Landing del anuncio «Páginas web en Honduras»: chunk propio (lazy en App) y oferta aparte, no toca la
 * home. Todo el texto sale de PAGINAS_WEB_CONTENT.
 */
const PaginasWeb = () => {
  const { hash } = useLocation();
  // Tokens MS con los tonos AA del conjunto cinemático; los contrastes están en msTokens.ts.
  const vars = cinematicVars(useCinematicTheme());
  // Solo la acción de una persona crea el prefill: ContactForm mueve el foco al nombre al recibirlo.
  const [contactPrefill, setContactPrefill] = useState<ContactPrefill>();
  const prefillApplied = useRef(false);

  useEffect(() => applyPageMeta(PAGE_META, { restoreTo: HOME_PAGE_META }), []);

  // Chunk lazy: con hash en la URL (p. ej. /paginas-web#precio) el navegador no encuentra la ancla a
  // tiempo. Salto directo, sin animación. El margen bajo la barra lo pone .ms-landing [id].
  useEffect(() => {
    const id = hash.replace(/^#/, "");
    if (!id) return;
    const frame = requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "auto" });
    });
    return () => cancelAnimationFrame(frame);
  }, [hash]);

  // CTA hacia #contacto: la navegación nativa a la ancla no se cancela; esto solo prellena el mensaje,
  // como máximo una vez por visita y sin pisar lo que la persona escribió. El valor del campo se lee
  // del DOM porque ContactForm es dueño de su estado. Si tiene texto no se marca como aplicado: si lo
  // borra, el primer CTA posterior sí prellena.
  const requestQuote = useCallback(() => {
    if (prefillApplied.current) return;
    const field = document.getElementById(CONTACT_MESSAGE_ID);
    if (field instanceof HTMLTextAreaElement && field.value.trim() !== "") return;
    prefillApplied.current = true;
    // Se aplica una sola vez, así que el nonce nunca pasa de 1.
    setContactPrefill({ text: CONTENT.contact.messagePrefill, nonce: 1 });
  }, []);

  return (
    <>
      <Navbar />
      <div
        className="ms-landing"
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
          <PwHero hero={CONTENT.hero} onContact={requestQuote} />
          <PwIncludes includes={CONTENT.includes} />
          <PwPrice price={CONTENT.price} onContact={requestQuote} />
          <PwTimeline timeline={CONTENT.timeline} onContact={requestQuote} />
          <PwEngineering engineering={CONTENT.engineering} />
          <PwHonduras honduras={CONTENT.honduras} />
          <PwChannels
            head={CONTENT.support}
            text={CONTENT.support.text}
            links={CONTENT.support.channels}
            onContact={requestQuote}
          />
          <PwChannels head={CONTENT.social} text={CONTENT.social.text} links={CONTENT.social.links} alt />
          <PwFaq faq={CONTENT.faq} />
          <PwContact contact={CONTENT.contact} prefill={contactPrefill} />
        </main>
        <Footer />
      </div>
    </>
  );
};

export default PaginasWeb;
