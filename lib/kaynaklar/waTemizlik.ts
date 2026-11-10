/**
 * WhatsApp yük gruplarında 2 günden eski mesajları temizler ("Sohbeti temizle").
 * Gruptan ÇIKILMAZ; kanallara, kişisel sohbetlere ve adı yük grubu olmayan
 * gruplara dokunulmaz. Temizlik bağlı cihazdan telefona eşitlenir.
 *
 * Açma/kapama: Ayar `wa_sohbet_temizle`
 *   yok / "0"      → kapalı (varsayılan)
 *   "1"            → tüm yük grupları
 *   başka bir metin → yalnız adında o metin geçen yük grupları (deneme için)
 *
 * WhatsApp "şu mesaja kadar temizle" ister: her grup için saatte bir "kontrol
 * noktası" (o saatin son mesajı) tutulur; 2 günü geçen en yeni nokta kullanılır.
 * Noktalar dosyada saklanır, okuyucu yeniden başlasa da kaybolmaz.
 */
import { readFile, writeFile } from "node:fs/promises";
import { sadelestir } from "@/lib/iller";
import { prisma } from "@/lib/prisma";
import { yukGrubuAdiMi } from "@/lib/kaynaklar/whatsapp";

export const TEMIZLIK_ANAHTAR = "wa_sohbet_temizle";
export const TEMIZLIK_YAS_SN = 2 * 24 * 60 * 60;
/** Tur başına en fazla grup (WhatsApp'a yüklenmeyelim) */
const TUR_TAVAN = 40;

export type Nokta = {
  id: string;
  participant?: string | null;
  fromMe?: boolean | null;
  ts: number;
};

/** jid → saat sırasıyla kontrol noktaları */
const noktalar = new Map<string, Nokta[]>();
let degisti = false;

export function noktaEkle(jid: string, n: Nokta): void {
  if (!jid.endsWith("@g.us") || !n.id || !(n.ts > 0)) return;
  const liste = noktalar.get(jid) ?? [];
  const son = liste[liste.length - 1];
  const saat = Math.floor(n.ts / 3600);
  if (son && Math.floor(son.ts / 3600) === saat) {
    if (n.ts >= son.ts) liste[liste.length - 1] = n;
  } else if (!son || n.ts > son.ts) {
    liste.push(n);
    // 3 günden fazlası gerekmez
    while (liste.length > 72) liste.shift();
  } else return;
  noktalar.set(jid, liste);
  degisti = true;
}

export async function noktalariYukle(dosya: string): Promise<void> {
  try {
    const veri = JSON.parse(await readFile(dosya, "utf8")) as Record<string, Nokta[]>;
    for (const [jid, liste] of Object.entries(veri)) {
      if (Array.isArray(liste)) noktalar.set(jid, liste.filter((n) => n && n.id && n.ts > 0));
    }
  } catch {
    // ilk çalışma: dosya yok
  }
}

export async function noktalariKaydet(dosya: string): Promise<void> {
  if (!degisti) return;
  degisti = false;
  await writeFile(dosya, JSON.stringify(Object.fromEntries(noktalar)), "utf8").catch(() => {
    degisti = true;
  });
}

/** Ayar: null = kapalı, "" = tüm yük grupları, metin = adında geçenler */
export async function temizlikAyari(): Promise<string | null> {
  const a = await prisma.ayar.findUnique({ where: { anahtar: TEMIZLIK_ANAHTAR } }).catch(() => null);
  const d = (a?.deger || "").trim();
  if (!d || d === "0") return null;
  return d === "1" ? "" : sadelestir(d);
}

export type TemizlikIsi = { jid: string; ad: string; nokta: Nokta };

/** Bu turda temizlenecek gruplar ve "buraya kadar sil" noktaları. */
export function temizlikIsleri(gruplar: { jid: string; ad: string }[], suzgec: string, simdiSn: number): TemizlikIsi[] {
  const sinir = simdiSn - TEMIZLIK_YAS_SN;
  const isler: TemizlikIsi[] = [];
  for (const g of gruplar) {
    if (!g.jid.endsWith("@g.us") || !g.ad || !yukGrubuAdiMi(g.ad)) continue;
    if (suzgec && !sadelestir(g.ad).includes(suzgec)) continue;
    const eski = (noktalar.get(g.jid) ?? []).filter((n) => n.ts <= sinir);
    const nokta = eski[eski.length - 1];
    if (nokta) isler.push({ jid: g.jid, ad: g.ad, nokta });
    if (isler.length >= TUR_TAVAN) break;
  }
  return isler;
}

/** Temizlenen noktayı ve öncekileri unut (bir sonraki tur daha yenisini kullanır). */
export function temizlendi(jid: string, nokta: Nokta): void {
  const liste = (noktalar.get(jid) ?? []).filter((n) => n.ts > nokta.ts);
  noktalar.set(jid, liste);
  degisti = true;
}
