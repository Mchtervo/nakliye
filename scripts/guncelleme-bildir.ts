/**
 * Deploy sonrası telefona "güncelleme hazır" push'u. Dokununca /?guncelle=1
 * açılır; uygulama önbelleği temizleyip yeni sürümü yükler.
 *   npm run ts -- scripts/guncelleme-bildir.ts "commit mesajı"
 */
import { prisma } from "@/lib/prisma";
import { pushGonder, pushKullanilabilir } from "@/lib/bildirim/push";

async function main() {
  if (!pushKullanilabilir()) {
    console.log("[guncelleme-bildir] push kapalı — atlandı");
    return;
  }
  const mesaj = process.argv.slice(2).join(" ").trim();
  const r = await pushGonder({
    baslik: "Güncelleme hazır",
    metin: mesaj ? `${mesaj.slice(0, 120)} — dokun, güncellensin` : "Dokun, uygulama güncellensin",
    url: "/?guncelle=1",
  });
  console.log(`[guncelleme-bildir] ${r.gonderilen}/${r.abone} ${r.hata ?? ""}`);
}

main()
  .catch((e) => {
    console.error("[guncelleme-bildir]", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
