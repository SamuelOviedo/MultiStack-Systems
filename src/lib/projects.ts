import { supabase } from '@/integrations/supabase/client';
import type {
  Project, ProjectStage, ProjectService, ProjectMaintenance, ProjectStatus,
} from '@/types/projects';

const db = supabase as any;

// ── Projects ──────────────────────────────────────────────────────────────────

export async function getProjects(): Promise<Project[]> {
  const { data, error } = await db
    .from('proyectos_clientes')
    .select('*')
    .order('fecha_creacion', { ascending: false });
  if (error) throw error;
  return data as Project[];
}

export async function getProject(id: string): Promise<Project> {
  const { data, error } = await db
    .from('proyectos_clientes')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as Project;
}

export async function createProject(
  userId: string,
  payload: Pick<Project, 'nombre_proyecto' | 'descripcion' | 'client_name' | 'client_email' | 'client_phone'>
): Promise<Project> {
  const { data, error } = await db
    .from('proyectos_clientes')
    .insert({ user_id: userId, estado: 'en_analisis', ...payload })
    .select()
    .single();
  if (error) throw error;
  return data as Project;
}

export async function updateProject(
  id: string,
  payload: Partial<Omit<Project, 'id' | 'user_id' | 'fecha_creacion'>>
): Promise<void> {
  const { error } = await db
    .from('proyectos_clientes')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

// ── Stages ────────────────────────────────────────────────────────────────────

export async function getProjectStages(projectId: string): Promise<ProjectStage[]> {
  const { data, error } = await db
    .from('project_stages')
    .select('*')
    .eq('project_id', projectId);
  if (error) throw error;
  return data as ProjectStage[];
}

export async function upsertStage(
  projectId: string,
  stageKey: string,
  stageLabel: string,
  payload: { completed_at: string; completed_by?: string; notes?: string; metadata?: Record<string, unknown> }
): Promise<void> {
  const { error } = await db
    .from('project_stages')
    .upsert({
      project_id: projectId,
      stage_key: stageKey,
      stage_label: stageLabel,
      ...payload,
    }, { onConflict: 'project_id,stage_key' });
  if (error) throw error;
}

export async function deleteStage(projectId: string, stageKey: string): Promise<void> {
  const { error } = await db
    .from('project_stages')
    .delete()
    .eq('project_id', projectId)
    .eq('stage_key', stageKey);
  if (error) throw error;
}

// ── Services ──────────────────────────────────────────────────────────────────

export async function getProjectServices(projectId: string): Promise<ProjectService[]> {
  const { data, error } = await db
    .from('project_services')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data as ProjectService[];
}

export async function createService(
  projectId: string,
  payload: Omit<ProjectService, 'id' | 'project_id' | 'created_at'>
): Promise<void> {
  const { error } = await db
    .from('project_services')
    .insert({ project_id: projectId, ...payload });
  if (error) throw error;
}

export async function deleteService(id: string): Promise<void> {
  const { error } = await db
    .from('project_services')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function getUpcomingRenewals(days = 30): Promise<(ProjectService & { nombre_proyecto: string })[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + days);
  const { data, error } = await db
    .from('project_services')
    .select('*, proyectos_clientes(nombre_proyecto)')
    .lte('renewal_date', cutoff.toISOString().split('T')[0])
    .gte('renewal_date', new Date().toISOString().split('T')[0])
    .order('renewal_date', { ascending: true });
  if (error) throw error;
  return (data || []).map((r: any) => ({
    ...r,
    nombre_proyecto: r.proyectos_clientes?.nombre_proyecto ?? '',
  }));
}

// ── Maintenance ───────────────────────────────────────────────────────────────

export async function getProjectMaintenance(projectId: string): Promise<ProjectMaintenance[]> {
  const { data, error } = await db
    .from('project_maintenance')
    .select('*')
    .eq('project_id', projectId)
    .order('month', { ascending: false });
  if (error) throw error;
  return data as ProjectMaintenance[];
}

export async function upsertMaintenance(
  projectId: string,
  month: string,
  payload: Partial<Omit<ProjectMaintenance, 'id' | 'project_id' | 'month' | 'created_at'>>
): Promise<void> {
  const { error } = await db
    .from('project_maintenance')
    .upsert({ project_id: projectId, month, ...payload }, { onConflict: 'project_id,month' });
  if (error) throw error;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function formatMonth(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-HN', { month: 'long', year: 'numeric' });
}

export function firstDayOfMonth(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

export function statusFromStages(completedKeys: string[]): ProjectStatus {
  const s = new Set(completedKeys);
  if (s.has('mantenimiento')) return 'mantenimiento';
  if (s.has('entrega'))       return 'activo';
  if (s.has('despliegue'))    return 'en_despliegue';
  if (s.has('desarrollo'))    return 'en_desarrollo';
  return 'en_analisis';
}
