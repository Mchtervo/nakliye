/**
 * Aşama 2 entegrasyon testi.
 * Çalıştır: node tests/asama2.mjs
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE_URL || "http://localhost:3000";
const prisma = new PrismaClient();

let gecen = 0;
let kalan = 0;

function assert(kosul, ad) {
  if (kosul) {
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
  console.log("Test sunucusu:", BASE);

  for (const yol of ["/", "/giderler", "/giderler/yeni", "/muhasebeci", "/yukler", "/yukler/yeni"]) {
    const r = await get(yol);
    assert(r.status === 200, `${yol} -> 200 (aldık: ${r.status})`);
  }

  const formSayfa = await get("/giderler/yeni");
  assert(formSayfa.text.includes("Fiş") || formSayfa.text.includes("fis"), "Gider formunda fiş alanı");
  assert(
    formSayfa.text.includes("Kamerayla") || formSayfa.text.includes("Galeriden"),
    "Kamera/galeri buton metinleri"
  );

  // Fiş dosyasını public/uploads'a kaydet (fisKaydet mantığının aynısı)
  const png = readFileSync(path.join(__dirname, "ornek-fis.png"));
  const uploadDir = path.join(process.cwd(), "public", "uploads");
  mkdirSync(uploadDir, { recursive: true });
  const dosyaAdi = `test-${Date.now()}-${randomUUID().slice(0, 8)}.png`;
  const fisYolu = `/uploads/${dosyaAdi}`;
  writeFileSync(path.join(uploadDir, dosyaAdi), png);

  const bugun = new Date();
  bugun.setHours(0, 0, 0, 0);

  const gider = await prisma.gider.create({
    data: {
      tarih: bugun,
      kategori: "YAKIT",
      aciklama: "Shell fiş test",
      kdvli: true,
      kdvDahilMi: true,
      netTutar: 300000,
      kdvTutar: 60000,
      toplamTutar: 360000,
      fisResmi: fisYolu,
      gonderildi: false,
    },
  });

  assert(gider.id > 0, `Gider oluşturuldu id=${gider.id}`);
  assert(existsSync(path.join(uploadDir, dosyaAdi)), "Fiş dosyası diskte");

  const img = await get(fisYolu);
  assert(img.status === 200, `Fiş static URL 200 (aldık: ${img.status})`);

  const liste = await get("/giderler");
  assert(liste.text.includes("Shell fiş test"), "Gider listesinde Shell fiş test");
  assert(liste.text.includes(fisYolu) || liste.text.includes(dosyaAdi), "Listede fiş thumbnail yolu");

  const muh = await get("/muhasebeci");
  assert(muh.text.includes("Muhasebeciye") || muh.text.includes("Toplu"), "Muhasebeci sayfası");
  assert(muh.text.includes("Shell") || muh.text.includes("Yakıt"), "Muhasebeci sayfasında fiş görünüyor");

  const zipBos = await fetch(BASE + "/api/fis-zip", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids: [] }),
  });
  assert(zipBos.status === 400, `Boş ZIP 400 (aldık: ${zipBos.status})`);

  const zip = await fetch(BASE + "/api/fis-zip", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids: [gider.id] }),
  });
  assert(zip.status === 200, `ZIP API 200 (aldık: ${zip.status})`);
  const buf = Buffer.from(await zip.arrayBuffer());
  assert(buf.length > 20 && buf[0] === 0x50 && buf[1] === 0x4b, `ZIP PK imzası (boyut=${buf.length})`);

  // Telefon formatı — actions içindeki mantığın bir kopyasını doğrula
  function normalize(telefonHam) {
    let telefon = telefonHam.trim().replace(/[\s\-()]/g, "");
    if (telefon.startsWith("00")) telefon = "+" + telefon.slice(2);
    if (telefon.startsWith("0")) telefon = "+90" + telefon.slice(1);
    if (!telefon.startsWith("+") && /^90\d{10}$/.test(telefon)) telefon = "+" + telefon;
    if (!telefon.startsWith("+") && /^5\d{9}$/.test(telefon)) telefon = "+90" + telefon;
    return /^\+\d{10,15}$/.test(telefon) ? telefon : null;
  }
  assert(normalize("05321234567") === "+905321234567", "Telefon 05xx -> +90");
  assert(normalize("abc") === null, "Geçersiz telefon reddedilir");
  assert(normalize("+905321234567") === "+905321234567", "Zaten +90 formatı");

  await prisma.ayar.upsert({
    where: { anahtar: "muhasebeci_telefon" },
    create: { anahtar: "muhasebeci_telefon", deger: "+905321234567" },
    update: { deger: "+905321234567" },
  });
  const muh2 = await get("/muhasebeci");
  assert(
    muh2.text.includes("05321234567") ||
      muh2.text.includes("+905321234567") ||
      muh2.text.includes("905321234567"),
    "Kayıtlı muhasebeci numarası sayfada"
  );

  // Gönderildi işaretleme
  await prisma.gider.update({
    where: { id: gider.id },
    data: { gonderildi: true, gonderimTarihi: new Date() },
  });
  const muh3 = await get("/muhasebeci");
  assert(
    muh3.text.includes("gönderildi") || muh3.text.includes("Gönderildi"),
    "Gönderildi işareti görünüyor"
  );

  // Nav linki
  const panel = await get("/");
  assert(panel.text.includes("/muhasebeci") || panel.text.includes("Gönder"), "Nav'da Gönder/muhasebeci");

  await prisma.$disconnect();
  console.log(`\nSonuç: ${gecen} geçti, ${kalan} kaldı`);
  process.exit(kalan > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
