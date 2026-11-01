/**
 * Mobil yönetim paneli verileri. Yalnız ana şemadan okur (üye hesapları,
 * ilanlar, kaynaklar, AI çağrıları). Üyelerin defterlerine / finansına girmez.
 */
import { anaPrisma } from "@/lib/prismaAna";

export type KaynakDurumu = {
  ad: string;
  durum: "CALISIYOR" | "SORUNLU" | "BILINMIYOR";
  ayrinti: string;
};

function dkOnce(d: Date): string {
  const dk = Math.max(0, Math.round((Date.now() - d.getTime()) / 60000));
  if (dk < 1) return "az önce";
  if (dk < 60) return `${dk} dk önce`;
  const sa = Math.round(dk / 60);
  return sa < 48 ? `${sa} sa önce` : `${Math.round(sa / 24)} gün önce`;
}

/** Telegram / WhatsApp okuyucu nabzı + web kaynaklarının son taraması. */
export async function kaynakDurumlari(): Promise<KaynakDurumu[]> {
  const nabizlar = await anaPrisma.ayar.findMany({ where: { anahtar: { in: ["daemon_nabiz_telegram", "daemon_nabiz_whatsapp"] } } });
  const okuyucu = (ad: string, anahtar: string): KaynakDurumu => {
    const s = nabizlar.find((n) => n.anahtar === anahtar);
    if (!s) return { ad, durum: "BILINMIYOR", ayrinti: "Nabız kaydı yok" };
    try {
      const n = JSON.parse(s.deger) as { durum: string; zaman: string };
      const zaman = new Date(n.zaman);
      const olu = Date.now() - zaman.getTime() > 10 * 60 * 1000;
      if (olu) return { ad, durum: "SORUNLU", ayrinti: `Servis yanıt vermiyor · son ${dkOnce(zaman)}` };
      if (n.durum !== "BAGLI") return { ad, durum: "SORUNLU", ayrinti: `${n.durum === "OTURUM_KAPANDI" ? "Oturum kapandı" : n.durum === "ESLEME_BEKLIYOR" ? "Eşleme bekliyor" : "Bağlantı koptu"} · ${dkOnce(zaman)}` };
      return { ad, durum: "CALISIYOR", ayrinti: `Bağlı · ${dkOnce(zaman)}` };
    } catch {
      return { ad, durum: "BILINMIYOR", ayrinti: "Nabız okunamadı" };
    }
  };
  const web = await anaPrisma.ilanKaynagi.findMany({
    where: { tur: "WEB", aktif: true },
    select: { sonTarama: true, sonHata: true },
  });
  const sonWeb = web.map((w) => w.sonTarama).filter((d): d is Date => d !== null).sort((a, b) => b.getTime() - a.getTime())[0];
  const hatali = web.filter((w) => w.sonHata).length;
  const webDurum: KaynakDurumu =
    web.length === 0
      ? { ad: "Web kaynakları", durum: "BILINMIYOR", ayrinti: "Aktif web kaynağı yok" }
      : {
          ad: "Web kaynakları",
          durum: hatali > 0 ? "SORUNLU" : "CALISIYOR",
          ayrinti: `${web.length} kaynak${hatali ? ` · ${hatali} hatalı` : ""}${sonWeb ? ` · son tarama ${dkOnce(sonWeb)}` : ""}`,
        };
  return [okuyucu("Telegram", "daemon_nabiz_telegram"), okuyucu("WhatsApp", "daemon_nabiz_whatsapp"), webDurum];
}

/** Genel durum sayaçları. */
export async function genelDurum() {
  const gun = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [uyeToplam, uyeAktif, kurulumBekleyen, ilan24, kaynakAktif, kaynakAday, kuyruk, kuyrukHata, sikayet] = await Promise.all([
    anaPrisma.uye.count(),
    anaPrisma.uye.count({ where: { aktif: true } }),
    anaPrisma.uye.count({ where: { aktif: true, kurulumBitti: null } }),
    anaPrisma.yukIlani.count({ where: { createdAt: { gte: gun } } }),
    anaPrisma.ilanKaynagi.count({ where: { aktif: true, durum: "AKTIF" } }),
    anaPrisma.ilanKaynagi.count({ where: { durum: "ADAY" } }),
    anaPrisma.hamMesaj.count({ where: { islendi: false, denemeSayisi: { lt: 3 } } }),
    anaPrisma.hamMesaj.count({ where: { islendi: false, denemeSayisi: { gte: 3 } } }),
    anaPrisma.ilanSikayet.count({ where: { durum: "ACIK" } }),
  ]);
  return { uyeToplam, uyeAktif, kurulumBekleyen, ilan24, kaynakAktif, kaynakAday, kuyruk, kuyrukHata, sikayet };
}

