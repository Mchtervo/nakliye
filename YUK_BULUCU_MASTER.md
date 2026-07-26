# YÜK BULUCU — BİRLEŞİK MASTER PLAN

Bu dosya bugüne kadar konuşulan **her şeyi** içerir. Sırayla uygulanacak.

---

## ÇALIŞMA KURALLARI

- `AI_KAPALI=true`. Ben açana kadar **hiçbir OpenAI çağrısı yapma.** Kodu hazırla, çalıştırma.
- Muhasebe tablolarına (`Yuk`, `Gider`, `Firma`, `Odeme`, `KasaHareket`) **yazma.** Sadece oku.
- Her faz bitince **DUR**, göster, onay al. Hepsini tek seferde yapma.
- "Yaptım" derken **canlıda mı lokalde mi** belirt. Deploy edilmemiş kod yok hükmündedir.
- Şema değişikliğinde migration'ı da uygula.
- Yeni alanlar nullable + varsayılanlı olsun, eski satırları bozma.
- Emin olmadığın yerde tahmin etme, sor.

---

# FAZ 1 — MALİYET GÜVENLİĞİ

Bir kısmı push edildi (`c9a1490`). Canlıda doğrula, eksikleri tamamla.

## 1.1 Doğrulanacaklar
- [x] `AI_KAPALI=true` kod + cron'da var; Ayarlar'da rozet var. Canlı UI oturum ister — sen ekranda amber "AI kapalı" görüyorsan OK.
- [x] `max_output_tokens` varsayılan 1500 (`OPENAI_MAX_CIKTI`) — kodda doğrulandı.
- [x] Timeout'ta retry KAPALI; sadece 429/5xx. Timeout 60s — kodda doğrulandı.
- [x] `HamMesaj.denemeSayisi` — migration canlı DB'de var; 2 denemeden sonra kalıcı HATA.
- [x] `AiCagri` tablo + istemci logu hazır (şu an 0 kayıt — kill switch yüzünden beklenen).
- [x] Günlük bütçe `$1` sert kesme kodu + Telegram uyarısı hazır. **Canlı kesme testi (1.3) henüz çalıştırılmadı** (çağrı yasak).

## 1.2 Test modu
Ayarlar'da "10 mesaj işle ve dur" butonu var. Çağrı başı satır satır token/$ gösterir.
**Senin onayınla çalıştırılacak** — ben bu turda OpenAI çağırmadım.
Hedef: çağrı başı çıktı &lt; 500 token.

## 1.3 Bütçe korumasını test et
`AI_GUNLUK_LIMIT_USD=0.01` ile canlı kesme + Telegram — **bekliyor (çağrı gerekir, senin onayın).**

---

# FAZ 2 — AYRIŞTIRMA HATALARI

## 2.1 Uydurma yer adları
- [x] Prompt sert kural (ham metinde yoksa null / uydurma yasak)
- [x] Sunucu doğrulama: `nereden`/`nereye`/`cikisIl`/`varisIl` → yoksa null, skor ≤35
- [x] `guvenSkoru < 50` → Şüpheli sekme; düşük skorlu artık kayda girer (≥15 + yer)
- [ ] Canlıda gerçek mesajla doğrula (AI kapalıyken bekliyor)

## 2.2 Ton başı / komple fiyat karışması
- [x] `fiyatTon` + `ucret` (=komple, kuruş) + `fiyatBelirsiz`
- [x] Prompt `ucretTuru`: TON_BASI / KOMPLE / BELIRSIZ
- [x] UI: `₺900/ton`, tahmin `~₺21.600 (24 ton × 900)`
- [ ] Canlıda "900+KDV" örneğiyle doğrula

## 2.3 Çok güzergahlı mesajlar
- [x] Her güzergah ayrı ilan, aynı `hamMetin`
- [x] Telefonsuz dedup artık rotaya göre (önce hepsi tek satıra çöküyordu)
- [x] "İlk N rota" kesme yok

## 2.4 Sessiz gruplar teşhisi
- [x] `sonMesajId` null → son 20 mesaj okunur (atlamaz)
- [x] Panel: `son okuma: … · çekilen (24s): N · … ilan`
- [x] İlk okuma bekleyen gruplar işaretlenir

## 2.5 Eksik gruplar
- [x] Üye olunan grupta başlık filtresi yok (`adaylariDegerlendir`)
- [ ] Canlıda `@grupajkargo` vb. senkron sonrası görünüyor mu kontrol et

