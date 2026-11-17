// Bienvenida sin peticiones repetidas (QA 2026-11-15, hallazgo 2). En auth-js, SIGNED_IN no significa «acaba de
// entrar»: llega en cada recarga, cada vez que la pestaña vuelve a estar visible y una vez por cada otra pestaña abierta.
// El AuthProvider real pide send-welcome-email solo cuando la respuesta vigente del perfil dice
// welcome_email_sent = false, y como mucho una vez por usuario mientras la página siga abierta.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";

type Listener = (event: string, session: unknown) => void;
interface ProfileRow {
  user_type: number;
  welcome_email_sent?: boolean;
}

const h = vi.hoisted(() => ({
  listener: undefined as ((event: string, session: unknown) => void) | undefined,
  initialSession: null as unknown,
  /** Una entrada por cada consulta de perfil lanzada, en orden, con las columnas pedidas. */
  calls: [] as {
    userId: string;
    columns: string;
    resolve: (row: { user_type: number; welcome_email_sent?: boolean }) => void;
    reject: (error: Error) => void;
  }[],
  invoke: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: h.initialSession } }),
      onAuthStateChange: (cb: Listener) => {
        h.listener = cb;
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
      signOut: () => Promise.resolve(),
    },
    functions: { invoke: (...args: unknown[]) => h.invoke(...args) },
    from: (table: string) => {
      if (table !== "profiles") throw new Error(`consulta inesperada a ${table}`);
      return {
        select: (columns: string) => ({
          eq: (_column: string, userId: string) => ({
            single: () =>
              new Promise((resolve, reject) => {
                h.calls.push({ userId, columns, resolve: (row) => resolve({ data: row }), reject });
              }),
          }),
        }),
      };
    },
  },
}));

import { AuthProvider, useAuth } from "@/hooks/useAuth";

const NOW = "2026-11-15T15:00:00.000Z";
const sessionOf = (id: string) => ({ access_token: `t-${id}`, user: { id, email: `${id}@example.test`, email_confirmed_at: NOW } });
const CLIENT = sessionOf("u-client");
const OTHER = sessionOf("u-otro");

function Consumer() {
  const { user, userType, loading } = useAuth();
  return <div data-testid="state" data-loading={String(loading)}>{`${user?.id ?? "-"}:${userType}`}</div>;
}
const state = () => screen.getByTestId("state").textContent;

const pending = (userId: string) => h.calls.filter((c) => c.userId === userId);
const welcomeCalls = () => h.invoke.mock.calls.filter(([name]) => name === "send-welcome-email");

/** La parte síncrona del manejador corre dentro de act; la aplazada (setTimeout 0) no. */
const emitSync = (event: string, session: unknown) => act(() => h.listener?.(event, session));
const flushDeferred = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)); });
/** Resuelve TODAS las consultas de perfil de `userId` que sigan abiertas. */
const answer = async (userId: string, row: ProfileRow) => {
  await act(async () => { pending(userId).forEach((c) => c.resolve(row)); });
  await flushDeferred();
};

function mount(session: unknown) {
  h.initialSession = session;
  render(
    <AuthProvider>
      <Consumer />
    </AuthProvider>,
  );
}

