ALTER TABLE "YukIlani" ADD COLUMN "sonGorulme" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "YukIlani_telefon_cikisIl_varisIl_sonGorulme_idx"
  ON "YukIlani"("telefon", "cikisIl", "varisIl", "sonGorulme");
