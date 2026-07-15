import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

/**
 * Regression coverage for the login "infinite loading" bug.
 *
 * Root cause: `userType` was only ever set through an unguarded `.then()` with
 * no `.catch()`/timeout, and the whole app gates on `userType !== null`. Any
 * failure of the `profiles` fetch left `userType` pinned at `null` forever, so
 * the post-login redirect and role-gated loads never released.
 *
 * These tests drive the provider with a REJECTING profile fetch and assert the
 * auth state still resolves (loading flips false, userType falls back to 2).
 */

const h = vi.hoisted(() => ({
  session: { current: null as { user: { id: string } } | null },
  single: { current: (() => Promise.resolve({ data: { user_type: 0 } })) as () => Promise<unknown> },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: h.session.current } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signOut: () => Promise.resolve(),
    },
    functions: { invoke: () => Promise.resolve() },
    from: () => ({ select: () => ({ eq: () => ({ single: () => h.single.current() }) }) }),
  },
}));

import { AuthProvider, useAuth } from "@/hooks/useAuth";

function Consumer() {
  const { loading, userType } = useAuth();
  return <div data-testid="state">{loading ? "loading" : `type:${userType}`}</div>;
}

const renderProvider = () =>
  render(
    <AuthProvider>
      <Consumer />
    </AuthProvider>
  );

beforeEach(() => {
  h.session.current = null;
  h.single.current = () => Promise.resolve({ data: { user_type: 0 } });
});

describe("useAuth — resilience (login infinite-loading regression)", () => {
  it("resolves to the fallback role (2) when the profile fetch REJECTS, instead of hanging", async () => {
    h.session.current = { user: { id: "u1" } };
    h.single.current = () => Promise.reject(new Error("profiles RLS / network failure"));

    renderProvider();

    // The bug would leave this stuck on "loading" forever.
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("type:2"));
  });

  it("resolves the real role when the profile fetch succeeds", async () => {
    h.session.current = { user: { id: "u1" } };
    h.single.current = () => Promise.resolve({ data: { user_type: 0 } });

    renderProvider();

    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("type:0"));
  });

  it("resolves loading with a null role when there is no session", async () => {
    h.session.current = null;

    renderProvider();

    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("type:null"));
  });
});
