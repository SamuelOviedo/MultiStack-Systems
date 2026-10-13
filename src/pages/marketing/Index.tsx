import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import Navbar from "@/components/common/Navbar";
import HeroSection from "@/components/marketing/HeroSection";
import CinematicBackground from "@/components/marketing/cinematic/CinematicBackground";
import DevSceneSwitcher from "@/components/marketing/cinematic/DevSceneSwitcher";
import ProductsShowcase from "@/components/marketing/ProductsShowcase";
import EcosystemConnect from "@/components/marketing/EcosystemConnect";
import TechStack from "@/components/marketing/TechStack";
import BuiltHonduras from "@/components/marketing/BuiltHonduras";
import ContactSplit from "@/components/marketing/ContactSplit";
import Footer from "@/components/common/Footer";
import { CINEMATIC_VARS, useMsThemeVars } from "@/lib/msTokens";
import { CINEMATIC_SCENES } from "@/lib/cinematicScenes";
import type { CinematicSceneId } from "@/types/cinematic";

const Index = () => {
  const location = useLocation();
  const msVars = useMsThemeVars();
  // F1: only the hero scene is live. F2 derives this from scroll position.
  const [devScene, setDevScene] = useState<CinematicSceneId>("hero");
  const activeScene: CinematicSceneId = import.meta.env.DEV ? devScene : "hero";

  useEffect(() => {
    const id = location.hash.replace(/^#/, "");
    if (!id) return;
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    });
  }, [location]);

  return (
    <>
      <Navbar />
      <div
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
        <div className="ms-cine" style={CINEMATIC_VARS}>
          <div className="ms-cine-stage">
            <div className="ms-cine-stage-pin">
              <CinematicBackground scenes={CINEMATIC_SCENES} activeSceneId={activeScene} />
            </div>
          </div>
          <div className="ms-cine-content">
            <HeroSection />
          </div>
        </div>

        <ProductsShowcase />
        <EcosystemConnect />
        <TechStack />
        <div id="empresa">
          <BuiltHonduras />
        </div>
        <ContactSplit />
        <Footer />
      </div>
      {import.meta.env.DEV && <DevSceneSwitcher value={devScene} onChange={setDevScene} />}
    </>
  );
};

export default Index;
