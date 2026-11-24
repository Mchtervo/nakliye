#!/usr/bin/env bash
set -euo pipefail
# shellcheck source=/dev/null
source "$(dirname "$0")/_ortak.sh"
cron_calistir "nobetci" npm run ts -- scripts/cron-nobetci.ts
