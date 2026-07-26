#!/usr/bin/env bash
# Ortak flock + log + hata bildirimi
# Kullanım: source _ortak.sh && cron_calistir "ad" npm run ts -- scripts/....ts

set -euo pipefail

REPO="${YUKAVCI_REPO:-/home/yukavci/muhasebbe}"
LOGDIR="${YUKAVCI_LOGDIR:-/home/yukavci/logs}"
LOCKDIR="${YUKAVCI_LOCKDIR:-/home/yukavci/locks}"

mkdir -p "$LOGDIR" "$LOCKDIR"

cron_calistir() {
  local ad="$1"
  shift
  local log="$LOGDIR/${ad}.log"
  local lock="$LOCKDIR/${ad}.lock"

  (
    flock -n 9 || {
      echo "$(date -Is) [$ad] zaten çalışıyor — atlandı" >>"$log"
      exit 0
    }
    echo "$(date -Is) [$ad] BAŞLA" >>"$log"
    if ( cd "$REPO" && "$@" ) >>"$log" 2>&1; then
      echo "$(date -Is) [$ad] BİTTİ" >>"$log"
      exit 0
    fi
    local kod=$?
    echo "$(date -Is) [$ad] HATA exit=$kod" >>"$log"
    ( cd "$REPO" && npm run ts -- scripts/cron-uyari.ts \
      "Cron HATA: ${ad} (exit ${kod}). Log: ${log}" ) >>"$log" 2>&1 || true
    exit "$kod"
  ) 9>"$lock"
}
