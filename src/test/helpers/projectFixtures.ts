// Datos INVENTADOS (dominios reservados `.test`/`.example`, importes redondos) para las pruebas del detalle de
// proyecto. Ninguna persona, empresa ni importe es real.
import type {
  Project, ProjectMaintenance, ProjectService, ProjectStage,
} from "@/types/projects";
import type { ClientAccessToken, Ticket } from "@/types/tickets";

/** Reloj fijo de las pruebas: los vencimientos y las fechas por defecto salen de aquí. */
export const AHORA = "2026-11-02T15:00:00.000Z";

export const project = (over: Partial<Project> = {}): Project => ({
  id: "p-1",
  user_id: "u-admin",
  nombre_proyecto: "Portal Corporativo Alfa",
  descripcion: "Sitio institucional con portal de clientes",
  estado: "activo",
  fecha_creacion: "2026-10-01T15:00:00.000Z",
  updated_at: null,
  client_name: "Cliente Demo",
  client_email: "cliente@example.test",
  client_phone: "+504 0000-0000",
  client_id: null,
  lead_developer_id: null,
  requirements: {},
  deadline: null,
  source_ticket_id: null,
  google_docs_requirements_url: "https://docs.example.test/d/abc",
  ...over,
});

export const stage = (key: string, over: Partial<ProjectStage> = {}): ProjectStage => ({
  id: `s-${key}`,
  project_id: "p-1",
  stage_key: key,
  stage_label: key,
  completed_at: "2026-10-05T15:00:00.000Z",
  completed_by: null,
  notes: null,
  metadata: {},
  created_at: "2026-10-05T15:00:00.000Z",
  ...over,
});

/** Cuatro etapas registradas (analisis, dominio, desarrollo, despliegue): 4/6 = 67 %. */
export const stages4 = (): ProjectStage[] => [
  stage("analisis", { completed_by: "Persona Demo", notes: "Notas de análisis", metadata: { "Reunión inicial con cliente": true } }),
  stage("dominio", {
    completed_at: "2026-10-08T15:00:00.000Z",
    metadata: { dominio: "alfa.example.test", proveedor: "Cloudflare", precio_anual: "12.00", moneda: "HNL" },
  }),
  stage("desarrollo", {
    completed_at: "2026-10-20T15:00:00.000Z",
    metadata: { stack: ["React", "Supabase"], desarrollador: "Dev Demo" },
  }),
  stage("despliegue", {
    completed_at: "2026-10-28T15:00:00.000Z",
    metadata: { plataforma: "Vercel", url_produccion: "https://alfa.example.test" },
  }),
];

export const service = (over: Partial<ProjectService> = {}): ProjectService => ({
  id: "sv-1",
  project_id: "p-1",
  service_type: "domain",
  provider: "Cloudflare",
  name: "alfa.example.test",
  url: null,
  cost_monthly: null,
  cost_yearly: 12,
  currency: "USD",
  renewal_date: "2026-11-07",
  notes: null,
  created_at: "2026-10-01T15:00:00.000Z",
  ...over,
});

export const services3 = (): ProjectService[] => [
  service(),
  service({ id: "sv-2", service_type: "hosting", provider: "Vercel", name: "Alojamiento Alfa", cost_yearly: null, cost_monthly: 20, renewal_date: "2026-11-25" }),
  service({ id: "sv-3", service_type: "database", provider: "Supabase", name: "Base de datos Alfa", cost_yearly: null, renewal_date: null }),
];

export const maintenance = (over: Partial<ProjectMaintenance> = {}): ProjectMaintenance => ({
  id: "m-1",
  project_id: "p-1",
  month: "2026-10-01",
  status: "completado",
  tasks_done: ["Copia de seguridad", "Actualización de dependencias"],
  notes: null,
  billed: true,
  billed_amount: 100,
  created_at: "2026-10-31T15:00:00.000Z",
  ...over,
});

export const maintenance2 = (): ProjectMaintenance[] => [
  maintenance({ id: "m-2", month: "2026-11-01", status: "pendiente", tasks_done: null, notes: "Revisar certificados", billed: false, billed_amount: null }),
  maintenance(),
];

export const ticket = (over: Partial<Ticket & { message_count: number }> = {}): Ticket & { message_count: number } => ({
  id: "t-1",
  project_id: "p-1",
  client_name: "Cliente Demo",
  client_email: "cliente@example.test",
  type: "modificacion",
  priority: "media",
  status: "abierto",
  title: "Cambiar el banner de inicio",
  description: "Descripción del pedido",
  created_at: "2026-10-30T15:00:00.000Z",
  updated_at: "2026-10-30T15:00:00.000Z",
  resolved_at: null,
  assigned_to: null,
  message_count: 0,
  ...over,
});

export const tickets3 = () => [
  ticket({ message_count: 2 }),
  ticket({ id: "t-2", title: "Error al enviar el formulario", type: "bug", priority: "urgente", status: "en_progreso", message_count: 0 }),
  ticket({ id: "t-3", title: "Consulta sobre facturación", type: "consulta", priority: "baja", status: "resuelto", message_count: 1 }),
];

export const token = (over: Partial<ClientAccessToken> = {}): ClientAccessToken => ({
  id: "k-1",
  project_id: "p-1",
  token: "tok-activo-0000000000000000000000",
  client_name: "Cliente Demo",
  client_email: "cliente@example.test",
  active: true,
  created_at: "2026-10-10T15:00:00.000Z",
  last_accessed_at: "2026-10-31T15:00:00.000Z",
  ...over,
});

export const tokens2 = (): ClientAccessToken[] => [
  token(),
  token({ id: "k-0", token: "tok-viejo-1111111111111111111111", active: false, created_at: "2026-09-01T15:00:00.000Z", last_accessed_at: null }),
];
