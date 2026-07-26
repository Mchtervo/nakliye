#!/usr/bin/env bash
DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=/dev/null
source "$DIR/_ortak.sh"
cron_calistir "disk" npm run ts -- scripts/cron-disk.ts
