/**
 * Tabloda (TAKMA_ADLAR) olmayan ilçeler. Kaynak: turkey-neighbourhoods 4.0.3 (MIT), 973 ilçe.
 * Yalnız Türkiye'de TEK ile ait adlar; sıradan kelime / yük cinsi / başka ildeki semtle
 * çakışanlar (Araç, Kiraz, Çay, Ulus, Dikmen, Marmara…) ve 3 harfliler bilerek yok.
 * Elle yazılan TAKMA_ADLAR önceliklidir.
 */
export const EK_ILCELER: Record<string, string> = {
  // Adana
  "aladağ": "Adana", "feke": "Adana", "saimbeyli": "Adana", "tufanbeyli": "Adana",
  // Adıyaman
  "çelikhan": "Adıyaman",
  // Afyonkarahisar
  "başmakçı": "Afyonkarahisar", "çobanlar": "Afyonkarahisar", "dazkırı": "Afyonkarahisar", "evciler": "Afyonkarahisar", "hocalar": "Afyonkarahisar", "ihsaniye": "Afyonkarahisar", "kızılören": "Afyonkarahisar", "sultandağı": "Afyonkarahisar",
  // Ağrı
  "taşlıçay": "Ağrı",
  // Aksaray
  "ağaçören": "Aksaray", "gülağaç": "Aksaray", "sarıyahşi": "Aksaray", "sultanhanı": "Aksaray",
  // Amasya
  "göynücek": "Amasya", "hamamözü": "Amasya",
  // Ankara
  "ayaş": "Ankara", "çamlıdere": "Ankara", "güdül": "Ankara", "kalecik": "Ankara",
  // Antalya
  "akseki": "Antalya", "demre": "Antalya", "gündoğmuş": "Antalya", "ibradı": "Antalya",
  // Artvin
  "murgul": "Artvin",
  // Aydın
  "buharkent": "Aydın", "karacasu": "Aydın", "köşk": "Aydın",
  // Balıkesir
  "altıeylül": "Balıkesir", "balya": "Balıkesir", "gömeç": "Balıkesir", "ivrindi": "Balıkesir", "karesi": "Balıkesir",
  // Batman
  "hasankeyf": "Batman",
  // Bilecik
  "gölpazarı": "Bilecik", "inhisar": "Bilecik",
  // Bingöl
  "kiğı": "Bingöl", "yayladere": "Bingöl", "yedisu": "Bingöl",
  // Bitlis
  "mutki": "Bitlis",
  // Bolu
  "kıbrıscık": "Bolu",
  // Burdur
  "ağlasun": "Burdur", "çavdır": "Burdur", "çeltikçi": "Burdur",
  // Tablo "Karaman"ın bitişik yazımı sanıyordu
  "karamanlı": "Burdur",
  // Bursa
  "büyükorhan": "Bursa", "harmancık": "Bursa", "keles": "Bursa",
  // Çanakkale
  "bozcaada": "Çanakkale", "eceabat": "Çanakkale", "gökçeada": "Çanakkale",
  // Çankırı
  "atkaracalar": "Çankırı", "bayramören": "Çankırı", "eldivan": "Çankırı", "kızılırmak": "Çankırı", "kurşunlu": "Çankırı", "yapraklı": "Çankırı",
  // Çorum
  "boğazkale": "Çorum", "dodurga": "Çorum", "kargı": "Çorum", "laçin": "Çorum", "oğuzlar": "Çorum", "uğurludağ": "Çorum",
  // Denizli
  "babadağ": "Denizli", "baklan": "Denizli", "bekilli": "Denizli", "beyağaç": "Denizli", "çameli": "Denizli", "serinhisar": "Denizli",
  // Diyarbakır
  "çüngüş": "Diyarbakır", "eğil": "Diyarbakır", "hazro": "Diyarbakır", "kocaköy": "Diyarbakır",
  // Düzce
  "cumayeri": "Düzce", "yığılca": "Düzce",
  // Edirne
  "lalapaşa": "Edirne", "meriç": "Edirne", "süloğlu": "Edirne",
  // Elazığ
  "ağın": "Elazığ", "alacakaya": "Elazığ", "arıcak": "Elazığ", "keban": "Elazığ", "sivrice": "Elazığ",
  // Erzincan
  "iliç": "Erzincan", "kemah": "Erzincan", "kemaliye": "Erzincan", "otlukbeli": "Erzincan",
  // Erzurum
  "ispir": "Erzurum", "karaçoban": "Erzurum", "karayazı": "Erzurum", "köprüköy": "Erzurum", "narman": "Erzurum", "pazaryolu": "Erzurum", "şenkaya": "Erzurum", "tekman": "Erzurum", "uzundere": "Erzurum",
  // Eskişehir
  "günyüzü": "Eskişehir", "mahmudiye": "Eskişehir", "mihalgazi": "Eskişehir", "sarıcakaya": "Eskişehir",
  // Gaziantep
  "karkamış": "Gaziantep", "yavuzeli": "Gaziantep",
  // Giresun
  "alucra": "Giresun", "çamoluk": "Giresun", "çanakçı": "Giresun", "doğankent": "Giresun", "eynesil": "Giresun", "güce": "Giresun", "keşap": "Giresun", "piraziz": "Giresun", "yağlıdere": "Giresun",
  // Gümüşhane
  "kürtün": "Gümüşhane",
  // Hakkari
  "derecik": "Hakkari",
  // Hatay
  "altınözü": "Hatay", "yayladağı": "Hatay",
  // Iğdır
  "karakoyunlu": "Iğdır",
  // Isparta
  "keçiborlu": "Isparta", "sütçüler": "Isparta", "uluborlu": "Isparta", "yenişarbademli": "Isparta",
  // İstanbul
  "bakırköy": "İstanbul", "beyoğlu": "İstanbul", "şile": "İstanbul",
  // İzmir
  "balçova": "İzmir", "bayındır": "İzmir", "beydağ": "İzmir", "güzelbahçe": "İzmir", "karaburun": "İzmir", "narlıdere": "İzmir",
  // Kahramanmaraş
  "çağlayancerit": "Kahramanmaraş", "ekinözü": "Kahramanmaraş", "nurhak": "Kahramanmaraş",
  // Karabük
  "eflani": "Karabük",
  // Karaman
  "başyayla": "Karaman", "kazımkarabekir": "Karaman", "sarıveliler": "Karaman",
  // Kars
  "arpaçay": "Kars",
  // Kastamonu
  "abana": "Kastamonu", "ağlı": "Kastamonu", "azdavay": "Kastamonu", "çatalzeytin": "Kastamonu", "doğanyurt": "Kastamonu", "hanönü": "Kastamonu", "ihsangazi": "Kastamonu", "seydiler": "Kastamonu", "şenpazar": "Kastamonu",
  // Kayseri
  "akkışla": "Kayseri", "felahiye": "Kayseri", "özvatan": "Kayseri", "sarıoğlan": "Kayseri", "sarız": "Kayseri", "tomarza": "Kayseri", "yeşilhisar": "Kayseri",
  // Kırıkkale
  "bahşılı": "Kırıkkale", "balışeyh": "Kırıkkale", "karakeçili": "Kırıkkale", "sulakyurt": "Kırıkkale",
  // Kırklareli
  "demirköy": "Kırklareli", "kofçaz": "Kırklareli", "pehlivanköy": "Kırklareli",
  // Kırşehir
  "akçakent": "Kırşehir", "çiçekdağı": "Kırşehir",
  // Konya
  "ahırlı": "Konya", "altınekin": "Konya", "bozkır": "Konya", "derebucak": "Konya", "doğanhisar": "Konya", "emirgazi": "Konya", "güneysınır": "Konya", "hadim": "Konya", "halkapınar": "Konya", "hüyük": "Konya", "tuzlukçu": "Konya", "yalıhüyük": "Konya", "yunak": "Konya",
  // Kütahya
  "aslanapa": "Kütahya", "çavdarhisar": "Kütahya", "şaphane": "Kütahya",
  // Malatya
  "arguvan": "Malatya", "doğanyol": "Malatya", "kuluncak": "Malatya", "yazıhan": "Malatya",
  // Manisa
  "ahmetli": "Manisa", "gölmarmara": "Manisa", "kula": "Manisa", "selendi": "Manisa",
  // Mardin
  "yeşilli": "Mardin",
  // Mersin
  "bozyazı": "Mersin", "çamlıyayla": "Mersin",
  // Muğla
  "kavaklıdere": "Muğla",
  // Nevşehir
  "hacıbektaş": "Nevşehir", "kozaklı": "Nevşehir",
  // Niğde
  "altunhisar": "Niğde",
  // Ordu
  "akkuş": "Ordu", "aybastı": "Ordu", "çamaş": "Ordu", "çatalpınar": "Ordu", "çaybaşı": "Ordu", "gülyalı": "Ordu", "gürgentepe": "Ordu", "ikizce": "Ordu", "kabadüz": "Ordu", "kabataş": "Ordu", "korgan": "Ordu", "mesudiye": "Ordu",
  // Osmaniye
  "hasanbeyli": "Osmaniye", "sumbas": "Osmaniye",
  // Rize
  "çamlıhemşin": "Rize", "derepazarı": "Rize", "güneysu": "Rize", "hemşin": "Rize", "ikizdere": "Rize",
  // Sakarya
  "karapürçek": "Sakarya", "kocaali": "Sakarya", "serdivan": "Sakarya", "taraklı": "Sakarya",
  // Samsun
  "asarcık": "Samsun", "salıpazarı": "Samsun", "yakakent": "Samsun",
  // Siirt
  "eruh": "Siirt", "tillo": "Siirt",
  // Sinop
  "durağan": "Sinop", "erfelek": "Sinop", "saraydüzü": "Sinop",
  // Sivas
  "akıncılar": "Sivas", "doğanşar": "Sivas", "gölova": "Sivas", "gürün": "Sivas", "hafik": "Sivas", "imranlı": "Sivas", "koyulhisar": "Sivas", "ulaş": "Sivas",
  // Şırnak
  "beytüşşebap": "Şırnak", "güçlükonak": "Şırnak",
  // Tekirdağ
  "süleymanpaşa": "Tekirdağ",
  // Tokat
  "artova": "Tokat", "başçiftlik": "Tokat", "sulusaray": "Tokat",
  // Trabzon
  "çaykara": "Trabzon", "dernekpazarı": "Trabzon", "düzköy": "Trabzon", "hayrat": "Trabzon", "ortahisar": "Trabzon", "şalpazarı": "Trabzon", "tonya": "Trabzon",
  // Tunceli
  "hozat": "Tunceli", "nazımiye": "Tunceli", "pülümür": "Tunceli",
  // Uşak
  "karahallı": "Uşak",
  // Van
  "bahçesaray": "Van", "çatak": "Van",
  // Yozgat
  "çandır": "Yozgat", "çayıralan": "Yozgat", "çekerek": "Yozgat", "kadışehri": "Yozgat", "saraykent": "Yozgat", "şefaatli": "Yozgat", "yenifakılı": "Yozgat",
};
