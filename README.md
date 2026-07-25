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
| `npm run telegram:oturum` | Kendi Telegram hesabınla giriş yapıp oturum anahtarı üretir |
| `npm run push:kur` | Web Push (VAPID) anahtarlarını üretir |

---

## Modüller

- **Yükler / Giderler / Cari / Kasa** — günlük kayıtlar, kısmi ödeme takibi, fiş fotoğrafı
- **KDV Merkezi** (`/kdv`) — aylık hesaplanan, indirilecek ve ödenecek KDV
- **Muhasebeciye Gönder** (`/muhasebeci`) — fiş görselleri + `giderler.xlsx` + `ozet.html` tek ZIP; WhatsApp veya e-posta
- **AI Merkezi** (`/ai`)
  - Yük Bulucu — Telegram gruplarını kendi hesabınla tarar, ilan siteleri ve web aramasını da okur
  - Grup Keşfi — seçtiğin bölgelerdeki yük gruplarını bulur, aday listesine yazar
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

### 3. Kendi Telegram hesabın (otomatik grup bulma)

Bot yalnızca **eklendiği** grupları görebilir. Grup yöneticileri çoğu zaman bot
eklemeye izin vermez. Kendi hesabınla bağlandığında ise **zaten üye olduğun bütün
gruplar** okunur ve seçtiğin bölgelerde yeni gruplar bulunup aday listesine yazılır.

1. [my.telegram.org](https://my.telegram.org) → API development tools → uygulama oluştur
2. Çıkan değerleri `.env`'e yaz:
   ```
   TELEGRAM_API_ID=1234567
   TELEGRAM_API_HASH=...
   ```
3. Bir kerelik giriş yap (telefonuna kod gelir):
   ```bash
   npm run telegram:oturum
   ```
4. Çıkan `TELEGRAM_SESSION=...` satırını `.env`'e ve Netlify'a ekle.
5. **Ayarlar → Yapay zekâ** ekranından bölgeleri seç (varsayılan: İç Anadolu, Marmara).

Nasıl davranır:

- Her 5 dakikada bir takipteki grupların yeni mesajları okunur.
- Her koşuda üyelik senkronu yapılır: üye olduğun uygun gruplar takibe alınır.
- 6 saatte bir arama turu: bulunan uygun gruplar **aday** olarak kaydedilir.
- Grup başlığında nakliye terimi aranır; "evden eve", emlak, sohbet gibi gruplar elenir.

**Gruba katılma otomatik yapılmaz.** Aday gruplar Ayarlar ekranında üye sayısıyla
listelenir; "Aç" düğmesi grubu Telegram'da açar. Katıldıktan sonra grup 5 dakika
içinde kendiliğinden takibe geçer, ayrıca bir şey yapman gerekmez.

`TELEGRAM_SESSION` hesabına tam erişim verir — kimseyle paylaşma. Telegram, aşırı
otomatik davranışta hesaba geçici kısıtlama koyabilir; bu yüzden grup araması
bilinçli olarak seyrektir.

### 4. Cron anahtarı

```bash
node -e "console.log(crypto.randomUUID())"
```

Çıkan değeri `.env`'e `AI_CRON_SECRET=` olarak yaz. Bu anahtar `/api/ai/*` ve
`/api/telegram/uye/*` uçlarını korur; zamanlanmış fonksiyonlar bununla çağırır.

### 5. Telefon bildirimi (isteğe bağlı)

```bash
npm run push:kur
```

Çıkan üç satırı `.env`'e ekle, sonra uygulamada **Ayarlar → Yapay zekâ → Bu cihazda
bildirimi aç** de.

### 6. Netlify

Site settings → Environment variables altına aynı değerleri gir:

`OPENAI_API_KEY`, `AI_CRON_SECRET`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`,
`TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, `TELEGRAM_SESSION`,
`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`

Zamanlanmış fonksiyonlar `netlify/functions/` altında tanımlıdır ve deploy ile
kendiliğinden devreye girer:

- `telegram-uye.mts` — 5 dakikada bir grupları okur ve üyeliği senkronlar, 6 saatte bir yeni grup arar
- `ai-kuyruk.mts` — 5 dakikada bir biriken mesajları AI ile ilana çevirir
- `ai-tarama.mts` — 15 dakikada bir ilan sitesi / web araması kaynaklarını tarar
- `ai-analiz.mts` — her sabah TR 08:00'de günlük analizi üretir

### 7. Uygulama içi ayarlar

**Ayarlar → Yapay zekâ**

- Şehrini ve sık çalıştığın rotaları gir (bildirim filtresi)
- Takip edilecek bölgeleri seç (grup araması ve bildirim kapsamı)
- İstersen en düşük ücret sınırı koy
- **Telegram grupları**: takipteki gruplar ve katılabileceğin aday gruplar listelenir
- **Diğer yük kaynakları**: ilan sitesi adresi veya AI arama sorgusu ekle

---

## Nasıl çalışıyor

```
Telegram (kendi hesabın) ─5dk──> ham mesaj kuyruğu ─┐
Telegram (bot) ──────webhook────────────────────────┤
Yük ilan siteleri ───────cron───────────────────────┼──> OpenAI çözümleme
OpenAI web arama ────────cron───────────────────────┘            │
                                                     tekrar kontrolü (dedup)
                                                                 │
                                              bölge / şehir / rota / dönüş filtresi
                                                                 │
                                          Telegram + telefon bildirimi · /ai/yukler
```

Okuma ile çözümleme bilerek ayrılmıştır: gruplardan mesaj çekmek hızlıdır, AI
çözümlemesi yavaştır. Ham mesajlar önce `HamMesaj` kuyruğuna yazılır, ayrı bir
zamanlanmış iş kuyruğu partiler hâlinde işler. Böylece iki taraf da Netlify'ın
süre sınırına takılmaz.

Ekrandan **Yüke çevir** dediğinde mevcut yük formu ilan bilgileriyle dolu açılır.

### Sınırlar

- Giriş (login) isteyen ilan siteleri taranamaz.
- Facebook grupları için resmî ve kalıcı bir API yolu yok; ilanı bota iletmek gerekir.
- Gruplara katılma otomatik değildir: uygulama grubu bulup aday olarak listeler,
  katılma kararı senindir. Katıldığın her grup (davetle girilen kapalı gruplar dâhil)
  sonraki koşuda kendiliğinden takibe geçer.
- Telegram aramasıyla yalnızca **açık** (herkese görünür) gruplar bulunabilir.
- Kişisel WhatsApp'a otomatik mesaj atan resmî API yok; WhatsApp tek tık gönderme
  bağlantısı olarak çalışır, anlık bildirim Telegram ve push üzerinden gider.
