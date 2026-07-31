-- AlterTable
ALTER TABLE "YukIlani" ADD COLUMN IF NOT EXISTS "aracUzunluk" DOUBLE PRECISION;
ALTER TABLE "YukIlani" ADD COLUMN IF NOT EXISTS "koridorTipi" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "YukIlani_koridorTipi_sonGorulme_idx" ON "YukIlani"("koridorTipi", "sonGorulme");
