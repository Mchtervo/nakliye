/**
 * AI maliyeti: ilan getirmeyen grupların mesajları AI'ye gitmesin.
 *
 * Günde bir kez son 7 güne bakılır; susturulan kaynak 14 gün sonra yeniden
 * denenir. WhatsApp kanalları okuyucu tarafından her taramada yeniden "aktif"
 * yazıldığı için susturma, AI kuyruğunda (cron-ai-kuyruk) uygulanır:
 * susturulmuş kaynağın bekleyen mesajı AI'ye gitmeden kapatılır.
 */
import { prisma } from "@/lib/prisma";
import { aiTercihleriOku } from "@/lib/ayarlar";
import { illeriBul, sadelestir } from "@/lib/iller";
import { koridorIlKumesi } from "@/lib/koridor";
import { gelenKutusunaEkle } from "@/lib/bildirim/gelenKutusu";

export const SESSIZ_ANAHTAR = "ai_sessiz_kaynaklar";
const SON_KONTROL_ANAHTAR = "ai_sessiz_son_kontrol";
/** Elle "Geri aç" denen kaynaklar bir daha otomatik susturulmaz. */
const ISTISNA_ANAHTAR = "ai_sessiz_istisna";

async function istisnalar(): Promise<Set<number>> {
  const k = await prisma.ayar.findUnique({ where: { anahtar: ISTISNA_ANAHTAR } });
  try {
    return new Set(JSON.parse(k?.deger || "[]") as number[]);
  } catch {
    return new Set();
  }
}

/** Ayarlar: susturmayı kaldır ve bir daha otomatik susturma. */
export async function sessizligiKaldir(id: number): Promise<void> {
  const liste = (await sessizKaynaklar()).filter((s) => s.id !== id);
  const ist = await istisnalar();
  ist.add(id);
  for (const [anahtar, deger] of [
    [SESSIZ_ANAHTAR, JSON.stringify(liste)],
    [ISTISNA_ANAHTAR, JSON.stringify([...ist])],
  ]) {
    await prisma.ayar.upsert({ where: { anahtar }, create: { anahtar, deger }, update: { deger } });
  }
}

const GUN_MS = 24 * 60 * 60 * 1000;
const PENCERE_GUN = 7;
const SURE_GUN = 14;
/** Bu kadar mesaj AI'ye gidip hiç ilan çıkmadıysa sustur. */
const SIFIR_ILAN_MIN_MESAJ = 20;
/** Bu kadar mesajda isabet %4'ün altındaysa sustur. */
const DUSUK_MIN_MESAJ = 40;
const DUSUK_ORAN = 0.04;
/** Grup adı yalnız koridor dışı bölgeyi anıyorsa (Doğu, Güneydoğu, Trakya…). */
const DIS_BOLGE = /\b(guneydogu|dogu bolgesi|dogu anadolu|dogu karadeniz|trakya)\b/;

export type SessizKaynak = { id: number; ad: string; sebep: string; bitis: string };

export async function sessizKaynaklar(simdi = new Date()): Promise<SessizKaynak[]> {
  const k = await prisma.ayar.findUnique({ where: { anahtar: SESSIZ_ANAHTAR } });
  try {
    const liste = JSON.parse(k?.deger || "[]") as SessizKaynak[];
    return liste.filter((s) => new Date(s.bitis) > simdi);
  } catch {
    return [];
  }
}

/** Adı koridor dışını anlatıyor mu (il adı var ama hiçbiri koridorda değil)? */
function adKoridorDisiMi(ad: string, koridor: Set<string>): boolean {
  if (DIS_BOLGE.test(sadelestir(ad))) return true;
  const iller = [...new Set(illeriBul(ad))];
  return iller.length > 0 && !iller.some((il) => koridor.has(il));
}

