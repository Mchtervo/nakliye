import { ILLER, ilBul, sadelestir } from "@/lib/iller";

export type BolgeKodu =
  | "MARMARA"
  | "IC_ANADOLU"
  | "EGE"
  | "AKDENIZ"
  | "KARADENIZ"
  | "DOGU_ANADOLU"
  | "GUNEYDOGU";

export type Bolge = {
  kod: BolgeKodu;
  ad: string;
  iller: string[];
  /** Grup aramasında kullanılacak ağırlıklı şehirler. */
  merkezler: string[];
};

export const BOLGELER: readonly Bolge[] = [
  {
    kod: "MARMARA",
    ad: "Marmara",
    iller: [
      "Balıkesir", "Bilecik", "Bursa", "Çanakkale", "Edirne", "İstanbul",
      "Kırklareli", "Kocaeli", "Sakarya", "Tekirdağ", "Yalova",
    ],
    merkezler: ["İstanbul", "Bursa", "Kocaeli", "Tekirdağ", "Sakarya", "Balıkesir"],
  },
  {
    kod: "IC_ANADOLU",
    ad: "İç Anadolu",
    iller: [
      "Aksaray", "Ankara", "Çankırı", "Eskişehir", "Karaman", "Kayseri",
      "Kırıkkale", "Kırşehir", "Konya", "Nevşehir", "Niğde", "Sivas", "Yozgat",
    ],
    merkezler: ["Ankara", "Konya", "Kayseri", "Eskişehir", "Sivas", "Aksaray"],
  },
  {
    kod: "EGE",
    ad: "Ege",
    iller: [
      "Afyonkarahisar", "Aydın", "Denizli", "İzmir", "Kütahya", "Manisa",
      "Muğla", "Uşak",
    ],
    merkezler: ["İzmir", "Manisa", "Denizli", "Aydın"],
  },
  {
    kod: "AKDENIZ",
    ad: "Akdeniz",
    iller: [
      "Adana", "Antalya", "Burdur", "Hatay", "Isparta", "Kahramanmaraş",
      "Mersin", "Osmaniye",
    ],
    merkezler: ["Mersin", "Adana", "Antalya", "Hatay"],
  },
  {
    kod: "KARADENIZ",
    ad: "Karadeniz",
    iller: [
      "Amasya", "Artvin", "Bartın", "Bayburt", "Bolu", "Çorum", "Düzce",
      "Giresun", "Gümüşhane", "Karabük", "Kastamonu", "Ordu", "Rize", "Samsun",
      "Sinop", "Tokat", "Trabzon", "Zonguldak",
    ],
    merkezler: ["Samsun", "Trabzon", "Ordu", "Düzce"],
  },
  {
    kod: "DOGU_ANADOLU",
    ad: "Doğu Anadolu",
    iller: [
      "Ağrı", "Ardahan", "Bingöl", "Bitlis", "Elazığ", "Erzincan", "Erzurum",
      "Hakkari", "Iğdır", "Kars", "Malatya", "Muş", "Tunceli", "Van",
    ],
    merkezler: ["Malatya", "Erzurum", "Van", "Elazığ"],
  },
  {
    kod: "GUNEYDOGU",
    ad: "Güneydoğu Anadolu",
    iller: [
      "Adıyaman", "Batman", "Diyarbakır", "Gaziantep", "Kilis", "Mardin",
      "Siirt", "Şanlıurfa", "Şırnak",
    ],
    merkezler: ["Gaziantep", "Şanlıurfa", "Diyarbakır", "Mardin"],
  },
] as const;

export const VARSAYILAN_BOLGELER: BolgeKodu[] = ["IC_ANADOLU", "MARMARA"];

const KOD_HARITASI = new Map<string, Bolge>(BOLGELER.map((b) => [b.kod, b]));

export function bolgeCozumle(ham: string | null | undefined): BolgeKodu[] {
  if (!ham) return [];
  const kodlar = ham
    .split(",")
    .map((p) => p.trim().toUpperCase())
    .filter((p): p is BolgeKodu => KOD_HARITASI.has(p));
  return [...new Set(kodlar)];
}

export function bolgeAdi(kod: BolgeKodu): string {
  return KOD_HARITASI.get(kod)?.ad ?? kod;
}

/** Seçili bölgelerin tüm illeri. Seçim yoksa 81 ilin tamamı döner. */
export function bolgeIlleri(kodlar: BolgeKodu[]): string[] {
  if (kodlar.length === 0) return [...ILLER];
  const iller = new Set<string>();
  for (const kod of kodlar) {
    for (const il of KOD_HARITASI.get(kod)?.iller ?? []) iller.add(il);
  }
  return [...iller];
}

/** Bir ilin hangi bölgeye ait olduğunu söyler. */
export function ilinBolgesi(il: string | null | undefined): BolgeKodu | null {
  const normal = ilBul(il);
  if (!normal) return null;
  for (const bolge of BOLGELER) {
    if (bolge.iller.includes(normal)) return bolge.kod;
  }
  return null;
}

