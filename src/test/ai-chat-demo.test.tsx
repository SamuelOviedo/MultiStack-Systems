import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import AiChatWidgetDemo from "@/components/marketing/ai-demo/AiChatWidgetDemo";
import { chatReducer, initialChatState } from "@/components/marketing/ai-demo/chatMachine";
import { GREETING, SUGGESTIONS, getDemoReply, typingDelay } from "@/components/marketing/ai-demo/demoScript";

beforeEach(() => {
  // jsdom no implementa estas APIs que usan Radix ScrollArea / el auto-scroll.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("demoScript", () => {
  it("resuelve intenciones sin importar acentos ni mayúsculas", () => {
    expect(getDemoReply("¿Cuánto TARDA implementarlo?").text).toMatch(/3 a 4 semanas/);
    expect(getDemoReply("¿Cuanto cuesta?").cta).toBe(true);
    expect(getDemoReply("¿Cómo funciona con mis documentos?").text).toMatch(/RAG/);
    expect(getDemoReply("¿se conecta con mi ERP?").text).toMatch(/n8n/);
  });

  it("todas las sugerencias tienen respuesta específica (no el fallback)", () => {
    const fallback = getDemoReply("zzz sin coincidencias");
    for (const s of SUGGESTIONS) expect(getDemoReply(s)).not.toBe(fallback);
    expect(fallback.cta).toBe(true);
  });

  it("acota el tiempo de escritura a 700–1400 ms", () => {
    expect(typingDelay({ text: "a" })).toBe(700);
    expect(typingDelay({ text: "a".repeat(1000) })).toBe(1400);
  });
});

describe("chatMachine", () => {
  it("idle → typing → idle, un turno a la vez", () => {
    let s = chatReducer(initialChatState, { type: "SEND", text: "  hola  " });
    expect(s.status).toBe("typing");
    expect(s.messages.at(-1)).toMatchObject({ from: "user", text: "hola" });

    expect(chatReducer(s, { type: "SEND", text: "otra" })).toBe(s); // ignorado mientras escribe
    s = chatReducer(s, { type: "REPLY", reply: { text: "respuesta", cta: true } });
    expect(s.status).toBe("idle");
    expect(s.messages.at(-1)).toMatchObject({ from: "agent", text: "respuesta", cta: true });
  });

  it("ignora envíos vacíos y RESET vuelve al saludo", () => {
    expect(chatReducer(initialChatState, { type: "SEND", text: "   " })).toBe(initialChatState);
    const s = chatReducer(initialChatState, { type: "SEND", text: "x" });
    expect(chatReducer(s, { type: "RESET" }).messages).toEqual([
      { id: 0, from: "agent", text: GREETING },
    ]);
  });
});

describe("AiChatLauncher · carga diferida", () => {
  it("no monta el panel hasta la primera intención (ni antes del idle)", async () => {
    vi.resetModules();
    vi.doMock("@/components/marketing/ai-demo/AiChatWidgetDemo", () => ({
      default: () => <div data-testid="chat-panel" />,
    }));
    // Idle que nunca llega durante el test.
    window.requestIdleCallback = (() => 1) as unknown as typeof window.requestIdleCallback;
    const { default: AiChatLauncher } = await import("@/components/marketing/ai-demo/AiChatLauncher");

    const props = { open: false, onOpenChange: vi.fn(), onArm: vi.fn(), onRequestDiagnosis: vi.fn() };
    const { rerender } = render(<AiChatLauncher {...props} armed={false} />);
    await act(() => new Promise((r) => setTimeout(r, 20)));
    expect(screen.queryByTestId("chat-panel")).toBeNull();

    fireEvent.pointerEnter(screen.getByRole("button", { name: /Probar el agente de IA/ }));
    expect(props.onArm).toHaveBeenCalled();
    rerender(<AiChatLauncher {...props} armed />);
    expect(await screen.findByTestId("chat-panel")).toBeInTheDocument();
    vi.doUnmock("@/components/marketing/ai-demo/AiChatWidgetDemo");
  });
});

describe("AiChatWidgetDemo", () => {
  const renderOpen = (onRequestDiagnosis = vi.fn()) => {
    const onOpenChange = vi.fn();
    render(<AiChatWidgetDemo open onOpenChange={onOpenChange} onRequestDiagnosis={onRequestDiagnosis} />);
    return { onOpenChange, onRequestDiagnosis };
  };

  it("se rotula como demo, saluda y ofrece sugerencias", () => {
    renderOpen();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Demo — respuestas simuladas")).toBeInTheDocument();
    expect(screen.getByText(GREETING)).toBeInTheDocument();
    expect(screen.getByRole("log")).toHaveAttribute("aria-live", "polite");
    for (const s of SUGGESTIONS) expect(screen.getByRole("button", { name: s })).toBeInTheDocument();
  });

  it("muestra 'escribiendo…' y luego la respuesta guionizada", async () => {
    renderOpen();
    fireEvent.click(screen.getByRole("button", { name: SUGGESTIONS[1] }));
    expect(screen.getByText("El agente está escribiendo…")).toBeInTheDocument();
    // La sugerencia usada desaparece de los chips.
    expect(screen.queryByRole("button", { name: SUGGESTIONS[1] })).toBeNull();
    await waitFor(() => expect(screen.getByText(/3 a 4 semanas/)).toBeInTheDocument(), { timeout: 2500 });
    expect(screen.queryByText("El agente está escribiendo…")).toBeNull();
  });

  it("Enter envía, Shift+Enter no", async () => {
    renderOpen();
    const input = screen.getByLabelText("Escribe tu pregunta");
    fireEvent.change(input, { target: { value: "¿cuánto cuesta?" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    expect((input as HTMLTextAreaElement).value).toBe("¿cuánto cuesta?");
    fireEvent.keyDown(input, { key: "Enter" });
    expect((input as HTMLTextAreaElement).value).toBe("");
    expect(screen.getByText("¿cuánto cuesta?")).toBeInTheDocument();
  });

  it("el CTA cierra el panel para llevar al formulario de contacto", async () => {
    const { onOpenChange } = renderOpen();
    fireEvent.click(screen.getByRole("button", { name: SUGGESTIONS[1] }));
    const cta = await screen.findByRole("button", { name: "Agenda un diagnóstico" }, { timeout: 2500 });
    fireEvent.click(cta);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
