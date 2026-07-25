# Nakliye Defteri

Tek kişilik nakliye işletmesi için mobil öncelikli muhasebe ve iş takip uygulaması.
Yükler, giderler, cari hesaplar, kasa, KDV ve yapay zekâ destekli yük bulucu tek yerde.

Teknoloji: Next.js (App Router) · Prisma · PostgreSQL (Supabase) · Netlify

---

## Geliştirme

```bash
npm install
npx prisma generate
npx prisma migrate deploy
npm run dev
```

`.env` dosyasını `.env.example` üzerinden oluştur.

Faydalı komutlar:

| Komut | Ne yapar |
| --- | --- |
| `npm run dev` | Geliştirme sunucusu |
| `npm run build` | Üretim derlemesi |
| `npm run supabase:kur` | Supabase depolama kovasını hazırlar |
| `npm run telegram:kur -- https://site-adresin` | Telegram webhook'unu kurar |
| `npm run push:kur` | Web Push (VAPID) anahtarlarını üretir |

---

## Modüller

- **Yükler / Giderler / Cari / Kasa** — günlük kayıtlar, kısmi ödeme takibi, fiş fotoğrafı
- **KDV Merkezi** (`/kdv`) — aylık hesaplanan, indirilecek ve ödenecek KDV
- **Muhasebeciye Gönder** (`/muhasebeci`) — fiş görselleri + `giderler.xlsx` + `ozet.html` tek ZIP; WhatsApp veya e-posta
- **AI Merkezi** (`/ai`)
  - Yük Bulucu — Telegram grupları, ilan siteleri ve web aramasından ilan toplar
  - Dönüş Yükü — her yük kaydında ters yön için otomatik arama açılır
  - Aday Firmalar — sanayi bölgelerinden potansiyel müşteri çıkarır
  - Analiz Merkezi — günlük kârlılık, yakıt, tahsilat ve KDV değerlendirmesi
- **Fiş OCR** — gider eklerken çekilen fotoğraftan tutar, KDV, tarih ve tür otomatik dolar

---

## AI kurulumu

AI modülleri anahtar olmadan da çökmeden çalışır (ekranlar boş görünür).
Tam çalışması için sırayla:

### 1. OpenAI anahtarı (zorunlu)

1. [platform.openai.com](https://platform.openai.com) → Billing → kredi yükle
2. API keys → **Create new secret key**
3. `.env` dosyasına: `OPENAI_API_KEY=sk-...`

Kullanılan modeller `lib/ai/modeller.ts` içinde; istersen `OPENAI_MODEL_HIZLI` ve
`OPENAI_MODEL_ANALIZ` ile değiştirebilirsin.

### 2. Telegram botu (yük bulucunun kalbi)

1. Telegram'da **@BotFather** → `/newbot` → token'ı `.env`'e:
   `TELEGRAM_BOT_TOKEN=...`
2. `.env`'e rastgele bir webhook anahtarı ekle: `TELEGRAM_WEBHOOK_SECRET=...`
3. **@BotFather → `/setprivacy` → botunu seç → Disable.**
   Bu adım şart; kapalı değilse bot grup mesajlarını göremez.
4. Botu takip etmek istediğin nakliye/yük gruplarına ekle.
   (Privacy'yi sonradan kapattıysan botu gruptan çıkarıp tekrar ekle.)
5. Webhook'u kur:
   ```bash
   npm run telegram:kur -- https://siteadresin.netlify.app
   ```
6. Kendi Telegram hesabından bota özelden **`/baglan`** yaz — bildirimler oraya gelir.

Gördüğün herhangi bir ilanı (Facebook, WhatsApp fark etmez) bota iletmen yeterli;
yapay zekâ onu da çözümleyip listeye ekler.

### 3. Cron anahtarı

```bash
node -e "console.log(crypto.randomUUID())"
```

Çıkan değeri `.env`'e `AI_CRON_SECRET=` olarak yaz. Bu anahtar `/api/ai/tara` ve
`/api/ai/gunluk-analiz` uçlarını korur; zamanlanmış fonksiyonlar bununla çağırır.

### 4. Telefon bildirimi (isteğe bağlı)

```bash
npm run push:kur
```

Çıkan üç satırı `.env`'e ekle, sonra uygulamada **Ayarlar → Yapay zekâ → Bu cihazda
bildirimi aç** de.

### 5. Netlify

Site settings → Environment variables altına aynı değerleri gir:

`OPENAI_API_KEY`, `AI_CRON_SECRET`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`,
`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`

Zamanlanmış fonksiyonlar `netlify/functions/` altında tanımlıdır ve deploy ile
kendiliğinden devreye girer:

- `ai-tarama.mts` — 15 dakikada bir, sırayla birkaç kaynağı tarar
- `ai-analiz.mts` — her sabah TR 08:00'de günlük analizi üretir

### 6. Uygulama içi ayarlar

**Ayarlar → Yapay zekâ**

- Şehrini ve sık çalıştığın rotaları gir (bildirim filtresi)
- İstersen en düşük ücret sınırı koy
- **Yük kaynakları**: ilan sitesi adresi veya AI arama sorgusu ekle
  (boş bırakırsan Telegram grupları yine çalışır)

---

## Nasıl çalışıyor

```
Telegram grupları ──webhook──┐
Yük ilan siteleri ───cron────┼──> OpenAI ile çözümleme ──> tekrar kontrolü ──> YukIlani
OpenAI web arama ────cron────┘                                                    │
                                                          şehir / rota / dönüş filtresi
                                                                     │
                                              Telegram + telefon bildirimi · /ai/yukler
```

Ekrandan **Yüke çevir** dediğinde mevcut yük formu ilan bilgileriyle dolu açılır.

### Sınırlar

- Giriş (login) isteyen ilan siteleri taranamaz.
- Facebook grupları için resmî ve kalıcı bir API yolu yok; ilanı bota iletmek gerekir.
- Kişisel WhatsApp'a otomatik mesaj atan resmî API yok; WhatsApp tek tık gönderme
  bağlantısı olarak çalışır, anlık bildirim Telegram ve push üzerinden gider.
