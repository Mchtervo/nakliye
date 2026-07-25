-- Aynı mesajın tekrar tekrar AI'a gönderilmesini engellemek için.
-- metinHash: birebir aynı metin. onek: aynı listenin ufak değişiklikle tekrarı.
ALTER TABLE "HamMesaj" ADD COLUMN IF NOT EXISTS "metinHash" TEXT;
ALTER TABLE "HamMesaj" ADD COLUMN IF NOT EXISTS "onek" TEXT;

CREATE INDEX IF NOT EXISTS "HamMesaj_metinHash_idx" ON "HamMesaj"("metinHash");
CREATE INDEX IF NOT EXISTS "HamMesaj_kaynakId_onek_createdAt_idx"
  ON "HamMesaj"("kaynakId", "onek", "createdAt");
