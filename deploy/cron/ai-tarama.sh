#!/usr/bin/env bash
DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=/dev/null
source "$DIR/_ortak.sh"
# AI_ARAMA kaynakları (Facebook grupları / Google) — her koşuda en eski 2 kaynak
cron_calistir "ai-tarama" npm run ts -- scripts/cron-ai-tarama.ts 2