/** Günde bir: verimsiz kaynakları belirle, listeyi yaz, yeni susturulanları bildir. */
export async function verimsizKaynaklariGuncelle(simdi = new Date()): Promise<SessizKaynak[]> {
  const bugun = new Date(simdi.getTime() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const son = await prisma.ayar.findUnique({ where: { anahtar: SON_KONTROL_ANAHTAR } });
  if (son?.deger === bugun) return sessizKaynaklar(simdi);

  const bas = new Date(simdi.getTime() - PENCERE_GUN * GUN_MS);
  const koridor = new Set(koridorIlKumesi((await aiTercihleriOku()).koridorIller));
  const [aiye, ilanlar, mevcut, ist] = await Promise.all([
    prisma.hamMesaj.groupBy({ by: ["kaynakId"], where: { createdAt: { gte: bas }, denemeSayisi: { gt: 0 } }, _count: true }),
    prisma.yukIlani.groupBy({ by: ["kaynakId"], where: { createdAt: { gte: bas } }, _count: true }),
    sessizKaynaklar(simdi),
    istisnalar(),
  ]);
  const ilanSay = new Map(ilanlar.map((i) => [i.kaynakId, i._count]));
  const kaynaklar = await prisma.ilanKaynagi.findMany({
    where: { aktif: true, durum: "AKTIF", tur: { in: ["WHATSAPP_GRUP", "TELEGRAM_UYE", "TELEGRAM"] } },
    select: { id: true, ad: true },
  }).then((l) => l.filter((k) => !ist.has(k.id)));
  const ad = new Map(kaynaklar.map((k) => [k.id, k.ad]));
  const bitis = new Date(simdi.getTime() + SURE_GUN * GUN_MS).toISOString();
  const yeni = new Map<number, SessizKaynak>(mevcut.map((s) => [s.id, s]));

  for (const k of kaynaklar) {
    if (!yeni.has(k.id) && adKoridorDisiMi(k.ad, koridor)) {
      yeni.set(k.id, { id: k.id, ad: k.ad, sebep: "Grup koridor dışı bölgeye ait", bitis });
    }
  }
  for (const a of aiye) {
    if (!a.kaynakId || !ad.has(a.kaynakId) || yeni.has(a.kaynakId)) continue;
    const ilan = ilanSay.get(a.kaynakId) ?? 0;
    const mesaj = a._count;
    if ((ilan === 0 && mesaj >= SIFIR_ILAN_MIN_MESAJ) || (mesaj >= DUSUK_MIN_MESAJ && ilan / mesaj < DUSUK_ORAN)) {
      yeni.set(a.kaynakId, {
        id: a.kaynakId,
        ad: ad.get(a.kaynakId)!,
        sebep: `7 günde ${mesaj} mesaj, ${ilan} ilan`,
        bitis,
      });
    }
  }

  const liste = [...yeni.values()];
  await prisma.ayar.upsert({
    where: { anahtar: SESSIZ_ANAHTAR },
    create: { anahtar: SESSIZ_ANAHTAR, deger: JSON.stringify(liste) },
    update: { deger: JSON.stringify(liste) },
  });
  await prisma.ayar.upsert({
    where: { anahtar: SON_KONTROL_ANAHTAR },
    create: { anahtar: SON_KONTROL_ANAHTAR, deger: bugun },
    update: { deger: bugun },
  });

  const eklenen = liste.filter((s) => !mevcut.some((m) => m.id === s.id));
  if (eklenen.length > 0) {
    await gelenKutusunaEkle({
      baslik: `${eklenen.length} verimsiz grup susturuldu`,
      metin:
        `Bu grupların mesajları 14 gün AI'ye gönderilmeyecek (para harcamasın):\n` +
        eklenen.map((s) => `• ${s.ad} — ${s.sebep}`).join("\n"),
      url: "/ayarlar#sessiz-gruplar",
    });
  }
  return liste;
}

/** AI'den önce: susturulmuş kaynakların bekleyen mesajlarını kapat. */
export async function sessizMesajlariKapat(simdi = new Date()): Promise<number> {
  const liste = await sessizKaynaklar(simdi);
  if (liste.length === 0) return 0;
  const r = await prisma.hamMesaj.updateMany({
    where: { islendi: false, kaynakId: { in: liste.map((s) => s.id) } },
    data: { islendi: true, hata: "SESSIZ_KAYNAK" },
  });
  return r.count;
}
