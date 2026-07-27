#!/usr/bin/env bash
set -euo pipefail
# shellcheck source=/dev/null
source "$(dirname "$0")/_ortak.sh"
cron_calistir "sabah-ozet" npm run ts -- scripts/cron-sabah-ozet.ts
