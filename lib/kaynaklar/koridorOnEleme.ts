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
