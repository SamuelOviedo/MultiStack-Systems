import { describe, it, expect, vi, beforeEach } from "vitest";

// Supabase client stub: records Edge Function invocations and inserts.
const invoke = vi.fn();
const single = vi.fn();
vi.mock("@/integrations/supabase/client", () => {
  const eq = vi.fn(async () => ({ error: null }));
  return {
    supabase: {
      functions: { invoke: (...args: unknown[]) => invoke(...args) },
      from: () => ({
        insert: () => ({ select: () => ({ single: () => single() }) }),
        update: () => ({ eq }),
      }),
    },
  };
});

import { addTeamMessage, notifyTeamReply } from "@/lib/tickets";

const TICKET_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const MESSAGE_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

describe("notifyTeamReply (S2 contract)", () => {
  beforeEach(() => { invoke.mockReset(); single.mockReset(); });

  it("sends identifiers only — never recipient, message, html or URLs", async () => {
    invoke.mockResolvedValue({ data: { ok: true }, error: null });
    await notifyTeamReply(TICKET_ID, MESSAGE_ID);

    expect(invoke).toHaveBeenCalledTimes(1);
    const [fn, options] = invoke.mock.calls[0];
    expect(fn).toBe("send-notification");
    expect(options.body).toEqual({ type: "team_reply", ticket_id: TICKET_ID, message_id: MESSAGE_ID });
  });

  it("returns true on success, false on a function error, never throws", async () => {
    invoke.mockResolvedValueOnce({ data: { ok: true }, error: null });
    await expect(notifyTeamReply(TICKET_ID, MESSAGE_ID)).resolves.toBe(true);

    invoke.mockResolvedValueOnce({ data: null, error: new Error("403") });
    await expect(notifyTeamReply(TICKET_ID, MESSAGE_ID)).resolves.toBe(false);

    invoke.mockRejectedValueOnce(new Error("network"));
    await expect(notifyTeamReply(TICKET_ID, MESSAGE_ID)).resolves.toBe(false);
  });

  it("addTeamMessage returns the new message id for the notification", async () => {
    single.mockResolvedValue({ data: { id: MESSAGE_ID }, error: null });
    await expect(addTeamMessage(TICKET_ID, "MultiStack Team", "Hola")).resolves.toBe(MESSAGE_ID);
  });
});