/** Kaynak türü başına aktif / aday / pasif sayısı (grup kalitesi özeti). */
export async function kaynakKalitesi() {
  const satir = await anaPrisma.ilanKaynagi.groupBy({ by: ["tur", "durum"], _count: { _all: true }, _sum: { bulunanAdet: true } });
  const sessiz = await anaPrisma.ilanKaynagi.count({ where: { aktif: true, durum: "AKTIF", OR: [{ sonTarama: null }, { sonTarama: { lt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) } }] } });
  const turAdi: Record<string, string> = { TELEGRAM: "Telegram bot", TELEGRAM_UYE: "Telegram grup", WHATSAPP: "WhatsApp", WEB: "Web", AI_ARAMA: "AI arama" };
  const map = new Map<string, { ad: string; aktif: number; aday: number; pasif: number; ilan: number }>();
  for (const s of satir) {
    const o = map.get(s.tur) ?? { ad: turAdi[s.tur] ?? s.tur, aktif: 0, aday: 0, pasif: 0, ilan: 0 };
    if (s.durum === "AKTIF") o.aktif += s._count._all;
    else if (s.durum === "ADAY") o.aday += s._count._all;
    else o.pasif += s._count._all;
    o.ilan += s._sum.bulunanAdet ?? 0;
    map.set(s.tur, o);
  }
  return { turler: [...map.values()].sort((a, b) => b.aktif - a.aktif), sessiz };
}

export async function sonYonetimKayitlari(adet = 30) {
  const k = await anaPrisma.yonetimKaydi.findMany({ orderBy: { id: "desc" }, take: adet });
  const uyeler = await anaPrisma.uye.findMany({ where: { id: { in: k.map((x) => x.uyeId).filter((x): x is number => x !== null) } }, select: { id: true, ad: true, kullaniciAdi: true } });
  const ad = new Map(uyeler.map((u) => [u.id, u.ad || u.kullaniciAdi]));
  return k.map((x) => ({ ...x, uyeAd: x.uyeId ? ad.get(x.uyeId) ?? `#${x.uyeId}` : null, zamanYazi: dkOnce(x.createdAt) }));
}

export const ISLEM_ADI: Record<string, string> = {
  UYE_OLUSTUR: "Üye oluşturuldu",
  SIFRE_SIFIRLA: "Şifre sıfırlandı",
  HESAP_KAPAT: "Hesap kapatıldı",
  HESAP_AC: "Hesap açıldı",
  PANELE_GIRIS: "Üye paneline girildi",
  OTURUM_KAPAT: "Üyenin oturumları kapatıldı",
  SIKAYET_KALDIR: "Şikâyetli ilan kaldırıldı",
  SIKAYET_YOKSAY: "Şikâyet yok sayıldı",
  ILAN_KALDIR: "Şüpheli ilan kaldırıldı",
};

export { dkOnce };

/** Tek tek sorunlu kaynaklar: son taramada hata verenler ve 3 günden uzun sessiz kalan aktifler. */
export async function sorunluKaynaklar(adet = 15) {
  const uc = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const k = await anaPrisma.ilanKaynagi.findMany({
    where: { aktif: true, durum: "AKTIF", OR: [{ sonHata: { not: null } }, { sonTarama: null }, { sonTarama: { lt: uc } }] },
    orderBy: [{ sonTarama: { sort: "asc", nulls: "first" } }],
    take: adet,
    select: { id: true, ad: true, tur: true, sonHata: true, sonTarama: true },
  });
  return k.map((x) => ({
    ...x,
    neden: x.sonHata ? x.sonHata.slice(0, 120) : x.sonTarama ? `Son tarama ${dkOnce(x.sonTarama)}` : "Hiç taranmadı",
  }));
}

/** AI çözümü 3 denemede başarısız olan mesajlar (en yeniler). */
export async function islenemeyenMesajlar(adet = 10) {
  const m = await anaPrisma.hamMesaj.findMany({
    where: { islendi: false, denemeSayisi: { gte: 3 } },
    orderBy: { id: "desc" },
    take: adet,
    select: { id: true, metin: true, hata: true, createdAt: true, kaynak: { select: { ad: true } } },
  });
  return m.map((x) => ({ id: x.id, kaynak: x.kaynak?.ad ?? "kaynak yok", metin: x.metin.replace(/\s+/g, " ").slice(0, 90), hata: x.hata?.slice(0, 100) ?? null, zaman: dkOnce(x.createdAt) }));
}

/** Son 7 ve 30 günün AI harcaması (mikro dolar) ve çağrı sayısı. */
export async function aiDonemHarcamasi() {
  const gun = 24 * 60 * 60 * 1000;
  const [h7, h30] = await Promise.all(
    [7, 30].map((n) => anaPrisma.aiCagri.aggregate({ where: { zaman: { gte: new Date(Date.now() - n * gun) } }, _sum: { maliyetMikro: true }, _count: { _all: true } }))
  );
  const usd = (m: number | null) => `$${((m ?? 0) / 1_000_000).toFixed(2)}`;
  return { yedi: { tutar: usd(h7._sum.maliyetMikro), cagri: h7._count._all }, otuz: { tutar: usd(h30._sum.maliyetMikro), cagri: h30._count._all } };
}
