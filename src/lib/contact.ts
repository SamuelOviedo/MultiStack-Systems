import { supabase } from '@/integrations/supabase/client';

export async function sendContactMessage(email: string, message: string): Promise<void> {
  const { error } = await supabase.functions.invoke('send-contact-email', {
    body: {
      email: email.trim().toLowerCase(),
      message: message.trim(),
    },
  });
  if (error) throw error;
}
