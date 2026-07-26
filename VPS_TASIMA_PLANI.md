# VPS'E TAM TAŞIMA PLANI

**Sunucu:** Hostinger KVM 2 · IP `72.61.101.239` · Ubuntu 24.04.4 LTS
**Alan adı:** `72.61.101.239.nip.io` (nip.io → otomatik A kaydı, DNS paneli yok)
**Taşınacak:** Next.js (Yük Avcısı) + Telethon okuyucu + cron işleri
**Taşınmayacak:** Supabase (yönetilen kalsın)

---

## MEVCUT SUNUCU ENVANTERİ (DOKUNULMAYACAK)

Bu VPS'te zaten çalışan servisler var. Taşıma bunları bozmamalı.

| Bileşen | Detay |
|---------|--------|
| Nginx site | **SADECE** `redmedya` → `redmediadugun.cloud` (80 + 443) |
| Proxy | `127.0.0.1:3000` (frontend), `127.0.0.1:8000` (/api, /docs, webhook) |
| SSL | `/etc/letsencrypt/live/redmediadugun.cloud` — **dokunma** |
| Docker | n8n (`127.0.0.1:5678`), redmedya-assistant, traefik (dış port yok) |
| Dolu portlar | **80, 443, 3000, 8000, 5432, 5678** |
| Disk | 96G · ~%10 kullanılmış |

### Bu plana özel kurallar
1. Next.js **PORT=3200** (3000 dolu). PM2'de `PORT=3200`.
2. Nginx: `redmedya` dosyasına **dokunma**. Yeni site: `/etc/nginx/sites-available/yukavci` → `127.0.0.1:3200`.
3. Certbot: **sadece** `-d 72.61.101.239.nip.io`. `redmediadugun.cloud` sertifikasına dokunma.
4. Her nginx değişikliğinde: `nginx -t` → temizse `systemctl reload nginx` (**restart değil**). Test hata verirse **asla reload etme**.
5. Değişiklikten önce: `cp -r /etc/nginx/sites-available /root/nginx-yedek-$(date +%F)`

---

## NEDEN TAŞIYORUZ
- Netlify build dakikası/kredisi bitti
- 30 saniyelik fonksiyon sınırı yüzünden kuyruk-parti cambazlığı yapıyoruz
- 5 dakikada bir polling yerine **sürekli bağlı** Telethon istiyorum
- Tek yerde toplansın

---

## HEDEF MİMARİ

```
VPS (72.61.101.239) — paylaşımlı sunucu
├── Nginx (80/443)
│    ├── redmedya          → redmediadugun.cloud → :3000 / :8000  [MEVCUT — DOKUNMA]
│    └── yukavci (YENİ)    → 72.61.101.239.nip.io → :3200
├── Next.js Yük Avcısı (PM2, PORT=3200)
├── Telethon daemon (systemd) — olay tabanlı
├── Docker / redmedya / n8n / :5432  [MEVCUT — DOKUNMA]
└── crontab (yukavci kullanıcısı)
     ├── AI kuyruk işçisi
     ├── Grup keşfi / katılım
     ├── Günlük rapor
     └── Yedekleme

Supabase (bulutta) — veritabanı
```

---

## AŞAMA 1 — SUNUCU HAZIRLIĞI

1. Sistem güncellemesi
2. Node.js 22 LTS
3. Python 3 + pip + venv
4. Nginx (zaten var — yeniden kurulum zarar vermez / skip edilebilir)
5. PM2 (global)
6. Git
7. Certbot + python3-certbot-nginx
8. **2 GB swap dosyası** (`/swapfile`, swappiness=10) — `npm run build` için

Doğrulama: `node -v`, `pm2 -v`, `swapon --show`, `nginx -t`

---

## AŞAMA 2 — GÜVENLİK

**Amaç:** `yukavci` kullanıcısı, SSH anahtarı, UFW, fail2ban, otomatik güncelleme.
**Dikkat:** Mevcut redmedya / Docker çalışmaya devam etmeli. UFW'de 80/443/SSH açık kalmalı.
**SSH port değiştirme:** Bu paylaşımlı sunucuda **önermiyorum** (Hostinger paneli + mevcut alışkanlık 22). İstersen en sonda, anahtar doğrulandıktan sonra.

