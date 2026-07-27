/**
 * Son işlenen ham mesajlarda AI'siz rota çıkarımı → bölge sınıflandırma.
 * Modelin yazdığı 15'i birebir getirmez; hangi rotaların "komşu / dışı"
 * sayılacağını gösterir.
 *
 *   npm run ts -- scripts/bolge-elenen-incele.ts
 */
import { prisma } from "@/lib/prisma";
import { aiTercihleriOku } from "@/lib/ayarlar";
import {
  cekirdekIlKumesi,
  genisIlKumesi,
  ilinBolgesi,
} from "@/lib/bolgeler";
import { hamRotalariCikar } from "@/lib/kaynaklar/onDedup";
import { trGunBaslangici } from "@/lib/ai/butce";

async function main() {
  const tercih = await aiTercihleriOku();
  const cekirdek = new Set(cekirdekIlKumesi(tercih.bolgeler, tercih.ekIller));
  const genis = new Set(genisIlKumesi(tercih.bolgeler, tercih.ekIller));

  console.log(`Bölgeler: ${tercih.bolgeler.join(", ") || "(yok)"}`);
  console.log(`Çekirdek il: ${cekirdek.size} · Geniş (komşu+): ${genis.size}`);
  console.log("");

  const bas = trGunBaslangici();
  const mesajlar = await prisma.hamMesaj.findMany({
    where: { islendi: true, updatedAt: { gte: bas } },
    orderBy: { updatedAt: "desc" },
    take: 40,
    select: { id: true, metin: true, updatedAt: true },
  });

  type Satir = {
    mesajId: number;
    cikis: string;
    varis: string;
    sinif: "cekirdek" | "komsu" | "dis";
    satir: string;
  };
  const satirlar: Satir[] = [];

  for (const m of mesajlar) {
    const rotalar = hamRotalariCikar(m.metin);
    for (const r of rotalar) {
      const cOk = cekirdek.has(r.cikisIl);
      const vOk = cekirdek.has(r.varisIl);
      const cG = genis.has(r.cikisIl);
      const vG = genis.has(r.varisIl);
      let sinif: Satir["sinif"];
      if (cOk || vOk) sinif = "cekirdek";
      else if (cG || vG) sinif = "komsu";
      else sinif = "dis";
      satirlar.push({
        mesajId: m.id,
        cikis: r.cikisIl,
        varis: r.varisIl,
        sinif,
        satir: r.satir.slice(0, 80),
      });
    }
  }

  const komsu = satirlar.filter((s) => s.sinif === "komsu");
  const dis = satirlar.filter((s) => s.sinif === "dis");
  const cek = satirlar.filter((s) => s.sinif === "cekirdek");

  console.log(
    `Bugün işlenen ${mesajlar.length} mesajdan ~${satirlar.length} rota (AI'siz):`
  );
  console.log(
    `  çekirdek (kayıt OK): ${cek.length} · sadece komşu: ${komsu.length} · tamamen dışı: ${dis.length}`
  );
  console.log("");
  console.log(
    "ESKİ BUG: prompt genişi istiyordu, filtre çekirdekti → komşu satırlar BÖLGE_ELE oluyordu."
  );
  console.log("Komşu rotalar (eski sistemde elenen adaylar):");
  for (const s of komsu.slice(0, 40)) {
    const cb = ilinBolgesi(s.cikis) || "?";
    const vb = ilinBolgesi(s.varis) || "?";
    console.log(
      `  #${s.mesajId} ${s.cikis}→${s.varis} [${cb}/${vb}] | ${s.satir}`
    );
  }
  if (komsu.length === 0) console.log("  (yok)");

  console.log("");
  console.log("Tamamen dışı (hâlâ elenir — doğru):");
  for (const s of dis.slice(0, 25)) {
    console.log(`  #${s.mesajId} ${s.cikis}→${s.varis} | ${s.satir}`);
  }
  if (dis.length === 0) console.log("  (yok)");

  // Bugünkü KESILDI özeti
  const kesilen = await prisma.aiCagri.findMany({
    where: { zaman: { gte: bas }, hata: { startsWith: "KESILDI" } },
    orderBy: { zaman: "desc" },
    select: {
      zaman: true,
      kaynak: true,
      ciktiToken: true,
      maliyetMikro: true,
      hata: true,
    },
  });
  console.log("");
  console.log(`Bugün KESILDI: ${kesilen.length}`);
  for (const k of kesilen) {
    console.log(
      `  ${k.zaman.toISOString()} ${k.kaynak} out=${k.ciktiToken} $${(k.maliyetMikro / 1e6).toFixed(4)} ${k.hata}`
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
