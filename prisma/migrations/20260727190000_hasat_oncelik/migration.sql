-- AlterTable
ALTER TABLE "IlanKaynagi" ADD COLUMN IF NOT EXISTS "oncelik" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "IlanKaynagi" ADD COLUMN IF NOT EXISTS "hasatKaynak" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "IlanKaynagi_tur_durum_oncelik_idx" ON "IlanKaynagi"("tur", "durum", "oncelik");

-- Keşif ADAY'ları otomatik katılım kuyruğuna al (kullaniciAdi olanlar)
UPDATE "IlanKaynagi"
SET "aktif" = true
WHERE "tur" = 'TELEGRAM_UYE'
  AND "durum" = 'ADAY'
  AND "kullaniciAdi" IS NOT NULL
  AND "aktif" = false;
