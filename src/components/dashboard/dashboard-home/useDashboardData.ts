import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getProjects, getProjectStages, getUpcomingRenewals } from "@/lib/projects";
import { getAllTickets, getProjectRequests } from "@/lib/tickets";
import { RENEWAL_WINDOW_DAYS } from "./projectMetrics";
import { withLoggedCode } from "./loadErrors";

/**
 * Lecturas del Inicio y de la lista de proyectos. Las funciones son las de siempre en `src/lib`; aquí no hay
 * consultas nuevas.
 *
 * Por qué no `useQuery`: importarlo sube `vendor-query` (+10 kB) y ese chunk es de carga inicial, también para
 * quien solo visita la landing (restricción del bundle de entrada). Este hook mínimo da lo mismo que el panel
 * necesita —carga, error, datos, «Reintentar»— sin caché entre pantallas (como hasta ahora: cada pantalla pide
 * lo suyo al montarse) y, por lo mismo, sin datos de una sesión anterior en memoria.
 *
 * - Nada se pide hasta que el rol se resuelve (`userType` llega después de montar).
 * - Una respuesta tardía de una petición anterior no pisa a la más reciente.
 */

export interface Resource<T> {
  data: T | undefined;
  error: unknown;
  /** Sin datos todavía (o `enabled` aún es falso): se muestra «cargando». */
  isPending: boolean;
  isError: boolean;
  isSuccess: boolean;
  /** Vuelve a pedir. Tras un error muestra «cargando»; con datos previos no parpadea. */
  refetch: () => Promise<void>;
}

type State<T> = { status: "pending" | "success" | "error"; data?: T; error?: unknown };

function useResource<T>(enabled: boolean, depKey: string, load: () => Promise<T>): Resource<T> {
  const [state, setState] = useState<State<T>>({ status: "pending" });
  const loadRef = useRef(load);
  loadRef.current = load;
  const ticket = useRef(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const run = useCallback(async () => {
    const mine = ++ticket.current;
    setState((s) => (s.status === "error" ? { status: "pending" } : s));
    try {
      const data = await loadRef.current();
      if (alive.current && mine === ticket.current) setState({ status: "success", data });
    } catch (error) {
      if (alive.current && mine === ticket.current) setState({ status: "error", error });
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    setState({ status: "pending" });
    void run();
  }, [enabled, depKey, run]);

  return {
    data: state.data,
    error: state.error,
    isPending: state.status === "pending",
    isError: state.status === "error",
    isSuccess: state.status === "success",
    refetch: run,
  };
}

export interface ProjectsOverview {
  projects: Awaited<ReturnType<typeof getProjects>>;
  /** Etapas registradas por proyecto (id → cantidad). */
  stagesMap: Record<string, number>;
}

function useScope() {
  const { user, userType } = useAuth();
  return { userId: user?.id ?? null, userType, ready: userType !== null && !!user };
}

export function useProjectsOverview(): Resource<ProjectsOverview> {
  const { userId, userType, ready } = useScope();
  return useResource(ready, `${userId}:${userType}`, () =>
    withLoggedCode("proyectos", async () => {
      const projects = await getProjects();
      const stagesMap: Record<string, number> = {};
      await Promise.all(
        projects.map(async (p) => {
          stagesMap[p.id] = (await getProjectStages(p.id)).length;
        }),
      );
      return { projects, stagesMap };
    }),
  );
}

export function useUpcomingRenewals() {
  const { userId, userType, ready } = useScope();
  return useResource(ready, `${userId}:${userType}`, () =>
    withLoggedCode("renovaciones", () => getUpcomingRenewals(RENEWAL_WINDOW_DAYS)),
  );
}

/** Solo administrador: un colaborador no consulta las solicitudes (la barrera real es RLS). */
export function useProjectRequests() {
  const { userId, userType, ready } = useScope();
  return useResource(ready && userType === 0, `${userId}:${userType}`, () =>
    withLoggedCode("solicitudes", () => getProjectRequests()),
  );
}

/** Tickets del equipo: todos para el administrador, solo los asignados para el colaborador (como `TicketsGlobal`). */
export function useDashboardTickets() {
  const { userId, userType, ready } = useScope();
  return useResource(ready, `${userId}:${userType}`, () =>
    withLoggedCode("tickets", () => getAllTickets(userType === 1 && userId ? { assignedTo: userId } : undefined)),
  );
}