beforeEach(() => {
  h.listener = undefined;
  h.initialSession = null;
  h.calls.length = 0;
  h.invoke.mockReset().mockResolvedValue({ data: { ok: true }, error: null });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useAuth · bienvenida: como mucho una petición por usuario y página", () => {
  it("lee el rol y la marca en la MISMA consulta de perfil (sin peticiones extra)", async () => {
    mount(CLIENT);
    await waitFor(() => expect(pending("u-client")).toHaveLength(1));
    expect(h.calls[0].columns).toBe("user_type, welcome_email_sent");
    await answer("u-client", { user_type: 2, welcome_email_sent: false });
    expect(state()).toBe("u-client:2");
    expect(h.calls).toHaveLength(1);
    expect(welcomeCalls()).toHaveLength(1);
    expect(h.invoke).toHaveBeenCalledWith("send-welcome-email");
  });

  it("carga + SIGNED_IN de la carga + foco + otra pestaña del mismo usuario: una sola invocación", async () => {
    mount(CLIENT);
    await waitFor(() => expect(pending("u-client")).toHaveLength(1));
    // SIGNED_IN de _recoverAndRefresh al cargar, del cambio de visibilidad y el reemitido por BroadcastChannel.
    for (let i = 0; i < 3; i++) {
      emitSync("SIGNED_IN", { ...CLIENT, access_token: `t-${i}` });
      // Nada se pide dentro del callback de autenticación.
      expect(welcomeCalls()).toHaveLength(0);
      await flushDeferred();
    }
    // Todas las consultas abiertas contestan «no enviado»: solo la vigente puede pedir, y una vez.
    await answer("u-client", { user_type: 2, welcome_email_sent: false });
    expect(welcomeCalls()).toHaveLength(1);

    // Más tarde, más eventos del mismo usuario mientras el servidor aún no marcó (o contestó 503 en local).
    for (const event of ["SIGNED_IN", "TOKEN_REFRESHED", "SIGNED_IN", "USER_UPDATED"]) {
      emitSync(event, CLIENT);
      await flushDeferred();
      await answer("u-client", { user_type: 2, welcome_email_sent: false });
    }
    expect(welcomeCalls()).toHaveLength(1);
    expect(state()).toBe("u-client:2");
  });

  it("con welcome_email_sent = true no se invoca nunca", async () => {
    mount(CLIENT);
    await waitFor(() => expect(pending("u-client")).toHaveLength(1));
    await answer("u-client", { user_type: 2, welcome_email_sent: true });
    for (let i = 0; i < 3; i++) {
      emitSync("SIGNED_IN", CLIENT);
      await flushDeferred();
      await answer("u-client", { user_type: 2, welcome_email_sent: true });
    }
    expect(welcomeCalls()).toHaveLength(0);
    expect(state()).toBe("u-client:2");
  });

  it("una respuesta obsoleta no invoca, aunque diga «no enviado» (otra cuenta o el mismo usuario)", async () => {
    mount(CLIENT);
    await waitFor(() => expect(pending("u-client")).toHaveLength(1)); // consulta inicial sin resolver

    // Cambio de cuenta: la respuesta de la cuenta anterior llega tarde y dice false.
    emitSync("SIGNED_IN", OTHER);
    await flushDeferred();
    await answer("u-client", { user_type: 2, welcome_email_sent: false });
    expect(welcomeCalls()).toHaveLength(0);
    await answer("u-otro", { user_type: 2, welcome_email_sent: true });
    expect(welcomeCalls()).toHaveLength(0);
    expect(state()).toBe("u-otro:2");

    // Mismo usuario: la primera consulta queda superada por la segunda antes de contestar.
    emitSync("SIGNED_IN", OTHER);
    await flushDeferred();
    const superseded = pending("u-otro")[pending("u-otro").length - 1];
    emitSync("SIGNED_IN", OTHER);
    await flushDeferred();
    await act(async () => superseded.resolve({ user_type: 2, welcome_email_sent: false }));
    await flushDeferred();
    expect(welcomeCalls()).toHaveLength(0);
    await answer("u-otro", { user_type: 2, welcome_email_sent: true });
    expect(welcomeCalls()).toHaveLength(0);
  });

  it("otro usuario en la misma página suma una; volver al primero no repite", async () => {
    mount(CLIENT);
    await waitFor(() => expect(pending("u-client")).toHaveLength(1));
    await answer("u-client", { user_type: 2, welcome_email_sent: false });
    expect(welcomeCalls()).toHaveLength(1);

    emitSync("SIGNED_IN", OTHER);
    await flushDeferred();
    await answer("u-otro", { user_type: 2, welcome_email_sent: false });
    expect(welcomeCalls()).toHaveLength(2);

    emitSync("SIGNED_OUT", null);
    await flushDeferred();
    emitSync("SIGNED_IN", CLIENT);
    await flushDeferred();
    await answer("u-client", { user_type: 2, welcome_email_sent: false });
    expect(welcomeCalls()).toHaveLength(2);
  });

  it("si la marca es desconocida (perfil que falla, sin la columna o colgado) no se invoca", async () => {
    mount(CLIENT);
    await waitFor(() => expect(pending("u-client")).toHaveLength(1));
    await act(async () => pending("u-client")[0].reject(new Error("RLS / red")));
    await waitFor(() => expect(state()).toBe("u-client:2"));

    emitSync("SIGNED_IN", CLIENT);
    await flushDeferred();
    await answer("u-client", { user_type: 2 }); // respuesta sin welcome_email_sent

    vi.useFakeTimers({ shouldAdvanceTime: true });
    emitSync("SIGNED_IN", CLIENT);
    await act(async () => { await vi.advanceTimersByTimeAsync(8010); }); // la consulta se cuelga: vence el tope de 8 s
    expect(state()).toBe("u-client:2");
    expect(welcomeCalls()).toHaveLength(0);
  });

  it("si la invocación falla o lanza, el estado de autenticación no se ve afectado", async () => {
    h.invoke.mockReset().mockImplementation(() => { throw new Error("functions no disponible"); });
    mount(CLIENT);
    await waitFor(() => expect(pending("u-client")).toHaveLength(1));
    await answer("u-client", { user_type: 0, welcome_email_sent: false });
    expect(state()).toBe("u-client:0");
    expect(screen.getByTestId("state").dataset.loading).toBe("false");

    h.invoke.mockReset().mockRejectedValue(new Error("503"));
    emitSync("SIGNED_IN", OTHER);
    await flushDeferred();
    await answer("u-otro", { user_type: 1, welcome_email_sent: false });
    expect(state()).toBe("u-otro:1");
    expect(welcomeCalls()).toHaveLength(1);
  });
});
