/**
 * Doğrulama scriptlerinin uygulama kodunu olduğu gibi çalıştırabilmesi için
 * "@/..." takma yolunu proje köküne bağlar. Node'un TypeScript desteği
 * uzantısız içe aktarmayı çözemediğinden uzantı da burada tamamlanır.
 */
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const kok = pathToFileURL(`${process.cwd()}/`);
const UZANTILAR = [".ts", ".tsx", "/index.ts", ""];

export function resolve(specifier, context, nextResolve) {
  if (!specifier.startsWith("@/")) return nextResolve(specifier, context);

  const taban = new URL(specifier.slice(2), kok);
  for (const ek of UZANTILAR) {
    const aday = new URL(taban.href + ek);
    if (existsSync(fileURLToPath(aday))) {
      return nextResolve(aday.href, context);
    }
  }
  return nextResolve(taban.href, context);
}
