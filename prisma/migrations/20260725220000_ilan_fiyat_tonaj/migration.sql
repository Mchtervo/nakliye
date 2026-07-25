-- Ton başı fiyat ile komple navlunu ayırmak, tonaj ve araç tipine göre
-- filtreleyebilmek için eklenen alanlar. Hepsi nullable / varsayılanlı;
-- mevcut ilanlar olduğu gibi kalır ("ucret" artık komple navlunu tutar).
ALTER TABLE "YukIlani" ADD COLUMN IF NOT EXISTS "fiyatTon" INTEGER;
ALTER TABLE "YukIlani" ADD COLUMN IF NOT EXISTS "fiyatBelirsiz" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "YukIlani" ADD COLUMN IF NOT EXISTS "tonaj" INTEGER;
ALTER TABLE "YukIlani" ADD COLUMN IF NOT EXISTS "aracTipiKod" TEXT;

CREATE INDEX IF NOT EXISTS "YukIlani_aracTipiKod_idx" ON "YukIlani"("aracTipiKod");
