import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import Navbar from "@/components/common/Navbar";
import HeroSection from "@/components/marketing/HeroSection";
import CinematicBackground from "@/components/marketing/cinematic/CinematicBackground";
import AiServicesCatalog from "@/components/marketing/AiServicesCatalog";
import EcosystemConnect from "@/components/marketing/EcosystemConnect";
import TechStack from "@/components/marketing/TechStack";
import BuiltHonduras from "@/components/marketing/BuiltHonduras";
import ContactSplit from "@/components/marketing/ContactSplit";
import type { ContactPrefill } from "@/components/marketing/ContactForm";
import Footer from "@/components/common/Footer";
import { CINEMATIC_VARS, useMsThemeVars } from "@/lib/msTokens";
import { CINEMATIC_SCENES } from "@/lib/cinematicScenes";
import { getAiService, serviceContactMessage } from "@/lib/aiServices";
import { useActiveScene } from "@/hooks/useActiveScene";
import type { CinematicSceneId, ScrubSource } from "@/types/cinematic";
import type { AiService, AiServiceSlug } from "@/types/aiServices";

// Only entry point to framer-motion: keeps it out of the chunk /dashboard shares.
const CinematicChapters = lazy(() => import("@/components/marketing/cinematic/CinematicChapters"));

/** Section anchor → cinematic scene, for the backdrop's scroll-spy. */
const SCENE_SECTIONS = { hero: "hero", agente: "agent", automatizacion: "automation" } as const;

type ScrubSources = Partial<Record<CinematicSceneId, ScrubSource>>;

const Index = () => {
  const location = useLocation();
  const msVars = useMsThemeVars();
  const [chaptersReady, setChaptersReady] = useState(false);
  const [scrubSources, setScrubSources] = useState<ScrubSources>({});
  const [contactPrefill, setContactPrefill] = useState<ContactPrefill>();
  const activeScene = useActiveScene(SCENE_SECTIONS, chaptersReady);

  // Re-run after the lazy chapters mount: they shift everything below them.
  useEffect(() => {
    const id = location.hash.replace(/^#/, "");
    if (!id) return;
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    });
  }, [location, chaptersReady]);

  const handleChaptersReady = useCallback(() => setChaptersReady(true), []);

  const registerScrubSource = useCallback((sceneId: CinematicSceneId, source: ScrubSource) => {
    setScrubSources((prev) => (prev[sceneId] === source ? prev : { ...prev, [sceneId]: source }));
  }, []);

  const requestService = useCallback((service: AiService) => {
    setContactPrefill((prev) => ({ text: serviceContactMessage(service), nonce: (prev?.nonce ?? 0) + 1 }));
    document.getElementById("contacto")?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const requestServiceBySlug = useCallback(
    (slug: AiServiceSlug) => requestService(getAiService(slug)),
    [requestService],
  );

  return (
    <>
      <Navbar variant="overlay" />
      <div
        className="ms-landing"
        style={{
          ...msVars,
          minHeight: "100vh",
          width: "100%",
          fontFamily: "'Hanken Grotesk', system-ui, sans-serif",
          background: "var(--bg)",
          color: "var(--text)",
        }}
      >
        {/* Escenas cinemáticas: siempre tokens oscuros (spec C-3). */}
        <div className="ms-cine" style={CINEMATIC_VARS} data-nav-overlay>
          <div className="ms-cine-stage">
            <div className="ms-cine-stage-pin">
              <CinematicBackground
                scenes={CINEMATIC_SCENES}
                activeSceneId={activeScene}
                scrubSources={scrubSources}
              />
            </div>
          </div>
          <div className="ms-cine-content">
            <HeroSection />
            <Suspense fallback={<div className="ms-chapters-placeholder" aria-hidden="true" />}>
              <CinematicChapters
                onReady={handleChaptersReady}
                onScrubSource={registerScrubSource}
                onRequestService={requestServiceBySlug}
              />
            </Suspense>
          </div>
        </div>

        <AiServicesCatalog onSelect={requestService} />
        <EcosystemConnect />
        <TechStack />
        <div id="empresa">
          <BuiltHonduras />
        </div>
        <ContactSplit prefill={contactPrefill} />
        <Footer />
      </div>
    </>
  );
};

export default Index;
