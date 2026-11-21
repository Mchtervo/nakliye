#!/usr/bin/env bash
DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=/dev/null
source "$DIR/_ortak.sh"
# Facebook grupları (görünmez tarayıcı, yedek hesap) — lib/kaynaklar/facebook.ts
cron_calistir "facebook" npm run ts -- scripts/cron-facebook.ts
