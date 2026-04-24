export type ProjectStatus =
  | 'en_analisis'
  | 'en_desarrollo'
  | 'en_despliegue'
  | 'activo'
  | 'mantenimiento'
  | 'pausado'
  | 'cancelado';

export type ServiceType = 'domain' | 'hosting' | 'database' | 'cdn' | 'other';
export type MaintenanceStatus = 'pendiente' | 'en_proceso' | 'completado';

export interface Project {
  id: string;
  user_id: string;
  nombre_proyecto: string;
  descripcion: string | null;
  estado: ProjectStatus;
  fecha_creacion: string;
  updated_at: string | null;
  client_name: string | null;
  client_email: string | null;
  client_phone: string | null;
}

export interface ProjectStage {
  id: string;
  project_id: string;
  stage_key: string;
  stage_label: string;
  completed_at: string;
  completed_by: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ProjectService {
  id: string;
  project_id: string;
  service_type: ServiceType;
  provider: string;
  name: string;
  url: string | null;
  cost_monthly: number | null;
  cost_yearly: number | null;
  currency: string;
  renewal_date: string | null;
  notes: string | null;
  created_at: string;
}

export interface ProjectMaintenance {
  id: string;
  project_id: string;
  month: string;
  status: MaintenanceStatus;
  tasks_done: string[] | null;
  notes: string | null;
  billed: boolean;
  billed_amount: number | null;
  created_at: string;
}

export interface PipelineStage {
  key: string;
  label: string;
  description: string;
}

export const PIPELINE_STAGES: PipelineStage[] = [
  { key: 'analisis',      label: 'Análisis',                description: 'Reunión, requerimientos, cotización' },
  { key: 'dominio',       label: 'Adquisición de Dominio',  description: 'Compra y configuración del dominio' },
  { key: 'desarrollo',    label: 'Desarrollo',              description: 'Stack, repo, QA con cliente' },
  { key: 'despliegue',    label: 'Despliegue',              description: 'Hosting, DNS, SSL, producción' },
  { key: 'entrega',       label: 'Entrega',                 description: 'Accesos, documentación, factura' },
  { key: 'mantenimiento', label: 'Mantenimiento Activo',    description: 'Seguimiento mensual' },
];

export const STATUS_CONFIG: Record<ProjectStatus, { label: string; color: string }> = {
  en_analisis:    { label: 'En análisis',    color: 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10' },
  en_desarrollo:  { label: 'En desarrollo',  color: 'text-accent border-accent/30 bg-accent/10' },
  en_despliegue:  { label: 'En despliegue',  color: 'text-blue-400 border-blue-400/30 bg-blue-400/10' },
  activo:         { label: 'Activo',         color: 'text-primary border-primary/30 bg-primary/10' },
  mantenimiento:  { label: 'Mantenimiento',  color: 'text-primary border-primary/30 bg-primary/10' },
  pausado:        { label: 'Pausado',        color: 'text-muted-foreground border-border bg-muted/10' },
  cancelado:      { label: 'Cancelado',      color: 'text-red-400 border-red-400/30 bg-red-400/10' },
};

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  domain:   'Dominio',
  hosting:  'Hosting',
  database: 'Base de datos',
  cdn:      'CDN',
  other:    'Otro',
};
