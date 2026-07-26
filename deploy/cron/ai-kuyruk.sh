#!/usr/bin/env bash
DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=/dev/null
source "$DIR/_ortak.sh"
cron_calistir "ai-kuyruk" npm run ts -- scripts/cron-ai-kuyruk.ts
