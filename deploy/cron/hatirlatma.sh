#!/usr/bin/env bash
set -euo pipefail
# shellcheck source=/dev/null
source "$(dirname "$0")/_ortak.sh"
cron_calistir "hatirlatma" npm run ts -- scripts/cron-hatirlatma.ts
