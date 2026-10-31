/**
 * AI'den önce: rota satırlarının HEPSİ koridor dışına gidiyorsa mesajı AI'ye
 * gönderme. Satır = tam 2 il (çıkış + varış) ve biri koridor dışı; sunucu bu
 * rotaları AI'den sonra zaten atıyordu (BOLGE_ROTA), parası boşa gidiyordu.
 *
 * Ölçüm (31.10, son 2 gün, 1.573 mesaj): 327 mesaj (%21) AI'siz kapanır,
 * bu mesajlardan kaydedilmiş ilan kaybı 0. Çok illi satırlar ("Kartal–Antep
 * Bilecik–Sultanbeyli") ve rota satırı olmayan düz metin dokunulmadan kalır.
 */
import { prisma } from "@/lib/prisma";
import { aiTercihleriOku } from "@/lib/ayarlar";
import { illeriBul } from "@/lib/iller";
import { koridorIlKumesi } from "@/lib/koridor";
import { rotaSatiriMi, satirlaraBol } from "@/lib/kaynaklar/onFiltre";

export function hepsiKoridorDisiMi(metin: string, koridor: Set<string>): boolean {
  if (koridor.size === 0 || koridor.size >= 70) return false;
  const rotalar = satirlaraBol(metin).filter(rotaSatiriMi);
  if (rotalar.length === 0) return false;
  return rotalar.every((s) => {
    const iller = [...new Set(illeriBul(s))];
    return iller.length === 2 && iller.some((il) => !koridor.has(il));
  });
}

/** Bekleyen kuyrukta koridor dışı mesajları AI'siz kapatır; kapatılan adedi döner. */
export async function koridorDisiMesajlariKapat(): Promise<number> {
  const koridor = new Set(koridorIlKumesi((await aiTercihleriOku()).koridorIller));
  const bekleyen = await prisma.hamMesaj.findMany({
    where: { islendi: false },
    select: { id: true, metin: true },
    take: 500,
  });
  const idler = bekleyen.filter((m) => hepsiKoridorDisiMi(m.metin, koridor)).map((m) => m.id);
  if (idler.length === 0) return 0;
  const r = await prisma.hamMesaj.updateMany({
    where: { id: { in: idler }, islendi: false },
    data: { islendi: true, hata: "KORIDOR_DISI_ROTA" },
  });
  return r.count;
}

const JEV_SORULAN_ANAHTAR = "jev_koridor_sorulan";

/**
 * Jev'e "iki ucu koridorda yük var mı?" diye sor; skoru eşiğin altındakini
 * AI'siz kapat. Her mesaj bir kez sorulur (id'ler Ayar'da tutulur).
 */
export async function jevKoridorEle(): Promise<{ soru: number; elenen: number }> {
  const { jevKoridorSkoru, JEV_KORIDOR_ESIK, jevKullanilabilir } = await import("@/lib/ai/jev");
  if (!jevKullanilabilir()) return { soru: 0, elenen: 0 };
  const { YENI_ILAN_MS } = await import("@/lib/ilanTazelik");
  const sinir = new Date(Date.now() - YENI_ILAN_MS);
  const iller = koridorIlKumesi((await aiTercihleriOku()).koridorIller);
  if (iller.length === 0 || iller.length >= 70) return { soru: 0, elenen: 0 };

  const kayit = await prisma.ayar.findUnique({ where: { anahtar: JEV_SORULAN_ANAHTAR } });
  let sorulan: number[] = [];
  try {
    sorulan = JSON.parse(kayit?.deger || "[]") as number[];
  } catch {
    sorulan = [];
  }
  const sorulanSet = new Set(sorulan);
  const bekleyen = (
    await prisma.hamMesaj.findMany({
      where: { islendi: false, OR: [{ mesajZamani: { gte: sinir } }, { mesajZamani: null, createdAt: { gte: sinir } }] },
      select: { id: true, metin: true },
      orderBy: { createdAt: "desc" },
      take: 120,
    })
  ).filter((m) => !sorulanSet.has(m.id));
  if (bekleyen.length === 0) return { soru: 0, elenen: 0 };

  const elenecek: { id: number; skor: number }[] = [];
  for (let i = 0; i < bekleyen.length; i += 8) {
    const parti = bekleyen.slice(i, i + 8);
    const skorlar = await Promise.all(parti.map((m) => jevKoridorSkoru(m.metin, iller)));
    parti.forEach((m, j) => {
      const s = skorlar[j];
      if (s !== null && s !== undefined) {
        sorulanSet.add(m.id);
        if (s < JEV_KORIDOR_ESIK) elenecek.push({ id: m.id, skor: s });
      }
    });
  }
  for (const e of elenecek) {
    await prisma.hamMesaj.updateMany({
      where: { id: e.id, islendi: false },
      data: { islendi: true, hata: `JEV_KORIDOR: skor ${e.skor.toFixed(2)} < ${JEV_KORIDOR_ESIK} — AI atlandı` },
    });
  }
  const deger = JSON.stringify([...sorulanSet].slice(-2000));
  await prisma.ayar.upsert({
    where: { anahtar: JEV_SORULAN_ANAHTAR },
    create: { anahtar: JEV_SORULAN_ANAHTAR, deger },
    update: { deger },
  });
  return { soru: bekleyen.length, elenen: elenecek.length };
}
