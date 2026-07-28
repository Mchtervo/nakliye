import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const FIS_BUCKET = "fisler";

let istemci: SupabaseClient | null = null;

function supabaseUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
}

/**
 * Storage API Authorization'ı JWT (üç parçalı Compact JWS) bekliyor.
 * Yeni `sb_secret_…` anahtarları JWT değil → "Invalid Compact JWS".
 * Dashboard → Project Settings → API → Legacy API Keys → service_role (eyJ…).
 */
export function supabaseJwtMi(key: string | undefined | null): boolean {
  if (!key) return false;
  const k = key.trim();
  return k.startsWith("eyJ") && k.split(".").length >= 3;
}

/** JWT içindeki ref ile URL projesinin aynı olduğunu doğrula. */
function jwtProjeUyuyorMu(url: string, key: string): boolean {
  try {
    const host = new URL(url).hostname; // xxx.supabase.co
    const ref = host.split(".")[0];
    const mid = key.split(".")[1];
    if (!mid) return false;
    const pad = mid + "=".repeat((4 - (mid.length % 4)) % 4);
    const json = Buffer.from(
      pad.replace(/-/g, "+").replace(/_/g, "/"),
      "base64"
    ).toString("utf8");
    const payload = JSON.parse(json) as { ref?: string; role?: string };
    if (payload.role && payload.role !== "service_role") return false;
    return payload.ref === ref;
  } catch {
    return false;
  }
}

function supabaseSecretKey(): string | undefined {
  const adaylar = [
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
    process.env.SUPABASE_SECRET_KEY?.trim(),
  ].filter(Boolean) as string[];

  // Önce JWT olanı seç (sb_secret_ Storage'da patlıyor)
  const jwt = adaylar.find((k) => supabaseJwtMi(k));
  if (jwt) return jwt;

  // Hiç JWT yoksa yine de döndür — hazirMi false olur / hata mesajı netleşir
  return adaylar[0];
}

/** Supabase Storage + admin işlemleri (legacy service_role JWT). */
export function supabaseHazirMi(): boolean {
  const url = supabaseUrl();
  const key = supabaseSecretKey();
  if (!url || !supabaseJwtMi(key)) return false;
  return jwtProjeUyuyorMu(url, key!);
}

export function supabaseAdmin(): SupabaseClient {
  const url = supabaseUrl();
  const key = supabaseSecretKey();
  if (!url || !key) {
    throw new Error("Supabase ayarları eksik (URL / SERVICE_ROLE_KEY).");
  }
  if (!supabaseJwtMi(key)) {
    throw new Error(
      "Supabase anahtarı JWT değil (sb_secret_…). " +
        "Dashboard → API → Legacy keys → service_role (eyJ…) kullan."
    );
  }
  if (!istemci) {
    istemci = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return istemci;
}
