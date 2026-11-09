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
  /** Honeypot (S4): hidden field that only bots fill in. */
  website?: string;
}

export const CONTACT_LIMITS = {
  nameMin: 2,
  nameMax: 120,
  emailMax: 254,
  phoneMax: 40,
  messageMin: 5,
  // Same limits as the Edge Function (S4, supabase/functions/send-contact-email/lead.ts).
  messageMax: 5000,
} as const;

/** The server rejected the message because of its abuse limits (HTTP 429). */
export class ContactRateLimitError extends Error {
  constructor() {
    super('contact rate limited');
    this.name = 'ContactRateLimitError';
  }
}

/**
 * The function refuses every message for now (HTTP 503): a missing server secret or a
 * misconfigured limit check. Retrying right away will not help, unlike a network failure.
 */
export class ContactUnavailableError extends Error {
  constructor() {
    super('contact unavailable');
    this.name = 'ContactUnavailableError';
  }
}

/**
 * The function answers 400 to content it cannot store (S4, W2.1 lead.ts `hasUnsafeText`): C0 controls other than tab,
 * line feed and carriage return (U+0000-0008, 000B, 000C, 000E-001F), DEL (007F) and unpaired UTF-16 surrogates. Same
 * exact set here, so the person is told which field has it before sending. Looked at the RAW text (trim would hide a
 * vertical tab or form feed at the edge) and never cleaned up silently. No regular expression: one pass.
 */
export function hasUnsafeText(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c <= 0x08 || c === 0x0b || c === 0x0c || (c >= 0x0e && c <= 0x1f) || c === 0x7f) return true;
    if (c >= 0xd800 && c <= 0xdbff) {
      const next = s.charCodeAt(i + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return true;
      i++; // a well-formed pair
    } else if (c >= 0xdc00 && c <= 0xdfff) {
      return true;
    }
  }
  return false;
}

/**
 * The function rejected the content (HTTP 400, fixed text). The client validates the same rules first, so this only
 * happens when the browser let something through that the server does not accept.
 */
export class ContactInvalidError extends Error {
  constructor() {
    super('contact rejected');
    this.name = 'ContactInvalidError';
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Digits plus common separators; 7–15 digits covers local (HN: 8) and E.164.
const PHONE_CHARS_RE = /^\+?[\d\s().-]+$/;

export function isValidEmail(email: string): boolean {
  const value = email.trim();
  // The length is measured on the lower-cased value: it is the one normalizeContact sends and the function measures
  // (U+0130 lower-cases to two code units).
  return value.toLowerCase().length <= CONTACT_LIMITS.emailMax && EMAIL_RE.test(value);
}

export function isValidPhone(phone: string): boolean {
  const value = phone.trim();
  const digits = value.replace(/\D/g, '').length;
  return value.length <= CONTACT_LIMITS.phoneMax && PHONE_CHARS_RE.test(value) && digits >= 7 && digits <= 15;
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
  const message = form.message.trim();

  // Hidden or control characters win over any other error of the same field: they are what to fix first.
  if (hasUnsafeText(form.name)) errors.name = 'Hay caracteres invisibles no permitidos en el nombre. Revisa lo que pegaste.';
  else if (name.length < CONTACT_LIMITS.nameMin) errors.name = 'Escribe tu nombre completo.';
  else if (name.length > CONTACT_LIMITS.nameMax) errors.name = 'El nombre es demasiado largo.';

  if (hasUnsafeText(form.phone ?? '')) errors.phone = 'Hay caracteres invisibles no permitidos en el teléfono. Revisa lo que pegaste.';
  else if (phone && !isValidPhone(phone)) errors.phone = 'Revisa el número de teléfono.';

  if (hasUnsafeText(form.email ?? '')) errors.email = 'Hay caracteres invisibles no permitidos en el correo. Revisa lo que pegaste.';
  else if (email && !isValidEmail(email)) errors.email = 'Revisa el correo electrónico.';

  if (!phone && !email) errors.contact = 'Déjanos un teléfono o un correo para responderte.';

  if (hasUnsafeText(form.message)) errors.message = 'Hay caracteres invisibles no permitidos en el mensaje. Revisa lo que pegaste.';
  else if (message.length < CONTACT_LIMITS.messageMin) errors.message = 'Cuéntanos un poco más.';
  else if (message.length > CONTACT_LIMITS.messageMax) errors.message = 'El mensaje es demasiado largo.';
  return errors;
}

/** Trims, lower-cases the email and drops empty optional fields. */
export function normalizeContact(form: ContactPayload): ContactPayload {
  const phone = form.phone?.trim();
  const email = form.email?.trim().toLowerCase();
  const website = form.website?.trim();
  return {
    name: form.name.trim(),
    ...(phone ? { phone } : {}),
    ...(email ? { email } : {}),
    message: form.message.trim(),
    ...(website ? { website } : {}),
  };
}

export async function sendContactMessage(form: ContactPayload): Promise<void> {
  const { error } = await supabase.functions.invoke('send-contact-email', {
    body: normalizeContact(form),
  });
  if (!error) return;
  // FunctionsHttpError carries the HTTP response as `context`.
  const status = (error as { context?: { status?: unknown } }).context?.status;
  if (status === 429) throw new ContactRateLimitError();
  if (status === 503) throw new ContactUnavailableError();
  if (status === 400) throw new ContactInvalidError();
  throw error;
}
