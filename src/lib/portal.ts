import { supabase } from '@/integrations/supabase/client';
import type { Ticket, TicketMessage } from '@/types/tickets';

const db = supabase as any;

export interface PortalProject {
  id: string;
  nombre_proyecto: string;
  descripcion: string | null;
  estado: string;
  client_name: string | null;
  client_email: string | null;
}

export async function portalGetProject(token: string): Promise<PortalProject | null> {
  const { data, error } = await db.rpc('portal_get_project', { p_token: token });
  if (error || !data?.length) return null;
  return data[0] as PortalProject;
}

export async function portalGetTickets(token: string): Promise<(Ticket & { message_count: number })[]> {
  const { data, error } = await db.rpc('portal_get_tickets', { p_token: token });
  if (error) throw error;
  return (data ?? []) as (Ticket & { message_count: number })[];
}

export async function portalCreateTicket(
  token: string,
  clientName: string,
  clientEmail: string,
  type: string,
  title: string,
  description: string,
): Promise<string> {
  const { data, error } = await db.rpc('portal_create_ticket', {
    p_token: token,
    p_client_name: clientName,
    p_client_email: clientEmail,
    p_type: type,
    p_title: title,
    p_description: description,
  });
  if (error) throw error;
  return data as string;
}

export async function portalGetMessages(token: string, ticketId: string): Promise<TicketMessage[]> {
  const { data, error } = await db.rpc('portal_get_messages', {
    p_token: token,
    p_ticket_id: ticketId,
  });
  if (error) throw error;
  return (data ?? []) as TicketMessage[];
}

export async function portalAddMessage(
  token: string,
  ticketId: string,
  senderName: string,
  message: string,
): Promise<void> {
  const { error } = await db.rpc('portal_add_message', {
    p_token: token,
    p_ticket_id: ticketId,
    p_sender_name: senderName,
    p_message: message,
  });
  if (error) throw error;
}
