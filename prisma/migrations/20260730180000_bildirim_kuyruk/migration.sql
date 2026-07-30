-- Bağımsız bildirim kuyruğu: deneme sayacı + push kanal bayrağı
ALTER TABLE "YukIlani" ADD COLUMN IF NOT EXISTS "bildirimDeneme" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "YukIlani" ADD COLUMN IF NOT EXISTS "bildirimPush" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "YukIlani_bildirildi_bildirimDeneme_sonGorulme_idx"
  ON "YukIlani" ("bildirildi", "bildirimDeneme", "sonGorulme");
