/**
 * Okuyucu (daemon) ve betikler Node'un "yalnız tip sil" kipiyle çalışır
 * (scripts/ts-kayit.mjs). Site derlemesi (Next) daha geniş TypeScript kabul eder:
 * enum, namespace, constructor'da readonly parametre gibi yazımlar derlemeden
 * geçip okuyucuyu canlıda düşürüyordu. Deploy öncesi scripts/ ve lib/ altındaki
 * tüm .ts dosyaları Node'un kendi tip silicisiyle denenir.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import path from "node:path";

const kok = process.cwd();
function dosyalar(dizin) {
  const sonuc = [];
  for (const ad of readdirSync(dizin)) {
    const tam = path.join(dizin, ad);
    if (statSync(tam).isDirectory()) sonuc.push(...dosyalar(tam));
    else if (ad.endsWith(".ts") && !ad.endsWith(".d.ts")) sonuc.push(tam);
  }
  return sonuc;
}

let hata = 0;
let sayi = 0;
for (const dizin of ["scripts", "lib"]) {
  for (const dosya of dosyalar(path.join(kok, dizin))) {
    sayi += 1;
    try {
      stripTypeScriptTypes(readFileSync(dosya, "utf8"), { mode: "strip" });
    } catch (e) {
      hata += 1;
      console.error(`${path.relative(kok, dosya)} — ${e instanceof Error ? e.message.split("\n")[0] : e}`);
    }
  }
}
if (hata > 0) {
  console.error(`Sözdizimi hatası: ${hata} dosya`);
  process.exit(1);
}
console.log(`sözdizimi temiz (${sayi} dosya)`);
