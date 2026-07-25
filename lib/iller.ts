export const ILLER = [
  "Adana", "Adıyaman", "Afyonkarahisar", "Ağrı", "Aksaray", "Amasya", "Ankara",
  "Antalya", "Ardahan", "Artvin", "Aydın", "Balıkesir", "Bartın", "Batman",
  "Bayburt", "Bilecik", "Bingöl", "Bitlis", "Bolu", "Burdur", "Bursa",
  "Çanakkale", "Çankırı", "Çorum", "Denizli", "Diyarbakır", "Düzce", "Edirne",
  "Elazığ", "Erzincan", "Erzurum", "Eskişehir", "Gaziantep", "Giresun",
  "Gümüşhane", "Hakkari", "Hatay", "Iğdır", "Isparta", "İstanbul", "İzmir",
  "Kahramanmaraş", "Karabük", "Karaman", "Kars", "Kastamonu", "Kayseri",
  "Kırıkkale", "Kırklareli", "Kırşehir", "Kilis", "Kocaeli", "Konya",
  "Kütahya", "Malatya", "Manisa", "Mardin", "Mersin", "Muğla", "Muş",
  "Nevşehir", "Niğde", "Ordu", "Osmaniye", "Rize", "Sakarya", "Samsun",
  "Siirt", "Sinop", "Sivas", "Şanlıurfa", "Şırnak", "Tekirdağ", "Tokat",
  "Trabzon", "Tunceli", "Uşak", "Van", "Yalova", "Yozgat", "Zonguldak",
] as const;

/** Yaygın ilçe / liman / semt adlarının bağlı olduğu il. */
const TAKMA_ADLAR: Record<string, string> = {
  istanbul: "İstanbul",
  ist: "İstanbul",
  tuzla: "İstanbul",
  gebze: "Kocaeli",
  izmit: "Kocaeli",
  korfez: "Kocaeli",
  derince: "Kocaeli",
  dilovasi: "Kocaeli",
  cerkezkoy: "Tekirdağ",
  corlu: "Tekirdağ",
  cayirova: "Kocaeli",
  aliaga: "İzmir",
  torbali: "İzmir",
  kemalpasa: "İzmir",
  nilufer: "Bursa",
  inegol: "Bursa",
  gemlik: "Bursa",
  mudanya: "Bursa",
  iskenderun: "Hatay",
  antakya: "Hatay",
  mersinliman: "Mersin",
  icel: "Mersin",
  maras: "Kahramanmaraş",
  urfa: "Şanlıurfa",
  antep: "Gaziantep",
  afyon: "Afyonkarahisar",
  sivrihisar: "Eskişehir",
  polatli: "Ankara",
  sincan: "Ankara",
  kazan: "Ankara",
  ostim: "Ankara",
  ivedik: "Ankara",
};

/** Türkçe karakterleri sadeleştirip küçük harfe indirir. */
export function sadelestir(metin: string): string {
  return metin
    .toLocaleLowerCase("tr-TR")
    .replaceAll("ı", "i")
    .replaceAll("ğ", "g")
    .replaceAll("ü", "u")
    .replaceAll("ş", "s")
    .replaceAll("ö", "o")
    .replaceAll("ç", "c")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const IL_ARAMA = new Map<string, string>();
for (const il of ILLER) IL_ARAMA.set(sadelestir(il), il);
for (const [takma, il] of Object.entries(TAKMA_ADLAR)) {
  IL_ARAMA.set(sadelestir(takma), il);
}

/**
 * Serbest metinden il adını bulur. "Ankara Ostim", "ist/tuzla" gibi
 * girdilerde de çalışır. Bulamazsa null döner.
 */
export function ilBul(metin: string | null | undefined): string | null {
  if (!metin) return null;
  const sade = sadelestir(metin);
  if (!sade) return null;

  const tam = IL_ARAMA.get(sade);
  if (tam) return tam;

  for (const kelime of sade.split(" ")) {
    const bulunan = IL_ARAMA.get(kelime);
    if (bulunan) return bulunan;
  }

  // Bitişik yazımlar için ("istanbultuzla")
  for (const [anahtar, il] of IL_ARAMA) {
    if (anahtar.length >= 4 && sade.includes(anahtar)) return il;
  }

  return null;
}

/** İki konumun aynı ile işaret edip etmediğini söyler. */
export function ayniIlMi(a: string | null, b: string | null): boolean {
  const ilA = ilBul(a);
  const ilB = ilBul(b);
  return Boolean(ilA && ilB && ilA === ilB);
}
