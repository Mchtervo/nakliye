#!/usr/bin/env bash
# Nginx varsayılan 1m — telefon fiş fotoğrafını keser / sekme düşer.
# Root: sudo bash /home/yukavci/muhasebbe/deploy/nginx-body-size.sh
set -euo pipefail

CONF=/etc/nginx/sites-available/yukavci
[[ -f "$CONF" ]] || { echo "Yok: $CONF"; exit 1; }

if grep -q 'client_max_body_size' "$CONF"; then
  echo "Zaten ayarlı:"
  grep -n 'client_max_body_size' "$CONF"
  exit 0
fi

cp -a "$CONF" "${CONF}.bak-body-$(date +%F-%H%M%S)"

# Her "location / {" önüne limit ekle (http + https server blokları)
sed -i 's|location / {|client_max_body_size 15m;\n    location / {|g' "$CONF"

# Uzun AI test / OCR için okuma zaman aşımı
if ! grep -q 'proxy_read_timeout' "$CONF"; then
  sed -i 's|proxy_read_timeout 120s;|proxy_read_timeout 300s;|g' "$CONF" || true
  # Yoksa location içine ekle
  if ! grep -q 'proxy_read_timeout' "$CONF"; then
    sed -i 's|proxy_http_version 1.1;|proxy_http_version 1.1;\n        proxy_read_timeout 300s;\n        proxy_send_timeout 300s;|g' "$CONF"
  fi
fi

nginx -t
systemctl reload nginx
echo "OK — client_max_body_size 15m (+ timeout gerekirse 300s)"