/** İlan seçili bölgelerden birine değiyor mu (çıkış veya varış). */
export function bolgeyeUyuyorMu(
  kodlar: BolgeKodu[],
  cikisIl: string | null,
  varisIl: string | null
): boolean {
  if (kodlar.length === 0) return true;
  const cikis = ilinBolgesi(cikisIl);
  const varis = ilinBolgesi(varisIl);
  return (
    (cikis !== null && kodlar.includes(cikis)) ||
    (varis !== null && kodlar.includes(varis))
  );
}

// --- Grup keşfi ---------------------------------------------------------

/** Grup başlığında aranan nakliye terimleri. */
const YUK_TERIMLERI = [
  "yuk", "yük", "nakliye", "nakliyat", "tir", "tır", "lojistik", "kamyon",
  "sevkiyat", "kamyonet", "tasima", "taşıma", "spot yuk", "arac yuk",
];

/**
 * Nakliye kelimesi geçse de işimize yaramayan gruplar.
 * "Evden eve" ve benzeri şahsi taşımacılık ilanları yük ilanı değildir.
 */
const ISTENMEYEN_TERIMLER = [
  "evden eve", "ev tasima", "asansorlu", "oto kurtarma", "cekici hizmet",
  "personel tasima", "ogrenci", "emlak", "kripto", "hisse", "forex",
  "bahis", "iddaa", "sohbet", "arkadas", "ifsa", "film", "dizi", "muzik",
];

const YUK_SADE = YUK_TERIMLERI.map(sadelestir);

/**
 * Telegram global aramasında denenecek sorgular.
 * Sorgu sayısı bilinçli sınırlı: her koşuda birkaç tanesi sırayla denenir,
 * hesap üzerinde arama baskısı oluşturmamak için.
 */
export function aramaSorgulariUret(kodlar: BolgeKodu[]): string[] {
  const sorgular: string[] = ["yük ilanları", "nakliye yük", "tır yük grubu"];

  const secili = kodlar.length > 0 ? kodlar : VARSAYILAN_BOLGELER;
  for (const kod of secili) {
    const bolge = KOD_HARITASI.get(kod);
    if (!bolge) continue;
    sorgular.push(`${bolge.ad} yük`);
    for (const merkez of bolge.merkezler) {
      sorgular.push(`${merkez} yük`);
      sorgular.push(`${merkez} nakliye`);
    }
  }

  return [...new Set(sorgular)];
}

export type GrupDegerlendirme = {
  uygun: boolean;
  sebep: string;
  bolge: BolgeKodu | null;
};

/**
 * Bulunan bir grubun takip edilmeye değer olup olmadığına karar verir.
 * Başlıkta hem nakliye terimi hem de (bölge seçiliyse) bölgeye ait bir
 * şehir/bölge adı aranır; bölge adı geçmeyen genel yük grupları da kabul
 * edilir çünkü içlerinde her rotadan ilan çıkabiliyor.
 */
export function grubuDegerlendir(
  baslik: string,
  kodlar: BolgeKodu[]
): GrupDegerlendirme {
  const sade = sadelestir(baslik);
  if (!sade) return { uygun: false, sebep: "Başlık boş", bolge: null };

  for (const kotu of ISTENMEYEN_TERIMLER) {
    if (sade.includes(sadelestir(kotu))) {
      return { uygun: false, sebep: `İstenmeyen terim: ${kotu}`, bolge: null };
    }
  }

  // Nakliye terimleri ek alabildiği için ("yükleri", "nakliyeci") parça arama.
  const yukVar = YUK_SADE.some((terim) => sade.includes(terim));
  if (!yukVar) {
    return { uygun: false, sebep: "Nakliye terimi yok", bolge: null };
  }

  // Yer adları kelime bazlı aranır; "Van" ile "vantilatör" karışmasın.
  const kelimeler = new Set(sade.split(" "));
  const yerGeciyorMu = (ad: string) =>
    sadelestir(ad)
      .split(" ")
      .every((parca) => kelimeler.has(parca));

  const secili = kodlar.length > 0 ? kodlar : VARSAYILAN_BOLGELER;
  for (const kod of secili) {
    const bolge = KOD_HARITASI.get(kod);
    if (!bolge) continue;

    if (yerGeciyorMu(bolge.ad)) {
      return { uygun: true, sebep: `${bolge.ad} grubu`, bolge: kod };
    }
    for (const il of bolge.iller) {
      if (yerGeciyorMu(il)) {
        return { uygun: true, sebep: `${il} grubu`, bolge: kod };
      }
    }
  }

  // Kapsam dışı bir il adı geçiyorsa o bölgenin grubudur, alma.
  const kapsam = new Set(bolgeIlleri(secili));
  const baskaIl = ILLER.some((il) => !kapsam.has(il) && yerGeciyorMu(il));
  if (baskaIl) {
    return { uygun: false, sebep: "Kapsam dışı bölge", bolge: null };
  }

  // Şehir adı geçmiyorsa genel yük grubudur; bunlar da takibe değer.
  return { uygun: true, sebep: "Genel yük grubu", bolge: null };
}
