-- CreateTable
CREATE TABLE "KasaHareket" (
    "id" SERIAL NOT NULL,
    "tarih" TIMESTAMP(3) NOT NULL,
    "tip" TEXT NOT NULL,
    "tutar" INTEGER NOT NULL,
    "aciklama" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KasaHareket_pkey" PRIMARY KEY ("id")
);
