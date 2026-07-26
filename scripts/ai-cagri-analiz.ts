/**
 * Bugünkü AiCagri dağılımı — test mi cron mu?
 *   npm run ai:cagri-analiz
 */
import { prisma } from "@/lib/prisma";

function trSaat(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  })
    .format(d)
    .replace(", ", " ");
}

async function main() {
  const gun = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
  }).format(new Date());
  const bas = new Date(`${gun}T00:00:00+03:00`);

  const cagrilar = await prisma.aiCagri.findMany({
    where: { zaman: { gte: bas } },
    orderBy: { zaman: "asc" },
    select: {
      zaman: true,
      kaynak: true,
      model: true,
      girdiToken: true,
      ciktiToken: true,
      reasoningToken: true,
      maliyetMikro: true,
      basarili: true,
      hata: true,
    },
  });

  console.log(`=== AiCagri bugün (${gun}) · ${cagrilar.length} çağrı ===\n`);

  const saat = new Map<string, { n: number; mikro: number }>();
  const kaynak = new Map<string, { n: number; mikro: number }>();
  let toplamMikro = 0;

  for (const c of cagrilar) {
    const s = trSaat(c.zaman).slice(0, 13); // YYYY-MM-DD HH
    const sk = saat.get(s) ?? { n: 0, mikro: 0 };
    sk.n += 1;
    sk.mikro += c.maliyetMikro;
    saat.set(s, sk);

    const kok = c.kaynak.split(".")[0] || c.kaynak;
    const kk = kaynak.get(c.kaynak) ?? { n: 0, mikro: 0 };
    kk.n += 1;
    kk.mikro += c.maliyetMikro;
    kaynak.set(c.kaynak, kk);
    toplamMikro += c.maliyetMikro;
  }

  console.log("── Saat (Europe/Istanbul) ──");
  for (const [k, v] of [...saat.entries()].sort()) {
    console.log(
      `${k}:00 · ${v.n} çağrı · $${(v.mikro / 1e6).toFixed(4)}`
    );
  }

  console.log("\n── Kaynak (dosya) ──");
  for (const [k, v] of [...kaynak.entries()].sort((a, b) => b[1].n - a[1].n)) {
    console.log(
      `${k} · ${v.n} · $${(v.mikro / 1e6).toFixed(4)}`
    );
  }

  const ilan = cagrilar.filter((c) => c.kaynak.startsWith("ilanCozumle"));
  const diger = cagrilar.filter((c) => !c.kaynak.startsWith("ilanCozumle"));
  console.log(`\n── Yorum ──`);
  console.log(
    `ilanCozumle*: ${ilan.length} (kuyruk çözümü = test veya cron; AI_KAPALI iken cron atlar → büyük ihtimal TEST)`
  );
  console.log(`diğer: ${diger.length}`);
  console.log(`toplam $: ${(toplamMikro / 1e6).toFixed(4)}`);
  console.log(
    `\nNot: 10 mesaj ≠ 10 çağrı. parti.p1…pN = aynı 10 mesajın rota parçaları.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
