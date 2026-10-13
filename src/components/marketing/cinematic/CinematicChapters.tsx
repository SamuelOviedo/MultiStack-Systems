import { useEffect } from "react";
import { LazyMotion, MotionConfig } from "framer-motion";
import AgentValueSection from "@/components/marketing/AgentValueSection";
import ZeroPaperSection from "@/components/marketing/ZeroPaperSection";
import type { CinematicSceneId, ScrubSource } from "@/types/cinematic";
import type { AiServiceSlug } from "@/types/aiServices";

const loadMotionFeatures = () => import("./motionFeatures").then((mod) => mod.default);

interface CinematicChaptersProps {
  /** Fired once mounted, so Index re-observes the new sections (scroll-spy + hash). */
  onReady: () => void;
  onScrubSource: (sceneId: CinematicSceneId, source: ScrubSource) => void;
  onRequestService: (slug: AiServiceSlug) => void;
}

/**
 * Scroll-driven chapters after the hero. Lazy-loaded by Index: this module is
 * the ONLY entry point to framer-motion, so the library never lands in the
 * entry chunk shared with /dashboard (spec Parte B §6, SC-004).
 * `strict` makes any accidental `motion.*` (non-lazy) component throw.
 */
const CinematicChapters = ({ onReady, onScrubSource, onRequestService }: CinematicChaptersProps) => {
  useEffect(() => {
    onReady();
  }, [onReady]);

  return (
    <LazyMotion features={loadMotionFeatures} strict>
      <MotionConfig reducedMotion="user">
        <AgentValueSection onScrubSource={onScrubSource} onRequestService={onRequestService} />
        <ZeroPaperSection onScrubSource={onScrubSource} onRequestService={onRequestService} />
      </MotionConfig>
    </LazyMotion>
  );
};

export default CinematicChapters;
