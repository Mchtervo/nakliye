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

/**
 * Bölgeye komşu olan, bölge dışındaki iller.
 *
 * Sadece bölge illeri alınırsa sınırın hemen ötesindeki yükler kaçıyor:
 * Bursa'da olan bir araç için Kütahya veya Manisa yükü de iştir. Öte
 * yandan tüm Türkiye'yi çözümlemek boşuna token yakıyor.
 */
const BOLGE_KOMSULARI: Record<BolgeKodu, string[]> = {
  // İzmir komşu kaldı (Bursa/Balıkesir için); uzak Akdeniz yok.
  MARMARA: ["Bolu", "Düzce", "Kütahya", "Manisa", "İzmir", "Eskişehir"],
  // Adana/Antalya/Mersin/Malatya komşu DEĞİL — "İç Anadolu" seçince
  // Akdeniz-Doğu yükleri kayda düşmesin.
  IC_ANADOLU: [
    "Bolu", "Kastamonu", "Karabük", "Çorum", "Amasya", "Tokat",
    "Isparta", "Afyonkarahisar", "Kütahya", "Bilecik", "Bursa",
  ],
  EGE: [
    "Balıkesir", "Bursa", "Bilecik", "Eskişehir", "Konya", "Karaman",
    "Isparta", "Burdur", "Antalya", "Çanakkale",
  ],
  AKDENIZ: [
    "Muğla", "Denizli", "Afyonkarahisar", "Konya", "Karaman", "Niğde",
    "Kayseri", "Malatya", "Adıyaman", "Gaziantep", "Şanlıurfa", "Kilis",
    "Uşak",
  ],
  KARADENIZ: [
    "Sakarya", "Kocaeli", "Ankara", "Kırıkkale", "Yozgat", "Sivas",
    "Erzincan", "Erzurum", "Bayburt", "Gümüşhane", "Artvin", "Ardahan",
    "Kastamonu", "Çankırı", "Elazığ", "Bingöl", "Tunceli",
  ],
  DOGU_ANADOLU: [
    "Sivas", "Kayseri", "Kahramanmaraş", "Adıyaman", "Diyarbakır",
    "Batman", "Siirt", "Şırnak", "Mardin", "Gümüşhane", "Bayburt",
    "Trabzon", "Rize", "Artvin", "Giresun", "Ordu", "Tokat",
  ],
  GUNEYDOGU: [
    "Malatya", "Elazığ", "Bingöl", "Muş", "Bitlis", "Van", "Hakkari",
    "Kahramanmaraş", "Osmaniye", "Hatay", "Adana",
  ],
};

/**
 * Çözümlemeye değer il kümesi: seçili bölgeler + komşuları + ek iller.
 * Bölge ve ek il yoksa 81 il döner. (AI prompt kapsamı — geniş.)
 */
export function genisIlKumesi(
  kodlar: BolgeKodu[],
  ekIller: string[] = []
): string[] {
  if (kodlar.length === 0 && ekIller.length === 0) return [...ILLER];
  const iller = new Set<string>();
  if (kodlar.length > 0) {
    for (const il of bolgeIlleri(kodlar)) iller.add(il);
    for (const kod of kodlar) {
      for (const il of BOLGE_KOMSULARI[kod] ?? []) iller.add(il);
    }
  }
  for (const ham of ekIller) {
    const n = ilBul(ham);
    if (n) iller.add(n);
  }
  return [...iller];
}

/**
 * Kayıt / liste filtresi: sadece seçili bölge illeri + ek iller.
 * Komşular (Adana, İzmir…) buraya GİRMEZ — aksi hâlde "İç Anadolu+Marmara"
 * seçince Akdeniz/Ege yükleri de kayda düşüyordu.
 */
