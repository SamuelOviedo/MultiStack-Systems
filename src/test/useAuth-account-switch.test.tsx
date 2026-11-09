// Cambio de cuenta en la misma pestaña (SIGNED_IN de otro usuario sin cerrar sesión): el rol anterior se invalida de
// inmediato y una respuesta tardía del perfil de la cuenta anterior nunca escribe el rol. Se usa el AuthProvider real
// con un cliente de Supabase simulado cuyas respuestas de `profiles` se controlan una por una.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";

type Listener = (event: string, session: unknown) => void;

const h = vi.hoisted(() => ({
  listener: undefined as ((event: string, session: unknown) => void) | undefined,
  initialSession: null as unknown,
  /** Una entrada por cada consulta de perfil lanzada, en orden. */
  calls: [] as { userId: string; resolve: (role: number) => void; reject: (error: Error) => void }[],
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
        select: () => ({
          eq: (_column: string, userId: string) => ({
            single: () =>
              new Promise((resolve, reject) => {
                h.calls.push({
                  userId,
                  resolve: (role) => resolve({ data: { user_type: role } }),
                  reject,
                });
              }),
          }),
        }),
      };
    },
  },
}));

import { AuthProvider, useAuth } from "@/hooks/useAuth";

const NOW = "2026-11-02T15:00:00.000Z";
const sessionOf = (id: string) => ({ access_token: `t-${id}`, user: { id, email: `${id}@example.test`, email_confirmed_at: NOW } });
const ADMIN = sessionOf("u-admin");
const COLAB = sessionOf("u-colab");
const CLIENT = sessionOf("u-client");

/** Cada render del consumidor queda registrado como «usuario:rol» para comprobar combinaciones prohibidas. */
const log: string[] = [];
function Consumer() {
  const { user, userType, loading } = useAuth();
  const line = `${user?.id ?? "-"}:${userType}`;
  log.push(line);
  return <div data-testid="state" data-loading={String(loading)}>{line}</div>;
}
const state = () => screen.getByTestId("state").textContent;

const callsFor = (userId: string) => h.calls.filter((c) => c.userId === userId);

/** Arranca con `session` ya guardada y su perfil resuelto a `role`. */
async function startAs(session: ReturnType<typeof sessionOf>, role: number) {
  h.initialSession = session;
  render(
    <AuthProvider>
      <Consumer />
    </AuthProvider>,
  );
  await waitFor(() => expect(callsFor(session.user.id).length).toBeGreaterThan(0));
  await act(async () => {
    callsFor(session.user.id).forEach((c) => c.resolve(role));
  });
  await waitFor(() => expect(state()).toBe(`${session.user.id}:${role}`));
}

/** Evento de Supabase: la parte síncrona del manejador corre dentro de act, el aplazado (setTimeout 0) no. */
const emitSync = (event: string, session: unknown) => act(() => h.listener?.(event, session));
const flushDeferred = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)); });

