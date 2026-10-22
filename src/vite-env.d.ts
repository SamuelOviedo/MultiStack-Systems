/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SITE_URL?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  /** Alias accepted for VITE_SUPABASE_PUBLISHABLE_KEY (see integrations/supabase/env.ts). */
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** Etiqueta de Google Ads (AW-<dígitos>). Pública; sin un valor válido no se carga nada (lib/analytics.ts). */
  readonly VITE_GADS_ID?: string;
  /** Destino de la conversión «Contacto enviado» (AW-<dígitos>/<etiqueta>); su AW-… debe coincidir con VITE_GADS_ID. */
  readonly VITE_GADS_CONTACT_LABEL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
