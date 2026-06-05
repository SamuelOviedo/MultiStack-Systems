import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { motion } from "framer-motion";

interface ServiceCTAProps {
  label: string;
  intent: string;
}

export function ServiceCTA({ label, intent }: ServiceCTAProps) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const targetPath = `/dashboard/new-request${intent}`;
    if (user) {
      navigate(targetPath);
    } else {
      sessionStorage.setItem("postLoginIntent", intent);
      navigate(`/login?redirect=${encodeURIComponent(targetPath)}`);
    }
  };

  return (
    <motion.button
      type="button"
      onClick={handleClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      className="group/cta mt-5 inline-flex items-center gap-2 rounded-sm bg-primary/10 border border-primary/30 px-4 py-2.5 text-sm font-display font-medium text-primary hover:bg-primary/20 hover:shadow-[0_0_16px_hsl(var(--primary)/0.25)] transition-all duration-200"
    >
      <span>{label}</span>
      <span className="font-mono text-xs transition-transform duration-200 group-hover/cta:translate-x-1">
        →
      </span>
    </motion.button>
  );
}
