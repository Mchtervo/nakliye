/**
 * Son 36 saat AiCagri — $0.25 ne yedi?
 *   npm run ai:butce-dokum
 */
import { prisma } from "@/lib/prisma";
import { mikrodolarYaz } from "@/lib/ai/maliyet";
import { trGunBaslangici, butceKesildiMi } from "@/lib/ai/butce";

function trEtiket(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  })
    .format(d)
    .replace(", ", " ");
}

async function main() {
  const simdi = new Date();
  const bas36 = new Date(simdi.getTime() - 36 * 60 * 60 * 1000);
  const bugunBas = trGunBaslangici(simdi);

  const cagrilar = await prisma.aiCagri.findMany({
    where: { zaman: { gte: bas36 } },
    orderBy: { zaman: "asc" },
    select: {
      zaman: true,
      kaynak: true,
      maliyetMikro: true,
    },
  });

  const saat = new Map<string, { n: number; mikro: number }>();
  let toplam = 0;
  let bugunToplam = 0;
  for (const c of cagrilar) {
    const k = trEtiket(c.zaman);
    const s = saat.get(k) ?? { n: 0, mikro: 0 };
    s.n += 1;
    s.mikro += c.maliyetMikro;
    saat.set(k, s);
    toplam += c.maliyetMikro;
    if (c.zaman >= bugunBas) bugunToplam += c.maliyetMikro;
  }

  console.log(
    `=== Son 36 saat · ${cagrilar.length} çağrı · ${mikrodolarYaz(toplam)} ===\n`
  );
  console.log("── Saat başı (TR) ──");
  for (const [k, v] of [...saat.entries()].sort()) {
    const bar = v.mikro >= 40_000 ? " ◄" : "";
    console.log(
      `${k}:00 · ${String(v.n).padStart(3)} çağrı · ${mikrodolarYaz(v.mikro)}${bar}`
    );
  }

  const limitMikro = Math.round(0.25 * 1e6);
  let biriken = 0;
  let kesimZaman: Date | null = null;
  const bugunCagri = cagrilar.filter((c) => c.zaman >= bugunBas);
  for (const c of bugunCagri) {
    biriken += c.maliyetMikro;
    if (biriken >= limitMikro && !kesimZaman) kesimZaman = c.zaman;
  }

  console.log(`\n── Bugün ──`);
  console.log(`Çağrı: ${bugunCagri.length} · ${mikrodolarYaz(bugunToplam)}`);
  console.log(`Bütçe kesildi mi: ${(await butceKesildiMi()) ? "evet" : "hayır"}`);
  if (kesimZaman && bugunCagri[0]) {
    const dk = Math.round(
      (kesimZaman.getTime() - bugunCagri[0].zaman.getTime()) / 60000
    );
    console.log(
      `$0.25 eşiği: ${trEtiket(kesimZaman)}:xx (ilk çağrıdan ~${dk} dk)`
    );
  }

  // 00–06 vs 06+ ayrımı (birikmiş kuyruk vs sabah)
  let geceMikro = 0;
  let sabahMikro = 0;
  for (const c of bugunCagri) {
    const h = Number(trEtiket(c.zaman).slice(-2));
    if (h < 6) geceMikro += c.maliyetMikro;
    else sabahMikro += c.maliyetMikro;
  }
  console.log(
    `00–05 (gece): ${mikrodolarYaz(geceMikro)} · 06+: ${mikrodolarYaz(sabahMikro)}`
  );

  const ilanBugun = await prisma.yukIlani.count({
    where: { createdAt: { gte: bugunBas } },
  });
  const hamBekleyen = await prisma.hamMesaj.count({
    where: { islendi: false },
  });
  console.log(`Bugün yeni ilan: ${ilanBugun} · hâlâ bekleyen ham: ${hamBekleyen}`);

  const aktif = [...saat.values()].filter((v) => v.n > 0);
  const ort =
    aktif.length > 0
      ? aktif.reduce((t, v) => t + v.mikro, 0) / aktif.length
      : 0;
  console.log(`\n── Projeksiyon ──`);
  console.log(`Ort. aktif saat: ${mikrodolarYaz(ort)}`);
  console.log(
    `$0.25 bu temposa ~${ort > 0 ? Math.round(250_000 / ort) : "?"} saat`
  );
  console.log(
    `Normal gün (16 saat × ort): ~${mikrodolarYaz(ort * 16)} — $0.25 sabah birikimi için dar; $0.75–1.00 daha gerçekçi.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