export function cekirdekIlKumesi(
  kodlar: BolgeKodu[],
  ekIller: string[] = []
): string[] {
  if (kodlar.length === 0 && ekIller.length === 0) return [...ILLER];
  const iller = new Set<string>(bolgeIlleri(kodlar));
  for (const ham of ekIller) {
    const n = ilBul(ham);
    if (n) iller.add(n);
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

/**
 * İlan seçili bölge / ek illere değiyor mu?
 * Kural: en az BİR uç çekirdek bölgede (komşu iller sayılmaz).
 */
export function bolgeyeUyuyorMu(
  kodlar: BolgeKodu[],
  cikisIl: string | null,
  varisIl: string | null,
  ekIller: string[] = []
): boolean {
  if (kodlar.length === 0 && ekIller.length === 0) return true;
  const kapsam = new Set(cekirdekIlKumesi(kodlar, ekIller));
  const cikis = ilBul(cikisIl);
  const varis = ilBul(varisIl);
  return (
    (cikis !== null && kapsam.has(cikis)) ||
    (varis !== null && kapsam.has(varis))
  );
}

// --- Grup keşfi ---------------------------------------------------------

/**
 * Otomatik AKTİF terfi için başlıkta olması gerekenler.
 * Galatasaray/Cimbom gibi alakasız üyelikler buradan elenir;
 * silinmez — PASIF ("Takip edilmiyor") kalır.
 */
const YUK_TERIMLERI = [
  "yuk", "yük", "nakliye", "nakliyat", "nakliyeci", "tir", "tır",
  "lojistik", "kamyon", "dorse", "borsa", "tasima", "taşıma",
  "sevkiyat", "filo", "navlun", "kamyonet", "spot yuk", "arac yuk",
];

/**
 * Nakliye kelimesi geçse de işimize yaramayan gruplar.
 * "Evden eve" ve benzeri şahsi taşımacılık ilanları yük ilanı değildir.
 */
export const ISTENMEYEN_TERIMLER = [
  "evden eve", "ev tasima", "asansorlu", "oto kurtarma", "cekici hizmet",
  "personel tasima", "ogrenci", "emlak", "kripto", "hisse", "forex",
  "bahis", "iddaa", "sohbet", "arkadas", "ifsa", "film", "dizi", "muzik",
  "galatasaray", "cimbom", "fenerbahce", "besiktas", "trabzonspor",
  "futbol", "mac sonucu", "sanal", "escort", "satis grubu", "ikinci el",
  "alisveris", "ilan panosu", "reklam", "sponsor",
];

/**
 * Otomatik katılım RED — başlıkta geçerse ADAY'a alma / katılma.
 * "yük borsası" istisna (aşağıda özel).
 */
const KATILIM_RED_TERIMLER = [
  // Özbek / Rusça Latin
  "yukchilar", "yukchi", "toshkent", "tashkent", "haydovchi", "fura",
  "uzb", "uzbekistan",
  // Eğitim / iş ilanı kirliliği
  "yuksek lisans", "universite", "lisans", "ogrenci", "sinav",
  "yuksek ihtisas", "egitim",
  // Spam
  "bahis", "escort", "kripto", "forex", "bitcoin",
  "evden eve", "ceyiz", "kurye", "motokurye", "moto kurye",
  // Yurtdışı hat (koridor dışı)
  "iran", "irak", "iraq", "azerbaycan", "azerbaijan",
  "gurcistan", "kazakistan", "ozbekistan", "turkmenistan",
  "rusya", "russia", "avrupa", "almanya", "germany",
];

/** Başlıkta geçince öncelik puanı (katılım sırası). */
const KORIDOR_BASLIK_KELIMELER = [
  "ankara", "istanbul", "gebze", "kocaeli", "bolu", "duzce",
  "sakarya", "kirikkale", "cankiri", "ostim", "hadimkoy",
  "dilovasi", "cayirova", "ikitelli", "adapazari",
];

const YUK_SADE = YUK_TERIMLERI.map((t) => sadelestir(t));

/** Kiril harfi var mı? */
function kirilVarMi(metin: string): boolean {
  return /[\u0400-\u04FF]/.test(metin);
}

/**
 * Katılım öncesi eleme. Sebep dönerse RED — katılma / ADAY oluşturma.
 */
export function katilimRedSebebi(baslik: string): string | null {
  const ham = (baslik || "").trim();
  if (!ham) return "Başlık boş";
  if (kirilVarMi(ham)) return "Kiril harf";

  const sade = sadelestir(ham);

  // borsa — ama "yük borsası" serbest
  if (
    sade.includes("borsa") &&
    !sade.includes("yuk borsa") &&
    !sade.includes("yukborsa")
  ) {
    return "borsa";
  }

  for (const t of KATILIM_RED_TERIMLER) {
    const k = sadelestir(t);
    if (k && sade.includes(k)) return t;
  }

  for (const t of ISTENMEYEN_TERIMLER) {
    const k = sadelestir(t);
    if (k && sade.includes(k)) return t;
  }

  return null;
}

/** Koridor ili/semt başlıkta → 0..N (katılım önceliği). */
export function koridorBaslikOnceligi(baslik: string): number {
  const sade = sadelestir(baslik);
  if (!sade) return 0;
  let puan = 0;
  for (const k of KORIDOR_BASLIK_KELIMELER) {
    if (sade.includes(k)) puan += 1;
  }
  return puan;
}

/** Başlık otomatik takibe / hasata uygun mu? */
export function yukBasligiMi(baslik: string): boolean {
  const ham = (baslik || "").trim();
  if (ham.length < 3) return false;
  if (katilimRedSebebi(baslik)) return false;
  const sade = sadelestir(ham);
  // "Ğ", emoji-only, anlamsız kısa
  const harf = sade.replace(/[^a-z0-9]+/g, "");
  if (harf.length < 3) return false;
  if (!sade) return false;
  return YUK_SADE.some((terim) => sade.includes(terim));
}

/**
 * Telegram global aramasında denenecek sorgular.
 * Koridor + yeni açılar (firma / cins / OSB / sıfat).
 * cron-kesif her turda listeden 20’lik dilim döndürür (sira ile).
 */
export function aramaSorgulariUret(
  kodlar: BolgeKodu[],
  koridorIller: string[] = []
): string[] {
  const oncelikli: string[] = [];
  const genel: string[] = ["yük ilanları", "nakliye yük", "tır yük grubu"];

  const sabitKoridor = [
    "ankara istanbul yük",
    "ankara çıkışlı",
    "istanbul çıkışlı",
    "gebze yük",
    "gebze ankara",
    "bolu nakliye",
    "düzce yük",
    "sakarya nakliye",
    "kocaeli tır",
    "ostim nakliye",
    "hadımköy yük",
    "ambarlı yük",
    "ikitelli nakliye",
    "anadolu yakası yük",
    "avrupa yakası yük",
    "kırıkkale yük",
    "ankara yük",
    "istanbul yük",
    "ankara istanbul nakliye",
    "kocaeli yük",
    "çankırı nakliye",
  ];

  const firmaAcilar = [
    "lojistik grup",
    "nakliyat grubu",
    "tır sahipleri",
    "araç sahipleri",
    "şoförler grubu",
    "nakliyeci grubu",
    "tır şoförleri",
    "kamyon sahipleri",
  ];

  const yukCinsi = [
    "parsiyel yük",
    "komple yük",
    "palet yük",
    "kimyasal yük",
    "gıda yük",
    "inşaat malzemesi",
    "damper yük",
    "tenteli yük",
  ];

  const ilceOsb = [
    "ostim",
    "ivedik",
    "başkent osb",
    "hadımköy",
    "ikitelli",
    "dilovası",
    "çerkezköy",
    "gebze osb",
    "tosb",
    "as osb ankara",
  ];

  const sifat = [
    "acil yük",
    "boş araç",
    "yük paylaşım",
    "günlük yük",
    "sıcak yük",
    "yük var",
    "araç arıyorum",
    "yük arıyorum",
  ];

  if (koridorIller.length > 0 || sabitKoridor.length > 0) {
    oncelikli.push(
      ...sabitKoridor,
      ...firmaAcilar,
      ...yukCinsi,
      ...ilceOsb,
      ...sifat
    );
    for (const il of koridorIller) {
      oncelikli.push(`${il} yük`);
      oncelikli.push(`${il} nakliye`);
      oncelikli.push(`${il} çıkışlı`);
      oncelikli.push(`${il} yük paylaşım`);
    }
  }

  const secili = kodlar.length > 0 ? kodlar : VARSAYILAN_BOLGELER;
  for (const kod of secili) {
    const bolge = KOD_HARITASI.get(kod);
    if (!bolge) continue;
    genel.push(`${bolge.ad} yük`);
    for (const merkez of bolge.merkezler) {
      genel.push(`${merkez} yük`);
      genel.push(`${merkez} nakliye`);
    }
  }

  const sonuc: string[] = [];
  const gorulen = new Set<string>();
  for (const s of [...oncelikli, ...genel]) {
    const k = s.toLocaleLowerCase("tr-TR");
    if (gorulen.has(k)) continue;
    gorulen.add(k);
    sonuc.push(s);
  }
  return sonuc;
}

/** Her keşif turunda kaç sorgu (dönüşümlü dilim). */
export const KESIF_TUR_SORGU = 20;

/**
 * Sıra anahtarına göre dönüşümlü 20 sorgu.
 * Aynı ilk 20’nin tekrarlanmasını önler.
 */
export function kesifSorguDilimi(
  tumSorgular: string[],
  sira: number,
  adet = KESIF_TUR_SORGU
): { sorgular: string[]; sonrakiSira: number } {
  if (tumSorgular.length === 0) return { sorgular: [], sonrakiSira: 0 };
  const n = tumSorgular.length;
  const bas = ((sira % n) + n) % n;
  const sorgular: string[] = [];
  const al = Math.min(adet, n);
  for (let i = 0; i < al; i++) {
    sorgular.push(tumSorgular[(bas + i) % n]);
  }
  return { sorgular, sonrakiSira: (bas + al) % n };
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

  const red = katilimRedSebebi(baslik);
  if (red) {
    return { uygun: false, sebep: `RED: ${red}`, bolge: null };
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
