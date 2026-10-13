import { supabase } from '@/integrations/supabase/client';

/**
 * Payload of the public contact form → Edge Function `send-contact-email`.
 * Keep in sync with supabase/functions/send-contact-email/index.ts.
 */
export interface ContactPayload {
  name: string;
  phone?: string;
  email?: string;
  message: string;
}

export const CONTACT_LIMITS = {
  nameMin: 2,
  nameMax: 120,
  messageMin: 5,
} as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Digits plus common separators; 7–15 digits covers local (HN: 8) and E.164.
const PHONE_CHARS_RE = /^\+?[\d\s().-]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

export function isValidPhone(phone: string): boolean {
  const value = phone.trim();
  const digits = value.replace(/\D/g, '').length;
  return PHONE_CHARS_RE.test(value) && digits >= 7 && digits <= 15;
}

export type ContactField = keyof ContactPayload | 'contact';

/**
 * Field-level validation. Name and message are required; phone and email are
 * each optional, but at least one is needed so the team can reply.
 */
export function validateContact(form: ContactPayload): Partial<Record<ContactField, string>> {
  const errors: Partial<Record<ContactField, string>> = {};
  const name = form.name.trim();
  const phone = form.phone?.trim() ?? '';
  const email = form.email?.trim() ?? '';

  if (name.length < CONTACT_LIMITS.nameMin) errors.name = 'Escribe tu nombre completo.';
  else if (name.length > CONTACT_LIMITS.nameMax) errors.name = 'El nombre es demasiado largo.';
  if (phone && !isValidPhone(phone)) errors.phone = 'Revisa el número de teléfono.';
  if (email && !isValidEmail(email)) errors.email = 'Revisa el correo electrónico.';
  if (!phone && !email) errors.contact = 'Déjanos un teléfono o un correo para responderte.';
  if (form.message.trim().length < CONTACT_LIMITS.messageMin) errors.message = 'Cuéntanos un poco más.';
  return errors;
}

/** Trims, lower-cases the email and drops empty optional fields. */
export function normalizeContact(form: ContactPayload): ContactPayload {
  const phone = form.phone?.trim();
  const email = form.email?.trim().toLowerCase();
  return {
    name: form.name.trim(),
    ...(phone ? { phone } : {}),
    ...(email ? { email } : {}),
    message: form.message.trim(),
  };
}

export async function sendContactMessage(form: ContactPayload): Promise<void> {
  const { error } = await supabase.functions.invoke('send-contact-email', {
    body: normalizeContact(form),
  });
  if (error) throw error;
}