### 2.0 — Alan adı (DNS paneli YOK)

`72.61.101.239.nip.io` nip.io üzerinden otomatik bu IP'ye çözülür. Panelde A kaydı açmana gerek yok.

Kurulumdan önce hızlı kontrol (sunucu veya PC):

```bash
dig +short 72.61.101.239.nip.io A
# Beklenen: 72.61.101.239
```

Windows: `nslookup 72.61.101.239.nip.io`

---

### 2.1 — Nginx yedeği (her şeyden önce)

```bash
cp -r /etc/nginx/sites-available /root/nginx-yedek-$(date +%F)
ls -la /root/nginx-yedek-*
# Mevcut site listesi — redmedya görünmeli
ls -la /etc/nginx/sites-enabled/
```

---

### 2.2 — `yukavci` kullanıcısı + sudo

```bash
# Kullanıcı yoksa oluştur
id yukavci 2>/dev/null || adduser --disabled-password --gecos "Yuk Avcisi" yukavci
usermod -aG sudo yukavci

# Parolasız sudo (deploy scriptleri için) — isteğe bağlı; yoksa sudo şifresi sorar
echo 'yukavci ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/yukavci
chmod 440 /etc/sudoers.d/yukavci
visudo -cf /etc/sudoers.d/yukavci
```

---

### 2.3 — SSH anahtarı (kendi PC'nde + sunucuya)

**Windows PowerShell (kendi bilgisayarında):**

```powershell
# Anahtar yoksa üret (Enter Enter = boş passphrase veya kendi passphrase'in)
if (-not (Test-Path "$env:USERPROFILE\.ssh\id_ed25519.pub")) {
  ssh-keygen -t ed25519 -C "yukavci-vps" -f "$env:USERPROFILE\.ssh\id_ed25519"
}
Get-Content "$env:USERPROFILE\.ssh\id_ed25519.pub"
```

Pub key satırını kopyala. **Sunucuda (root iken):**

```bash
# yukavci için authorized_keys
mkdir -p /home/yukavci/.ssh
chmod 700 /home/yukavci/.ssh
# Aşağıdaki tırnak içine KENDİ pub key'ini yapıştır:
echo 'BURAYA_PUB_KEY_YAPISTIR' >> /home/yukavci/.ssh/authorized_keys
chmod 600 /home/yukavci/.ssh/authorized_keys
chown -R yukavci:yukavci /home/yukavci/.ssh
```

**Yeni bir PowerShell penceresinde test et (mevcut root oturumunu KAPATMA):**

```powershell
ssh yukavci@72.61.101.239
```

Anahtarla girdikten sonra:

```bash
whoami   # yukavci olmalı
sudo -n true && echo "sudo OK"
exit
```

---

### 2.4 — SSH: parola girişini kapat (SADECE anahtar çalıştıktan sonra)

⚠️ **Tehlikeli:** Anahtar çalışmadan yaparsan sunucuya giremezsin. Hostinger VNC/console ile kurtarman gerekir.

```bash
# Yedek
cp /etc/ssh/sshd_config /root/sshd_config.yedek-$(date +%F)

# Anahtar zorunlu, parola kapalı (root SSH da kapansın — yukavci kullan)
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/^#\?KbdInteractiveAuthentication.*/KbdInteractiveAuthentication no/' /etc/ssh/sshd_config
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/^#\?PubkeyAuthentication.*/PubkeyAuthentication yes/' /etc/ssh/sshd_config

# Syntax kontrol
sshd -t && systemctl reload ssh
```

Doğrulama: yeni pencereden `ssh yukavci@72.61.101.239` — girmelisin.  
`ssh root@...` — reddedilmeli.

---

### 2.5 — UFW firewall

⚠️ Docker / mevcut servisler `127.0.0.1` dinliyor; UFW onları bozmaz. Sadece dış kapıları kısıtlarız.

