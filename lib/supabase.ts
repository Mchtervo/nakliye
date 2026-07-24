import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const FIS_BUCKET = "fisler";

let istemci: SupabaseClient | null = null;

function supabaseUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
}

function supabaseSecretKey(): string | undefined {
  return (
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  );
}

/** Supabase Storage + admin işlemleri (secret / service role). */
export function supabaseHazirMi(): boolean {
  return Boolean(supabaseUrl() && supabaseSecretKey());
}

export function supabaseAdmin(): SupabaseClient {
  const url = supabaseUrl();
  const key = supabaseSecretKey();
  if (!url || !key) {
    throw new Error("Supabase ayarları eksik (URL / SECRET_KEY).");
  }
  if (!istemci) {
    istemci = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return istemci;
}
