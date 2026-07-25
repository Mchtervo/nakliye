-- HamMesaj deneme limiti: aynı mesaj sonsuza kadar AI'ya gitmesin.
ALTER TABLE "HamMesaj" ADD COLUMN IF NOT EXISTS "denemeSayisi" INTEGER NOT NULL DEFAULT 0;

DROP INDEX IF EXISTS "HamMesaj_islendi_createdAt_idx";
CREATE INDEX IF NOT EXISTS "HamMesaj_islendi_denemeSayisi_createdAt_idx"
  ON "HamMesaj"("islendi", "denemeSayisi", "createdAt");

-- Her OpenAI çağrısının token / maliyet kaydı.
CREATE TABLE IF NOT EXISTS "AiCagri" (
    "id" SERIAL NOT NULL,
    "zaman" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kaynak" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "girdiToken" INTEGER NOT NULL DEFAULT 0,
    "ciktiToken" INTEGER NOT NULL DEFAULT 0,
    "reasoningToken" INTEGER NOT NULL DEFAULT 0,
    "maliyetMikro" INTEGER NOT NULL DEFAULT 0,
    "basarili" BOOLEAN NOT NULL DEFAULT false,
    "hata" TEXT,
    "sureMs" INTEGER,

    CONSTRAINT "AiCagri_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AiCagri_zaman_idx" ON "AiCagri"("zaman");
CREATE INDEX IF NOT EXISTS "AiCagri_kaynak_zaman_idx" ON "AiCagri"("kaynak", "zaman");