```bash
apt install -y ufw

# Varsayılanlar
ufw default deny incoming
ufw default allow outgoing

# SSH önce! (kendini kilitleme)
ufw allow OpenSSH
# veya: ufw allow 22/tcp

ufw allow 80/tcp
ufw allow 443/tcp

# Etkinleştir — "y" de
ufw --force enable
ufw status verbose
```

Beklenen: 22, 80, 443 ALLOW. redmediadugun.cloud HTTPS hâlâ açılmalı.

---

### 2.6 — fail2ban

```bash
apt install -y fail2ban
systemctl enable fail2ban
systemctl start fail2ban

cat > /etc/fail2ban/jail.local <<'EOF'
[DEFAULT]
bantime  = 1h
findtime = 10m
maxretry = 5

[sshd]
enabled = true
EOF

systemctl restart fail2ban
fail2ban-client status sshd
```

---

### 2.7 — Otomatik güvenlik güncellemeleri

```bash
apt install -y unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades
# "Yes" seç

systemctl status unattended-upgrades --no-pager
```

---

### 2.8 — Uygulama dizinleri + izin notları (dosyalar AŞAMA 4'te gelecek)

```bash
mkdir -p /home/yukavci/logs /home/yukavci/backups
chown -R yukavci:yukavci /home/yukavci/logs /home/yukavci/backups

# AŞAMA 4'te .env için hatırlatma (repo: /home/yukavci/muhasebbe):
# chmod 600 /home/yukavci/muhasebbe/.env
```

---

### 2.9 — AŞAMA 2 doğrulama

```bash
echo "USER: $(id yukavci)"
echo "SSH config PasswordAuthentication: $(grep -E '^PasswordAuthentication' /etc/ssh/sshd_config)"
echo "SSH PermitRootLogin: $(grep -E '^PermitRootLogin' /etc/ssh/sshd_config)"
ufw status | head -20
fail2ban-client status sshd | head -10
ls /root/nginx-yedek-*
dig +short 72.61.101.239.nip.io A || true
```

**DUR.** Çıktıyı gönder, onay al → AŞAMA 3.

---

## AŞAMA 3 — ALAN ADI + NGINX + SSL

**Alan adı:** `72.61.101.239.nip.io` — DNS paneli yok; nip.io otomatik çözer.

**Önkoşul (30 sn):**

```bash
dig +short 72.61.101.239.nip.io A
# Beklenen: 72.61.101.239
```

**Dokunulmayacak:** `/etc/nginx/sites-available/redmedya`, `redmediadugun.cloud` sertifikası.

### 3.1 — Yedek + çözünürlük kontrolü

```bash
cp -r /etc/nginx/sites-available /root/nginx-yedek-$(date +%F)-asama3
dig +short 72.61.101.239.nip.io A
```

---

### 3.2 — Yeni Nginx site (HTTP, henüz SSL yok)

```bash
cat > /etc/nginx/sites-available/yukavci <<'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name 72.61.101.239.nip.io;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/html;
        default_type "text/plain";
    }

    location / {
        proxy_pass http://127.0.0.1:3200;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }
}
EOF

ln -sfn /etc/nginx/sites-available/yukavci /etc/nginx/sites-enabled/yukavci

# Test → sadece OK ise reload
nginx -t && systemctl reload nginx
```

⚠️ `nginx -t` hata verirse **reload etme**.

```bash
curl -sI -H "Host: 72.61.101.239.nip.io" http://127.0.0.1/ | head -10
# Upstream 502 normal (uygulama henüz yok)
# redmediadugun.cloud tarayıcıdan hâlâ açılmalı
```

---

### 3.3 — Certbot (SADECE nip.io alan adı)

```bash
certbot --nginx -d 72.61.101.239.nip.io \
  --non-interactive --agree-tos \
  -m SENIN_EMAIL@adresin.com \
  --redirect
```

`-m` adresini kendi e-postanla değiştir.

Sonra:

```bash
nginx -t && systemctl reload nginx
```

Doğrulama:

```bash
ls /etc/letsencrypt/live/
# Beklenen: redmediadugun.cloud  VE  72.61.101.239.nip.io
# (letsencrypt dizin adı noktalı IP olabilir)

curl -sI https://72.61.101.239.nip.io | head -15
# Uygulama yoksa 502; TLS çalışması yeterli

curl -sI https://redmediadugun.cloud | head -10
```

**Certbot nip.io'yu reddederse** (nadir): çıktıyı gönder; geçici HTTP veya `sslip.io` alternatifi bakarız. `redmediadugun` sertifikasına asla dokunma.

---

### 3.4 — Otomatik yenileme testi

```bash
certbot renew --dry-run
```

---

### 3.5 — AŞAMA 3 doğrulama özeti

```bash
echo "=== sites-enabled ==="
ls -la /etc/nginx/sites-enabled/
echo "=== certs ==="
ls /etc/letsencrypt/live/
echo "=== yukavci ==="
grep -E 'server_name|proxy_pass|listen|ssl_certificate' /etc/nginx/sites-available/yukavci
echo "=== redmedya aynı mı? ==="
diff -q /etc/nginx/sites-available/redmedya /root/nginx-yedek-$(date +%F)-asama3/redmedya
```

**DUR.** Çıktıyı gönder → AŞAMA 4 (PORT=3200, PM2).

---

## AŞAMA 4 — UYGULAMAYI TAŞI (önizleme — henüz çalıştırma)

1. `yukavci` ile repo klonla → `/home/yukavci/muhasebbe`
2. `.env` — `chmod 600`; Netlify değişkenleri + `AI_KAPALI=true`
   - Site URL: `https://72.61.101.239.nip.io` (varsa `SITE_URL` / benzeri)
3. `npm ci && npm run build`
4. `npx prisma generate` + `npx prisma migrate deploy`
5. PM2: **`PORT=3200`** — örn. `PORT=3200 pm2 start npm --name yukavci -- start`
6. `pm2 startup` + `pm2 save` (`yukavci` kullanıcısı)
7. Nginx zaten `:3200`

**Netlify'a özgü:** `netlify.toml`, `netlify/functions/` → cron/daemon'a taşınacak.

---

## AŞAMA 5 — TELEGRAM DAEMON (GramJS)

**Karar: Node + GramJS** (Telethon değil).
- Mevcut `TELEGRAM_SESSION` StringSession formatı GramJS; Telethon ayrı `.session` ister.
- `mesajlariKuyrugaAl` / `onFiltre` TypeScript — yeniden yazılmaz.
- Olay: `NewMessage` (`scripts/telegram-daemon.ts`), polling yok.
- systemd: `deploy/yukavci-telegram.service` · logrotate: `deploy/yukavci-telegram.logrotate`
- Sağlık: 30 dk aktivite yoksa bot ile `telegram_chat_id`'ye uyarı
- OpenAI yok; sadece HamMesaj kuyruğu (`AI_KAPALI=true`)

Oturum: `cd ~/muhasebbe && npm run telegram:oturum` → `.env` içine `TELEGRAM_SESSION=...`

## AŞAMA 6 — CRON İŞLERİ

**Saat:** `timedatectl set-timezone Europe/Istanbul` + crontab `CRON_TZ=Europe/Istanbul`

| İş | Saat | Script |
|----|------|--------|
| AI kuyruk | `*/5` | `deploy/cron/ai-kuyruk.sh` → `scripts/cron-ai-kuyruk.ts` |
| Grup keşfi | `08:00` | `deploy/cron/grup-kesif.sh` |
| Grup katılım | `*/45` (max 4/gün, ≥45 dk) | `deploy/cron/grup-katil.sh` |
| Günlük rapor | `20:00` | `deploy/cron/gunluk-rapor.sh` (OpenAI yok) |
| Yedek | `03:15` | `deploy/cron/yedek.sh` → `~/backups` 7 gün |

Her iş: ayrı log (`~/logs/<ad>.log`), `flock`, hata → `cron-uyari.ts` (Telegram bot).
Kurulum: `crontab -u yukavci /home/yukavci/muhasebbe/deploy/crontab.yukavci`
Netlify scheduled functions VPS'te çalışmaz; kodda kalabilir.

