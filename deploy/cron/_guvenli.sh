#!/usr/bin/env bash
# Cron giriş kapısı — +x kaybında sessiz ölüm olmasın.
# Kullanım (crontab):
#   * * * * * /bin/bash /home/yukavci/muhasebbe/deploy/cron/_guvenli.sh auto-deploy.sh
#
# 1) chmod +x dener
# 2) hâlâ çalıştırılamıyorsa / dosya yoksa Telegram uyarır
# 3) her zaman /bin/bash ile çalıştırır (+x olmasa da içerik koşar)

set -u

REPO="${YUKAVCI_REPO:-/home/yukavci/muhasebbe}"
LOGDIR="${YUKAVCI_LOGDIR:-/home/yukavci/logs}"
LOCKDIR="${YUKAVCI_LOCKDIR:-/home/yukavci/locks}"
mkdir -p "$LOGDIR" "$LOCKDIR"

AD="${1:-}"
if [ -z "$AD" ]; then
  echo "kullanım: _guvenli.sh <script.sh>" >&2
  exit 2
fi

SCRIPT="$REPO/deploy/cron/$AD"
LOG="$LOGDIR/cron-guvenli.log"
RATE="$LOCKDIR/izin-uyari.${AD//\//_}"

uyari() {
  local metin="$1"
  echo "$(date -Is) $metin" >>"$LOG"
  ( cd "$REPO" && npm run ts -- scripts/cron-uyari.ts "$metin" ) >>"$LOG" 2>&1 || true
}

uyari_rate() {
  local metin="$1"
  # Aynı uyarıyı saatte bir gönder (dakikalık cron spam olmasın)
  if [ -f "$RATE" ] && ! find "$RATE" -mmin +60 2>/dev/null | grep -q .; then
    echo "$(date -Is) (rate-limit) $metin" >>"$LOG"
    return 0
  fi
  touch "$RATE" 2>/dev/null || true
  uyari "$metin"
}

if [ ! -f "$SCRIPT" ]; then
  uyari "Cron: script yok — $AD ($SCRIPT)"
  exit 1
fi

if [ ! -r "$SCRIPT" ]; then
  uyari "Cron: script okunamıyor — $AD"
  exit 1
fi

chmod +x "$REPO"/deploy/deploy.sh "$REPO"/deploy/cron/*.sh 2>/dev/null || true

if [ ! -x "$SCRIPT" ]; then
  uyari_rate "Cron: +x kayıp — $AD. chmod denendi, hâlâ yok; bash ile zorlanıyor."
fi

# +x olmasa da çalıştır (sessiz Permission denied olmasın)
set +e
/bin/bash "$SCRIPT"
kod=$?
set -e

# Bash'in kendisi scripti açamadıysa (nadir)
if [ "$kod" -eq 126 ] || [ "$kod" -eq 127 ]; then
  uyari "Cron: çalıştırılamadı — $AD (exit $kod)"
fi

exit "$kod"
