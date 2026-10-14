import { lazy, Suspense } from "react";
import { Sparkles } from "lucide-react";
import { useAfterLoadIdle } from "@/hooks/useCinematicEnabled";
import { AGENT_NAME } from "./agent";

// Panel + máquina de estados + guion: chunk propio, nunca en la carga inicial.
const AiChatWidgetDemo = lazy(() => import("./AiChatWidgetDemo"));

interface AiChatLauncherProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** true tras la primera intención (mouseenter/focus/touch) sobre un disparador. */
  armed: boolean;
  onArm: () => void;
  onRequestDiagnosis: () => void;
}

/**
 * FAB de Otto, el agente de demostración (eager, mínimo: un botón). El panel se
 * monta —y su chunk se descarga— solo cuando ocurre lo primero de:
 *   1. `load` + requestIdleCallback (useAfterLoadIdle), o
 *   2. la primera intención del usuario (pointerenter / focus / touchstart), o
 *   3. un clic (abre en cuanto el chunk llega).
 * Así el hilo principal queda libre durante la carga inicial (LCP/INP).
 */
const AiChatLauncher = ({ open, onOpenChange, armed, onArm, onRequestDiagnosis }: AiChatLauncherProps) => {
  const idle = useAfterLoadIdle();
  const mounted = armed || idle || open;

  return (
    <>
      {/* Etiqueta solo-CSS (no Radix Tooltip): cero JS extra en vendor-ui, que comparte /dashboard. */}
      <button
        type="button"
        className="ms-chat-fab"
        aria-label={`Hablar con ${AGENT_NAME}, el asistente de IA (demo)`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onPointerEnter={onArm}
        onFocus={onArm}
        onTouchStart={onArm}
        onClick={() => {
          onArm();
          onOpenChange(true);
        }}
      >
        <Sparkles aria-hidden="true" size={22} />
        <span aria-hidden="true" className="ms-chat-fab-label">
          Habla con {AGENT_NAME}
        </span>
      </button>
      {mounted && (
        <Suspense fallback={null}>
          <AiChatWidgetDemo open={open} onOpenChange={onOpenChange} onRequestDiagnosis={onRequestDiagnosis} />
        </Suspense>
      )}
    </>
  );
};

export default AiChatLauncher;