beforeEach(() => {
  h.listener = undefined;
  h.initialSession = null;
  h.calls.length = 0;
  h.invoke.mockReset().mockResolvedValue({});
  log.length = 0;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useAuth · cambio de cuenta sin cerrar sesión", () => {
  it.each([
    ["colaborador", COLAB, 1],
    ["cliente", CLIENT, 2],
  ] as const)("admin → %s: el rol anterior se invalida de inmediato y no se empareja con la sesión nueva", async (_name, next, role) => {
    await startAs(ADMIN, 0);
    log.length = 0;

    emitSync("SIGNED_IN", next);
    // Antes de que corra la consulta aplazada: la sesión ya es la nueva y el rol es null, no el del administrador.
    expect(state()).toBe(`${next.user.id}:null`);

    await flushDeferred();
    expect(callsFor(next.user.id)).toHaveLength(1);
    expect(state()).toBe(`${next.user.id}:null`);

    await act(async () => callsFor(next.user.id)[0].resolve(role));
    await waitFor(() => expect(state()).toBe(`${next.user.id}:${role}`));

    // Nunca hubo un render con el usuario nuevo y el rol 0.
    expect(log.filter((l) => l === `${next.user.id}:0`)).toEqual([]);
  });

  it("una respuesta tardía del perfil de la cuenta anterior se ignora (resuelta fuera de orden)", async () => {
    h.initialSession = ADMIN;
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );
    await waitFor(() => expect(callsFor("u-admin")).toHaveLength(1)); // perfil del admin SIN resolver

    emitSync("SIGNED_IN", COLAB);
    await flushDeferred();
    expect(callsFor("u-colab")).toHaveLength(1);

    // La respuesta de A llega antes que la de B: no puede escribir el rol.
    await act(async () => callsFor("u-admin").forEach((c) => c.resolve(0)));
    expect(state()).toBe("u-colab:null");
    expect(log.filter((l) => l === "u-colab:0")).toEqual([]);

    await act(async () => callsFor("u-colab")[0].resolve(1));
    await waitFor(() => expect(state()).toBe("u-colab:1"));

    // Y si la de A llegara después de la de B, tampoco la pisa.
    await act(async () => callsFor("u-admin").forEach((c) => c.resolve(0)));
    expect(state()).toBe("u-colab:1");
  });

  it("A → B → A rápido: solo vale la última consulta", async () => {
    await startAs(ADMIN, 0);
    emitSync("SIGNED_IN", COLAB);
    await flushDeferred();
    emitSync("SIGNED_IN", CLIENT);
    await flushDeferred();
    expect(state()).toBe("u-client:null");

    await act(async () => callsFor("u-client")[0].resolve(2));
    await waitFor(() => expect(state()).toBe("u-client:2"));
    // La consulta de colaborador, ya superada, llega tarde.
    await act(async () => callsFor("u-colab")[0].resolve(1));
    expect(state()).toBe("u-client:2");
  });

  it("si falla el perfil de la cuenta nueva el rol es 2 (menor privilegio), nunca el anterior", async () => {
    await startAs(ADMIN, 0);
    log.length = 0;
    emitSync("SIGNED_IN", COLAB);
    await flushDeferred();
    await act(async () => callsFor("u-colab")[0].reject(new Error("RLS / red")));
    await waitFor(() => expect(state()).toBe("u-colab:2"));
    expect(log.filter((l) => l === "u-colab:0")).toEqual([]);
  });

  it("si el perfil de la cuenta nueva se cuelga, a los 8 s el rol es 2 y no el anterior", async () => {
    await startAs(ADMIN, 0);
    vi.useFakeTimers({ shouldAdvanceTime: true });
    emitSync("SIGNED_IN", COLAB);
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    expect(state()).toBe("u-colab:null");
    await act(async () => { await vi.advanceTimersByTimeAsync(8000); });
    expect(state()).toBe("u-colab:2");
  });

  it("TOKEN_REFRESHED y USER_UPDATED del mismo usuario no resetean el rol ni parpadean", async () => {
    await startAs(ADMIN, 0);
    log.length = 0;
    for (const event of ["TOKEN_REFRESHED", "USER_UPDATED"]) {
      emitSync(event, { ...ADMIN, access_token: `nuevo-${event}` });
      expect(state()).toBe("u-admin:0");
    }
    await flushDeferred();
    // Se vuelve a leer el perfil (comportamiento previo), pero el rol vigente se mantiene mientras tanto.
    const refetches = callsFor("u-admin");
    expect(refetches.length).toBeGreaterThan(1);
    expect(state()).toBe("u-admin:0");
    await act(async () => refetches.forEach((c) => c.resolve(0)));
    expect(state()).toBe("u-admin:0");
    expect(log.filter((l) => l.endsWith(":null"))).toEqual([]);
  });

  it("SIGNED_OUT limpia sesión y rol de inmediato, y una respuesta tardía no los restaura", async () => {
    h.initialSession = ADMIN;
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );
    await waitFor(() => expect(callsFor("u-admin")).toHaveLength(1)); // sin resolver

    emitSync("SIGNED_OUT", null);
    expect(state()).toBe("-:null");
    await flushDeferred();
    await act(async () => callsFor("u-admin").forEach((c) => c.resolve(0)));
    expect(state()).toBe("-:null");
  });

  it("SIGNED_OUT con el rol ya resuelto lo deja en null, y entrar de nuevo como otro usuario no hereda nada", async () => {
    await startAs(ADMIN, 0);
    emitSync("SIGNED_OUT", null);
    expect(state()).toBe("-:null");
    await flushDeferred();

    emitSync("SIGNED_IN", CLIENT);
    expect(state()).toBe("u-client:null");
    await flushDeferred();
    await act(async () => callsFor("u-client")[0].resolve(2));
    await waitFor(() => expect(state()).toBe("u-client:2"));
  });

  it("send-welcome-email se invoca en SIGNED_IN (una vez por evento) y no en TOKEN_REFRESHED", async () => {
    await startAs(ADMIN, 0);
    h.invoke.mockClear();
    emitSync("TOKEN_REFRESHED", ADMIN);
    expect(h.invoke).not.toHaveBeenCalled();
    emitSync("SIGNED_IN", COLAB);
    expect(h.invoke).toHaveBeenCalledTimes(1);
    expect(h.invoke).toHaveBeenCalledWith("send-welcome-email");
  });

  it("la sesión inicial sigue resolviendo `loading` y el rol como antes", async () => {
    await startAs(CLIENT, 2);
    expect(screen.getByTestId("state").textContent).toBe("u-client:2");
  });
});
