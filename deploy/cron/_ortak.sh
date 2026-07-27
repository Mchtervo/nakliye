#!/usr/bin/env bash
# Ortak flock + log + hata bildirimi
# Kullanım: source _ortak.sh && cron_calistir "ad" npm run ts -- scripts/....ts

set -euo pipefail

REPO="${YUKAVCI_REPO:-/home/yukavci/muhasebbe}"
LOGDIR="${YUKAVCI_LOGDIR:-/home/yukavci/logs}"
LOCKDIR="${YUKAVCI_LOCKDIR:-/home/yukavci/locks}"

mkdir -p "$LOGDIR" "$LOCKDIR"

# Takılı kilit: 2 saatten eskiyse sil (cron yarım kalmış olabilir)
eski_kilit_temizle() {
  local lock="$1"
  local log="$2"
  [ -e "$lock" ] || return 0
  if find "$lock" -mmin +120 2>/dev/null | grep -q .; then
    echo "$(date -Is) eski kilit silindi (>2s): $lock" >>"$log"
    if command -v fuser >/dev/null 2>&1; then
      fuser -k "$lock" >>"$log" 2>&1 || true
    fi
    rm -f "$lock"
  fi
}

cron_calistir() {
  local ad="$1"
  shift
  local log="$LOGDIR/${ad}.log"
  local lock="$LOCKDIR/${ad}.lock"
  local kod

  eski_kilit_temizle "$lock" "$log"

  (
    flock -n 9 || {
      echo "$(date -Is) [$ad] zaten çalışıyor — atlandı" >>"$log"
      exit 0
    }
    echo "$(date -Is) [$ad] BAŞLA" >>"$log"

    # set -e + `local kod=$?` tuzağı: local başarılı olunca $? 0 olur,
    # gerçek hata "exit 0" diye bildiriliyordu. Önce kodu yakala.
    set +e
    ( cd "$REPO" && "$@" ) >>"$log" 2>&1
    kod=$?
    set -e

    if [ "$kod" -eq 0 ]; then
      echo "$(date -Is) [$ad] BİTTİ" >>"$log"
      exit 0
    fi

    echo "$(date -Is) [$ad] HATA exit=$kod" >>"$log"
    ( cd "$REPO" && npm run ts -- scripts/cron-uyari.ts \
      "Cron HATA: ${ad} (exit ${kod}). Log: ${log}" ) >>"$log" 2>&1 || true
    exit "$kod"
  ) 9>"$lock"
}
