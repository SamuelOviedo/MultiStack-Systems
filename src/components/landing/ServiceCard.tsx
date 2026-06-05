import type { ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { ServiceCTA } from "./ServiceCTA";

export interface ServiceCardData {
  icon: ReactNode;
  eyebrow: string;
  headline: string;
  teaser: string;
  benefits: string[];
  ctaLabel: string;
  ctaIntent: string;
}

interface ServiceCardProps extends ServiceCardData {
  index: number;
  isOpen: boolean;
  onExpand: () => void;
  onCollapse: () => void;
  onToggle: () => void;
}

export function ServiceCard({
  icon,
  eyebrow,
  headline,
  teaser,
  benefits,
  ctaLabel,
  ctaIntent,
  index,
  isOpen,
  onExpand,
  onCollapse,
  onToggle,
}: ServiceCardProps) {
  const isHoverDevice = () =>
    typeof window !== "undefined" &&
    window.matchMedia("(hover: hover)").matches;

  const handleMouseEnter = () => {
    if (isHoverDevice()) onExpand();
  };
  const handleMouseLeave = () => {
    if (isHoverDevice()) onCollapse();
  };
  const handleClick = () => {
    if (!isHoverDevice()) onToggle();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.13, ease: [0.4, 0, 0.2, 1] }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      className={cn(
        "relative flex flex-col rounded-sm border bg-card/50 backdrop-blur-md cursor-pointer",
        "transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
        isOpen
          ? "border-primary/30 shadow-[0_4px_40px_hsl(var(--primary)/0.07)]"
          : "border-border/50 hover:border-primary/20"
      )}
    >
      {/* Left accent line */}
      <div
        className={cn(
          "absolute left-0 top-5 bottom-5 w-[2px] rounded-full transition-all duration-300",
          isOpen
            ? "bg-accent shadow-[-3px_0_10px_hsl(var(--accent)/0.35)]"
            : "bg-primary/15"
        )}
      />

      <div className="px-7 py-6">
        {/* Icon row + chevron */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="shrink-0 rounded-sm bg-primary/10 border border-primary/15 p-2.5">
            {icon}
          </div>
          <ChevronDown
            className={cn(
              "h-4 w-4 mt-0.5 text-muted-foreground transition-transform duration-300",
              isOpen && "rotate-180 text-accent"
            )}
          />
        </div>

        {/* Eyebrow */}
        <p className="eyebrow mb-2 text-[10px]">{eyebrow}</p>

        {/* Headline */}
        <h3 className="font-display text-[17px] font-semibold leading-snug text-foreground mb-2.5 tracking-tight">
          {headline}
        </h3>

        {/* Teaser — always visible */}
        <p className="text-sm text-muted-foreground leading-relaxed">{teaser}</p>

        {/* Expandable body */}
        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.div
              key="body"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
              className="overflow-hidden"
            >
              <ul className="mt-5 space-y-2.5">
                {benefits.map((benefit, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2.5 text-sm text-[hsl(var(--body-foreground))]"
                  >
                    <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    {benefit}
                  </li>
                ))}
              </ul>
              <ServiceCTA label={ctaLabel} intent={ctaIntent} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
