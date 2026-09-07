import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import Navbar from "@/components/common/Navbar";
import HeroSection from "@/components/marketing/HeroSection";
import ProductsShowcase from "@/components/marketing/ProductsShowcase";
import EcosystemConnect from "@/components/marketing/EcosystemConnect";
import TechStack from "@/components/marketing/TechStack";
import BuiltHonduras from "@/components/marketing/BuiltHonduras";
import ContactSplit from "@/components/marketing/ContactSplit";
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
        <ProductsShowcase />
        <EcosystemConnect />
        <TechStack />
        <div id="empresa">
          <BuiltHonduras />
        </div>
        <ContactSplit />
        <Footer />
      </div>
    </>
  );
};

export default Index;
