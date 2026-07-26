#!/usr/bin/env bash
DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=/dev/null
source "$DIR/_ortak.sh"
cron_calistir "gunluk-rapor" npm run ts -- scripts/cron-gunluk-rapor.ts
