import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import { HookSection } from "@/components/landing/HookSection";
import ServicesSection from "@/components/ServicesSection";
import TechStack from "@/components/TechStack";
import Footer from "@/components/Footer";
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
