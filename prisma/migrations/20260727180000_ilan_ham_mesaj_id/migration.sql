-- YukIlani → HamMesaj bağı (HamMesaj.id)
ALTER TABLE "YukIlani" ADD COLUMN IF NOT EXISTS "hamMesajId" INTEGER;
CREATE INDEX IF NOT EXISTS "YukIlani_hamMesajId_idx" ON "YukIlani"("hamMesajId");
