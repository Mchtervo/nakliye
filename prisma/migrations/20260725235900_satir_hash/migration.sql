-- Rota satırı tekrarı: aynı satır AI'ya bir kez gider.
CREATE TABLE IF NOT EXISTS "SatirHash" (
    "hash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SatirHash_pkey" PRIMARY KEY ("hash")
);

CREATE INDEX IF NOT EXISTS "SatirHash_createdAt_idx" ON "SatirHash"("createdAt");
