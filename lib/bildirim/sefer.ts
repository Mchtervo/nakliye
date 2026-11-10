/**
 * Aynı hesabı birden çok kişi (patron + şoförler) kullanıyor:
 * - Biri sefer girince DİĞER telefonlara "Yeni sefer" bildirimi gider.
 * - Gün içinde iki kez (13:00, 19:00) bugün seferi yazılmamış tır varsa hatırlatılır.
 * Bildirimler hesabın kendi cihazlarına ve uygulama içi kutuya gider.
 */
import { prisma } from "@/lib/prisma";
import { aiTercihleriOku } from "@/lib/ayarlar";
import { gelenKutusunaEkle } from "@/lib/bildirim/gelenKutusu";
import { pushGonder, pushKullanilabilir } from "@/lib/bildirim/push";
import { tlYaz } from "@/lib/para";

function aracAdi(a: { ad: string; plaka: string | null; sofor: string | null } | null): string | null {
  if (!a) return null;
  const plaka = a.plaka || a.ad;
  return a.sofor ? `${a.sofor} (${plaka})` : plaka;
}

/** Yeni sefer kaydı: kaydı giren cihaz hariç hesabın diğer cihazlarına haber. */
export async function yeniSeferBildir(s: {
  nereden: string;
  nereye: string;
  firma: string;
  toplamTutar: number;
  aracId: number | null;
  /** Kaydı giren cihazın bildirim adresi (ona gönderilmez) */
  cihaz: string | null;
}): Promise<void> {
  const arac = s.aracId
    ? await prisma.arac.findUnique({ where: { id: s.aracId }, select: { ad: true, plaka: true, sofor: true } })
    : null;
  const kim = aracAdi(arac);
  const baslik = `Yeni sefer: ${s.nereden} → ${s.nereye}`;
  const metin = [kim, s.firma, tlYaz(s.toplamTutar)].filter(Boolean).join(" · ");

  await gelenKutusunaEkle({ baslik, metin, url: "/yukler" });

  const tercih = await aiTercihleriOku();
  if (!tercih.pushAcik || !pushKullanilabilir()) return;
  const digerleri = await prisma.pushAbone.findMany({
    where: s.cihaz ? { endpoint: { not: s.cihaz } } : undefined,
    select: { id: true },
  });
  if (digerleri.length === 0) return;
  // aboneIdler verilince kutuya ikinci kez yazılmaz (yukarıda eklendi)
  await pushGonder({ baslik, metin, url: "/yukler", aboneIdler: digerleri.map((d) => d.id) });
}

const HATIRLATMA_SAATLERI = [13, 19];
const HATIRLATMA_ANAHTAR = "sefer_hatirlatma_son";

function trSimdi(): { gun: string; saat: number; gunBasi: Date } {
  const tr = new Date(Date.now() + 3 * 60 * 60 * 1000);
  const gun = tr.toISOString().slice(0, 10);
  return { gun, saat: tr.getUTCHours(), gunBasi: new Date(`${gun}T00:00:00+03:00`) };
}

/**
 * 13:00 ve 19:00'dan sonraki ilk turda bir kez: bugün hiç sefer yazılmamış
 * tırlar varsa "Bugün sefer yazdın mı?" der. Araç yoksa ya da hepsi yazdıysa susar.
 */
export async function seferHatirlat(): Promise<boolean> {
  const { gun, saat, gunBasi } = trSimdi();
  const slot = [...HATIRLATMA_SAATLERI].reverse().find((s) => saat >= s);
  if (slot === undefined || saat >= 22) return false;
  const anahtar = `${gun}:${slot}`;
  const son = await prisma.ayar.findUnique({ where: { anahtar: HATIRLATMA_ANAHTAR } });
  if (son?.deger === anahtar) return false;
  await prisma.ayar.upsert({
    where: { anahtar: HATIRLATMA_ANAHTAR },
    update: { deger: anahtar },
    create: { anahtar: HATIRLATMA_ANAHTAR, deger: anahtar },
  });

  const araclar = await prisma.arac.findMany({ orderBy: { id: "asc" }, select: { id: true, ad: true, plaka: true, sofor: true } });
  if (araclar.length === 0) return false;
  const bugunku = await prisma.yuk.findMany({ where: { createdAt: { gte: gunBasi } }, select: { aracId: true } });
  const ilkId = araclar[0].id;
  const yazanlar = new Set(bugunku.map((y) => y.aracId ?? ilkId));
  const eksik = araclar.filter((a) => !yazanlar.has(a.id));
  if (eksik.length === 0) return false;

  const baslik = "Bugün sefer yazdın mı?";
  const metin =
    araclar.length === 1
      ? "Bugün sefer girilmedi. Sefer yaptıysan yazmayı unutma."
      : `Bugün sefer girilmeyen: ${eksik.map((a) => aracAdi(a)).join(", ")}. Sefer yaptıysa yazmayı unutma.`;

  const tercih = await aiTercihleriOku();
  if (tercih.pushAcik && pushKullanilabilir()) {
    await pushGonder({ baslik, metin, url: "/yukler/yeni" });
  } else {
    await gelenKutusunaEkle({ baslik, metin, url: "/yukler/yeni" });
  }
  return true;
}
