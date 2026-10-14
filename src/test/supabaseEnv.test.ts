import { describe, expect, it } from "vitest";
import { getSupabaseEnvProblems, resolveSupabaseEnv, SupabaseConfigError } from "@/integrations/supabase/env";

const VALID = {
  VITE_SUPABASE_URL: "https://abcdefghijklmnop.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "eyJhbGciOiJIUzI1NiJ9.real-looking.key",
};

describe("resolveSupabaseEnv", () => {
  it("devuelve URL y key válidas (sin espacios sobrantes)", () => {
    expect(resolveSupabaseEnv({ ...VALID, VITE_SUPABASE_URL: `  ${VALID.VITE_SUPABASE_URL}  ` })).toEqual({
      url: VALID.VITE_SUPABASE_URL,
      publishableKey: VALID.VITE_SUPABASE_PUBLISHABLE_KEY,
    });
  });

  it("acepta VITE_SUPABASE_ANON_KEY como alias de la publishable key", () => {
    const env = { VITE_SUPABASE_URL: VALID.VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY: "anon-key-value" };
    expect(resolveSupabaseEnv(env).publishableKey).toBe("anon-key-value");
  });

  it.each([
    ["indefinida", { VITE_SUPABASE_PUBLISHABLE_KEY: VALID.VITE_SUPABASE_PUBLISHABLE_KEY }, /VITE_SUPABASE_URL is missing/],
    ["vacía", { ...VALID, VITE_SUPABASE_URL: "   " }, /VITE_SUPABASE_URL is missing/],
    ["placeholder (caso real)", { ...VALID, VITE_SUPABASE_URL: "https://your_project_ref.supabase.co" }, /placeholder \(your_project_ref\.supabase\.co\)/],
    ["placeholder en mayúsculas (.env.example)", { ...VALID, VITE_SUPABASE_URL: "https://YOUR_PROJECT_REF.supabase.co" }, /placeholder/],
    ["no es URL", { ...VALID, VITE_SUPABASE_URL: "abcdefghijklmnop" }, /not a valid URL/],
    ["protocolo no http(s)", { ...VALID, VITE_SUPABASE_URL: "ftp://x.supabase.co" }, /http\(s\)/],
  ])("URL %s → error descriptivo", (_case, env, detail) => {
    expect(() => resolveSupabaseEnv(env)).toThrow(SupabaseConfigError);
    expect(() => resolveSupabaseEnv(env)).toThrow(/^Missing or invalid Supabase environment variables\./);
    expect(() => resolveSupabaseEnv(env)).toThrow(detail);
  });

  it.each([
    ["indefinida", { VITE_SUPABASE_URL: VALID.VITE_SUPABASE_URL }, /missing or empty/],
    ["placeholder de .env.example", { ...VALID, VITE_SUPABASE_PUBLISHABLE_KEY: "YOUR_SUPABASE_ANON_KEY" }, /placeholder/],
  ])("key %s → error descriptivo", (_case, env, detail) => {
    expect(() => resolveSupabaseEnv(env)).toThrow(detail);
  });

  it("nunca incluye el valor de la key en el mensaje", () => {
    const secretish = "sb_publishable_your_supabase_DO_NOT_LEAK";
    try {
      resolveSupabaseEnv({ VITE_SUPABASE_URL: "", VITE_SUPABASE_PUBLISHABLE_KEY: secretish });
      throw new Error("should have thrown");
    } catch (e) {
      expect((e as Error).message).not.toContain(secretish);
    }
  });

  it("acepta un Supabase local (supabase start, http://127.0.0.1:54321)", () => {
    expect(getSupabaseEnvProblems({ ...VALID, VITE_SUPABASE_URL: "http://127.0.0.1:54321" })).toEqual([]);
  });
});
