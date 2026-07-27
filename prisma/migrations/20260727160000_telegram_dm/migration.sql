-- AlterTable
ALTER TABLE "HamMesaj" ADD COLUMN IF NOT EXISTS "gonderenUserId" TEXT;

-- AlterTable
ALTER TABLE "YukIlani" ADD COLUMN IF NOT EXISTS "gonderenUserId" TEXT;
ALTER TABLE "YukIlani" ADD COLUMN IF NOT EXISTS "kaynakMesajId" INTEGER;

-- CreateTable
CREATE TABLE IF NOT EXISTS "TelegramDm" (
    "id" SERIAL NOT NULL,
    "ilanId" INTEGER NOT NULL,
    "hedefUserId" TEXT,
    "telefon" TEXT,
    "metin" TEXT NOT NULL,
    "durum" TEXT NOT NULL DEFAULT 'ONAY_BEKLIYOR',
    "outboundMesajId" INTEGER,
    "gonderildiAt" TIMESTAMP(3),
    "cevapMetin" TEXT,
    "cevapAt" TIMESTAMP(3),
    "hata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramDm_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TelegramDm_durum_createdAt_idx" ON "TelegramDm"("durum", "createdAt");
CREATE INDEX IF NOT EXISTS "TelegramDm_hedefUserId_durum_idx" ON "TelegramDm"("hedefUserId", "durum");
CREATE INDEX IF NOT EXISTS "TelegramDm_ilanId_idx" ON "TelegramDm"("ilanId");
CREATE INDEX IF NOT EXISTS "YukIlani_gonderenUserId_idx" ON "YukIlani"("gonderenUserId");
CREATE INDEX IF NOT EXISTS "HamMesaj_gonderenUserId_idx" ON "HamMesaj"("gonderenUserId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "TelegramDm" ADD CONSTRAINT "TelegramDm_ilanId_fkey"
    FOREIGN KEY ("ilanId") REFERENCES "YukIlani"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