## AŞAMA 7 — GÜNCELLEME AKIŞI

`deploy/deploy.sh` (kullanıcı `yukavci`):
1. `git pull --ff-only`
2. `npm ci` → prisma generate/migrate → `npm run build`
3. `pm2 restart yukavci --update-env`
4. `sudo systemctl restart yukavci-telegram` (sudoers dar kural)
5. Doğrulama: pm2 online · systemd active · `curl -sI localhost:3200` → 2xx/3xx; değilse exit 1

Sudoers: `deploy/sudoers-yukavci-telegram` → `/etc/sudoers.d/yukavci-telegram`  
Kesinti: build sırasında eski process ayakta; restart ~2–10 sn (Next + daemon).

## AŞAMA 8 — YEDEKLEME VE İZLEME

| Ne | Nasıl |
|----|--------|
| DB JSON yedek | `cron-yedek` 03:15 → `~/backups/yukavci-*.json` (7 gün) — AŞAMA 6’da kuruldu |
| Disk %80+ | `deploy/cron/disk.sh` saatte 1 → Telegram |
| Servis durumu | günlük raporda pm2 + `yukavci-telegram` + disk |
| `.env` offsite | `deploy/yedek-env.md` — openssl şifreli tar, VPS dışına `scp` |

## AŞAMA 9 — GEÇİŞ VE GERİ DÖNÜŞ

**Canlı adres:** `https://72.61.101.239.nip.io`  
**Eski:** `https://musical-seahorse-b58027.netlify.app`

### Sıra
1. VPS doğrulandı (site + daemon + cron) ✅
2. Netlify scheduled functions’ı durdur (aşağıda)
3. Netlify sitesini **1 hafta silme** — geri dönüş için dursun; istersen “Disable project”
4. İleride kendi domain: DNS A → VPS + `certbot --nginx -d ...` (redmedya’ya dokunma)

### Netlify cron’u nasıl kapatılır
- Kod: `netlify/functions/*` içindeki `schedule` kaldırıldı → bir kez Netlify’a deploy et **veya**
- UI: Project → **Disable project** (build/function tüketimini de keser)
- Env: Netlify’da `AI_KAPALI=true` kalsın (yanlışlıkla tetiklenirse OpenAI yanmasın)

### Sorular

**İkisi bir süre birlikte çalışırsa çift kayıt olur mu?**  
Evet risk var. `dedupHash` aynı rota+telefon için ikinci kaydı engeller; ama HamMesaj kuyruğu / eleme sayaçları / Telegram bildirimleri çiftlenebilir. **Netlify cron’u kapatmadan ikisini birlikte bırakma.**

**VPS bozulursa Netlify’ı tekrar açabilir miyim?**  
Evet. Enable project (veya son deploy duruyorsa) + Netlify env’de `SITE_URL` eski Netlify URL + gerekirse function `schedule`’ları geri ekle + deploy. Süre: genelde **15–60 dk** (env kontrol + redeploy + webhook). Daemon/VPS oturumu Netlify’da yoktu; Netlify yine 5 dk polling’e döner.

**`TELEGRAM_SESSION` VPS’e geçince Netlify ne olur?**  
Aynı StringSession iki yerde aynı anda kullanılırsa Telegram birini düşürebilir / flood riski. Netlify cron kapalıysa session orada **uyumaz** — sorun yok. Netlify’daki env değerini silmek zorunlu değil; güvenlik için sonra silebilirsin. Yeni oturum ürettiysen Netlify’daki eski session zaten geçersiz olabilir.

---

## KURALLAR

- `AI_KAPALI=true` — kurulum sırasında OpenAI yok
- Supabase şeması değişmesin; muhasebe tablolarına dokunma
- `redmedya` nginx + `redmediadugun.cloud` SSL + Docker'a dokunma
- PORT **3200** (3000 yasak bu sunucuda)
- `nginx -t` temiz değilse **reload yok**
- Her aşama bitince **DUR**, göster, onay al
- Tehlikeli komutlarda önce uyar
`)
