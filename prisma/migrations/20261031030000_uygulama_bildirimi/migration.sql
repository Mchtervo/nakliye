CREATE TABLE IF NOT EXISTS "UygulamaBildirimi" (
  "id" SERIAL NOT NULL,
  "baslik" TEXT NOT NULL,
  "metin" TEXT NOT NULL,
  "url" TEXT,
  "butonlar" JSONB,
  "okundu" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UygulamaBildirimi_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "UygulamaBildirimi_okundu_idx" ON "UygulamaBildirimi"("okundu");
CREATE INDEX IF NOT EXISTS "UygulamaBildirimi_createdAt_idx" ON "UygulamaBildirimi"("createdAt");
