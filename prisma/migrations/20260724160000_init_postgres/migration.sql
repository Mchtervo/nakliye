-- CreateSchema
CREATE TABLE "Firma" (
    "id" SERIAL NOT NULL,
    "ad" TEXT NOT NULL,
    "telefon" TEXT,
    "vergiNo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Firma_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Yuk" (
    "id" SERIAL NOT NULL,
    "tarih" TIMESTAMP(3) NOT NULL,
    "firmaId" INTEGER NOT NULL,
    "nereden" TEXT NOT NULL,
    "nereye" TEXT NOT NULL,
    "aciklama" TEXT,
    "kdvli" BOOLEAN NOT NULL DEFAULT true,
    "kdvDahilMi" BOOLEAN NOT NULL DEFAULT true,
    "netTutar" INTEGER NOT NULL,
    "kdvTutar" INTEGER NOT NULL,
    "toplamTutar" INTEGER NOT NULL,
    "odemeDurumu" TEXT NOT NULL DEFAULT 'BEKLIYOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Yuk_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Odeme" (
    "id" SERIAL NOT NULL,
    "yukId" INTEGER NOT NULL,
    "tarih" TIMESTAMP(3) NOT NULL,
    "tutar" INTEGER NOT NULL,
    "not" TEXT,

    CONSTRAINT "Odeme_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Gider" (
    "id" SERIAL NOT NULL,
    "tarih" TIMESTAMP(3) NOT NULL,
    "kategori" TEXT NOT NULL,
    "aciklama" TEXT,
    "kdvli" BOOLEAN NOT NULL DEFAULT true,
    "kdvDahilMi" BOOLEAN NOT NULL DEFAULT true,
    "netTutar" INTEGER NOT NULL,
    "kdvTutar" INTEGER NOT NULL,
    "toplamTutar" INTEGER NOT NULL,
    "fisResmi" TEXT,
    "gonderildi" BOOLEAN NOT NULL DEFAULT false,
    "gonderimTarihi" TIMESTAMP(3),
    "litre" DOUBLE PRECISION,
    "km" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Gider_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Ayar" (
    "anahtar" TEXT NOT NULL,
    "deger" TEXT NOT NULL,

    CONSTRAINT "Ayar_pkey" PRIMARY KEY ("anahtar")
);

CREATE UNIQUE INDEX "Firma_ad_key" ON "Firma"("ad");

ALTER TABLE "Yuk" ADD CONSTRAINT "Yuk_firmaId_fkey" FOREIGN KEY ("firmaId") REFERENCES "Firma"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Odeme" ADD CONSTRAINT "Odeme_yukId_fkey" FOREIGN KEY ("yukId") REFERENCES "Yuk"("id") ON DELETE CASCADE ON UPDATE CASCADE;
