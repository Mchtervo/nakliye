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

/**
 * İlçe / semt / sanayi bölgesi / liman adlarının bağlı olduğu il.
 *
 * Yük ilanlarında il adı neredeyse hiç yazılmaz; "Ostim", "Hadımköy",
 * "Çan" gibi yer adları yazılır. Bu tablo olmadan ilan filtrelenemez.
 *
 * İki ilde birden bulunan adlar (Ereğli, Gölbaşı, Pınarbaşı, Yenişehir,
 * Pazar, Yenice, Ovacık...) bilinçli olarak yoktur: yanlış ile bağlamak
 * hiç bağlamamaktan kötüdür.
 */
const TAKMA_ADLAR: Record<string, string> = {
  // --- İstanbul ---
  ist: "İstanbul", "ist avrupa": "İstanbul", "ist anadolu": "İstanbul",
  tuzla: "İstanbul", orhanlı: "İstanbul", tepeören: "İstanbul",
  pendik: "İstanbul", kurtköy: "İstanbul", kartal: "İstanbul",
  maltepe: "İstanbul", ataşehir: "İstanbul", ümraniye: "İstanbul",
  dudullu: "İstanbul", şerifali: "İstanbul", sancaktepe: "İstanbul",
  sultanbeyli: "İstanbul", çekmeköy: "İstanbul", alemdağ: "İstanbul",
  beykoz: "İstanbul", üsküdar: "İstanbul", kadıköy: "İstanbul",
  kavacık: "İstanbul", hadımköy: "İstanbul", ikitelli: "İstanbul",
  esenyurt: "İstanbul", hoşdere: "İstanbul", kıraç: "İstanbul",
  akçaburgaz: "İstanbul", beylikdüzü: "İstanbul", avcılar: "İstanbul",
  ambarlı: "İstanbul", küçükçekmece: "İstanbul", sefaköy: "İstanbul",
  büyükçekmece: "İstanbul", başakşehir: "İstanbul", bağcılar: "İstanbul",
  güneşli: "İstanbul", mahmutbey: "İstanbul", bahçelievler: "İstanbul",
  güngören: "İstanbul", esenler: "İstanbul", bayrampaşa: "İstanbul",
  zeytinburnu: "İstanbul", topkapı: "İstanbul", eyüpsultan: "İstanbul",
  gaziosmanpaşa: "İstanbul", sultangazi: "İstanbul", arnavutköy: "İstanbul",
  silivri: "İstanbul", çatalca: "İstanbul", kağıthane: "İstanbul",
  şişli: "İstanbul", beşiktaş: "İstanbul", sarıyer: "İstanbul",
  maslak: "İstanbul", levent: "İstanbul", halkalı: "İstanbul",
  yenibosna: "İstanbul", seyrantepe: "İstanbul", haramidere: "İstanbul",
  // İlanlarda sık geçen kısaltmalar ("G.O.PAŞA", "B.ÇEKMECE").
  "g o paşa": "İstanbul", "b çekmece": "İstanbul", "k çekmece": "İstanbul",

  // --- Kocaeli ---
  gebze: "Kocaeli", izmit: "Kocaeli", körfez: "Kocaeli", derince: "Kocaeli",
  dilovası: "Kocaeli", çayırova: "Kocaeli", darıca: "Kocaeli",
  gölcük: "Kocaeli", kartepe: "Kocaeli", başiskele: "Kocaeli",
  kandıra: "Kocaeli", karamürsel: "Kocaeli", yarımca: "Kocaeli",
  şekerpınar: "Kocaeli", alikahya: "Kocaeli", kullar: "Kocaeli",

  // --- Bursa ---
  nilüfer: "Bursa", inegöl: "Bursa", gemlik: "Bursa", mudanya: "Bursa",
  yıldırım: "Bursa", osmangazi: "Bursa", kestel: "Bursa", gürsu: "Bursa",
  karacabey: "Bursa", mustafakemalpaşa: "Bursa", orhangazi: "Bursa",
  iznik: "Bursa", orhaneli: "Bursa", demirtaş: "Bursa", hasanağa: "Bursa",
  kayapa: "Bursa", ovaakça: "Bursa", teknosab: "Bursa", bursaosb: "Bursa",

  // --- Tekirdağ ---
  çerkezköy: "Tekirdağ", çorlu: "Tekirdağ", kapaklı: "Tekirdağ",
  ergene: "Tekirdağ", velimeşe: "Tekirdağ", muratlı: "Tekirdağ",
  malkara: "Tekirdağ", hayrabolu: "Tekirdağ", şarköy: "Tekirdağ",
  "marmara ereğlisi": "Tekirdağ", "marmaraereğlisi": "Tekirdağ",

  // --- Sakarya ---
  adapazarı: "Sakarya", hendek: "Sakarya", akyazı: "Sakarya",
  karasu: "Sakarya", ferizli: "Sakarya", arifiye: "Sakarya",
  geyve: "Sakarya", pamukova: "Sakarya", sapanca: "Sakarya",
  kaynarca: "Sakarya",

  // --- Balıkesir ---
  bandırma: "Balıkesir", edremit: "Balıkesir", ayvalık: "Balıkesir",
  burhaniye: "Balıkesir", gönen: "Balıkesir", susurluk: "Balıkesir",
  bigadiç: "Balıkesir", dursunbey: "Balıkesir", sındırgı: "Balıkesir",
  savaştepe: "Balıkesir", erdek: "Balıkesir", manyas: "Balıkesir",
  kepsut: "Balıkesir", "havran": "Balıkesir",

  // --- Çanakkale ---
  çan: "Çanakkale", biga: "Çanakkale", gelibolu: "Çanakkale",
  lapseki: "Çanakkale", ezine: "Çanakkale", ayvacık: "Çanakkale",
  bayramiç: "Çanakkale", çardak: "Çanakkale",

  // --- Diğer Marmara ---
  çiftlikköy: "Yalova", altınova: "Yalova", çınarcık: "Yalova",
  bozüyük: "Bilecik", osmaneli: "Bilecik", söğüt: "Bilecik",
  pazaryeri: "Bilecik", keşan: "Edirne", uzunköprü: "Edirne",
  ipsala: "Edirne", havsa: "Edirne", enez: "Edirne",
  lüleburgaz: "Kırklareli", babaeski: "Kırklareli", vize: "Kırklareli",
  pınarhisar: "Kırklareli",

  // --- Ankara ---
  ostim: "Ankara", ivedik: "Ankara", siteler: "Ankara", batıkent: "Ankara",
  sincan: "Ankara", etimesgut: "Ankara", yenimahalle: "Ankara",
  keçiören: "Ankara", mamak: "Ankara", altındağ: "Ankara",
  çankaya: "Ankara", pursaklar: "Ankara", polatlı: "Ankara",
  kahramankazan: "Ankara", temelli: "Ankara", malıköy: "Ankara",
  akyurt: "Ankara", elmadağ: "Ankara", çubuk: "Ankara",
  şereflikoçhisar: "Ankara", beypazarı: "Ankara", nallıhan: "Ankara",
  kızılcahamam: "Ankara", haymana: "Ankara", "başkent osb": "Ankara",

  // --- İç Anadolu ---
  akşehir: "Konya", ilgın: "Konya", seydişehir: "Konya", çumra: "Konya",
  karapınar: "Konya", beyşehir: "Konya", cihanbeyli: "Konya",
  kulu: "Konya", sarayönü: "Konya", kadınhanı: "Konya", selçuklu: "Konya",
  meram: "Konya", karatay: "Konya",
  melikgazi: "Kayseri", kocasinan: "Kayseri", talas: "Kayseri",
  develi: "Kayseri", yahyalı: "Kayseri", incesu: "Kayseri",
  bünyan: "Kayseri",
  sivrihisar: "Eskişehir", çifteler: "Eskişehir", seyitgazi: "Eskişehir",
  mihalıççık: "Eskişehir", alpu: "Eskişehir", inönü: "Eskişehir",
  tepebaşı: "Eskişehir", odunpazarı: "Eskişehir",
  şarkışla: "Sivas", suşehri: "Sivas", gemerek: "Sivas", zara: "Sivas",
  yıldızeli: "Sivas", divriği: "Sivas", kangal: "Sivas",
  sorgun: "Yozgat", yerköy: "Yozgat", boğazlıyan: "Yozgat",
  akdağmadeni: "Yozgat", sarıkaya: "Yozgat",
  yahşihan: "Kırıkkale", delice: "Kırıkkale", keskin: "Kırıkkale",
  kaman: "Kırşehir", mucur: "Kırşehir",
  eskil: "Aksaray", güzelyurt: "Aksaray",
  ürgüp: "Nevşehir", avanos: "Nevşehir", gülşehir: "Nevşehir",
  derinkuyu: "Nevşehir", ulukışla: "Niğde", çamardı: "Niğde",
  ermenek: "Karaman", ayrancı: "Karaman",
  çerkeş: "Çankırı", ilgaz: "Çankırı",

  // --- İzmir ---
  aliağa: "İzmir", nemrut: "İzmir", petkim: "İzmir", torbalı: "İzmir",
  kemalpaşa: "İzmir", menemen: "İzmir", bornova: "İzmir", buca: "İzmir",
  gaziemir: "İzmir", çiğli: "İzmir", karabağlar: "İzmir", konak: "İzmir",
  bayraklı: "İzmir", karşıyaka: "İzmir", alsancak: "İzmir",
  ödemiş: "İzmir", tire: "İzmir", bergama: "İzmir", dikili: "İzmir",
  foça: "İzmir", urla: "İzmir", çeşme: "İzmir", seferihisar: "İzmir",
  menderes: "İzmir", selçuk: "İzmir", kınık: "İzmir", işıkkent: "İzmir",

  // --- Ege ---
  akhisar: "Manisa", salihli: "Manisa", turgutlu: "Manisa",
  alaşehir: "Manisa", soma: "Manisa", saruhanlı: "Manisa",
  gördes: "Manisa", demirci: "Manisa", sarıgöl: "Manisa",
  kırkağaç: "Manisa", şehzadeler: "Manisa", yunusemre: "Manisa",
  söke: "Aydın", nazilli: "Aydın", kuşadası: "Aydın", didim: "Aydın",
  çine: "Aydın", germencik: "Aydın", incirliova: "Aydın",
  koçarlı: "Aydın", bozdoğan: "Aydın", sultanhisar: "Aydın",
  efeler: "Aydın",
  çivril: "Denizli", acıpayam: "Denizli", tavas: "Denizli",
  sarayköy: "Denizli", honaz: "Denizli", buldan: "Denizli",
  pamukkale: "Denizli", merkezefendi: "Denizli",
  bodrum: "Muğla", fethiye: "Muğla", marmaris: "Muğla", milas: "Muğla",
  yatağan: "Muğla", ortaca: "Muğla", dalaman: "Muğla",
  köyceğiz: "Muğla", datça: "Muğla", seydikemer: "Muğla",
  menteşe: "Muğla",
  tavşanlı: "Kütahya", simav: "Kütahya", gediz: "Kütahya",
  emet: "Kütahya", altıntaş: "Kütahya", tunçbilek: "Kütahya",
  domaniç: "Kütahya",
  afyon: "Afyonkarahisar", sandıklı: "Afyonkarahisar",
  dinar: "Afyonkarahisar", bolvadin: "Afyonkarahisar",
  emirdağ: "Afyonkarahisar", sinanpaşa: "Afyonkarahisar",
  şuhut: "Afyonkarahisar", iscehisar: "Afyonkarahisar",
  banaz: "Uşak", eşme: "Uşak", sivaslı: "Uşak",

  // --- Akdeniz ---
  alanya: "Antalya", manavgat: "Antalya", serik: "Antalya",
  kumluca: "Antalya", kemer: "Antalya", korkuteli: "Antalya",
  elmalı: "Antalya", gazipaşa: "Antalya", finike: "Antalya",
  döşemealtı: "Antalya", kepez: "Antalya", muratpaşa: "Antalya",
  konyaaltı: "Antalya", aksu: "Antalya",
  tarsus: "Mersin", silifke: "Mersin", erdemli: "Mersin",
  anamur: "Mersin", mut: "Mersin", toroslar: "Mersin",
  mezitli: "Mersin", gülnar: "Mersin", taşucu: "Mersin", içel: "Mersin",
  seyhan: "Adana", yüreğir: "Adana", çukurova: "Adana", sarıçam: "Adana",
  ceyhan: "Adana", kozan: "Adana", karataş: "Adana", imamoğlu: "Adana",
  pozantı: "Adana", karaisalı: "Adana", yumurtalık: "Adana",
  iskenderun: "Hatay", antakya: "Hatay", dörtyol: "Hatay",
  payas: "Hatay", kırıkhan: "Hatay", reyhanlı: "Hatay",
  samandağ: "Hatay", erzin: "Hatay", belen: "Hatay", hassa: "Hatay",
  defne: "Hatay", arsuz: "Hatay",
  kadirli: "Osmaniye", düziçi: "Osmaniye", bahçe: "Osmaniye",
  toprakkale: "Osmaniye",
  maraş: "Kahramanmaraş", "k maraş": "Kahramanmaraş",
  "kmaraş": "Kahramanmaraş", elbistan: "Kahramanmaraş",
  afşin: "Kahramanmaraş", pazarcık: "Kahramanmaraş",
  türkoğlu: "Kahramanmaraş", göksun: "Kahramanmaraş",
  andırın: "Kahramanmaraş", onikişubat: "Kahramanmaraş",
  dulkadiroğlu: "Kahramanmaraş",
  yalvaç: "Isparta", eğirdir: "Isparta", şarkikaraağaç: "Isparta",
  gelendost: "Isparta", senirkent: "Isparta",
  bucak: "Burdur", gölhisar: "Burdur", yeşilova: "Burdur",
  tefenni: "Burdur",

  // --- Karadeniz ---
  bafra: "Samsun", çarşamba: "Samsun", terme: "Samsun", havza: "Samsun",
  vezirköprü: "Samsun", ladik: "Samsun", alaçam: "Samsun",
  tekkeköy: "Samsun", atakum: "Samsun", ilkadım: "Samsun",
  canik: "Samsun", kavak: "Samsun",
  akçaabat: "Trabzon", vakfıkebir: "Trabzon", araklı: "Trabzon",
  sürmene: "Trabzon", arsin: "Trabzon", yomra: "Trabzon",
  beşikdüzü: "Trabzon", maçka: "Trabzon", çarşıbaşı: "Trabzon",
  fatsa: "Ordu", ünye: "Ordu", perşembe: "Ordu", kumru: "Ordu",
  gölköy: "Ordu", altınordu: "Ordu",
  bulancak: "Giresun", görele: "Giresun", tirebolu: "Giresun",
  espiye: "Giresun", şebinkarahisar: "Giresun", dereli: "Giresun",
  çayeli: "Rize", ardeşen: "Rize", fındıklı: "Rize",
  kalkandere: "Rize", iyidere: "Rize",
  hopa: "Artvin", arhavi: "Artvin", borçka: "Artvin",
  yusufeli: "Artvin", ardanuç: "Artvin", şavşat: "Artvin",
  boyabat: "Sinop", gerze: "Sinop", ayancık: "Sinop", türkeli: "Sinop",
  taşköprü: "Kastamonu", tosya: "Kastamonu", inebolu: "Kastamonu",
  cide: "Kastamonu", daday: "Kastamonu", devrekani: "Kastamonu",
  sungurlu: "Çorum", osmancık: "Çorum", iskilip: "Çorum",
  alaca: "Çorum", mecitözü: "Çorum",
  merzifon: "Amasya", suluova: "Amasya", taşova: "Amasya",
  gümüşhacıköy: "Amasya",
  turhal: "Tokat", erbaa: "Tokat", niksar: "Tokat", zile: "Tokat",
  reşadiye: "Tokat", almus: "Tokat",
  çaycuma: "Zonguldak", devrek: "Zonguldak", alaplı: "Zonguldak",
  "kdz ereğli": "Zonguldak", "karadeniz ereğli": "Zonguldak",
  gökçebey: "Zonguldak", kilimli: "Zonguldak", kozlu: "Zonguldak",
  safranbolu: "Karabük", eskipazar: "Karabük",
  amasra: "Bartın", kurucaşile: "Bartın",
  gerede: "Bolu", mudurnu: "Bolu", mengen: "Bolu", dörtdivan: "Bolu",
  yeniçağa: "Bolu", göynük: "Bolu", seben: "Bolu",
  akçakoca: "Düzce", kaynaşlı: "Düzce", gölyaka: "Düzce",
  çilimli: "Düzce", gümüşova: "Düzce",
  kelkit: "Gümüşhane", şiran: "Gümüşhane", torul: "Gümüşhane",
  demirözü: "Bayburt", aydıntepe: "Bayburt",

  // --- Güneydoğu ---
  antep: "Gaziantep", nizip: "Gaziantep", islahiye: "Gaziantep",
  şahinbey: "Gaziantep", şehitkamil: "Gaziantep", oğuzeli: "Gaziantep",
  nurdağı: "Gaziantep", araban: "Gaziantep",
  "g antep": "Gaziantep",
  urfa: "Şanlıurfa", "ş urfa": "Şanlıurfa", "s urfa": "Şanlıurfa",
  siverek: "Şanlıurfa", viranşehir: "Şanlıurfa",
  birecik: "Şanlıurfa", suruç: "Şanlıurfa", akçakale: "Şanlıurfa",
  ceylanpınar: "Şanlıurfa", harran: "Şanlıurfa", halfeti: "Şanlıurfa",
  bozova: "Şanlıurfa", hilvan: "Şanlıurfa", karaköprü: "Şanlıurfa",
  eyyübiye: "Şanlıurfa", haliliye: "Şanlıurfa",
  "d bakır": "Diyarbakır", "d.bakır": "Diyarbakır",
  ergani: "Diyarbakır", bismil: "Diyarbakır", silvan: "Diyarbakır",
  çermik: "Diyarbakır", çınar: "Diyarbakır", kulp: "Diyarbakır",
  lice: "Diyarbakır", dicle: "Diyarbakır", kayapınar: "Diyarbakır",
  bağlar: "Diyarbakır",
  kızıltepe: "Mardin", nusaybin: "Mardin", midyat: "Mardin",
  derik: "Mardin", savur: "Mardin", mazıdağı: "Mardin",
  artuklu: "Mardin", ömerli: "Mardin", dargeçit: "Mardin",
  kozluk: "Batman", beşiri: "Batman", sason: "Batman",
  gercüş: "Batman",
  kurtalan: "Siirt", pervari: "Siirt", baykan: "Siirt", şirvan: "Siirt",
  cizre: "Şırnak", silopi: "Şırnak", idil: "Şırnak", uludere: "Şırnak",
  kahta: "Adıyaman", besni: "Adıyaman", gerger: "Adıyaman",
  samsat: "Adıyaman", sincik: "Adıyaman",
  musabeyli: "Kilis", elbeyli: "Kilis", polateli: "Kilis",

  // --- Doğu Anadolu ---
  battalgazi: "Malatya", yeşilyurt: "Malatya", doğanşehir: "Malatya",
  akçadağ: "Malatya", darende: "Malatya", hekimhan: "Malatya",
  arapgir: "Malatya", pütürge: "Malatya",
  kovancılar: "Elazığ", karakoçan: "Elazığ", palu: "Elazığ",
  maden: "Elazığ", baskil: "Elazığ",
  aşkale: "Erzurum", horasan: "Erzurum", oltu: "Erzurum",
  pasinler: "Erzurum", hınıs: "Erzurum", tortum: "Erzurum",
  yakutiye: "Erzurum", palandöken: "Erzurum", aziziye: "Erzurum",
  tercan: "Erzincan", refahiye: "Erzincan", üzümlü: "Erzincan",
  çayırlı: "Erzincan",
  erciş: "Van", özalp: "Van", muradiye: "Van", gevaş: "Van",
  başkale: "Van", çaldıran: "Van", ipekyolu: "Van", tuşba: "Van",
  bulanık: "Muş", malazgirt: "Muş", varto: "Muş", korkut: "Muş",
  tatvan: "Bitlis", ahlat: "Bitlis", güroymak: "Bitlis",
  hizan: "Bitlis", adilcevaz: "Bitlis",
  patnos: "Ağrı", doğubayazıt: "Ağrı", diyadin: "Ağrı",
  eleşkirt: "Ağrı", tutak: "Ağrı",
  sarıkamış: "Kars", kağızman: "Kars", digor: "Kars", selim: "Kars",
  tuzluca: "Iğdır", aralık: "Iğdır",
  göle: "Ardahan", çıldır: "Ardahan", hanak: "Ardahan",
  posof: "Ardahan",
  yüksekova: "Hakkari", şemdinli: "Hakkari", çukurca: "Hakkari",
  solhan: "Bingöl", karlıova: "Bingöl", adaklı: "Bingöl",
  pertek: "Tunceli", çemişgezek: "Tunceli", mazgirt: "Tunceli",
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

/** Tek kelimelik yer adları: "gebze" -> Kocaeli */
const TEK_KELIME = new Map<string, string>();
/** Çok kelimeli yer adları: "kdz eregli" -> Zonguldak. Uzun olan önce denenir. */
const COK_KELIME: { kalip: string; il: string }[] = [];

function yerEkle(ad: string, il: string): void {
  const sade = sadelestir(ad);
  if (!sade) return;
  if (sade.includes(" ")) COK_KELIME.push({ kalip: sade, il });
  else if (!TEK_KELIME.has(sade)) TEK_KELIME.set(sade, il);
}

for (const il of ILLER) yerEkle(il, il);
for (const [takma, il] of Object.entries(TAKMA_ADLAR)) yerEkle(takma, il);
COK_KELIME.sort((a, b) => b.kalip.length - a.kalip.length);

/**
 * Yer adının alabileceği çekim ekleri. "Ankaradan", "Boluya", "İzmirde"
 * yakalanmalı; ama "Karşı" -> Kars, "Vana" -> Van gibi kazalar olmamalı.
 * Bu yüzden serbest ek değil, sabit bir ek listesi kullanılır.
 */
const EKLER = [
  "dan", "den", "tan", "ten", "ndan", "nden",
  "da", "de", "ta", "te", "nda", "nde",
  "ya", "ye", "na", "ne",
];

/** Kelime bir yer adının çekimli hâli mi? */
function kokBul(kelime: string): string | null {
  if (TEK_KELIME.has(kelime)) return kelime;
  for (const ek of EKLER) {
    if (!kelime.endsWith(ek)) continue;
    const kok = kelime.slice(0, -ek.length);
    // Çok kısa kökler ("van" + "da" = "vanda") tesadüfen eşleşiyor.
    if (kok.length >= 4 && TEK_KELIME.has(kok)) return kok;
  }
  return null;
}

/**
 * Serbest metinden il adını bulur. "Ankara Ostim", "Gebze", "Çan"
 * girdilerinin hepsi çalışır. Bulamazsa null döner.
 */
export function ilBul(metin: string | null | undefined): string | null {
  if (!metin) return null;
  const sade = sadelestir(metin);
  if (!sade) return null;

  const tek = TEK_KELIME.get(sade);
  if (tek) return tek;

  for (const { kalip, il } of COK_KELIME) {
    if (sade === kalip || new RegExp(`(^|\\s)${kalip}(\\s|$)`).test(sade)) {
      return il;
    }
  }

  const kelimeler = sade.split(" ");
  for (const kelime of kelimeler) {
    const kok = kokBul(kelime);
    if (kok) return TEK_KELIME.get(kok) ?? null;
  }

  // Bitişik yazımlar: "istanbultuzla". Sadece il adlarında denenir;
  // ilçe adlarıyla parça arama yanlış eşleşme üretiyor.
  for (const il of ILLER) {
    const sadeIl = sadelestir(il);
    if (sadeIl.length >= 5 && sade.includes(sadeIl)) return il;
  }

  return null;
}

/** Metinde geçen bütün illeri (ilçe adları dâhil) sırayla döndürür. */
export function illeriBul(metin: string | null | undefined): string[] {
  if (!metin) return [];
  const sade = sadelestir(metin);
  if (!sade) return [];

  const bulunan = new Set<string>();

  for (const { kalip, il } of COK_KELIME) {
    if (new RegExp(`(^|\\s)${kalip}(\\s|$)`).test(sade)) bulunan.add(il);
  }
  for (const kelime of sade.split(" ")) {
    const kok = kokBul(kelime);
    if (kok) bulunan.add(TEK_KELIME.get(kok) as string);
  }

  return [...bulunan];
}

/** İki konumun aynı ile işaret edip etmediğini söyler. */
export function ayniIlMi(a: string | null, b: string | null): boolean {
  const ilA = ilBul(a);
  const ilB = ilBul(b);
  return Boolean(ilA && ilB && ilA === ilB);
}
