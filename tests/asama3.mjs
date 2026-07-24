/**
 * Aşama 3: firma cari + raporlar
 */
import { PrismaClient } from "@prisma/client";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const prisma = new PrismaClient();
let gecen = 0;
let kalan = 0;

function assert(k, ad) {
  if (k) {
    console.log("PASS:", ad);
    gecen++;
  } else {
    console.error("FAIL:", ad);
    kalan++;
  }
}

async function get(yol) {
  const r = await fetch(BASE + yol);
  return { status: r.status, text: await r.text() };
}

async function main() {
  const firma = await prisma.firma.findFirst({ orderBy: { id: "asc" } });
  assert(!!firma, "En az bir firma var");

  for (const yol of ["/firmalar", "/raporlar", firma ? `/firmalar/${firma.id}` : "/firmalar"]) {
    const r = await get(yol);
    assert(r.status === 200, `${yol} -> 200 (${r.status})`);
  }

  const firmalar = await get("/firmalar");
  assert(firmalar.text.includes("Cari") || firmalar.text.includes("Firma"), "Firmalar başlığı");
  if (firma) {
    assert(firmalar.text.includes(firma.ad), `Firma listesinde ${firma.ad}`);
  }

  const rapor = await get("/raporlar");
  assert(rapor.text.includes("Raporlar"), "Raporlar başlığı");
  assert(
    rapor.text.includes("Gelir") && rapor.text.includes("Gider"),
    "Raporlarda gelir/gider"
  );
  assert(
    rapor.text.includes("Firma bazlı") || rapor.text.includes("kategori"),
    "Rapor grafik bölümleri"
  );

  if (firma) {
    const detay = await get(`/firmalar/${firma.id}`);
    assert(detay.text.includes(firma.ad), "Firma detay adı");
    assert(
      detay.text.includes("Kalan") || detay.text.includes("alacak") || detay.text.includes("Ciro") || detay.text.includes("ciro"),
      "Firma detay özet kartları"
    );
  }

  const yok = await get("/firmalar/999999");
  assert(yok.status === 404, `Olmayan firma 404 (aldık: ${yok.status})`);

  const panel = await get("/");
  assert(panel.text.includes("/firmalar"), "Panelde firmalar linki");
  assert(panel.text.includes("/raporlar"), "Panelde raporlar linki");

  await prisma.$disconnect();
  console.log(`\nSonuç: ${gecen} geçti, ${kalan} kaldı`);
  process.exit(kalan > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
