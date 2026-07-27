#!/usr/bin/env bash
# Dakikada bir: origin/main değiştiyse güvenli deploy.
# flock — üst üste binmez. Build fail → eski commit + .next geri.
#
# Kurulum: crontab'a ekle (deploy/crontab.yukavci)
# Ayarlar → «Otomatik deploy» açık olmalı.

set -euo pipefail

REPO="${YUKAVCI_REPO:-/home/yukavci/muhasebbe}"
LOGDIR="${YUKAVCI_LOGDIR:-/home/yukavci/logs}"
LOCKDIR="${YUKAVCI_LOCKDIR:-/home/yukavci/locks}"
LOG="$LOGDIR/auto-deploy.log"
LOCK="$LOCKDIR/auto-deploy.lock"

mkdir -p "$LOGDIR" "$LOCKDIR"
cd "$REPO"

exec 9>"$LOCK"
if ! flock -n 9; then
  echo "$(date -Is) zaten çalışıyor — atlandı" >>"$LOG"
  exit 0
fi

log() { echo "$(date -Is) $*" >>"$LOG"; }

bildir() {
  local metin="$1"
  ( cd "$REPO" && npm run ts -- scripts/cron-uyari.ts "$metin" ) >>"$LOG" 2>&1 || true
}

# Ayarlar'dan kapalıysa çık — AUTO_DEPLOY=1 env varsa her zaman açık
set +e
( cd "$REPO" && npm run ts -- scripts/auto-deploy-acik-mi.ts ) >>"$LOG" 2>&1
ACIK=$?
set -e
if [ "$ACIK" -ne 0 ]; then
  # Sessiz — her dakika log şişmesin
  exit 0
fi

git fetch origin main --quiet 2>>"$LOG" || {
  log "git fetch HATA"
  exit 0
}

LOCAL="$(git rev-parse HEAD)"
REMOTE="$(git rev-parse origin/main)"

if [ "$LOCAL" = "$REMOTE" ]; then
  exit 0
fi

SHORT="$(git rev-parse --short origin/main)"
MSG="$(git log -1 --format=%s origin/main | tr '\n' ' ' | cut -c1-120)"
log "YENİ commit $SHORT — $MSG (eski=$(git rev-parse --short HEAD))"

# --- Güvenli deploy: önce yedek, başarısızsa geri ---
OLD_SHA="$LOCAL"
NEXT_BAK=""
if [ -d .next ]; then
  NEXT_BAK=".next.bak.$$"
  rm -rf "$NEXT_BAK"
  cp -a .next "$NEXT_BAK"
fi

geri_al() {
  log "GERİ AL → $OLD_SHA"
  git reset --hard "$OLD_SHA" >>"$LOG" 2>&1 || true
  set +e
  npm ci >>"$LOG" 2>&1
  if [ -n "$NEXT_BAK" ] && [ -d "$NEXT_BAK" ]; then
    rm -rf .next
    mv "$NEXT_BAK" .next
    log ".next yedeği geri yüklendi"
  else
    npm run build >>"$LOG" 2>&1
  fi
  set -e
}

set +e
git reset --hard origin/main >>"$LOG" 2>&1
npm ci >>"$LOG" 2>&1
CI_KOD=$?
if [ "$CI_KOD" -ne 0 ]; then
  log "npm ci HATA exit=$CI_KOD"
  geri_al
  bildir "❌ Deploy hatası (npm ci): $SHORT — $MSG"
  exit 1
fi

npx prisma generate >>"$LOG" 2>&1
npx prisma migrate deploy >>"$LOG" 2>&1
MIG_KOD=$?
if [ "$MIG_KOD" -ne 0 ]; then
  log "prisma HATA exit=$MIG_KOD"
  geri_al
  bildir "❌ Deploy hatası (prisma): $SHORT — $MSG"
  exit 1
fi

npm run build >>"$LOG" 2>&1
BUILD_KOD=$?
if [ "$BUILD_KOD" -ne 0 ]; then
  log "build HATA exit=$BUILD_KOD"
  geri_al
  bildir "❌ Deploy hatası (build): $SHORT — $MSG"
  exit 1
fi
set -e

# Build OK — yedeği sil, servisleri yenile
if [ -n "$NEXT_BAK" ] && [ -d "$NEXT_BAK" ]; then
  rm -rf "$NEXT_BAK"
fi

# Daemon yalnızca GramJS / kuyruk / prisma / bağımlılık değişince restart.
# UI-only push → catch-up döngüsü ve mesaj kaçırma riski olmasın.
daemon_etkilendi() {
  local eski="$1" yeni="$2"
  git diff --name-only "$eski" "$yeni" | grep -E \
    '^(scripts/telegram-daemon\.ts|scripts/ts-kayit\.mjs|scripts/ts-cozucu\.mjs|scripts/cron-katil\.ts|scripts/cron-grup-cik\.ts|lib/kaynaklar/(telegram|tdm|eleme|grupOkuma|filtre|kaydet)|lib/ayarlar\.ts|lib/prisma\.ts|lib/bildirim/|lib/ai/|package(-lock)?\.json|prisma/|deploy/yukavci-telegram\.service)' \
    >/dev/null
}

DAEMON_RESTART=0
if daemon_etkilendi "$OLD_SHA" "HEAD"; then
  DAEMON_RESTART=1
  log "daemon kodu değişti → yukavci-telegram restart"
else
  log "daemon kodu değişmedi → yukavci-telegram dokunulmadı (catch-up atlandı)"
fi

set +e
pm2 restart yukavci --update-env >>"$LOG" 2>&1
pm2 save >>"$LOG" 2>&1
if [ "$DAEMON_RESTART" -eq 1 ]; then
  sudo /bin/systemctl restart yukavci-telegram >>"$LOG" 2>&1
fi

sleep 3
HATA=0
PID="$(pm2 pid yukavci 2>/dev/null | head -1 | tr -d '[:space:]')"
if ! [[ "$PID" =~ ^[0-9]+$ ]] || [ "$PID" -le 0 ]; then
  log "pm2 online değil"
  HATA=1
fi
TG="$(systemctl is-active yukavci-telegram 2>/dev/null || true)"
if [ "$TG" != "active" ]; then
  log "telegram daemon active değil ($TG)"
  HATA=1
fi
HTTP="$(curl -sI -o /dev/null -w '%{http_code}' --max-time 10 http://127.0.0.1:3200/ || echo '000')"
case "$HTTP" in
  200|301|302|303|307|308) ;;
  *)
    log "HTTP $HTTP"
    HATA=1
    ;;
esac
set -e

if [ "$HATA" -ne 0 ]; then
  log "doğrulama başarısız — geri alınıyor"
  geri_al
  set +e
  pm2 restart yukavci --update-env >>"$LOG" 2>&1
  # Geri alınca daemon da eski koda dönsün
  sudo /bin/systemctl restart yukavci-telegram >>"$LOG" 2>&1
  set -e
  bildir "❌ Deploy hatası (doğrulama): $SHORT — $MSG (eski sürüme dönüldü)"
  exit 1
fi

if [ "$DAEMON_RESTART" -eq 1 ]; then
  log "DEPLOY OK $SHORT (daemon restart)"
  bildir "✅ Deploy: $SHORT — $MSG"
else
  log "DEPLOY OK $SHORT (daemon aynı)"
  bildir "✅ Deploy: $SHORT — $MSG (daemon restart yok)"
fi
exit 0