---

# FAZ 3 — FİLTRE AYARLARI

Hepsi Ayarlar ekranından değiştirilebilir olsun, **koda gömme.**

## 3.1 Aracım
```
Tip: TENTELİ / KAPALI KASA
Tonaj: ___ ton        <-- DOLDURULACAK
Ana üs: Ankara
```

**KABUL edilecek kelimeler:**
tenteli, tente, tenteli kasa, kapalı kasa, kapalı, branda, brandalı, perdeli, perde, sürgülü perde

**REDDEDİLECEK:**
açık kasa, açık, kırkayak, platform, lowbed, lowbet, damper, frigo, soğutmalı, tanker, silobas, konteyner şasi, römork, havuz, sal

Araç tipi belirtilmemişse **eleme** — "belirsiz" geçir, kartta sarı uyarı.

## 3.2 Bölgelerim

**İç Anadolu:** Ankara, Konya, Kayseri, Sivas, Eskişehir, Kırıkkale, Kırşehir, Nevşehir, Niğde, Aksaray, Yozgat, Çankırı, Karaman

**Marmara:** İstanbul, Bursa, Kocaeli, Sakarya, Tekirdağ, Edirne, Kırklareli, Balıkesir, Çanakkale, Yalova, Bilecik, Düzce

**Kural:** en az **BİR** ucu bu bölgelere değsin. İki ucu da değil — Ankara→Antalya da Antalya→Ankara da tutulmalı (dönüş yükü mantığı).

Komşu iller kapsamı da geçerli kalsın.

**Bölge listesi genişletilebilir olsun.** İleride Ege veya başka bölge eklemek isteyebilirim — kod değiştirmeden, Ayarlar'dan il seçip ekleyebileyim.

## 3.3 İlçe → İl eşleme tablosu (KRİTİK)
İlanlarda il adı yazmıyor, ilçe/sanayi bölgesi yazıyor. Bu tablo olmadan geçerli ilanların yarısı kaybolur.

**En az 300 kayıt.** Başlangıç listesi:

```
Ankara:     Ostim, İvedik, Sincan, Kazan, Temelli, Polatlı,
            Başkent OSB, Şaşmaz, Etimesgut, Akyurt, Çubuk
İstanbul:   Hadımköy, İkitelli, Tuzla, Dudullu, Esenyurt,
            Beylikdüzü, Silivri, Çatalca, Sefaköy, Ambarlı, Halkalı
Kocaeli:    Gebze, Dilovası, Körfez, Çayırova, Şekerpınar, Kartepe
Bursa:      İnegöl, Nilüfer, Kestel, Gürsu, Yenişehir, Karacabey
Konya:      Ereğli, Akşehir, Karatay OSB, Selçuklu, Çumra
Kayseri:    OSB, Develi, Yahyalı, İncesu
Eskişehir:  Mihalıççık, Sivrihisar, OSB, Alpu
Balıkesir:  Bandırma, Susurluk, Gönen, Edremit, Bigadiç
Çanakkale:  Çan, Biga, Gelibolu, Lapseki
Tekirdağ:   Çerkezköy, Çorlu, Kapaklı, Ergene, Muratlı, Malkara
Sakarya:    Hendek, Akyazı, Arifiye, Pamukova
Sivas:      OSB, Şarkışla, Gemerek
Aksaray:    OSB, Ortaköy
Kırıkkale:  OSB, Yahşihan, Delice
Bilecik:    Bozüyük, Osmaneli, Pazaryeri
Düzce:      Gümüşova, Kaynaşlı
```

Kalanını sen tamamla — her ilin sanayi bölgelerini ve yük yüklenen ilçelerini ekle.

**Kendi kendine büyüsün:** yeni karşılaşılan yer adları için (AI açıkken) "bu neresi" diye sorup tabloya eklesin.

## 3.4 Ayarlar ekranı
Değiştirilebilir olacaklar: araç tipi (çoklu), max tonaj, aktif bölgeler (çoklu, il bazında), ana üs şehri.

**"Eski ham mesajları yeni ayarla yeniden işle" butonu** — bölge genişlettiğimde geçmiş veriyi kaçırmayayım.

---

# FAZ 4 — TALEP ÜZERİNE MİMARİ

Şu an her mesaj otomatik AI'ye gidiyor, sormayacağım 190 rotanın parasını ödüyorum. Bunu değiştir.

