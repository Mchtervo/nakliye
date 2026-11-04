#!/usr/bin/env bash
# Yük Avcısı — boş Ubuntu 24.04 sunucuya tek seferde kurulum (root ile).
# Eski sunucudaki düzenin aynısı: yukavci kullanıcısı, PM2 :3200, nginx + SSL (nip.io),
# Telegram/WhatsApp systemd servisleri, crontab, UFW, fail2ban.
#
# Kullanım (root):
#   1) .env'i /root/yukavci.env olarak koy (scp ile)
#   2) curl -fsSL https://raw.githubusercontent.com/Mchtervo/nakliye/main/deploy/kurulum-yeni-sunucu.sh -o kur.sh && bash kur.sh
# Tekrar çalıştırmak güvenli: yapılmış adımları atlar.
set -euo pipefail

KULLANICI=yukavci
EV=/home/$KULLANICI
REPO=$EV/muhasebbe
REPO_URL=https://github.com/Mchtervo/nakliye.git
PORT=3200
IP="$(curl -4 -fsS https://api.ipify.org || hostname -I | awk '{print $1}')"
ALAN="$IP.nip.io"

adim() { echo; echo "==================== $* ===================="; }
kullanici() { sudo -u "$KULLANICI" -H bash -lc "$*"; }

[ "$(id -u)" -eq 0 ] || { echo "root ile çalıştır"; exit 1; }

if [ ! -f /root/yukavci.env ] && [ ! -f "$REPO/.env" ]; then
  echo "HATA: /root/yukavci.env yok. Önce .env dosyasını sunucuya kopyala."
  exit 1
fi

adim "1/9 Saat dilimi + paketler"
timedatectl set-timezone Europe/Istanbul
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y -o Dpkg::Options::=--force-confold
apt-get install -y curl git nginx certbot python3-certbot-nginx ufw fail2ban psmisc dnsutils build-essential unattended-upgrades

adim "2/9 Node.js 24 + PM2"
if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 24 ]; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt-get install -y nodejs
fi
command -v pm2 >/dev/null || npm install -g pm2
node -v && pm2 -v

adim "3/9 Swap (build için 2 GB)"
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  sysctl -w vm.swappiness=10 && echo 'vm.swappiness=10' > /etc/sysctl.d/99-swappiness.conf
fi
swapon --show

adim "4/9 Kullanıcı + kod"
id "$KULLANICI" >/dev/null 2>&1 || adduser --disabled-password --gecos "Yuk Avcisi" "$KULLANICI"
mkdir -p "$EV/logs" "$EV/backups" "$EV/locks" "$EV/.wa-oturum"
chown -R "$KULLANICI:$KULLANICI" "$EV/logs" "$EV/backups" "$EV/locks" "$EV/.wa-oturum"
if [ ! -d "$REPO/.git" ]; then
  kullanici "git clone $REPO_URL $REPO"
else
  kullanici "cd $REPO && git fetch origin main && git reset --hard origin/main"
fi
if [ -f /root/yukavci.env ]; then
  mv /root/yukavci.env "$REPO/.env"
fi
# Site adresi bu sunucunun IP'si; otomatik deploy açık
sed -i "s#^SITE_URL=.*#SITE_URL=\"https://$ALAN\"#" "$REPO/.env"
grep -q '^AUTO_DEPLOY=' "$REPO/.env" || echo 'AUTO_DEPLOY=1' >> "$REPO/.env"
sed -i 's/\r$//' "$REPO/.env"
chown "$KULLANICI:$KULLANICI" "$REPO/.env" && chmod 600 "$REPO/.env"
chmod +x "$REPO"/deploy/*.sh "$REPO"/deploy/cron/*.sh

adim "5/9 Bağımlılıklar + veritabanı şeması + build (5-10 dk)"
kullanici "cd $REPO && npm ci && npx prisma generate && npx prisma migrate deploy"
kullanici "cd $REPO && rm -rf .next && NODE_OPTIONS=--max-old-space-size=2048 npm run build"

adim "6/9 Uygulama (PM2, port $PORT)"
kullanici "cd $REPO && (pm2 describe yukavci >/dev/null 2>&1 && pm2 restart yukavci --update-env) || PORT=$PORT pm2 start npm --name yukavci -- start"
kullanici "pm2 save"
env PATH="$PATH:/usr/bin" pm2 startup systemd -u "$KULLANICI" --hp "$EV" >/dev/null
systemctl enable "pm2-$KULLANICI" >/dev/null 2>&1 || true

adim "7/9 Telegram + WhatsApp servisleri, sudo kuralı, log döndürme, cron"
cp "$REPO/deploy/yukavci-telegram.service" "$REPO/deploy/yukavci-whatsapp.service" /etc/systemd/system/
cp "$REPO/deploy/sudoers-yukavci-telegram" /etc/sudoers.d/yukavci-telegram
chmod 440 /etc/sudoers.d/yukavci-telegram && visudo -cf /etc/sudoers.d/yukavci-telegram
cp "$REPO/deploy/yukavci-telegram.logrotate" /etc/logrotate.d/yukavci-telegram
cp "$REPO/deploy/yukavci-cron.logrotate" /etc/logrotate.d/yukavci-cron
systemctl daemon-reload
systemctl enable --now yukavci-telegram yukavci-whatsapp
crontab -u "$KULLANICI" "$REPO/deploy/crontab.yukavci"

adim "8/9 Nginx + SSL ($ALAN)"
cat > /etc/nginx/sites-available/yukavci <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $ALAN;
    client_max_body_size 15m;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/html;
        default_type "text/plain";
    }

    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
ln -sfn /etc/nginx/sites-available/yukavci /etc/nginx/sites-enabled/yukavci
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
if [ ! -d "/etc/letsencrypt/live/$ALAN" ]; then
  certbot --nginx -d "$ALAN" --non-interactive --agree-tos --register-unsafely-without-email --redirect
fi

adim "9/9 Güvenlik duvarı + fail2ban + otomatik güvenlik güncellemesi"
ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp && ufw --force enable
printf '[DEFAULT]\nbantime = 1h\nfindtime = 10m\nmaxretry = 5\n\n[sshd]\nenabled = true\n' > /etc/fail2ban/jail.local
systemctl enable --now fail2ban && systemctl restart fail2ban
echo 'APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";' > /etc/apt/apt.conf.d/20auto-upgrades

echo
echo "==================== KONTROL ===================="
sleep 5
echo "pm2:       $(kullanici 'pm2 jlist' | grep -o '"status":"[a-z]*"' | head -1)"
echo "telegram:  $(systemctl is-active yukavci-telegram)"
echo "whatsapp:  $(systemctl is-active yukavci-whatsapp)"
echo "http:      $(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:$PORT/)"
echo "https:     $(curl -s -o /dev/null -w '%{http_code}' https://$ALAN/)"
echo "cron:      $(crontab -u $KULLANICI -l | grep -c GUVENLI) iş"
echo
echo "BİTTİ → https://$ALAN"
echo "WhatsApp eşleme kodu Telegram'a gelecek (gelmezse: tail -50 $EV/logs/whatsapp-daemon.log)"
