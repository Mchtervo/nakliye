#!/usr/bin/env bash
DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=/dev/null
source "$DIR/_ortak.sh"
# Kayıtlı tüm web siteleri (yuklegel + yeniler) — Ayarlar aktif/pasif
cron_calistir "web-siteler" npm run ts -- scripts/cron-web-siteler.ts
