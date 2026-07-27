#!/usr/bin/env bash
source "$(dirname "$0")/_ortak.sh"
cron_calistir "uid-doldur" npm run ts -- scripts/cron-uid-doldur.ts
