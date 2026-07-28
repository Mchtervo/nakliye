#!/usr/bin/env bash
# Manuel deploy — auto-deploy ile aynı güvenli yol (yedek .next).
# Kullanım: bash ~/muhasebbe/deploy/deploy.sh
set -euo pipefail

REPO="${YUKAVCI_REPO:-/home/yukavci/muhasebbe}"
cd "$REPO"

bildir() {
  local metin="$1"
  ( cd "$REPO" && npm run ts -- scripts/cron-uyari.ts "$metin" ) || true
}

SHORT="$(git rev-parse --short HEAD)"
MSG="$(git log -1 --format=%s HEAD | tr '\n' ' ' | cut -c1-120)"

trap 'bildir "❌ Manuel deploy kesildi: $SHORT — $MSG"' ERR

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
  chmod +x deploy/deploy.sh deploy/cron/*.sh deploy/nginx-body-size.sh 2>/dev/null || true
  npm ci
  if [ -n "$NEXT_BAK" ] && [ -d "$NEXT_BAK" ]; then
    rm -rf .next
    mv "$NEXT_BAK" .next
  else
    npm run build
  fi
}

git reset --hard origin/main

# Reset sonrası executable bit'i yenile (git mode 100755 olmalı; yine de güvence)
chmod +x deploy/deploy.sh deploy/cron/*.sh deploy/nginx-body-size.sh 2>/dev/null || true

SHORT="$(git rev-parse --short HEAD)"
MSG="$(git log -1 --format=%s HEAD | tr '\n' ' ' | cut -c1-120)"

echo "==> npm ci"
if ! npm ci; then
  bildir "❌ Manuel deploy hatası (npm ci): $SHORT — $MSG"
  geri_al
  exit 1
fi

echo "==> prisma generate + migrate deploy"
if ! npx prisma generate; then
  bildir "❌ Manuel deploy hatası (prisma generate): $SHORT — $MSG"
  geri_al
  exit 1
fi
if ! npx prisma migrate deploy; then
  bildir "❌ Manuel deploy hatası (prisma migrate): $SHORT — $MSG"
  geri_al
  exit 1
fi

# Build sırasında app .next okumasın + yarım klasör kalmasın (ENOENT tmp)
echo "==> pm2 stop (build için)"
pm2 stop yukavci >/dev/null 2>&1 || true
# Portu tutan yetim next-server varsa öldür
fuser -k 3200/tcp >/dev/null 2>&1 || true
pkill -f "next-server" >/dev/null 2>&1 || true
sleep 1

echo "==> temiz .next + build"
rm -rf .next
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=2048}"
if ! npm run build; then
  echo "==> BUILD HATA — eski sürüme dönülüyor"
  bildir "❌ Manuel deploy hatası (build): $SHORT — $MSG"
  geri_al
  pm2 restart yukavci --update-env || true
  exit 1
fi

if [ -n "$NEXT_BAK" ] && [ -d "$NEXT_BAK" ]; then
  rm -rf "$NEXT_BAK"
fi

echo "==> pm2 start/restart yukavci"
pm2 restart yukavci --update-env || pm2 start yukavci --update-env
pm2 save

# Daemon yalnızca ilgili dosyalar değiştiyse restart (UI-only → atla).
daemon_etkilendi() {
  local eski="$1" yeni="$2"
  git diff --name-only "$eski" "$yeni" | grep -E \
    '^(scripts/telegram-daemon\.ts|scripts/ts-kayit\.mjs|scripts/ts-cozucu\.mjs|scripts/cron-katil\.ts|scripts/cron-grup-cik\.ts|lib/kaynaklar/(telegram|tdm|eleme|grupOkuma|filtre|kaydet)|lib/ayarlar\.ts|lib/prisma\.ts|lib/bildirim/|lib/ai/|package(-lock)?\.json|prisma/|deploy/yukavci-telegram\.service)' \
    >/dev/null
}

DAEMON_RESTART=0
if [ "$OLD_SHA" = "$(git rev-parse HEAD)" ]; then
  echo "==> SHA değişmedi — daemon restart (manuel yenileme)"
  DAEMON_RESTART=1
elif daemon_etkilendi "$OLD_SHA" "HEAD"; then
  echo "==> daemon kodu değişti → yukavci-telegram restart"
  DAEMON_RESTART=1
else
  echo "==> daemon kodu değişmedi → yukavci-telegram dokunulmadı"
fi

if [ "$DAEMON_RESTART" -eq 1 ]; then
  echo "==> systemctl restart yukavci-telegram"
  sudo /bin/systemctl restart yukavci-telegram
fi

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
  bildir "❌ Manuel deploy hatası (doğrulama): $SHORT — $MSG"
  geri_al
  pm2 restart yukavci --update-env || true
  sudo /bin/systemctl restart yukavci-telegram || true
  exit 1
fi

trap - ERR

# git reset --hard izinleri sıfırlayabilir — her deploy sonunda yenile
chmod +x deploy/deploy.sh deploy/cron/*.sh deploy/nginx-body-size.sh 2>/dev/null || true

echo "==> DEPLOY OK $(date -Is) $(git rev-parse --short HEAD) daemon_restart=$DAEMON_RESTART"
if [ "$DAEMON_RESTART" -eq 1 ]; then
  bildir "✅ Manuel deploy: $SHORT — $MSG"
else
  bildir "✅ Manuel deploy: $SHORT — $MSG (daemon restart yok)"
fi
