/**
 * scripts/*.ts dosyalarını sözdizimi için denetler (tip denetimi değil).
 * Site derlemesi bu klasörü kapsamaz; bozuk bir okuyucu (daemon) dosyası
 * canlıya çıkıp servisi düşürmesin diye deploy öncesi çalışır.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

const dizin = path.join(process.cwd(), "scripts");
let hata = 0;
for (const ad of readdirSync(dizin)) {
  if (!ad.endsWith(".ts")) continue;
  const kaynak = readFileSync(path.join(dizin, ad), "utf8");
  const r = ts.transpileModule(kaynak, {
    reportDiagnostics: true,
    fileName: ad,
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ESNext },
  });
  for (const d of r.diagnostics ?? []) {
    hata += 1;
    const yer = d.file && d.start != null ? d.file.getLineAndCharacterOfPosition(d.start) : null;
    console.error(`scripts/${ad}${yer ? `:${yer.line + 1}` : ""} — ${ts.flattenDiagnosticMessageText(d.messageText, " ")}`);
  }
}
if (hata > 0) {
  console.error(`Sözdizimi hatası: ${hata}`);
  process.exit(1);
}
console.log("scripts sözdizimi temiz");
