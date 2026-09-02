import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import Navbar from "@/components/common/Navbar";
import HeroSection from "@/components/marketing/HeroSection";
import { HookSection } from "@/components/marketing/HookSection";
import ServicesSection from "@/components/marketing/ServicesSection";
import TechStack from "@/components/marketing/TechStack";
import Footer from "@/components/common/Footer";
import { useMsThemeVars } from "@/lib/msTokens";

const Index = () => {
  const location = useLocation();
  const msVars = useMsThemeVars();

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
        <HeroSection />
        <HookSection />
        <ServicesSection />
        <TechStack />
        <Footer />
      </div>
    </>
  );
};

export default Index;
