#!/usr/bin/env bash
# Manuel deploy — auto-deploy ile aynı güvenli yol (yedek .next).
# Kullanım: bash ~/muhasebbe/deploy/deploy.sh
set -euo pipefail

REPO="${YUKAVCI_REPO:-/home/yukavci/muhasebbe}"
cd "$REPO"

echo "==> $(date -Is) manuel deploy"

git fetch origin main
LOCAL="$(git rev-parse HEAD)"
REMOTE="$(git rev-parse origin/main)"
if [ "$LOCAL" = "$REMOTE" ]; then
  echo "Zaten origin/main ($(git rev-parse --short HEAD))"
else
  echo "Güncelleniyor: $(git rev-parse --short HEAD) → $(git rev-parse --short origin/main)"
fi

OLD_SHA="$LOCAL"
NEXT_BAK=""
if [ -d .next ]; then
  NEXT_BAK=".next.bak.manual"
  rm -rf "$NEXT_BAK"
  cp -a .next "$NEXT_BAK"
fi

geri_al() {
  echo "==> GERİ AL $OLD_SHA"
  git reset --hard "$OLD_SHA"
  npm ci
  if [ -n "$NEXT_BAK" ] && [ -d "$NEXT_BAK" ]; then
    rm -rf .next
    mv "$NEXT_BAK" .next
  else
    npm run build
  fi
}

git reset --hard origin/main

echo "==> npm ci"
npm ci

echo "==> prisma generate + migrate"
npx prisma generate
npx prisma migrate deploy

echo "==> npm run build"
if ! npm run build; then
  echo "==> BUILD HATA — eski sürüme dönülüyor"
  geri_al
  exit 1
fi

if [ -n "$NEXT_BAK" ] && [ -d "$NEXT_BAK" ]; then
  rm -rf "$NEXT_BAK"
fi

echo "==> pm2 restart yukavci"
pm2 restart yukavci --update-env
pm2 save

echo "==> systemctl restart yukavci-telegram"
sudo /bin/systemctl restart yukavci-telegram

echo "==> doğrulama"
HATA=0
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
  echo "==> DEPLOY DOĞRULAMA BAŞARISIZ — geri al"
  geri_al
  pm2 restart yukavci --update-env || true
  exit 1
fi

echo "==> DEPLOY OK $(date -Is) $(git rev-parse --short HEAD)"
