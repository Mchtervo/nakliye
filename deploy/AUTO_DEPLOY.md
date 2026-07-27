# Otomatik deploy (VPS)

GitHub `main` push → VPS dakikada bir `git fetch`; fark varsa güvenli build + restart.

## Özellikler
- flock (üst üste binmez)
- `prisma migrate deploy` her deploy'da (manuel + otomatik)
- Build/prisma/ci fail → eski commit + `.next` yedeği geri
- Telegram: her deploy sonucu `✅` / `❌` (manuel dahil)
- Açık tutma:
  1. **`.env` → `AUTO_DEPLOY=1`** (önerilen kilit — panel/DB kapatsa bile çalışır)
  2. Ayarlar → «Otomatik deploy (VPS)» (`auto_deploy=1`)

## Kurulum (yukavci kullanıcısı)

```bash
cd ~/muhasebbe
git fetch origin main && git reset --hard origin/main

# .env içine kilidi ekle (bir kez):
# AUTO_DEPLOY=1

chmod +x deploy/cron/auto-deploy.sh deploy/deploy.sh deploy/cron/*.sh

crontab deploy/crontab.yukavci
crontab -l | grep auto-deploy
```

Panel: env açıkken checkbox kilitli görünür («panelden kapanmaz»).

Manuel test:
```bash
tail -f ~/logs/auto-deploy.log
bash deploy/cron/auto-deploy.sh
# veya
bash deploy/deploy.sh
```

## Notlar
- `AUTO_DEPLOY=1` yoksa varsayılan panel/DB'ye bakar (eski davranış).
- `git fetch` için VPS'te GitHub erişimi (deploy key / HTTPS token) gerekir.
- Deploy ~2–5 dk; flock varken ikinci dakika atlanır.
