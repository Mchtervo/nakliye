# .env ve Telegram session — VPS dışı yedek

Supabase zaten yönetilen. Asıl kritik: VPS’teki `.env` (bot token, session, OpenAI, DB URL).

## Şifreli arşiv (VPS’te, sonra kendi PC’ne indir)

```bash
sudo -iu yukavci
cd ~
# Tarihli şifreli tar (şifreyi sorar — güçlü bir parola seç)
tar -czf - -C ~/muhasebbe .env | openssl enc -aes-256-cbc -pbkdf2 -salt \
  -out ~/backups/env-$(date +%F).tar.gz.enc

# İndir (kendi PC’nden):
# scp yukavci@72.61.101.239:~/backups/env-YYYY-MM-DD.tar.gz.enc .
```

Açmak (PC’de):

```bash
openssl enc -aes-256-cbc -pbkdf2 -d -in env-YYYY-MM-DD.tar.gz.enc | tar -tz
```

**Saklama:** şifreli dosyayı VPS’te bırakma (veya bırakıp ek olarak OneDrive/USB’ye kopyala).  
**Asla** düz `.env`’i git’e veya Telegram’a yapıştırma.

`TELEGRAM_SESSION` `.env` içinde; ayrı session dosyası yok (GramJS StringSession).
