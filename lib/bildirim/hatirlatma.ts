/**
 * Telefona (push) + Telegram'a giden hatırlatmalar:
 * - Tahsil edilmemiş iş: iş tarihinden 7, 14, 21, 30. gün, sonra 15 günde bir.
 * - Okuyucu (WhatsApp/Telegram) koptu: 3 saatte bir tekrar.
 */
import { prisma } from "@/lib/prisma";
import { bilgiBildir } from "@/lib/bildirim/gonder";
import { daemonSorunlari } from "@/lib/kaynaklar/daemonNabiz";
import { tlYaz } from "@/lib/para";

const GUN_MS = 24 * 60 * 60 * 1000;
const ODEME_ANAHTAR = "odeme_hatirlatma_gun";
const ODEME_SAAT = 9;
const DAEMON_TEKRAR_MS = 3 * 60 * 60 * 1000;

/** TR saatiyle YYYY-MM-DD ve saat. */
function trSimdi(): { gun: string; saat: number } {
  const tr = new Date(Date.now() + 3 * 60 * 60 * 1000);
  return { gun: tr.toISOString().slice(0, 10), saat: tr.getUTCHours() };
}

function trGun(d: Date): string {
  return new Date(d.getTime() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function gunFarki(eski: string, yeni: string): number {
  return Math.round((Date.parse(yeni) - Date.parse(eski)) / GUN_MS);
}

/** 7, 14, 21, 30, sonra 45, 60, 75… */
export function hatirlatmaGunuMu(gecen: number): boolean {
  if (gecen === 7 || gecen === 14 || gecen === 21 || gecen === 30) return true;
  return gecen > 30 && (gecen - 30) % 15 === 0;
}

async function ayarAl(anahtar: string): Promise<string | null> {
  const k = await prisma.ayar.findUnique({ where: { anahtar } });
  return k?.deger ?? null;
}

async function ayarKoy(anahtar: string, deger: string): Promise<void> {
  await prisma.ayar.upsert({
    where: { anahtar },
    update: { deger },
    create: { anahtar, deger },
  });
}

function tarihYaz(d: Date): string {
  return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Istanbul" });
}

export async function odemeHatirlat(): Promise<{ adet: number; atlandi?: string }> {
  const { gun, saat } = trSimdi();
  if (saat < ODEME_SAAT) return { adet: 0, atlandi: "saat erken" };
  if ((await ayarAl(ODEME_ANAHTAR)) === gun) return { adet: 0, atlandi: "bugün gönderildi" };

  const yukler = await prisma.yuk.findMany({
    where: { odemeDurumu: { not: "ODENDI" }, tarih: { lte: new Date(Date.now() - 6 * GUN_MS) } },
    select: {
      id: true,
      tarih: true,
      nereden: true,
      nereye: true,
      toplamTutar: true,
      firma: { select: { ad: true } },
      odemeler: { select: { tutar: true } },
    },
    orderBy: { tarih: "asc" },
  });

  const satirlar: string[] = [];
  let toplam = 0;
  for (const y of yukler) {
    const kalan = y.toplamTutar - y.odemeler.reduce((o, p) => o + p.tutar, 0);
    if (kalan <= 0) continue;
    const gecen = gunFarki(trGun(y.tarih), gun);
    if (!hatirlatmaGunuMu(gecen)) continue;
    toplam += kalan;
    satirlar.push(
      `• ${y.firma.ad}: ${tarihYaz(y.tarih)} tarihli ${y.nereden}→${y.nereye} işinin ${tlYaz(kalan)} ödemesi ${gecen} gündür alınmadı`
    );
  }

  await ayarKoy(ODEME_ANAHTAR, gun);
  if (satirlar.length === 0) return { adet: 0 };

  const baslik =
    satirlar.length === 1 ? "Ödeme alınmadı" : `${satirlar.length} işin ödemesi alınmadı (${tlYaz(toplam)})`;
  await bilgiBildir(
    baslik,
    `${satirlar.join("\n")}\n\nÖdeme geldiyse uygulamada işaretle.`,
    "/yukler"
  );
  return { adet: satirlar.length };
}

const YOLCULUK_ANAHTAR = "yolculuk_sor_son";
const YOLCULUK_ARALIK_MS = 3 * 60 * 60 * 1000;

/**
 * Açık yolculuk yoksa 08–20 arası 3 saatte bir "Yolculuk nereye?".
 * Boşaltma yeri girilince o il ve 60 km çevresindeki yükler bildirilir.
 */
export async function yolculukSor(): Promise<boolean> {
  const { saat } = trSimdi();
  if (saat < 8 || saat >= 20) return false;
  const acik = await prisma.donusTalebi.count({ where: { aktif: true } });
  if (acik > 0) return false;
  const onceki = Number((await ayarAl(YOLCULUK_ANAHTAR)) || 0);
  if (Date.now() - onceki < YOLCULUK_ARALIK_MS) return false;
  await ayarKoy(YOLCULUK_ANAHTAR, String(Date.now()));
  await bilgiBildir(
    "Yolculuk nereye?",
    "Nereden yükledin, nereye boşaltıyorsun? Yaz, vardığın yerde ve 60 km çevresinde dönüş yükü arayayım.",
    "/#yolculuk"
  );
  return true;
}

const KONTROL_ANAHTAR = "yolculuk_kontrol_son";
const KONTROL_ARALIK_MS = 2 * 60 * 60 * 1000;

/**
 * Açık yolculuk varken 08–22 arası 2 saatte bir "Yük buldun mu?".
 * Dokununca ana sayfadaki kart: Aramayı durdur / Yük aldım, yeni yere ara.
 * İlk soru yolculuk açıldıktan 2 saat sonra gelir.
 */
export async function yolculukKontrol(): Promise<boolean> {
  const { saat } = trSimdi();
  if (saat < 8 || saat >= 22) return false;
  const y = await prisma.donusTalebi.findFirst({
    where: { aktif: true },
    orderBy: { createdAt: "desc" },
    select: { cikis: true, createdAt: true, eslesmeAdet: true },
  });
  if (!y || Date.now() - y.createdAt.getTime() < KONTROL_ARALIK_MS) return false;
  const onceki = Number((await ayarAl(KONTROL_ANAHTAR)) || 0);
  if (Date.now() - onceki < KONTROL_ARALIK_MS) return false;
  await ayarKoy(KONTROL_ANAHTAR, String(Date.now()));
  const bulunan = y.eslesmeAdet > 0 ? `${y.cikis} çevresinde ${y.eslesmeAdet} yük çıktı. ` : "";
  await bilgiBildir(
    "Yük buldun mu?",
    `${bulunan}Yük aldıysan yeni yeri yaz, oraya arayayım. Gerek yoksa aramayı durdur.`,
    "/#yolculuk"
  );
  return true;
}

/**
 * Bakım yaklaşınca: ≤1000 km, ≤500 km ve geçince birer kez (08–21 arası).
 * "Bakım yapıldı" ya da bakım ayarı değişince seviye sıfırlanır.
 */
export async function bakimHatirlat(): Promise<number> {
  const { saat } = trSimdi();
  if (saat < 8 || saat >= 21) return 0;
  const { kmOzeti } = await import("@/lib/seferKm");
  const o = await kmOzeti();
  if (!o.arac || o.bakimaKalan === null || o.sonrakiBakimKm === null) return 0;
  const seviye = o.bakimaKalan <= 0 ? 3 : o.bakimaKalan <= 500 ? 2 : o.bakimaKalan <= 1000 ? 1 : 0;
  if (seviye <= o.arac.bakimUyari) return 0;
  await prisma.arac.update({ where: { id: o.arac.id }, data: { bakimUyari: seviye } });
  const km = (n: number) => `${n.toLocaleString("tr-TR")} km`;
  await bilgiBildir(
    seviye === 3 ? "Bakım zamanı geçti" : `Bakıma ${km(o.bakimaKalan)} kaldı`,
    seviye === 3
      ? `Bakım ${km(o.sonrakiBakimKm)}'de yapılacaktı, tahmini gösterge ${km(o.tahminiSayac ?? 0)}. Bakımı yaptıysan ana sayfada "Bakım yapıldı"ya bas.`
      : `Tahmini gösterge ${km(o.tahminiSayac ?? 0)}, sonraki bakım ${km(o.sonrakiBakimKm)}. Göstergeyi ana sayfadan güncellersen hesap netleşir.`,
    "/#km"
  );
  return seviye;
}

/** Belge bitişi: 30 / 7 / 1 gün kala ve geçince birer kez (09–21 arası). */
export async function belgeHatirlat(): Promise<number> {
  const { saat } = trSimdi();
  if (saat < 9 || saat >= 21) return 0;
  const { belgeAdi, kalanGun, uyariSeviyesi } = await import("@/lib/belge");
  const belgeler = await prisma.belge.findMany({
    where: { bitis: { lte: new Date(Date.now() + 31 * GUN_MS) } },
  });
  let gonderilen = 0;
  for (const b of belgeler) {
    const kalan = kalanGun(b.bitis);
    const seviye = uyariSeviyesi(kalan);
    if (seviye <= b.uyari) continue;
    await prisma.belge.update({ where: { id: b.id }, data: { uyari: seviye } });
    const ad = belgeAdi(b.tur, b.ad);
    await bilgiBildir(
      kalan < 0 ? `${ad} süresi geçti` : kalan <= 1 ? `${ad} ${kalan === 0 ? "bugün" : "yarın"} bitiyor` : `${ad}: ${kalan} gün kaldı`,
      `Bitiş: ${tarihYaz(b.bitis)}. Yeniledikten sonra ana sayfada "Yenilendi"ye basıp yeni tarihi gir.`,
      "/#belgeler"
    );
    gonderilen += 1;
  }
  return gonderilen;
}

/**
 * Kredi kartı: borç varken son ödemeye 3 gün, 1 gün kala, son gün ve
 * geçince birer kez (09–21). Anahtar "YYYY-MM-GG:seviye" — her ekstre dönemi ayrı.
 */
export async function kartHatirlat(): Promise<number> {
  const { saat } = trSimdi();
  if (saat < 9 || saat >= 21) return 0;
  const { kartlarDurumu } = await import("@/lib/krediKarti");
  let gonderilen = 0;
  for (const k of await kartlarDurumu()) {
    if (k.kalan <= 0) continue;
    const seviye = k.kalanGun < 0 ? 4 : k.kalanGun === 0 ? 3 : k.kalanGun <= 1 ? 2 : k.kalanGun <= 3 ? 1 : 0;
    if (seviye === 0) continue;
    const donem = trGun(k.sonOdeme);
    const [oncekiDonem, oncekiSeviye] = (k.uyari || "").split(":");
    if (oncekiDonem === donem && Number(oncekiSeviye) >= seviye) continue;
    await prisma.krediKarti.update({ where: { id: k.id }, data: { uyari: `${donem}:${seviye}` } });
    const borc = tlYaz(k.kalan);
    await bilgiBildir(
      seviye === 4
        ? `${k.ad}: son ödeme geçti`
        : seviye === 3
          ? `${k.ad}: son ödeme bugün`
          : `${k.ad}: son ödemeye ${k.kalanGun} gün`,
      `Kalan borç ${borc}. Son ödeme ${tarihYaz(k.sonOdeme)}. Ödediysen ana sayfada "Ödeme yap"tan kaydet.`,
      "/#kartlar"
    );
    gonderilen += 1;
  }
  return gonderilen;
}

const YAKIT_UYARI_ANAHTAR = "yakit_uyari_dolum";

/** Son dolum ortalamadan %15 fazla yaktıysa o dolum için bir kez. */
export async function yakitHatirlat(): Promise<boolean> {
  const { yakitVerimi } = await import("@/lib/yakit");
  const v = await yakitVerimi();
  if (!v.fazla || !v.sonDolumId || v.lt100 == null || v.sonLt100 == null) return false;
  if ((await ayarAl(YAKIT_UYARI_ANAHTAR)) === String(v.sonDolumId)) return false;
  await ayarKoy(YAKIT_UYARI_ANAHTAR, String(v.sonDolumId));
  const s = (n: number) => n.toLocaleString("tr-TR", { maximumFractionDigits: 1 });
  await bilgiBildir(
    "Yakıt tüketimi arttı",
    `Son dolumda ${s(v.sonLt100)} lt/100 km yaktın, ortalaman ${s(v.lt100)}. Kaçak, lastik basıncı, filtre ve enjektörü kontrol ettir; km ya da litre yanlış yazıldıysa gideri düzelt.`,
    "/#km"
  );
  return true;
}

/** Kopan okuyucu için 3 saatte bir hatırlatma; eşleme kodu da içinde gelir. */
export async function okuyucuHatirlat(): Promise<number> {
  const sorunlar = await daemonSorunlari();
  let gonderilen = 0;
  for (const s of sorunlar) {
    const anahtar = `daemon_uyari_${s.ad}`;
    const onceki = Number((await ayarAl(anahtar)) || 0);
    if (Date.now() - onceki < DAEMON_TEKRAR_MS) continue;
    // Eşleme kodu dakikada bir değişir; bildirimdeki kod bayatlar, ekrandaki güncel.
    const detay = s.detay.startsWith("Kod:") ? "Güncel eşleme kodu yük ekranında." : s.detay;
    await bilgiBildir(s.baslik, detay, "/ai/yukler");
    await ayarKoy(anahtar, String(Date.now()));
    gonderilen += 1;
  }
  // Düzelen okuyucu: bir sonraki kopuşta hemen haber gelsin.
  const sorunlu = sorunlar.map((s) => `daemon_uyari_${s.ad}`);
  await prisma.ayar.deleteMany({
    where: { anahtar: { startsWith: "daemon_uyari_", notIn: sorunlu } },
  });
  return gonderilen;
}
