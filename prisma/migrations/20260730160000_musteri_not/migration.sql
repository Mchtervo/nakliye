-- AlterTable
CREATE TABLE "MusteriNot" (
    "id" SERIAL NOT NULL,
    "telefon" TEXT NOT NULL,
    "metin" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MusteriNot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MusteriNot_telefon_createdAt_idx" ON "MusteriNot"("telefon", "createdAt");
