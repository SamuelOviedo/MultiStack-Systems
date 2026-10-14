import { supabase } from '@/integrations/supabase/client';
import { getAuthEmailRedirectUrl, getSiteOrigin } from '@/lib/siteUrl';

export type OAuthProvider = 'google' | 'github';

/**
 * Where OAuth and password-reset flows return: the origin that STARTED them,
 * so a Vercel Preview comes back to that same Preview (not production) and
 * localhost to localhost. Supabase only honors it if the origin matches an
 * entry in Auth → URL Configuration → Redirect URLs (wildcards allowed);
 * otherwise it falls back to the project's Site URL.
 * (Signup confirmation e-mails keep the canonical origin: getAuthEmailRedirectUrl.)
 */
export function getAuthCallbackUrl(): string {
  const origin = typeof window !== "undefined" ? window.location.origin : getSiteOrigin();
  return `${origin}/auth/callback`;
}

export async function signInWithPassword(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) throw error;
}

export async function signInWithOAuth(provider: OAuthProvider): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: getAuthCallbackUrl() },
  });
  if (error) throw error;
}

export async function signUpWithEmail(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { emailRedirectTo: getAuthEmailRedirectUrl() },
  });
  if (error) throw error;
}

export async function sendPasswordResetEmail(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: getAuthCallbackUrl(),
  });
  if (error) throw error;
}

/**
 * Sets a new password for the signed-in user (recovery session) and then
 * revokes the user's OTHER sessions — whoever else held the old password is
 * signed out. Revocation failures are ignored: the password already changed.
 */
export async function updatePassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
  try {
    await supabase.auth.signOut({ scope: 'others' });
  } catch {
    /* best effort */
  }
}

/** Password rules shown and enforced by the UI (Supabase enforces its own minimum too). */
export const PASSWORD_RULES = { min: 8, max: 72 } as const;

/** Spanish validation message for a new password, or null when it is acceptable. */
export function validateNewPassword(password: string, confirmation: string): string | null {
  if (password.length < PASSWORD_RULES.min) return `Usa al menos ${PASSWORD_RULES.min} caracteres.`;
  if (password.length > PASSWORD_RULES.max) return `Usa como máximo ${PASSWORD_RULES.max} caracteres.`;
  if (!/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(password) || !/\d/.test(password)) {
    return 'Combina letras y números.';
  }
  if (password !== confirmation) return 'Las contraseñas no coinciden.';
  return null;
}

/** Supabase Auth error code (`AuthError.code`), when present. */
export function authErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined;
  const { code } = error as { code?: unknown };
  return typeof code === 'string' ? code : undefined;
}

/** Codes meaning the recovery session/link can no longer be used. */
export const INVALID_LINK_CODES = new Set([
  'otp_expired', 'session_not_found', 'session_expired', 'bad_jwt', 'reauthentication_needed',
]);

const LINK_INVALID_MESSAGE = 'El enlace no es válido o ya expiró. Solicita uno nuevo.';

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  email_not_confirmed:
    'Tu correo aún no está confirmado. Abre el enlace que te enviamos (revisa también spam) o pide uno nuevo.',
  invalid_credentials: 'Correo o contraseña incorrectos.',
  user_already_exists: 'Ya existe una cuenta con ese correo. Inicia sesión o recupera tu contraseña.',
  email_exists: 'Ya existe una cuenta con ese correo. Inicia sesión o recupera tu contraseña.',
  weak_password: 'La contraseña es demasiado débil. Usa al menos 8 caracteres combinando letras y números.',
  same_password: 'La nueva contraseña debe ser distinta de la actual.',
  over_email_send_rate_limit: 'Se enviaron demasiados correos. Espera unos minutos e inténtalo de nuevo.',
  over_request_rate_limit: 'Demasiados intentos seguidos. Espera unos minutos e inténtalo de nuevo.',
  signup_disabled: 'El registro de cuentas nuevas está desactivado temporalmente.',
  ...Object.fromEntries([...INVALID_LINK_CODES].map((code) => [code, LINK_INVALID_MESSAGE])),
};

/** User-facing (Spanish) message for an auth error; falls back to the raw message. */
export function describeAuthError(error: unknown): string {
  const code = authErrorCode(error);
  if (code && AUTH_ERROR_MESSAGES[code]) return AUTH_ERROR_MESSAGES[code];
  return error instanceof Error ? error.message : String(error);
}

export async function exchangeAuthCodeForSession(code: string): Promise<void> {
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) throw error;
}
