-- Aday gruplara elle katılabilmek için kullanıcı adı ve üye sayısı saklanır.
ALTER TABLE "IlanKaynagi" ADD COLUMN IF NOT EXISTS "kullaniciAdi" TEXT;
ALTER TABLE "IlanKaynagi" ADD COLUMN IF NOT EXISTS "uyeSayisi" INTEGER;
