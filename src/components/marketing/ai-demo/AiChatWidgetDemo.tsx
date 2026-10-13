import { useEffect, useReducer, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { RotateCcw, SendHorizontal } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { chatReducer, initialChatState } from "./chatMachine";
import { SUGGESTIONS, getDemoReply, typingDelay } from "./demoScript";

const MOBILE_QUERY = "(max-width: 767px)";
const isMobileViewport = () =>
  typeof window.matchMedia === "function" && window.matchMedia(MOBILE_QUERY).matches;
const prefersReducedMotion = () =>
  typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

interface AiChatWidgetDemoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Cierra el chat y lleva al formulario de contacto prellenado. */
  onRequestDiagnosis: () => void;
}

/**
 * Panel de chat simulado (spec Capa 5). Se carga con React.lazy desde
 * AiChatLauncher: ni este módulo ni la máquina de estados forman parte de la
 * carga inicial. Radix (Sheet) aporta trampa de foco, Esc y bloqueo de scroll
 * del fondo; el retorno del foco al disparador (FAB o CTA del hero) se hace
 * aquí, porque sin <SheetTrigger> Radix no sabe a quién devolverlo.
 *
 * Se fuerza el tema oscuro con la clase `dark` (tokens HSL de shadcn) porque
 * el panel flota sobre las escenas cinemáticas (spec C-3). NO se le aplican
 * los tokens MS: `--primary`/`--accent` en hex romperían `hsl(var(--primary))`
 * de los primitivos shadcn. El CSS propio usa variables `--chat-*`.
 */
const AiChatWidgetDemo = ({ open, onOpenChange, onRequestDiagnosis }: AiChatWidgetDemoProps) => {
  const [state, dispatch] = useReducer(chatReducer, initialChatState);
  const [draft, setDraft] = useState("");
  const [mobile] = useState(isMobileViewport);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pendingDiagnosis = useRef(false);
  const openerRef = useRef<HTMLElement | null>(null);

  const lastMessage = state.messages[state.messages.length - 1];
  const asked = new Set(state.messages.filter((m) => m.from === "user").map((m) => m.text));
  const suggestions = SUGGESTIONS.filter((s) => !asked.has(s));
  const typing = state.status === "typing";

  // typing → respuesta guionizada tras un "escribiendo…" realista.
  useEffect(() => {
    if (!typing || lastMessage.from !== "user") return;
    const reply = getDemoReply(lastMessage.text);
    const timer = window.setTimeout(() => dispatch({ type: "REPLY", reply }), typingDelay(reply));
    return () => window.clearTimeout(timer);
  }, [typing, lastMessage]);

  // Mantiene visible el último mensaje (y el indicador de escritura).
  useEffect(() => {
    const viewport = scrollRef.current?.querySelector<HTMLElement>("[data-radix-scroll-area-viewport]");
    viewport?.scrollTo({ top: viewport.scrollHeight, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }, [state.messages.length, typing, open]);

  const send = (text: string) => {
    if (!text.trim() || typing) return;
    dispatch({ type: "SEND", text });
    setDraft("");
    if (inputRef.current) inputRef.current.style.height = "";
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    send(draft);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send(draft);
    }
  };

  const autoGrow = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  };

  const requestDiagnosis = () => {
    pendingDiagnosis.current = true;
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={mobile ? "bottom" : "right"}
        closeLabel="Cerrar chat"
        overlayClassName="bg-black/40 backdrop-blur-[2px]"
        className={cn(
          "dark ms-chat-panel flex flex-col gap-0 p-0 text-foreground",
          mobile ? "h-[85dvh] rounded-t-2xl" : "w-full sm:max-w-md",
        )}
        onOpenAutoFocus={(e) => {
          // Aún no se ha movido el foco: este es el disparador.
          openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          // Desktop: listo para escribir. Móvil: sin abrir el teclado de golpe.
          if (mobile) return;
          e.preventDefault();
          inputRef.current?.focus();
        }}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          if (pendingDiagnosis.current) {
            pendingDiagnosis.current = false;
            requestAnimationFrame(onRequestDiagnosis); // el formulario de contacto toma el foco
            return;
          }
          const opener = openerRef.current;
          const target =
            opener && opener !== document.body && opener.isConnected
              ? opener
              : document.querySelector<HTMLElement>(".ms-chat-fab");
          target?.focus({ preventScroll: true });
        }}
      >
        <SheetHeader className="ms-chat-head space-y-0 text-left">
          <div className="flex items-center gap-3 pr-8">
            <Avatar className="h-10 w-10 rounded-xl">
              <AvatarFallback className="ms-chat-avatar rounded-xl">IA</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <SheetTitle className="text-base">Agente MultiStack</SheetTitle>
              <div className="ms-chat-online">
                <span aria-hidden="true" className="ms-chip-dot" style={{ background: "var(--chat-success)" }} />
                en línea
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-3">
            <Badge variant="outline" className="ms-chat-badge">
              Demo — respuestas simuladas
            </Badge>
          </div>
          <SheetDescription className="sr-only">
            Conversación de demostración con un agente de IA. Las respuestas son simuladas y nada sale de tu
            navegador.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea ref={scrollRef} className="min-h-0 flex-1">
          <div role="log" aria-live="polite" aria-relevant="additions" aria-label="Conversación" className="ms-chat-messages">
            {state.messages.map((msg) => (
              <div key={msg.id} className={cn("ms-chat-msg", msg.from === "user" && "is-user")}>
                <span className="sr-only">{msg.from === "user" ? "Tú:" : "Agente:"} </span>
                <p>{msg.text}</p>
                {msg.cta && (
                  <Button size="sm" className="ms-chat-cta" onClick={requestDiagnosis}>
                    Agenda un diagnóstico
                  </Button>
                )}
              </div>
            ))}
            {typing && (
              <div className="ms-chat-msg ms-chat-typing">
                <span className="sr-only">El agente está escribiendo…</span>
                <span aria-hidden="true" />
                <span aria-hidden="true" />
                <span aria-hidden="true" />
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="ms-chat-composer">
          {suggestions.length > 0 && (
            <div className="ms-chat-suggestions" aria-label="Preguntas sugeridas">
              {suggestions.map((s) => (
                <Button
                  key={s}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="ms-chat-suggestion"
                  disabled={typing}
                  onClick={() => send(s)}
                >
                  {s}
                </Button>
              ))}
            </div>
          )}
          <form onSubmit={handleSubmit} className="flex items-end gap-2">
            <label htmlFor="ms-chat-input" className="sr-only">
              Escribe tu pregunta
            </label>
            <Textarea
              id="ms-chat-input"
              ref={inputRef}
              rows={1}
              value={draft}
              placeholder="Escribe tu pregunta…"
              onChange={(e) => {
                setDraft(e.target.value);
                autoGrow(e.target);
              }}
              onKeyDown={handleKeyDown}
              className="ms-chat-input min-h-[44px] resize-none"
            />
            <Button type="submit" size="icon" className="h-11 w-11 shrink-0" disabled={typing || !draft.trim()} aria-label="Enviar mensaje">
              <SendHorizontal />
            </Button>
          </form>
          <div className="ms-chat-foot">
            <span>Demo sin conexión: tus mensajes no salen de tu navegador.</span>
            <button
              type="button"
              className="ms-chat-reset"
              onClick={() => dispatch({ type: "RESET" })}
              disabled={state.messages.length === 1}
            >
              <RotateCcw aria-hidden="true" size={12} /> Reiniciar
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default AiChatWidgetDemo;