## 4.1 Sürekli ve bedava
- Telegram okuması devam (bedava)
- Ham mesajlar `HamMesaj`'da 7 gün saklansın
- Her ham mesaj kaydedilirken **AI'SIZ etiketlensin:** regex + ilçe→il tablosuyla içindeki şehirleri bul, `aday_sehirler` alanına yaz
- Spam/tekrar filtreleri burada çalışsın (bedava)

## 4.2 Ön filtre (AI'ye gitmeden önce)
Mesaj AI'ye gitsin diye şart: **şehir/ilçe adı VE** (rota işareti `→ - den/dan` | ton | fiyat | telefon | "yük" | "araç") sinyallerinden en az biri.

Sadece şehir adı geçmesi yetmesin. Elenen sayısını logla.

**Spam kalıpları:** evden eve, çeyiz, parça eşya, kurye, motokurye, araç aranıyor, yetişkin içerik, escort, bahis, emlak

## 4.3 Satır bazlı tekrar tespiti
Zaman penceresi kullanma — yeni eklenen rotayı kaçırır.

Mesajı satırlara böl, her satırı normalize edip hash'le. **Sadece daha önce görülmemiş satırlar** AI'ye gitsin. Aynı liste 8 kez atılırsa 2-8. sıfır çağrı; araya "BOLU 700+" eklenirse sadece başlık + o satır gider.

## 4.4 Otomatik AI sadece sabit rotalar için
Ayarlar'dan 1-3 "takip rotası" tanımlayabileyim (örn. Ankara çıkışlı).

Günde 2 kez (09:00 ve 17:00) **sadece bu rotalara uyan** ham mesajlar AI'ye gitsin, sonuç Telegram'a bildirim olsun. Diğer hiçbir mesaj otomatik işlenmesin.

## 4.5 Talep üzerine işleme — ASIL KISIM
Telegram'dan sorduğumda:

```
a) Sorudan çıkış/varış yerini çıkar (küçük AI çağrısı, max 100 token)
b) HamMesaj'da BEDAVA metin araması: aday_sehirler + ham metin
   eşleşmesi. İlçe adları dahil (Gerede→Bolu, Ostim→Ankara)
c) Eşleşenlerden EN FAZLA 15'ini AI'ye ver, JSON'a çevir
d) YukIlani'ye kaydet, islendi=true — aynı mesaj bir daha işlenmesin
e) Sadece soruya uyan ilanları Telegram'a gönder
```

## 4.6 Maliyet tavanı
Bir sorgu en fazla 15 mesaj işlesin. Fazlaysa en yenileri. Sorgu başı tahmini maliyeti cevabın altına küçük yaz (test için, sonra kaldırırız).

## 4.7 Gece penceresi
23:00–06:00 TR arası **okuma devam etsin** (bedava), sadece AI işleme ertelensin. Mesajlar biriksin, 06:00'da toplu işlensin. Gece aynı liste 8 kez atılırsa satır hash sabah hepsini tek seferde yakalar.

## 4.8 Hafıza
- İşlenmiş ilanlar 48 saat "taze" — aynı soru gelirse AI'siz cache'ten dön
- 48 saat sonrası arşive geçsin, silinmesin
- Ham mesajlar 7 gün dursun

## 4.9 Parti mantığı
Parti başarısız olunca tek tek deneme pahalı. **İkiye böl, yine olmazsa yine böl** (ikili arama). Tek mesaj en son çare.

## 4.10 Eleme sayaçları
Günlük tut ve raporda göster: bugün X mesaj geldi, Y tekrar, Z spam, W bölge dışı, sadece V tanesi AI'ye gitti.

---

# FAZ 5 — GRUP KEŞFİ VE KATILIM

**Tamamen OpenAI'siz, maliyet sıfır.** `AI_KAPALI=true` olsa bile çalışsın.

## 5.1 Keşif (günde 1 kez, 08:00)
Telegram araması bedava. Kelimeler:
```
yük ilan, nakliye grubu, nakliyeci, tır yük, boş araç, yük borsası,
komple yük, parsiyel yük, ankara yük, istanbul yük, iç anadolu nakliye,
marmara yük, dorse ilan, lojistik ilan, nakliye borsası, yük paylaşım
```
Bulunanlar ADAY olarak kaydedilsin.

