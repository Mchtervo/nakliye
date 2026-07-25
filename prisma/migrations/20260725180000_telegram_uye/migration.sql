-- Telegram kullanıcı hesabıyla takip edilen gruplar için ek alanlar.
ALTER TABLE "IlanKaynagi" ADD COLUMN IF NOT EXISTS "durum" TEXT NOT NULL DEFAULT 'AKTIF';
ALTER TABLE "IlanKaynagi" ADD COLUMN IF NOT EXISTS "bolge" TEXT;
ALTER TABLE "IlanKaynagi" ADD COLUMN IF NOT EXISTS "sonMesajId" INTEGER;

CREATE INDEX IF NOT EXISTS "IlanKaynagi_tur_durum_idx" ON "IlanKaynagi"("tur", "durum");

-- Gruplardan çekilen ham mesaj kuyruğu.
CREATE TABLE IF NOT EXISTS "HamMesaj" (
    "id" SERIAL NOT NULL,
    "kaynakId" INTEGER,
    "mesajId" INTEGER,
    "metin" TEXT NOT NULL,
    "islendi" BOOLEAN NOT NULL DEFAULT false,
    "hata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HamMesaj_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "HamMesaj_kaynakId_mesajId_key" ON "HamMesaj"("kaynakId", "mesajId");
CREATE INDEX IF NOT EXISTS "HamMesaj_islendi_createdAt_idx" ON "HamMesaj"("islendi", "createdAt");

ALTER TABLE "HamMesaj" DROP CONSTRAINT IF EXISTS "HamMesaj_kaynakId_fkey";
ALTER TABLE "HamMesaj" ADD CONSTRAINT "HamMesaj_kaynakId_fkey" FOREIGN KEY ("kaynakId") REFERENCES "IlanKaynagi"("id") ON DELETE CASCADE ON UPDATE CASCADE;
