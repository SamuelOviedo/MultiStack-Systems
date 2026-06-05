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

  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.13, ease: [0.4, 0, 0.2, 1] }}
      onMouseEnter={() => { if (isHoverDevice()) onExpand(); }}
      onMouseLeave={() => { if (isHoverDevice()) onCollapse(); }}
      onClick={() => { if (!isHoverDevice()) onToggle(); }}
      className={cn(
        "relative flex flex-col rounded-sm border bg-card/50 backdrop-blur-md cursor-pointer",
        "transition-[border-color,box-shadow] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
        isOpen
          ? "border-primary/25 shadow-[0_4px_40px_hsl(var(--primary)/0.07)]"
          : "border-border/50 hover:border-primary/20"
      )}
    >
      {/* Left accent bar */}
      <div
        className={cn(
          "absolute left-0 top-5 bottom-5 w-[2px] rounded-full",
          "transition-[background-color,box-shadow] duration-300",
          isOpen
            ? "bg-accent shadow-[-3px_0_10px_hsl(var(--accent)/0.4)]"
            : "bg-primary/15"
        )}
      />

      <div className="px-7 py-6">
        {/* Icon + chevron row */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="shrink-0 rounded-sm bg-primary/10 border border-primary/15 p-2.5">
            {icon}
          </div>
          <ChevronDown
            className={cn(
              "h-4 w-4 mt-0.5 shrink-0",
              "transition-[transform,color] duration-300",
              isOpen ? "rotate-180 text-accent" : "text-muted-foreground/50"
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
        <p
          className={cn(
            "text-sm leading-relaxed transition-colors duration-300",
            isOpen ? "text-muted-foreground/80" : "text-muted-foreground"
          )}
        >
          {teaser}
        </p>

        {/* Expandable content */}
        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.div
              key="expanded"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{
                height:  { duration: 0.35, ease: [0.4, 0, 0.2, 1] },
                opacity: { duration: 0.25, ease: "easeOut" },
              }}
              className="overflow-hidden"
            >
              {/* Divider */}
              <div className="mt-5 mb-4 h-px bg-border/40" />

              {/* Benefits */}
              <ul className="space-y-2.5">
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

              {/* CTA */}
              <div className="mt-5">
                <ServiceCTA label={ctaLabel} intent={ctaIntent} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
