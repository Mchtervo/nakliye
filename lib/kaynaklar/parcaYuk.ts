/**
 * Parça (parsiyel) yük: tırı doldurmayan küçük yük — "1 palet 500 kg",
 * "parça yük", "parsiyel", "6 metre yer". Şimdilik kayda alınmaz (ELENDI).
 *
 * Toplu mesajda yalnız o ilanın rota satırı taranır; tek rotalı mesajda
 * (palet/kg bilgisi çoğu zaman ayrı satırda) bütün metin taranır.
 */
import { illeriBul, sadelestir } from "@/lib/iller";
import { rotaSatiriniBul } from "@/lib/kaynaklar/rotaDogrula";

export const PARCA_YUK_ANAHTAR = "ai_parca_yuk_getir";

const PARCA = /\b(parca|parsiyel|parsiyal|kismi yuk)\b(?!\s*(olmaz|olmasin|yok|alinmaz|almiyoruz|kabul))/;
/** 1–12 palet (tam tır ~33 palet) */
const PALET = /\b([1-9]|1[0-2])\s*(adet\s*)?palet\b/;
const KG = /\b(\d{1,3}(?:[.,]\d{3})?|\d{2,5})\s*(kg|kilo)\b/g;
const YER = /\b\d{1,2}(?:[.,]\d+)?\s*(metre|mt|m)\s*yer\b/;
const PARCA_TON = 3;
/** Bu tonajın üstü parça sayılmaz (listede başka satırın paleti karışmasın). */
const TAM_TON = 10;

function kucukKg(metin: string): boolean {
  for (const m of metin.matchAll(KG)) {
    const kg = Number(m[1].replace(/[.,]/g, ""));
    if (kg > 0 && kg < 5000) return true;
  }
  return false;
}

function metinParcaMi(ham: string): boolean {
  const s = sadelestir(ham);
  return PARCA.test(s) || PALET.test(s) || YER.test(s) || kucukKg(s);
}

export function parcaYukMu(
  ilan: { yukTipi?: string | null; tonaj: number | null; nereden?: string | null; nereye?: string | null },
  hamMetin: string
): boolean {
  if (ilan.tonaj != null && ilan.tonaj >= TAM_TON) return false;
  if (ilan.tonaj != null && ilan.tonaj > 0 && ilan.tonaj <= PARCA_TON) return true;
  if (ilan.yukTipi && metinParcaMi(ilan.yukTipi)) return true;
  const satir = rotaSatiriniBul(ilan.nereden ?? null, ilan.nereye ?? null, hamMetin);
  if (satir && metinParcaMi(satir)) return true;
  // Tek ilanlık mesaj: yükleme + indirme satırından fazla yer adı geçmiyor
  const satirIlleri = hamMetin.split(/\n+/).map((l) => new Set(illeriBul(l)).size).filter((n) => n > 0);
  const tekIlan = satirIlleri.length <= 2 && satirIlleri.filter((n) => n >= 2).length <= 1;
  return tekIlan && hamMetin.length < 600 && metinParcaMi(hamMetin);
}
