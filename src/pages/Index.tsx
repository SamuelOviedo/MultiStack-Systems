import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import { HookSection } from "@/components/landing/HookSection";
import ServicesSection from "@/components/ServicesSection";
import TechStack from "@/components/TechStack";
import Footer from "@/components/Footer";

const Index = () => {
  const location = useLocation();

  useEffect(() => {
    const id = location.hash.replace(/^#/, "");
    if (!id) return;
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    });
  }, [location]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <HeroSection />
      <HookSection />
      <ServicesSection />
      <TechStack />
      <Footer />
    </div>
  );
};

export default Index;
