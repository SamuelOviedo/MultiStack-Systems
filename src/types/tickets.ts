export type TicketType = 'modificacion' | 'bug' | 'consulta' | 'pago' | 'mantenimiento' | 'otro' | 'solicitud';
export type TicketPriority = 'baja' | 'media' | 'alta' | 'urgente';
export type TicketStatus = 'abierto' | 'en_revision' | 'asignado' | 'en_progreso' | 'resuelto' | 'cerrado' | 'convertido';
export type SenderType = 'client' | 'team';

export interface Ticket {
  id: string;
  project_id: string | null;
  client_name: string | null;
  client_email: string | null;
  type: TicketType;
  priority: TicketPriority;
  status: TicketStatus;
  title: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  assigned_to: string | null;
  assignee_email?: string | null;
  message_count?: number;
}

export interface TeamMember {
  id: string;
  email: string | null;
  user_type: number;
}

export const ROLE_LABELS: Record<number, string> = {
  0: 'Admin',
  1: 'Colaborador',
  2: 'Cliente',
};

export interface TicketMessage {
  id: string;
  ticket_id: string;
  sender_type: SenderType;
  sender_name: string;
  message: string;
  created_at: string;
}

export interface ClientAccessToken {
  id: string;
  project_id: string;
  token: string;
  client_name: string | null;
  client_email: string | null;
  active: boolean;
  created_at: string;
  last_accessed_at: string | null;
}

export const TICKET_TYPE_LABELS: Record<TicketType, string> = {
  modificacion:  'Modificación',
  bug:           'Bug / Error',
  consulta:      'Consulta',
  pago:          'Pago',
  mantenimiento: 'Mantenimiento',
  otro:          'Otro',
  solicitud:     'Solicitud de Proyecto',
};

export const TICKET_STATUS_CONFIG: Record<TicketStatus, { label: string; color: string }> = {
  abierto:     { label: 'Recibido',     color: 'text-accent border-accent/30 bg-accent/10' },
  en_revision: { label: 'En revisión',  color: 'text-warning border-warning/30 bg-warning/10' },
  asignado:    { label: 'Asignado',     color: 'text-violet-600 dark:text-violet-400 border-violet-500/30 bg-violet-500/10' },
  en_progreso: { label: 'En progreso',  color: 'text-primary border-primary/30 bg-primary/10' },
  resuelto:    { label: 'Resuelto',     color: 'text-muted-foreground border-border bg-muted/10' },
  cerrado:     { label: 'Cerrado',      color: 'text-muted-foreground/50 border-border/50 bg-transparent' },
  convertido:  { label: 'Convertido a Proyecto', color: 'text-success border-success/30 bg-success/10' },
};

export const TICKET_PRIORITY_CONFIG: Record<TicketPriority, { label: string; color: string; pulse?: boolean }> = {
  baja:    { label: 'Baja',    color: 'text-muted-foreground border-border' },
  media:   { label: 'Media',   color: 'text-warning border-warning/30' },
  alta:    { label: 'Alta',    color: 'text-orange-600 dark:text-orange-400 border-orange-500/30' },
  urgente: { label: 'Urgente', color: 'text-destructive border-destructive/30', pulse: true },
};
