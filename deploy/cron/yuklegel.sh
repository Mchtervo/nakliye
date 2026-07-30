#!/usr/bin/env bash
DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=/dev/null
source "$DIR/_ortak.sh"
cron_calistir "yuklegel" npm run ts -- scripts/cron-yuklegel.ts
