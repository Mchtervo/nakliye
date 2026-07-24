#!/bin/sh
set -e

mkdir -p /data/uploads

echo ">> Veritabanı migrasyonu..."
./node_modules/.bin/prisma migrate deploy

echo ">> Sunucu başlıyor..."
exec node server.js