## 5.2 Değerlendirme — AI YOK, kelime eşleşmesi
- **KABUL:** yük, nakliye, nakliyeci, lojistik, tır, kamyon, dorse, borsa, taşıma, sevkiyat
- **RED:** üniversite, yüksek lisans, emlak, evden eve, kurye, motokurye, escort, bahis
- 50 üyenin altını hiç kaydetme
- Rusça/Özbekçe/Arapça başlıkları "yurtdışı" etiketle, varsayılan katılma

## 5.3 Katılım (günde en fazla 4)
- Üye sayısı yüksek olandan başla
- İki katılım arası en az 45 dakika
- Günlük sayaç DB'de, UTC gün dönümünde sıfırlansın
- `FloodWaitError` → 24 saat tam dur, kilit bitişini DB'ye yaz
- `InviteRequestSentError` → **başarı say**, tekrar deneme
- Her denemeyi logla

## 5.4 Ayarlar ekranı
- Otomatik keşif aç/kapa
- Otomatik katılım aç/kapa
- Günlük katılım limiti (varsayılan 4)
- Aday grup listesi: üye sayısına göre sıralı, "Aç" ve "Elle katıl" butonlarıyla
- "Bugün X/4 katılım" göstergesi

---

# FAZ 6 — TELEGRAM DOĞAL DİL BOTU

Şu an bota "ankara yük var mı" yazınca alakasız cevap veriyor. Hâlâ eski komut tabanlı webhook çalışıyor.

**Slash komut olmayacak.** Normal Türkçe yazacağım.

## 6.1 Örnek konuşmalar
```
"ankaradayım gerede'ye yük var mı"
"istanbuldan ankaraya ne var"
"bugün ostimden çıkan bir şey"
"dün akşamdan beri ne geldi"
"şu 24 tonluk buğday işi neydi"
"bugün kaç ilan geldi"
"hangi grup en çok iş veriyor"
"sistem nasıl"
"en son kimi aradım"
```

## 6.2 Teknik
OpenAI **function calling**. Tanıtılacak fonksiyonlar:
- `ilanAra(cikisIl?, varisIl?, aracTipi?, maxTonaj?, sonSaat?, limit?)`
- `hamMesajAra(metin, sonSaat?)`
- `istatistik(gun?)`
- `grupDurumu()`
- `ilanDetay(id)`
- `iletisimGecmisi(limit?)`

Sistem prompt'unda aracımı, bölgemi, tercihlerimi ver ki filtreyi kendisi kursun.

**Konuşma hafızası:** son 10 mesaj saklansın, "şu ilan" dediğimde anlasın.

Cevaplar kısa. En fazla 5 ilan, altına "3 tane daha var".

## 6.3 İlan kartı formatı
```
🚛 Ankara Ostim → Gerede
24 ton · tenteli · buğday
📅 Yarın sabah
💰 ₺18.000 komple
📞 0532 000 00 00
🏢 Erollar Lojistik
⏱ 12 dk önce · NGL LOJİSTİK · güven %92
```
Inline butonlar: **[WhatsApp]** · **[Takibe Al]** · **[İlgilenmiyorum]**

## 6.4 Güvenlik ve maliyet
- Sadece kayıtlı `telegram_chat_id`'den gelen mesaja cevap ver, başkasını görmezden gel (logla)
- Günlük mesaj limiti (varsayılan 50)
- `AI_KAPALI=true` iken "AI şu an kapalı" desin, çağrı yapmasın

---

# FAZ 7 — SESLİ SORU

Direksiyondayken yazamam.

- Bot `voice` tipi mesajı yakalasın
- Whisper API ile Türkçe metne çevirsin (dakikası ~$0.006)
- Normal doğal dil akışına soksun
- Cevabı **yazılı** göndersin
- Çevrilen metni de göstersin: *"Anladığım: ankaradayım gerede'ye yük var mı"*
- Whisper maliyetini de logla

---

# FAZ 8 — YÜK ARA SAYFASI

Yeni sayfa: `/yuk-ara`

## 8.1 Filtreler
- **NEREDEN / NEREYE**: serbest metin + otomatik tamamlama. Boş = hepsi.
- Araç tipi (çoklu), max tonaj, tarih aralığı, sadece fiyatı belli olanlar, son X saat, min güven skoru
- Filtreler URL'ye yazılsın: `/yuk-ara?cikis=Ankara&varis=Bolu`
- Sık kullanılan filtreler kaydedilebilsin, üstte çip olarak dursun

