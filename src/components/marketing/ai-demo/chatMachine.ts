import { GREETING, type DemoReply } from "./demoScript";

export interface ChatMessage {
  id: number;
  from: "user" | "agent";
  text: string;
  cta?: boolean;
}

/** idle → (SEND) → typing → (REPLY) → idle. RESET vuelve al saludo. */
export interface ChatState {
  status: "idle" | "typing";
  messages: ChatMessage[];
  nextId: number;
}

export type ChatEvent =
  | { type: "SEND"; text: string }
  | { type: "REPLY"; reply: DemoReply }
  | { type: "RESET" };

export const initialChatState: ChatState = {
  status: "idle",
  messages: [{ id: 0, from: "agent", text: GREETING }],
  nextId: 1,
};

export function chatReducer(state: ChatState, event: ChatEvent): ChatState {
  switch (event.type) {
    case "SEND": {
      const text = event.text.trim();
      // Un turno a la vez: se ignoran envíos vacíos o mientras "escribe".
      if (!text || state.status === "typing") return state;
      return {
        status: "typing",
        messages: [...state.messages, { id: state.nextId, from: "user", text }],
        nextId: state.nextId + 1,
      };
    }
    case "REPLY":
      if (state.status !== "typing") return state;
      return {
        status: "idle",
        messages: [
          ...state.messages,
          { id: state.nextId, from: "agent", text: event.reply.text, cta: event.reply.cta },
        ],
        nextId: state.nextId + 1,
      };
    case "RESET":
      return initialChatState;
  }
}
