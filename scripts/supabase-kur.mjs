/**
 * Supabase Storage bucket oluşturur (bir kez çalıştır).
 * Kullanım: node --env-file=.env scripts/supabase-kur.mjs
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const adaylar = [
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  process.env.SUPABASE_SECRET_KEY,
].filter(Boolean);
const key =
  adaylar.find((k) => k.startsWith("eyJ") && k.split(".").length >= 3) ||
  adaylar[0];
const bucket = "fisler";

if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli.");
  process.exit(1);
}

if (!key.startsWith("eyJ") || key.split(".").length < 3) {
  console.error(
    "SUPABASE_SERVICE_ROLE_KEY JWT olmalı (eyJ…). " +
      "sb_secret_ Storage'da Invalid Compact JWS verir. " +
      "Dashboard → API → Legacy API Keys → service_role kopyala."
  );
  process.exit(1);
}

const sb = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: list, error: listErr } = await sb.storage.listBuckets();
if (listErr) {
  console.error("Bucket listesi alınamadı:", listErr.message);
  process.exit(1);
}

if (list?.some((b) => b.name === bucket)) {
  console.log(`Bucket zaten var: ${bucket}`);
} else {
  const { error } = await sb.storage.createBucket(bucket, {
    public: true,
    fileSizeLimit: 8 * 1024 * 1024,
    allowedMimeTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/heic",
      "image/heif",
    ],
  });
  if (error) {
    console.error("Bucket oluşturulamadı:", error.message);
    process.exit(1);
  }
  console.log(`Bucket oluşturuldu (public): ${bucket}`);
}

console.log("Tamam. Fişler Supabase Storage'a gidecek.");