## 8.2 Ham mesaj sekmesi
Ayrıştırılmamış ham mesajlarda tam metin araması. Ayrıştırıcı bir mesajı atlamışsa orada görüp elle "İlana çevir" diyebileyim.

## 8.3 Sonuç kartı
Güzergah (ilçe dahil), tonaj, yük cinsi, araç tipi, yükleme tarihi, fiyat (ton/komple ayrımı net), firma, telefon (tıklayınca kopyalanır), kaynak grup, kaç dakika önce, güven skoru.

**Görsel işaretler:**
- 4 saatten eski ilan soluk
- Aynı ilan birden fazla grupta göründüyse "3 grupta" rozeti
- Kara listedeki numara kırmızı çerçeve
- Düşük güven skoru sarı uyarı

## 8.4 Mobil
Çoğu zaman telefondan bakacağım. Tek sütun, parmakla basılabilir butonlar, filtreler açılır panelde.

---

# FAZ 9 — GERÇEK KÂR HESABI

Bu sistemin en büyük farkı. Muhasebe verim bende, hiçbir yük borsası bunu yapamaz.

## 9.1 Ayarlar'a eklenecek
- Yakıt tüketimi (lt/100km, varsayılan 30)
- Güncel motorin fiyatı
- Km başı sabit gider (lastik, bakım, sigorta — varsayılan ₺3/km)
- Ortalama HGS/köprü gideri

## 9.2 İlan kartında göster
```
190 km · boş km 0 · toplam 190 km
Yakıt ~₺4.900 · HGS ₺180 · sabit ₺570
Net beklenen: ₺12.350 · ₺65/km
Bu hattaki ortalaman: ₺61/km → %6 iyi ✅
```

## 9.3 Mesafe hesabı
İl/ilçe koordinat tablosu, kuş uçuşu × 1.3 (karayolu tahmini). Mesafeleri cache'le.

## 9.4 Hat ortalaması
`Yuk` tablosundaki geçmiş seferlerimden öğren (**sadece oku**). Gördüğüm ilanlardan da biriktir. Yeterli veri yoksa "ortalama yok" de, uydurma.

---

# FAZ 10 — DÖNÜŞ YÜKÜ

`DonusTalebi` tablosu var ama kullanılmıyor. Boş dönmek en büyük para kaybı.

- İlanı "ALINDI" işaretlediğimde otomatik dönüş talebi oluşsun
- Varış ilinden çıkışlı yükler aranmaya başlasın
- Bulununca Telegram'dan haber ver
- Ayarlar'dan açılıp kapanabilsin
- Yükleme tarihinden 2 gün sonra otomatik kapansın

---

# FAZ 11 — FİRMA HAFIZASI, KARA LİSTE, KOMİSYONCU

Amaç: komisyoncuyu aradan çıkarıp doğrudan müşteri havuzu kurmak. Navlun %20-30 artar.

## 11.1 Her firma için tut
Kaç kez görüşüldü, kaç iş alındı, ödedi mi, kaç günde ödedi, fiyatı piyasaya göre nasıl, komisyoncu mu yük sahibi mi, notlarım.

İlan kartında göster: *"Bu firmayla 3 kez görüştün, 1 iş aldın, 12 günde ödedi"*

## 11.2 Kara liste
"Kara listeye al" butonu + sebep notu. O numaradan gelen ilan bir daha görünmesin. Ayarlar'dan yönetilebilsin.

## 11.3 Komisyoncu tespiti
Aynı telefon 10+ farklı güzergahta ilan veriyorsa "komisyoncu (47 ilan)" etiketi. İstersem gizleyebileyim.

## 11.4 Tekrar eden ilan sinyali
Aynı ilan 5 grupta dolaşıyorsa **ilk nerede ve ne zaman göründüğünü** göster. Kaynağa en yakın olan en az elden geçmiştir.

---

# FAZ 12 — WHATSAPP

- Her ilan kartında "WhatsApp" butonu
- Basınca OpenAI o ilana özel kısa mesaj üretsin (3-4 cümle, esnaf dili, samimi ama profesyonel)
- Mesaj **düzenlenebilir** olsun
- "WhatsApp'ta Aç" → `wa.me/90XXXXXXXXXX?text=<encodeURIComponent(mesaj)>`
- Numara formatı: `0532 306 30 70` → `905323063070`. 10 haneli değilse butonu gösterme.
- Açıldıktan sonra `ILETISIME_GECILDI` durumuna geçsin
- Şablon Ayarlar'dan düzenlenebilsin (araç bilgilerim, imza, ton)
- **Otomatik gönderme yok**, son "gönder"e ben basacağım (toplu mesaj = numara banı)
- AI çağrısı sadece butona basınca, sonucu 24 saat sakla

