-- Kişi başına günlük paylaşım sayacı (ilanlar silinse de kalır)
CREATE TABLE IF NOT EXISTS "PaylasimGun" (
    "telefon" TEXT NOT NULL,
    "gun" TEXT NOT NULL,
    "cikisIl" TEXT NOT NULL DEFAULT '',
    "varisIl" TEXT NOT NULL DEFAULT '',
    "adet" INTEGER NOT NULL DEFAULT 0,
    "firmaAdi" TEXT,
    CONSTRAINT "PaylasimGun_pkey" PRIMARY KEY ("telefon", "gun", "cikisIl", "varisIl")
);
CREATE INDEX IF NOT EXISTS "PaylasimGun_gun_idx" ON "PaylasimGun"("gun");
