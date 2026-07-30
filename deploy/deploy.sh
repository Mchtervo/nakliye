#!/usr/bin/env bash
# Manuel deploy — auto-deploy ile AYNI flock kilidi (npm ci çakışmaz).
# Kullanım: bash ~/muhasebbe/deploy/deploy.sh
set -euo pipefail

REPO="${YUKAVCI_REPO:-/home/yukavci/muhasebbe}"
LOGDIR="${YUKAVCI_LOGDIR:-/home/yukavci/logs}"
LOCKDIR="${YUKAVCI_LOCKDIR:-/home/yukavci/locks}"
LOCK="$LOCKDIR/deploy.lock"

mkdir -p "$LOGDIR" "$LOCKDIR"
cd "$REPO"

# Takılı kilit: 2 saatten eskiyse temizle
eski_kilit_temizle() {
  local lock="$1"
  [ -e "$lock" ] || return 0
  if find "$lock" -mmin +120 2>/dev/null | grep -q .; then
    echo "==> UYARI: kilit >2s — siliniyor ($lock)"
    if command -v fuser >/dev/null 2>&1; then
      fuser -k "$lock" >/dev/null 2>&1 || true
    fi
    rm -f "$lock"
  fi
}

eski_kilit_temizle "$LOCKDIR/auto-deploy.lock"
eski_kilit_temizle "$LOCK"

# --- TEK flock: git / npm ci / prisma / build / restart tamamı ---
# Cron auto-deploy ile paylaşılan kilit; tutulamazsa çık
exec 9>"$LOCK"
if ! flock -n 9; then
  echo "$(date -Is) zaten deploy çalışıyor — çıkılıyor"
  echo "$(date -Is) zaten deploy çalışıyor — atlandı (manuel)" >>"$LOGDIR/auto-deploy.log"
  exit 1
fi

bildir() {
  local metin="$1"
  ( cd "$REPO" && npm run ts -- scripts/cron-uyari.ts "$metin" ) || true
}

# Telegram'a gidecek hata özeti (mümkün olduğunca tam)
hata_ozet() {
  local dosya="$1"
  if [ ! -f "$dosya" ]; then
    echo "(log yok)"
    return
  fi
  tail -n 80 "$dosya" | tail -c 3500
}

SHORT="$(git rev-parse --short HEAD)"
MSG="$(git log -1 --format=%s HEAD | tr '\n' ' ' | cut -c1-120)"

trap 'bildir "❌ Manuel deploy kesildi: $SHORT — $MSG"' ERR

echo "==> $(date -Is) manuel deploy (kilit: $LOCK)"

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

# Geri alma: SADECE git + .next. node_modules'a DOKUNMA
# (npm ci geri almada ENOTEMPTY / prisma: not found üretiyordu)
geri_al() {
  echo "==> GERİ AL $OLD_SHA (node_modules dokunulmuyor)"
  git reset --hard "$OLD_SHA"
  chmod +x deploy/deploy.sh deploy/cron/*.sh deploy/nginx-body-size.sh 2>/dev/null || true
  if [ -n "$NEXT_BAK" ] && [ -d "$NEXT_BAK" ]; then
    rm -rf .next
    mv "$NEXT_BAK" .next
    echo "==> .next yedeği geri yüklendi"
  else
    echo "==> .next yedeği yok — mevcut .next bırakıldı (yeniden build yok)"
  fi
}

# npm ci: fail → rm node_modules + cache clean → bir kez daha dene
npm_ci_guvenli() {
  local logf
  logf="$(mktemp /tmp/yukavci-npmci.XXXXXX)"
  echo "==> npm ci (1. deneme)"
  set +e
  npm ci >"$logf" 2>&1
  local kod=$?
  set -e
  cat "$logf"
  if [ "$kod" -eq 0 ]; then
    rm -f "$logf"
    return 0
  fi

  echo "==> npm ci HATA — node_modules sil + cache clean, 2. deneme"
  echo "==> hata özeti:"
  hata_ozet "$logf"
  rm -rf node_modules
  npm cache clean --force || true

  echo "==> npm ci (2. deneme)"
  set +e
  npm ci >"$logf" 2>&1
  kod=$?
  set -e
  cat "$logf"
  if [ "$kod" -eq 0 ]; then
    rm -f "$logf"
    return 0
  fi

  local oz
  oz="$(hata_ozet "$logf")"
  rm -f "$logf"
  bildir "❌ Manuel deploy npm ci 2x fail: $SHORT — $MSG

$oz"
  # Geri al: git + .next; node_modules dokunma
  geri_al
  return 1
}

git reset --hard origin/main

# Reset sonrası executable bit'i yenile
chmod +x deploy/deploy.sh deploy/cron/*.sh deploy/nginx-body-size.sh 2>/dev/null || true

SHORT="$(git rev-parse --short HEAD)"
MSG="$(git log -1 --format=%s HEAD | tr '\n' ' ' | cut -c1-120)"

if ! npm_ci_guvenli; then
  exit 1
fi

echo "==> prisma generate + migrate deploy"
PRISMA_LOG="$(mktemp /tmp/yukavci-prisma.XXXXXX)"
set +e
npx prisma generate >"$PRISMA_LOG" 2>&1
PG_KOD=$?
if [ "$PG_KOD" -eq 0 ]; then
  npx prisma migrate deploy >>"$PRISMA_LOG" 2>&1
  PG_KOD=$?
fi
set -e
cat "$PRISMA_LOG"
if [ "$PG_KOD" -ne 0 ]; then
  bildir "❌ Manuel deploy prisma: $SHORT — $MSG

$(hata_ozet "$PRISMA_LOG")"
  rm -f "$PRISMA_LOG"
  geri_al
  exit 1
fi
rm -f "$PRISMA_LOG"

# Build sırasında app .next okumasın + yarım klasör kalmasın (ENOENT tmp)
echo "==> pm2 stop (build için)"
pm2 stop yukavci >/dev/null 2>&1 || true
fuser -k 3200/tcp >/dev/null 2>&1 || true
pkill -f "next-server" >/dev/null 2>&1 || true
sleep 1

echo "==> temiz .next + build"
rm -rf .next
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=2048}"
BUILD_LOG="$(mktemp /tmp/yukavci-build.XXXXXX)"
set +e
npm run build >"$BUILD_LOG" 2>&1
BUILD_KOD=$?
set -e
cat "$BUILD_LOG"
if [ "$BUILD_KOD" -ne 0 ]; then
  echo "==> BUILD HATA — eski sürüme dönülüyor (node_modules dokunulmuyor)"
  bildir "❌ Manuel deploy build: $SHORT — $MSG

$(hata_ozet "$BUILD_LOG")"
  rm -f "$BUILD_LOG"
  geri_al
  pm2 restart yukavci --update-env || true
  exit 1
fi
rm -f "$BUILD_LOG"

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
PID="$(pm2 pid yukavci 2>/dev/null | head -1 | tr '\n' ' ' | awk '{print $1}' | tr -d '[:space:]')"
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
  bildir "❌ Manuel deploy doğrulama: $SHORT — $MSG (pm2/http/daemon)"
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