---

# FAZ 13 — GÜNLÜK RAPOR

Her akşam 20:00 (TR) bota otomatik mesaj:

```
📊 Günlük Özet — 26 Temmuz

Yeni bulunan grup: 3
Katılınan grup: 2 (bugün 2/4)
Takipteki grup: 12
Okunan mesaj: 847
  → tekrar elenen: 412
  → spam elenen: 89
  → bölge dışı: 231
  → AI'ye giden: 115
Yeni ilan: 62
Sana uygun: 14
İletişime geçtiğin: 3

🏆 En verimli: NGL LOJİSTİK (18 ilan)
😴 Sessiz: GEBZE NAKLİYECİLER (0 ilan/3 gün)
💸 AI maliyeti: $0.08
```

Sessiz gruplar 7 gün 0 ilan verirse "bu gruptan çıkmak ister misin" diye sorsun.

---

# FAZ 14 — KONUM, İRSALİYE, BOŞ ARAÇ DUYURUSU

## 14.1 Konum bazlı arama
Telegram'dan konum paylaşınca "şu an X km yakınındaki yükler". Yarıçap ayarlanabilir (varsayılan 100 km).

## 14.2 İrsaliye / fatura fotoğrafı
`fisOku` zaten var, ona bağlan. Telegram'a fotoğraf atınca oku, tutar/tarih/firma/plaka çıkar, muhasebeye kaydet. **Onay iste**, direkt kaydetme.

## 14.3 Boş araç duyurusu
Ayarlar'dan açılabilsin. Günde 1 kez metin hazırlansın: *"Ankara'da tenteli boş araç, İstanbul-Bursa yönü müsait, 0544..."*

**Onay için bana gelsin**, otomatik gönderme. Onaylarsam seçtiğim gruplara gitsin. Aynı gruba günde 1'den fazla gönderme (spam = gruptan atılma).

---

# FAZ 15 — KÜÇÜK AMA ÖNEMLİ

- **Aciliyet:** "acil", "bugün", "yarın" geçen ilanlar öne çıksın
- **İlan yaşı:** 4 saatten eski ilanlar soluk
- **Sessiz saat:** 23:00–07:00 bildirim yok, sabah toplu özet
- **Yüksek öncelik:** skor 90+ için ayrı bildirim
- **İlan yaşam döngüsü:** `YENI → ILETISIME_GECILDI → PAZARLIKTA → ALINDI/KAYBEDILDI/SURESI_GECTI`. 12 saat dokunulmamış → `SURESI_GECTI`. Kayıp sebebini sorsun (fiyat düşüktü / başkası aldı / cevap vermedi).
- **AI maliyet takibi:** Ayarlar'da günlük/aylık harcama
- **Yedekleme:** günde 1 kez tüm veriyi JSON olarak dışa aktar

---

# UYGULAMA SIRASI

1. **FAZ 1** — maliyet güvenliği doğrulaması (kısmen yapıldı)
2. **FAZ 2** — ayrıştırma hataları
3. **FAZ 3** — filtre ayarları + ilçe→il tablosu
4. **FAZ 4** — talep üzerine mimari
5. **FAZ 5** — grup keşfi ve katılım (sıfır maliyet, paralel gidebilir)
6. **FAZ 6** — Telegram doğal dil botu
7. **FAZ 7** — sesli soru
8. **FAZ 8** — Yük Ara sayfası
9. **FAZ 9** — kâr hesabı
10. **FAZ 10–15** — sırayla

---

# KABUL KRİTERLERİ

Her faz için "bitti" demeden önce:

- [ ] Build hatasız
- [ ] Tip kontrolü temiz
- [ ] Migration uygulandı
- [ ] Mobilde düzgün
- [ ] Muhasebe sayfaları etkilenmedi
- [ ] Gerçek veriyle test edildi (uydurma veri değil)
- [ ] Canlıya deploy edildi mi, belirtildi

---

**FAZ 1'den başla. Bitince dur ve göster.**

Bittiğinde şu iki soruyu cevapla:
1. Günde 5 sorgu yaparsam tahmini maliyet ne kadar?
2. Mevcut "hepsini işle" modeline göre yüzde kaç tasarruf?
