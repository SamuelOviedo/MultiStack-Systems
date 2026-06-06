-- =============================================================================
-- Fix: assigned tickets invisible to assignee when user_type ≠ 1.
--
-- Old policy required get_user_type() = 1 AND assigned_to = auth.uid().
-- If the assignee's profile was still default (2) or missing, the role check
-- failed and the ticket vanished from their view despite a valid assignment.
--
-- New rule: the assignment IS the authorization — an admin deliberately bound
-- that UUID. Any authenticated user assigned to a ticket can read/update it.
-- Admin (0) global access unchanged. Clients can never be assigned via the UI
-- (dropdown lists roles 0/1 only) and gain nothing beyond their own rows.
-- =============================================================================

DROP POLICY "collaborator reads assigned tickets"   ON public.tickets;
DROP POLICY "collaborator updates assigned tickets" ON public.tickets;

CREATE POLICY "assignee reads own tickets"
  ON public.tickets FOR SELECT
  TO authenticated
  USING (assigned_to = auth.uid());

CREATE POLICY "assignee updates own tickets"
  ON public.tickets FOR UPDATE
  TO authenticated
  USING (assigned_to = auth.uid())
  WITH CHECK (assigned_to = auth.uid());

-- Mirror on messages: drop the role-coupled name, keep assignment-based access
DROP POLICY "collaborator messages on assigned tickets" ON public.ticket_messages;

CREATE POLICY "assignee messages on own tickets"
  ON public.ticket_messages FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = ticket_messages.ticket_id AND t.assigned_to = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = ticket_messages.ticket_id AND t.assigned_to = auth.uid()
  ));
