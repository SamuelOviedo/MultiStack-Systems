import { describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";

// Isolated file: this suite loads the REAL AuthProvider with a stubbed client.
let listener: ((event: string, session: unknown) => void) | undefined;
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: (cb: typeof listener) => { listener = cb; return { data: { subscription: { unsubscribe: () => {} } } }; },
      signOut: vi.fn(),
    },
    functions: { invoke: vi.fn().mockResolvedValue({}) },
    from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { user_type: 2 } }) }) }) }),
  },
}));

import { AuthProvider, useAuth } from "@/hooks/useAuth";

describe("useAuth wiring for recovery", () => {
  it("PASSWORD_RECOVERY event and SIGNED_OUT are handled by the real provider", async () => {
    const Probe = () => <p data-testid="pending">{String(useAuth().recoveryPending)}</p>;
    render(<AuthProvider><Probe /></AuthProvider>);
    expect(screen.getByTestId("pending")).toHaveTextContent("false");

    act(() => listener?.("PASSWORD_RECOVERY", { user: { id: "u1" } }));
    await waitFor(() => expect(screen.getByTestId("pending")).toHaveTextContent("true"));
    expect(sessionStorage.getItem("ms:auth:recovery-pending")).toBe("1");

    act(() => listener?.("SIGNED_OUT", null));
    await waitFor(() => expect(screen.getByTestId("pending")).toHaveTextContent("false"));
    expect(sessionStorage.getItem("ms:auth:recovery-pending")).toBeNull();
  });
});

