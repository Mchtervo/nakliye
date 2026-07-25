-- CreateTable
CREATE TABLE "IlanKaynagi" (
    "id" SERIAL NOT NULL,
    "tur" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "hedef" TEXT NOT NULL,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "sonTarama" TIMESTAMP(3),
    "sonHata" TEXT,
    "bulunanAdet" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IlanKaynagi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "YukIlani" (
    "id" SERIAL NOT NULL,
    "kaynakId" INTEGER,
    "hamMetin" TEXT NOT NULL,
    "firmaAdi" TEXT,
    "telefon" TEXT,
    "nereden" TEXT,
    "nereye" TEXT,
    "cikisIl" TEXT,
    "varisIl" TEXT,
    "yuklemeTarihi" TIMESTAMP(3),
    "ucret" INTEGER,
    "aracTipi" TEXT,
    "yukTipi" TEXT,
    "guvenSkoru" INTEGER NOT NULL DEFAULT 0,
    "durum" TEXT NOT NULL DEFAULT 'YENI',
    "dedupHash" TEXT NOT NULL,
    "donusTalebiId" INTEGER,
    "bildirildi" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "YukIlani_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DonusTalebi" (
    "id" SERIAL NOT NULL,
    "yukId" INTEGER,
    "cikis" TEXT NOT NULL,
    "varis" TEXT NOT NULL,
    "cikisIl" TEXT NOT NULL,
    "varisIl" TEXT NOT NULL,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "sonKontrol" TIMESTAMP(3),
    "eslesmeAdet" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DonusTalebi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdayFirma" (
    "id" SERIAL NOT NULL,
    "ad" TEXT NOT NULL,
    "sehir" TEXT,
    "ilce" TEXT,
    "adres" TEXT,
    "telefon" TEXT,
    "web" TEXT,
    "sektor" TEXT,
    "kaynak" TEXT,
    "neden" TEXT,
    "skor" INTEGER NOT NULL DEFAULT 0,
    "durum" TEXT NOT NULL DEFAULT 'YENI',
    "notlar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdayFirma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiAnaliz" (
    "id" SERIAL NOT NULL,
    "tarih" TIMESTAMP(3) NOT NULL,
    "tur" TEXT NOT NULL DEFAULT 'GUNLUK',
    "baslik" TEXT NOT NULL,
    "metin" TEXT NOT NULL,
    "veriJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiAnaliz_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bildirim" (
    "id" SERIAL NOT NULL,
    "kanal" TEXT NOT NULL,
    "hedef" TEXT NOT NULL,
    "baslik" TEXT NOT NULL,
    "metin" TEXT NOT NULL,
    "durum" TEXT NOT NULL DEFAULT 'BEKLIYOR',
    "hata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bildirim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushAbone" (
    "id" SERIAL NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "cihaz" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushAbone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IlanKaynagi_tur_hedef_key" ON "IlanKaynagi"("tur", "hedef");

-- CreateIndex
CREATE UNIQUE INDEX "YukIlani_dedupHash_key" ON "YukIlani"("dedupHash");

-- CreateIndex
CREATE INDEX "YukIlani_durum_createdAt_idx" ON "YukIlani"("durum", "createdAt");

-- CreateIndex
CREATE INDEX "YukIlani_cikisIl_varisIl_idx" ON "YukIlani"("cikisIl", "varisIl");

-- CreateIndex
CREATE INDEX "DonusTalebi_aktif_idx" ON "DonusTalebi"("aktif");

-- CreateIndex
CREATE INDEX "AdayFirma_durum_skor_idx" ON "AdayFirma"("durum", "skor");

-- CreateIndex
CREATE UNIQUE INDEX "AdayFirma_ad_sehir_key" ON "AdayFirma"("ad", "sehir");

-- CreateIndex
CREATE UNIQUE INDEX "AiAnaliz_tarih_tur_key" ON "AiAnaliz"("tarih", "tur");

-- CreateIndex
CREATE INDEX "Bildirim_createdAt_idx" ON "Bildirim"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PushAbone_endpoint_key" ON "PushAbone"("endpoint");

-- AddForeignKey
ALTER TABLE "YukIlani" ADD CONSTRAINT "YukIlani_kaynakId_fkey" FOREIGN KEY ("kaynakId") REFERENCES "IlanKaynagi"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YukIlani" ADD CONSTRAINT "YukIlani_donusTalebiId_fkey" FOREIGN KEY ("donusTalebiId") REFERENCES "DonusTalebi"("id") ON DELETE SET NULL ON UPDATE CASCADE;
