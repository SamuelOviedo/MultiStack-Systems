import { supabase } from '@/integrations/supabase/client';
import type { Ticket, TicketMessage, TicketStatus, TicketPriority, ClientAccessToken, TeamMember } from '@/types/tickets';

const db = supabase as any;

// ── Tickets (team / authenticated) ───────────────────────────────────────────

export async function getProjectTickets(projectId: string): Promise<(Ticket & { message_count: number })[]> {
  const { data, error } = await db
    .from('tickets')
    .select('*, ticket_messages(count)')
    .eq('project_id', projectId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((t: any) => ({
    ...t,
    message_count: t.ticket_messages?.[0]?.count ?? 0,
  }));
}

export async function getAllTickets(): Promise<(Ticket & { nombre_proyecto: string; message_count: number })[]> {
  const { data, error } = await db
    .from('tickets')
    .select('*, proyectos_clientes(nombre_proyecto), ticket_messages(count), assignee:profiles!tickets_assigned_to_fkey(email)')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((t: any) => ({
    ...t,
    nombre_proyecto: t.proyectos_clientes?.nombre_proyecto ?? '',
    assignee_email: t.assignee?.email ?? null,
    message_count: t.ticket_messages?.[0]?.count ?? 0,
  }));
}

// ── Assignment workflow (admin role 0) ────────────────────────────────────────

export async function getTeamMembers(): Promise<TeamMember[]> {
  const { data, error } = await db
    .from('profiles')
    .select('id, email, user_type')
    .in('user_type', [0, 1])
    .order('user_type', { ascending: true });
  if (error) throw error;
  return data as TeamMember[];
}

export async function assignTicket(
  ticketId: string,
  assigneeId: string | null,
  currentStatus?: TicketStatus,
): Promise<void> {
  const patch: any = { assigned_to: assigneeId, updated_at: new Date().toISOString() };
  // Assigning auto-advances early-stage tickets to 'asignado'; never regresses
  // tickets already in progress or resolved.
  if (assigneeId && (currentStatus === 'abierto' || currentStatus === 'en_revision')) {
    patch.status = 'asignado';
  }
  const { error } = await db.from('tickets').update(patch).eq('id', ticketId);
  if (error) throw error;
}

export async function getTicketMessages(ticketId: string): Promise<TicketMessage[]> {
  const { data, error } = await db
    .from('ticket_messages')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data as TicketMessage[];
}

export async function addTeamMessage(ticketId: string, senderName: string, message: string): Promise<void> {
  const { error } = await db
    .from('ticket_messages')
    .insert({ ticket_id: ticketId, sender_type: 'team', sender_name: senderName, message });
  if (error) throw error;
  await db.from('tickets').update({ updated_at: new Date().toISOString() }).eq('id', ticketId);
}

export async function updateTicketStatus(ticketId: string, status: TicketStatus): Promise<void> {
  const patch: any = { status, updated_at: new Date().toISOString() };
  if (status === 'resuelto') patch.resolved_at = new Date().toISOString();
  const { error } = await db.from('tickets').update(patch).eq('id', ticketId);
  if (error) throw error;
}

export async function updateTicketPriority(ticketId: string, priority: TicketPriority): Promise<void> {
  const { error } = await db
    .from('tickets')
    .update({ priority, updated_at: new Date().toISOString() })
    .eq('id', ticketId);
  if (error) throw error;
}

export async function getOpenTicketsCount(): Promise<number> {
  const { count, error } = await db
    .from('tickets')
    .select('*', { count: 'exact', head: true })
    .in('status', ['abierto', 'en_revision', 'en_progreso']);
  if (error) return 0;
  return count ?? 0;
}

// ── Solicitudes (type-2 authenticated clients) ────────────────────────────────

export async function createSolicitud(
  clientEmail: string,
  clientName: string,
  title: string,
  description: string,
): Promise<void> {
  const { error } = await db.from('tickets').insert({
    project_id: null,
    client_email: clientEmail,
    client_name: clientName,
    type: 'solicitud',
    priority: 'media',
    status: 'abierto',
    title,
    description,
  });
  if (error) throw error;
}

export async function getSolicitudesByEmail(
  email: string,
): Promise<(Ticket & { message_count: number })[]> {
  const { data, error } = await db
    .from('tickets')
    .select('*, ticket_messages(count)')
    .eq('client_email', email)
    .is('project_id', null)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((t: any) => ({
    ...t,
    message_count: t.ticket_messages?.[0]?.count ?? 0,
  }));
}

// ── Client access tokens ──────────────────────────────────────────────────────

export async function getProjectTokens(projectId: string): Promise<ClientAccessToken[]> {
  const { data, error } = await db
    .from('client_access_tokens')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as ClientAccessToken[];
}

export async function generateToken(
  projectId: string,
  clientName?: string,
  clientEmail?: string,
): Promise<ClientAccessToken> {
  // Deactivate existing tokens
  await db
    .from('client_access_tokens')
    .update({ active: false })
    .eq('project_id', projectId);

  const { data, error } = await db
    .from('client_access_tokens')
    .insert({
      project_id: projectId,
      token: crypto.randomUUID(),
      client_name: clientName ?? null,
      client_email: clientEmail ?? null,
      active: true,
    })
    .select()
    .single();
  if (error) throw error;
  return data as ClientAccessToken;
}

// ── Email notification (graceful — fails silently if edge function not deployed)
export async function notifyNewTicket(ticket: Ticket, projectName: string): Promise<void> {
  try {
    await (supabase as any).functions.invoke('send-notification', {
      body: { type: 'new_ticket', ticket, projectName },
    });
  } catch { /* silent */ }
}

export async function notifyTeamReply(
  ticket: Ticket,
  message: string,
  portalUrl: string,
): Promise<void> {
  try {
    await (supabase as any).functions.invoke('send-notification', {
      body: { type: 'team_reply', ticket, message, portalUrl },
    });
  } catch { /* silent */ }
}
