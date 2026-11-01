-- Üye hesapları (yalnız ana şemada dolu; üye şemalarında boş kalır)
CREATE TABLE IF NOT EXISTS "Uye" (
    "id" SERIAL NOT NULL,
    "kullaniciAdi" TEXT NOT NULL,
    "sifreHash" TEXT NOT NULL,
    "ad" TEXT,
    "telefon" TEXT,
    "sehir" TEXT,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "sonGiris" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Uye_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Uye_kullaniciAdi_key" ON "Uye"("kullaniciAdi");
