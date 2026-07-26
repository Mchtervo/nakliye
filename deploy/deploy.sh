#!/usr/bin/env bash
# Yük Avcısı — manuel güncelleme
# Kullanım (yukavci): ~/muhasebbe/deploy/deploy.sh
set -euo pipefail

REPO="${YUKAVCI_REPO:-/home/yukavci/muhasebbe}"
cd "$REPO"

echo "==> $(date -Is) git pull"
git pull --ff-only origin main

echo "==> npm ci"
npm ci

echo "==> prisma generate + migrate"
npx prisma generate
npx prisma migrate deploy

echo "==> npm run build"
npm run build

echo "==> pm2 restart yukavci"
# PORT .env / ecosystem'dan gelir; process zaten kayıtlı
pm2 restart yukavci --update-env
pm2 save

echo "==> systemctl restart yukavci-telegram"
sudo /bin/systemctl restart yukavci-telegram

echo "==> doğrulama"
HATA=0

# pm2 describe tablosu: "status │ online" — arada çizgi karakteri var
PID="$(pm2 pid yukavci 2>/dev/null | head -1 | tr -d '[:space:]')"
if [[ "$PID" =~ ^[0-9]+$ ]] && [ "$PID" -gt 0 ]; then
  echo "pm2 yukavci: online (pid $PID)"
else
  echo "HATA: pm2 yukavci online değil (pid='${PID:-yok}')"
  HATA=1
fi

TG="$(systemctl is-active yukavci-telegram || true)"
echo "yukavci-telegram: $TG"
if [ "$TG" != "active" ]; then
  echo "HATA: yukavci-telegram active değil"
  HATA=1
fi

# Birkaç sn Next ayağa kalksın
sleep 2
HTTP="$(curl -sI -o /dev/null -w '%{http_code}' --max-time 10 http://127.0.0.1:3200/ || echo '000')"
echo "curl localhost:3200 -> HTTP $HTTP"
case "$HTTP" in
  200|301|302|303|307|308) ;;
  *)
    echo "HATA: beklenen 2xx/3xx, gelen $HTTP"
    HATA=1
    ;;
esac

pm2 status || true

if [ "$HATA" -ne 0 ]; then
  echo "==> DEPLOY DOĞRULAMA BAŞARISIZ"
  exit 1
fi

echo "==> DEPLOY OK $(date -Is)"
