# Otomatik deploy (VPS)

GitHub `main` push → VPS dakikada bir `git fetch`; fark varsa güvenli build + restart.

## Özellikler
- flock (üst üste binmez)
- Build/prisma/ci fail → eski commit + `.next` yedeği geri
- Telegram: `✅ Deploy: …` / `❌ Deploy hatası: …`
- Ayarlar → «Otomatik deploy (VPS)» aç/kapa (`auto_deploy=1`)

## Kurulum (yukavci kullanıcısı)

```bash
cd ~/muhasebbe
git fetch origin main && git reset --hard origin/main

chmod +x deploy/cron/auto-deploy.sh deploy/deploy.sh deploy/cron/*.sh

# Crontab'ı yükle (dakikalık satır dahil)
crontab deploy/crontab.yukavci
crontab -l | grep auto-deploy

# Ayarlar'dan aç VEYA DB:
npm run ts -- -e "..."   # veya panelden checkbox
```

Panel: **Ayarlar → Otomatik deploy (VPS)** işaretle → Kaydet.

Manuel test (açıkken):
```bash
# Sahte fark yoksa sessiz çıkar; log:
tail -f ~/logs/auto-deploy.log

# Elle tetikle (origin farklıysa):
bash deploy/cron/auto-deploy.sh
```

## Notlar
- İlk kurulumda varsayılan **kapalı** — yanlışlıkla yarım deploy olmasın.
- `git fetch` için VPS'te GitHub erişimi (deploy key / HTTPS token) zaten olmalı.
- Deploy ~2–5 dk sürebilir; flock varken ikinci dakika atlanır.
