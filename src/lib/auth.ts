import { supabase } from '@/integrations/supabase/client';
import { getAuthEmailRedirectUrl, getSiteOrigin } from '@/lib/siteUrl';

export type OAuthProvider = 'google' | 'github';

function getAuthCallbackUrl(): string {
  return `${getSiteOrigin()}/auth/callback`;
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

export async function exchangeAuthCodeForSession(code: string): Promise<void> {
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) throw error;
}
