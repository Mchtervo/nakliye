-- Üyelik: telefon doğrulama, yarım kalan kurulum, oturum iptali (yalnız ana şemada dolu)
ALTER TABLE "Uye" ADD COLUMN IF NOT EXISTS "telefonDogrulandi" TIMESTAMP(3);
ALTER TABLE "Uye" ADD COLUMN IF NOT EXISTS "kurulumAdim" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Uye" ADD COLUMN IF NOT EXISTS "kurulumBitti" TIMESTAMP(3);
ALTER TABLE "Uye" ADD COLUMN IF NOT EXISTS "kurulumTaslak" JSONB;
ALTER TABLE "Uye" ADD COLUMN IF NOT EXISTS "oturumSurum" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "Uye_telefon_idx" ON "Uye"("telefon");

CREATE TABLE IF NOT EXISTS "TelefonKodu" (
    "id" SERIAL NOT NULL,
    "uyeId" INTEGER NOT NULL,
    "amac" TEXT NOT NULL,
    "kodHash" TEXT NOT NULL,
    "sonKullanma" TIMESTAMP(3) NOT NULL,
    "deneme" INTEGER NOT NULL DEFAULT 0,
    "kullanildi" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TelefonKodu_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "TelefonKodu_uyeId_amac_createdAt_idx" ON "TelefonKodu"("uyeId", "amac", "createdAt");

CREATE TABLE IF NOT EXISTS "YonetimKaydi" (
    "id" SERIAL NOT NULL,
    "islem" TEXT NOT NULL,
    "uyeId" INTEGER,
    "ayrinti" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "YonetimKaydi_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "YonetimKaydi_createdAt_idx" ON "YonetimKaydi"("createdAt");

-- Araç: sınıf ve gövde ayrı, taşıma bilgileri, konum, aktif araç
ALTER TABLE "Arac" ADD COLUMN IF NOT EXISTS "sinif" TEXT;
ALTER TABLE "Arac" ADD COLUMN IF NOT EXISTS "kasaTipi" TEXT;
ALTER TABLE "Arac" ADD COLUMN IF NOT EXISTS "kapasiteTon" DOUBLE PRECISION;
ALTER TABLE "Arac" ADD COLUMN IF NOT EXISTS "kasaUzunlukM" DOUBLE PRECISION;
ALTER TABLE "Arac" ADD COLUMN IF NOT EXISTS "kasaGenislikM" DOUBLE PRECISION;
ALTER TABLE "Arac" ADD COLUMN IF NOT EXISTS "kasaYukseklikM" DOUBLE PRECISION;
ALTER TABLE "Arac" ADD COLUMN IF NOT EXISTS "konumIl" TEXT;
ALTER TABLE "Arac" ADD COLUMN IF NOT EXISTS "aktif" BOOLEAN NOT NULL DEFAULT false;
-- Var olan ilk araç aktif olur (km / bakım kayıtları aynen kalır)
UPDATE "Arac" SET "aktif" = true WHERE "id" = (SELECT MIN("id") FROM "Arac") AND NOT EXISTS (SELECT 1 FROM "Arac" WHERE "aktif" = true);

-- Sefer / gider hangi araca ait (eski kayıtlar boş kalır = ilk araç)
ALTER TABLE "Yuk" ADD COLUMN IF NOT EXISTS "aracId" INTEGER;
ALTER TABLE "Gider" ADD COLUMN IF NOT EXISTS "aracId" INTEGER;

-- İlan şikâyetleri (yalnız ana şemada dolu)
CREATE TABLE IF NOT EXISTS "IlanSikayet" (
    "id" SERIAL NOT NULL,
    "ilanId" INTEGER NOT NULL,
    "uyeId" INTEGER NOT NULL,
    "neden" TEXT NOT NULL,
    "not" TEXT,
    "durum" TEXT NOT NULL DEFAULT 'ACIK',
    "kapandi" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IlanSikayet_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "IlanSikayet_ilanId_uyeId_key" ON "IlanSikayet"("ilanId", "uyeId");
CREATE INDEX IF NOT EXISTS "IlanSikayet_durum_createdAt_idx" ON "IlanSikayet"("durum", "createdAt");

-- Kredi planı ve taksitler (her defterde: yönetici ve her üye kendi şemasında)
CREATE TABLE IF NOT EXISTS "Kredi" (
    "id" SERIAL NOT NULL,
    "ad" TEXT NOT NULL,
    "kurum" TEXT,
    "anapara" INTEGER NOT NULL,
    "baslangic" TIMESTAMP(3) NOT NULL,
    "notlar" TEXT,
    "kapandi" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Kredi_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "KrediTaksit" (
    "id" SERIAL NOT NULL,
    "krediId" INTEGER NOT NULL,
    "sira" INTEGER NOT NULL,
    "vade" TIMESTAMP(3) NOT NULL,
    "tutar" INTEGER NOT NULL,
    "anaparaPay" INTEGER NOT NULL,
    "faizPay" INTEGER NOT NULL,
    "odendi" TIMESTAMP(3),
    "giderId" INTEGER,
    "uyari" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KrediTaksit_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "KrediTaksit_krediId_fkey" FOREIGN KEY ("krediId") REFERENCES "Kredi"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "KrediTaksit_vade_idx" ON "KrediTaksit"("vade");
CREATE INDEX IF NOT EXISTS "KrediTaksit_krediId_sira_idx" ON "KrediTaksit"("krediId", "sira");
