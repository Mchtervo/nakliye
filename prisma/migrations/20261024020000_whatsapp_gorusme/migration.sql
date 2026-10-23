CREATE TABLE IF NOT EXISTS "WhatsAppGorusme" (
    "id" SERIAL NOT NULL,
    "ilanId" INTEGER NOT NULL,
    "telefon" TEXT NOT NULL,
    "gidenMetin" TEXT NOT NULL,
    "durum" TEXT NOT NULL DEFAULT 'BEKLIYOR',
    "cevapMetin" TEXT,
    "ozet" TEXT,
    "gonderildiAt" TIMESTAMP(3),
    "cevapAt" TIMESTAMP(3),
    "hata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppGorusme_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WhatsAppGorusme_durum_createdAt_idx" ON "WhatsAppGorusme"("durum", "createdAt");
CREATE INDEX IF NOT EXISTS "WhatsAppGorusme_telefon_createdAt_idx" ON "WhatsAppGorusme"("telefon", "createdAt");
CREATE INDEX IF NOT EXISTS "WhatsAppGorusme_ilanId_idx" ON "WhatsAppGorusme"("ilanId");

DO $$ BEGIN
  ALTER TABLE "WhatsAppGorusme" ADD CONSTRAINT "WhatsAppGorusme_ilanId_fkey"
    FOREIGN KEY ("ilanId") REFERENCES "YukIlani"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
