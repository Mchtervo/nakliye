/**
 * Emoji gibi çift kodlu karakterler sabit uzunlukta kırpılınca ortadan
 * bölünür; geriye kalan yarım karakter JSON gövdesini bozar ve OpenAI
 * isteği 400 döner. Kırpma bu yüzden yarım karakter bırakmamalı.
 */
const YALNIZ_VEKIL =
  /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

/** Metni verilen uzunluğa indirir, yarım kalan karakterleri atar. */
export function guvenliKirp(metin: string, uzunluk: number): string {
  const kirpik = metin.length > uzunluk ? metin.slice(0, uzunluk) : metin;
  return kirpik.replace(YALNIZ_VEKIL, "");
}
