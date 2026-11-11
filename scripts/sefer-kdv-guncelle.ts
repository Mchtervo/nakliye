/**
 * Eski seferlere sefer KDV kuralını uygular (10.000 TL üstü %16, altı %20).
 *
 *   npm run ts -- scripts/sefer-kdv-guncelle.ts            → yalnız rapor (hiçbir şey değişmez)
 *   npm run ts -- scripts/sefer-kdv-guncelle.ts --uygula   → önce yedek yazar, sonra günceller
 *   npm run ts -- scripts/sefer-kdv-guncelle.ts --geri-al <yedek.json>  → yedekteki eski değerleri geri yazar
 *
 * Girilen tutar: "KDV hariç" seferde net, "KDV dahil" seferde toplam (form böyle çalışır).
 * - KDV hariç sefer: net aynı kalır, KDV ve toplam (alacak) düşer.
 * - KDV dahil sefer: toplam aynı kalır, net artar, KDV düşer.
 * KDV'siz seferlere ve 10.000 TL ve altındakilere dokunulmaz.
 * Yönetici defteri + tüm üye defterleri işlenir. Ödeme durumu yeni toplama göre yeniden hesaplanır.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { anaPrisma } from "@/lib/prismaAna";
import { uyeAdinaCalistir } from "@/lib/baglam";
import { kdvHesapla, seferKdvOrani, SEFER_KDV_SINIR_KURUS, tlYaz } from "@/lib/para";

type Deger = { netTutar: number; kdvTutar: number; toplamTutar: number; odemeDurumu: string };
type Eski = Deger & { defter: string; id: number };
type Degisiklik = { eski: Eski; yeni: Deger };
type Defter = { ad: string; calistir: <T>(fn: () => Promise<T>) => Promise<T> };

function durum(odenen: number, toplam: number): string {
  if (odenen <= 0) return "BEKLIYOR";
  return odenen >= toplam ? "ODENDI" : "KISMI";
}

/** Yalnız hesaplar ve raporlar; yazmaz. */
async function defteriHesapla(defter: string): Promise<Degisiklik[]> {
  const seferler = await prisma.yuk.findMany({
    where: { kdvli: true },
    select: { id: true, kdvDahilMi: true, netTutar: true, kdvTutar: true, toplamTutar: true, odemeDurumu: true, odemeler: { select: { tutar: true } } },
  });
  const degisiklikler: Degisiklik[] = [];
  let kdvOnce = 0;
  let kdvSonra = 0;
  let toplamOnce = 0;
  let toplamSonra = 0;
  for (const s of seferler) {
    const girilen = s.kdvDahilMi ? s.toplamTutar : s.netTutar;
    if (girilen <= SEFER_KDV_SINIR_KURUS) continue;
    const yeni = kdvHesapla(girilen, true, s.kdvDahilMi, seferKdvOrani(girilen));
    if (yeni.netTutar === s.netTutar && yeni.kdvTutar === s.kdvTutar && yeni.toplamTutar === s.toplamTutar) continue;
    kdvOnce += s.kdvTutar;
    kdvSonra += yeni.kdvTutar;
    toplamOnce += s.toplamTutar;
    toplamSonra += yeni.toplamTutar;
    const odenen = s.odemeler.reduce((t, o) => t + o.tutar, 0);
    degisiklikler.push({
      eski: { defter, id: s.id, netTutar: s.netTutar, kdvTutar: s.kdvTutar, toplamTutar: s.toplamTutar, odemeDurumu: s.odemeDurumu },
      yeni: { ...yeni, odemeDurumu: durum(odenen, yeni.toplamTutar) },
    });
  }
  console.log(
    `${defter}: KDV'li sefer=${seferler.length} değişecek=${degisiklikler.length} | KDV ${tlYaz(kdvOnce)} → ${tlYaz(kdvSonra)} | toplam ${tlYaz(toplamOnce)} → ${tlYaz(toplamSonra)}`
  );
  return degisiklikler;
}

async function defterler(): Promise<Defter[]> {
  const uyeler = await anaPrisma.uye.findMany({ where: { kurulumBitti: { not: null } }, select: { id: true, kullaniciAdi: true } });
  return [
    { ad: "yönetici", calistir: (fn) => fn() },
    ...uyeler.map((u): Defter => ({ ad: `üye ${u.id} (${u.kullaniciAdi})`, calistir: (fn) => uyeAdinaCalistir(u.id, fn) })),
  ];
}

async function geriAl(dosya: string) {
  const kayitlar = JSON.parse(await readFile(dosya, "utf8")) as Eski[];
  let adet = 0;
  for (const d of await defterler()) {
    const bunlar = kayitlar.filter((k) => k.defter === d.ad);
    await d.calistir(async () => {
      for (const k of bunlar) {
        const n = await prisma.yuk.updateMany({
          where: { id: k.id },
          data: { netTutar: k.netTutar, kdvTutar: k.kdvTutar, toplamTutar: k.toplamTutar, odemeDurumu: k.odemeDurumu },
        });
        adet += n.count;
      }
    });
  }
  console.log(`Geri alındı: ${adet}/${kayitlar.length} sefer (${dosya})`);
}

async function main() {
  const geriIndeks = process.argv.indexOf("--geri-al");
  if (geriIndeks > 0) return geriAl(process.argv[geriIndeks + 1]);

  const uygula = process.argv.includes("--uygula");
  const plan: { d: Defter; degisiklikler: Degisiklik[] }[] = [];
  // Bir defter okunamazsa hata fırlar, hiçbir şey yazılmaz (yarım güncelleme olmasın)
  for (const d of await defterler()) {
    plan.push({ d, degisiklikler: await d.calistir(() => defteriHesapla(d.ad)) });
  }
  const toplam = plan.reduce((t, p) => t + p.degisiklikler.length, 0);
  if (!uygula) {
    console.log(`\nRAPOR (hiçbir şey değişmedi): ${toplam} sefer güncellenecek. Uygulamak için --uygula ekle.`);
    return;
  }
  if (toplam === 0) {
    console.log("\nGüncellenecek sefer yok.");
    return;
  }
  // Önce yedek, sonra yazma
  const klasor = path.join(process.env.HOME || ".", "backups");
  await mkdir(klasor, { recursive: true });
  const dosya = path.join(klasor, `sefer-kdv-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  await writeFile(dosya, JSON.stringify(plan.flatMap((p) => p.degisiklikler.map((x) => x.eski))), "utf8");
  console.log(`\nYedek yazıldı: ${dosya}`);
  let yazilan = 0;
  for (const p of plan) {
    await p.d.calistir(async () => {
      for (const x of p.degisiklikler) {
        await prisma.yuk.update({ where: { id: x.eski.id }, data: x.yeni });
        yazilan += 1;
      }
    });
  }
  console.log(`UYGULANDI: ${yazilan}/${toplam} sefer güncellendi. Geri almak için: --geri-al ${dosya}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
