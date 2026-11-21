/**
 * Facebook gruplarını okur (20 dk'da bir, gündüz). Her turda en uzun süredir okunmayan
 * birkaç yük grubu; yeni gönderiler WhatsApp ile aynı kuyruğa girer.
 * İlk kez okunan grubun mevcut gönderileri yalnız "görüldü" sayılır (eski ilan gelmesin).
 *
 *   npm run ts -- scripts/cron-facebook.ts
 */
import { prisma } from "@/lib/prisma";
import { mesajlariKuyrugaAl } from "@/lib/kaynaklar/telegramUye";
import { yukGrubuAdiMi } from "@/lib/kaynaklar/whatsapp";
import {
  FACEBOOK_GRUP,
  FbOturumHatasi,
  fbHazirMi,
  fbOturumAc,
  gorulenOku,
  gorulenYaz,
  grupGonderileri,
  katilinanGruplar,
} from "@/lib/kaynaklar/facebook";

const TUR_BASINA_GRUP = Number(process.env.FB_TUR_GRUP) || 8;
const LISTE_YENILE_MS = 6 * 3600e3;
const LISTE_ANAHTAR = "fb_grup_liste_zaman";
const UYARI_ANAHTAR = "fb_oturum_uyari_gun";

/** Adı yük grubu gibi olmayan ama nakliye anlamı taşıyan FB grup adları da kabul. */
function fbYukGrubuMu(ad: string): boolean {
  return yukGrubuAdiMi(ad) || /nakliy|y[üu]k|lojistik|t[ıi]r|kamyon|sevkiyat|ta[şs][ıi]ma/i.test(ad);
}

async function listeYenile(sayfa: Parameters<typeof katilinanGruplar>[0]): Promise<void> {
  const son = await prisma.ayar.findUnique({ where: { anahtar: LISTE_ANAHTAR } });
  if (son && Date.now() - Number(son.deger) < LISTE_YENILE_MS && process.env.FB_LISTE_YENILE !== "1") return;
  const gruplar = await katilinanGruplar(sayfa);
  let yuk = 0;
  for (const g of gruplar) {
    const uygun = fbYukGrubuMu(g.ad);
    if (uygun) yuk += 1;
    await prisma.ilanKaynagi.upsert({
      where: { tur_hedef: { tur: FACEBOOK_GRUP, hedef: g.id } },
      create: { tur: FACEBOOK_GRUP, hedef: g.id, ad: g.ad, aktif: uygun, durum: uygun ? "AKTIF" : "PASIF" },
      update: { ad: g.ad, aktif: uygun, durum: uygun ? "AKTIF" : "PASIF" },
    });
  }
  // Hesap değişti / gruptan çıkıldı: listede olmayan gruplar okunmasın
  if (gruplar.length > 0) {
    await prisma.ilanKaynagi.updateMany({
      where: { tur: FACEBOOK_GRUP, hedef: { notIn: gruplar.map((g) => g.id) } },
      data: { aktif: false, durum: "PASIF" },
    });
  }
  await prisma.ayar.upsert({ where: { anahtar: LISTE_ANAHTAR }, create: { anahtar: LISTE_ANAHTAR, deger: String(Date.now()) }, update: { deger: String(Date.now()) } });
  console.log(`[facebook] grup listesi: ${gruplar.length} grup, yük grubu ${yuk}`);
}

async function oturumUyarisi(mesaj: string): Promise<void> {
  const gun = new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);
  const k = await prisma.ayar.findUnique({ where: { anahtar: UYARI_ANAHTAR } });
  if (k?.deger === gun) return;
  await prisma.ayar.upsert({ where: { anahtar: UYARI_ANAHTAR }, create: { anahtar: UYARI_ANAHTAR, deger: gun }, update: { deger: gun } });
  const { bilgiBildir } = await import("@/lib/bildirim/gonder");
  await bilgiBildir(
    "Facebook doğrulama istiyor",
    "Facebook okuyucu durdu. Yedek hesapla tarayıcıdan bir kez giriş yap, Cookie-Editor ile çerezleri Claude'a ver.",
    "/ayarlar"
  ).catch(() => null);
  console.warn("[facebook]", mesaj);
}

async function main() {
  if (!fbHazirMi()) {
    console.log("[facebook] kurulu değil / kapalı — atlandı");
    return;
  }
  const { sayfa, kapat } = await fbOturumAc();
  try {
    await listeYenile(sayfa);
    const kaynaklar = await prisma.ilanKaynagi.findMany({
      where: { tur: FACEBOOK_GRUP, aktif: true, durum: "AKTIF" },
      orderBy: [{ sonTarama: { sort: "asc", nulls: "first" } }],
      take: TUR_BASINA_GRUP,
      select: { id: true, ad: true, hedef: true },
    });
    const gorulen = gorulenOku();
    let toplam = 0;
    let yeni = 0;
    for (const k of kaynaklar) {
      const gonderiler = await grupGonderileri(sayfa, k.hedef);
      const onceki = new Set(gorulen[k.hedef] ?? []);
      const ilkKez = !(k.hedef in gorulen);
      const taze = gonderiler.filter((g) => !onceki.has(g.anahtar));
      gorulen[k.hedef] = [...(gorulen[k.hedef] ?? []), ...taze.map((g) => g.anahtar)];
      toplam += gonderiler.length;
      await prisma.ilanKaynagi.update({ where: { id: k.id }, data: { sonTarama: new Date() } });
      if (ilkKez || taze.length === 0) {
        console.log(`[facebook] ${k.ad.slice(0, 40)}: ${gonderiler.length} gönderi${ilkKez ? " (ilk okuma — görüldü sayıldı)" : ", yeni yok"}`);
        continue;
      }
      const rapor = await mesajlariKuyrugaAl([
        { id: k.id, mesajlar: taze.map((g) => ({ mesajId: null, metin: g.metin, gonderenUserId: null, zaman: new Date() })) },
      ]);
      yeni += rapor.kuyruga;
      console.log(`[facebook] ${k.ad.slice(0, 40)}: ${gonderiler.length} gönderi, yeni ${taze.length}, kuyruğa ${rapor.kuyruga}`);
      await new Promise((c) => setTimeout(c, 3000 + Math.random() * 4000));
    }
    gorulenYaz(gorulen);
    console.log(`[facebook] tur bitti: ${kaynaklar.length} grup, ${toplam} gönderi, kuyruğa ${yeni}`);
  } catch (e) {
    if (e instanceof FbOturumHatasi) await oturumUyarisi(e.message);
    else throw e;
  } finally {
    await kapat();
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("[facebook] hata:", e instanceof Error ? e.message : e);
  process.exit(1);
});
