import { AiHatasi, aiJson } from "@/lib/ai/istemci";
import { AI_MAX_CIKTI } from "@/lib/ai/modeller";
import { MODEL_HIZLI } from "@/lib/ai/modeller";
import {
  ILAN_LISTESI_SEMASI,
  MESAJ_ILAN_SEMASI,
  type IlanCikti,
  type MesajIlanCikti,
} from "@/lib/ai/semalar";
import {
  aracKoduBul,
  aracYerAdiMi,
  tirUzunlukMetre,
  type AracTipiKodu,
} from "@/lib/arac";
import { yaklasikKarayoluKm, VARIS_UZA_KM } from "@/lib/ilMesafe";
import { ilBul, illeriBul, sadelestir } from "@/lib/iller";
import { koridorTipiBelirle, type KoridorTipi } from "@/lib/koridor";
import {
  AI_MAX_ROTA_PARCA,
  mesajiAiParcalarinaBol,
  rotaSatirSayisi,
  satirlaraBol,
  telefonVarMi,
  yuklemeIfadesiVarMi,
} from "@/lib/kaynaklar/onFiltre";
import { rotaAyniSatirdaMi } from "@/lib/kaynaklar/rotaDogrula";
import { irtibatTelefonuBul } from "@/lib/kaynaklar/onDedup";
import { guvenliKirp } from "@/lib/metin";

/** Bir parti çağrısına en fazla bu kadar mesaj dilimi. */
const AI_MAX_MESAJ_PARCA = Number(process.env.AI_MAX_MESAJ_PARCA || 3);

const SISTEM = `Sen Türkiye'deki nakliye/yük ilanlarını okuyan bir asistansın.
Verilen metinde kaç tane yük ilanı varsa hepsini çıkar.

Kurallar:
- Sadece GERÇEK yük ilanlarını al. Sohbet, selam, "araç arıyorum", reklam,
  ödeme şikayeti gibi mesajlar ilan değildir; onları listeye ekleme.
- YER ADI (SERT): Ham metinde AÇIKÇA geçmeyen hiçbir yer adı yazma.
  Emin değilsen null bırak. Uydurma. Kısaltmayı açma, ilçeyi ile çevirme,
  yazımı "düzeltme". Metinde "İst" yazıyorsa "İst", "Ostim" yazıyorsa
  "Ostim" yaz. Metinde "Kütahya Tunçbilek" varken "Kayseri Pınarbaşı"
  yazmak yasaktır.
- YER ADI DEĞİL: Araç tipi (kırkayak, damper, tenteli, frigo, lowbed,
  açık kasa, tır, dorse) ve firma/kişi adları varış veya çıkış OLAMAZ.
  "Çanakkale kırkayak" → nereye=null, aracTipi=kırkayak.
- "Ankara > Bolu", "Ankara-Bolu", "Ankaradan Boluya" gibi yazımların hepsi
  çıkış ve varış demektir.
- SATIR KURALI: Bir rotanın çıkışı ve varışı AYNI satırda olmalı.
  Farklı satırlardan yer birleştirme YASAK.
- YÜKLEME İLANI: "ANKARA YÜKLEME", "GEBZE YÜKLEMELİ", "çıkışlı" =
  çıkış o il, varış BİLİNMİYOR → nereye=null, nereden=il.
  Bunları atlama; telefon varsa özellikle yaz.
- ÇOK GÜZERGAHLI MESAJ: Bir mesajda birden çok güzergah listelenmiş olabilir
  ("ÇAN'DAN: VAN 2400+, KONYA 850+, MERSİN 1100+"). Her satırı AYRI ilan yap.
  Ortak çıkış yerini (başlık satırı) hepsine uygula ama bir satırın varışını
  veya fiyatını ASLA başka satıra taşıma. "İlk N rota" diye kesme — hepsini çıkar.
- ORTAK BAĞLAM: Mesaj başındaki (veya "ortaktır" notunun üstündeki) firma,
  telefon ve tarih TÜM güzergah ilanlarına kopyalanır. Parça metninde
  telefon bir kez geçiyorsa listedeki her ilana yaz.
- FİRMA vs KİŞİ: firmaAdi alanına ŞİRKET adı yaz (… Lojistik, … Nakliyat,
  Ltd, A.Ş). Kişi adı (Ulviye, Mehmet, Ali Usta) firmaAdi'ye yazma —
  ilgiliKisi alanına yaz. İkisi de varsa ikisini de doldur.
- FİYAT TÜRÜ: ton mu komple mi ayırt et. "ton", "/ton", "TL/ton" veya
  X+KDV liste formatı ("VAN 2400+KDV", "900+KDV") → TON_BASI. "komple",
  "navlun", "toplam" ile verilen tek büyük tutar → KOMPLE.
  Anlaşılmıyorsa ucretTl null ve ucretTuru BELIRSIZ.
- FİYAT ZORUNLU İŞARET: Metinde TL, ₺, bin, navlun, USD, EUR, KDV yoksa
  fiyat YOKTUR — ucretTl=null, ucretTuru=BELIRSIZ. Sadece çıplak sayı
  fiyat sayılmaz.
- "13.60 tır", "13,60 TIR", "1360 dorse" = 13,60 METRE standart tenteli
  dorse. ARAÇ özelliği — ASLA ucretTl'ye yazma. aracTipi=tenteli.
- Ücret "8500 TL", "8.500 TL", "8500tl", "900+KDV" gibi; sadece sayıyı ver
  (Türkçe binlik: 13.600 TL = 13600). Ton başı genelde 200–5000 TL;
  komple navlun genelde 2000–150000 TL. Ücret yoksa null bırak.
- tonaj: yükün ton cinsinden ağırlığı ("24 ton" -> 24). "3 TİR", "10 araç"
  gibi ifadeler ARAÇ ADEDİDİR, tonaj değildir; onları tonaja yazma.
- aracTipi: metinde geçen araç türünü yaz (damper, tenteli, frigo…).
- Telefonu sadece rakam olarak ver (05321234567).
- TELEFON ÖNCELİĞİ (SERT): Metinde "İRT", "İRTİBAT", "İLETİŞİM", "TEL:"
  ile yazılan numarayı telefon alanına yaz. Bu, mesajı atan kişinin
  numarası değil — yük sahibinin / irtibatın numarasıdır. İRT varsa
  onu kullan; yoksa metindeki diğer telefonu yaz.
- Uydurma bilgi ekleme; yoksa null bırak.
- guvenSkoru: metin net bir yük ilanıysa 80-100, şüpheliyse 40-70, zayıfsa 0-39.`;

export type CozulmusIlan = {
  firmaAdi: string | null;
  ilgiliKisi: string | null;
  telefon: string | null;
  nereden: string | null;
  nereye: string | null;
  cikisIl: string | null;
  varisIl: string | null;
  yuklemeTarihi: Date | null;
  ucret: number | null; // kuruş — komple navlun
  fiyatTon: number | null; // kuruş — ton başı
  fiyatBelirsiz: boolean;
  tonaj: number | null;
  aracTipi: string | null;
  aracTipiKod: AracTipiKodu | null;
  /** Tenteli dorse uzunluğu (metre), örn. 13.6 — fiyat değil. */
  aracUzunluk: number | null;
  /** TAM | VARIS | CIKIS | DISI — kayıt katmanında set edilir. */
  koridorTipi: KoridorTipi | null;
  yukTipi: string | null;
  guvenSkoru: number;
};

/** Fiyat kabulü için para işareti (yoksa fiyat belirsiz). */
const PARA_ISARETI =
  /(?:\bTL\b|₺|\bTRY\b|\bUSD\b|\$|\bEUR\b|€|\bbin\b|\bnavlun\b|\bKDV\b)/i;

export function fiyatParaIsaretiVarMi(metin: string | null | undefined): boolean {
  return Boolean(metin && PARA_ISARETI.test(metin));
}

/** Kayda alma alt sınırı — panel SUPHE_SINIRI (50) ile karıştırma. */
export const GUVEN_MIN_KAYIT = 15;

/** AI → kayıt funnel sayaçları (kör kayıp yok). */
export type CozumEleSayac = {
  aiCevapBos: number;
  rotaYok: number;
  guvenDusuk: number;
  satirEle: number;
  bolgeElenen: number;
  /** Sadece çıkış koridorda — kaydedilmedi, sayıldı. */
  cikisSay: number;
  modelCikti: number;
};

export function bosCozumEle(): CozumEleSayac {
  return {
    aiCevapBos: 0,
    rotaYok: 0,
    guvenDusuk: 0,
    satirEle: 0,
    bolgeElenen: 0,
    cikisSay: 0,
    modelCikti: 0,
  };
}

export function cozumEleTopla(
  a: CozumEleSayac,
  b: CozumEleSayac
): CozumEleSayac {
  return {
    aiCevapBos: a.aiCevapBos + b.aiCevapBos,
    rotaYok: a.rotaYok + b.rotaYok,
    guvenDusuk: a.guvenDusuk + b.guvenDusuk,
    satirEle: a.satirEle + b.satirEle,
    bolgeElenen: a.bolgeElenen + b.bolgeElenen,
    cikisSay: a.cikisSay + b.cikisSay,
    modelCikti: a.modelCikti + b.modelCikti,
  };
}

/** Komple navlun / ton başı akıl sınırları (TL). */
export const FIYAT_AKIL = {
  kompleMin: 2_000,
  kompleMax: 150_000,
  tonMin: 200,
  tonMax: 5_000,
} as const;

/** Kayıtlı fiyat mantıklı mı? (kuruş cinsinden alanlar) */
export function fiyatAkliDisiMi(ilan: {
  ucret: number | null;
  fiyatTon: number | null;
  fiyatBelirsiz?: boolean;
}): boolean {
  if (ilan.fiyatBelirsiz) return true;
  if (ilan.ucret != null && ilan.ucret > 0) {
    const tl = ilan.ucret / 100;
    if (tl < FIYAT_AKIL.kompleMin || tl > FIYAT_AKIL.kompleMax) return true;
  }
  if (ilan.fiyatTon != null && ilan.fiyatTon > 0) {
    const tl = ilan.fiyatTon / 100;
    if (tl < FIYAT_AKIL.tonMin || tl > FIYAT_AKIL.tonMax) return true;
  }
  return false;
}

function telefonTemizle(ham: string | null): string | null {
  if (!ham) return null;
  const rakam = ham.replace(/\D/g, "");
  if (rakam.length < 10) return null;
  if (rakam.length === 10) return `0${rakam}`;
  if (rakam.length === 12 && rakam.startsWith("90")) return `0${rakam.slice(2)}`;
  if (rakam.length === 13 && rakam.startsWith("090")) return `0${rakam.slice(3)}`;
  return rakam.slice(0, 11);
}

function tarihCevir(ham: string | null): Date | null {
  if (!ham || !/^\d{4}-\d{2}-\d{2}$/.test(ham)) return null;
  const t = new Date(`${ham}T00:00:00`);
  if (Number.isNaN(t.getTime())) return null;

  // Geçmiş yıla ya da çok uzağa düşen tarihleri kabul etme.
  const bugun = new Date();
  const altSinir = new Date(bugun.getFullYear(), bugun.getMonth() - 1, 1);
  const ustSinir = new Date(bugun.getFullYear() + 1, bugun.getMonth(), 1);
  if (t < altSinir || t > ustSinir) return null;
  return t;
}

function ucretKurusaCevir(tl: number | null): number | null {
  if (tl === null || !Number.isFinite(tl) || tl <= 0) return null;
  // Anlamsız uçları ele (1 TL altı / 5 milyon TL üstü).
  if (tl < 1 || tl > 5_000_000) return null;
  return Math.round(tl * 100);
}

function tonajTemizle(ham: number | null): number | null {
  if (ham === null || !Number.isFinite(ham)) return null;
  const ton = Math.round(ham);
  // 50 tonun üstü ve 1 tonun altı yük ilanı değil, yanlış okumadır.
  return ton >= 1 && ton <= 50 ? ton : null;
}

type HamIlan = IlanCikti["ilanlar"][number];

const KACIS = /[.*+?^${}()|[\]\\]/g;

/** Doğrulama için ham metinden bir kez çıkarılan bilgiler. */
export type MetinBaglami = { ham: string; sade: string; iller: Set<string> };

export function baglamCikar(hamMetin: string): MetinBaglami {
  return {
    ham: hamMetin,
    sade: sadelestir(hamMetin),
    iller: new Set(illeriBul(hamMetin)),
  };
}

/**
 * Model bazen metinde hiç geçmeyen şehir uyduruyor. Yer adı ham metinde
 * ya birebir geçmeli ya da metinde geçen bir ilçenin ili olmalı; aksi
 * hâlde uydurmadır ve kullanıcı olmayan bir yüke telefon açar.
 */
function yerMetindeVarMi(yer: string | null, baglam: MetinBaglami): boolean {
  if (!yer) return true;
  const sade = sadelestir(yer);
  if (!sade) return false;

  // "Bolu" -> "boluya" kabul, "sabolu" değil.
  if (new RegExp(`(^|\\s)${sade.replace(KACIS, "\\$&")}`).test(baglam.sade)) {
    return true;
  }

  // Metinde "Gebze" yazıp model "Kocaeli" demişse bu uydurma değildir.
  const il = ilBul(yer);
  return il !== null && baglam.iller.has(il);
}

/** Yer adı: hamda geçmeli, araç/firma kelimesi olmamalı, il/ilçeye çözülmeli. */
function yerGecerliMi(yer: string | null, baglam: MetinBaglami): boolean {
  if (!yer) return true;
  if (aracYerAdiMi(yer)) return false;
  if (!yerMetindeVarMi(yer, baglam)) return false;
  // "Sahınler", "Ulviye" gibi çözülemeyen adlar yer sayılmaz.
  return ilBul(yer) !== null;
}

function kisiAdiMi(ad: string | null): boolean {
  if (!ad) return false;
  const s = ad.trim();
  if (!s) return false;
  const sade = sadelestir(s);
  // Şirket ipuçları
  if (
    /\b(lojistik|nakliyat|nakliye|ltd|lts|a\.?s\.?|as\b|tic|san|trans|transport|kargo)\b/.test(
      sade
    )
  ) {
    return false;
  }
  // Tek kelime / iki kısa kelime → kişi adı adayı
  const parca = s.split(/\s+/);
  return parca.length <= 2 && s.length <= 28;
}

function ilaniNormalize(
  i: HamIlan,
  baglam: MetinBaglami,
  anaUs: string | null = null
): CozulmusIlan {
  let nereden = i.nereden?.trim() || null;
  let nereye = i.nereye?.trim() || null;
  let skor = Math.max(0, Math.min(100, Math.round(i.guvenSkoru ?? 0)));

  if (!yerGecerliMi(nereden, baglam)) {
    nereden = null;
    skor = Math.min(skor, 35);
  }
  if (!yerGecerliMi(nereye, baglam)) {
    nereye = null;
    skor = Math.min(skor, 35);
  }

  let cikisIl = ilBul(nereden);
  let varisIl = ilBul(nereye);
  if (cikisIl && !baglam.iller.has(cikisIl) && !yerMetindeVarMi(cikisIl, baglam)) {
    cikisIl = null;
    skor = Math.min(skor, 35);
  }
  if (varisIl && !baglam.iller.has(varisIl) && !yerMetindeVarMi(varisIl, baglam)) {
    varisIl = null;
    skor = Math.min(skor, 35);
  }

  const uzunluk =
    tirUzunlukMetre(baglam.ham) ||
    tirUzunlukMetre(`${i.aracTipi || ""} ${i.yukTipi || ""}`);

  let fiyatHam = ucretKurusaCevir(i.ucretTl);
  // Model 13.60 / 1360'ı fiyat sandıysa — tır uzunluğudur
  if (
    fiyatHam != null &&
    (fiyatHam === 1360 ||
      fiyatHam === 1460 ||
      Math.abs(fiyatHam / 100 - 13.6) < 0.001 ||
      Math.abs(fiyatHam / 100 - 14.6) < 0.001)
  ) {
    console.log(
      `[ilanCozumle] fiyat→uzunluk reddi ${i.ucretTl} (tır metre, navlun değil)`
    );
    fiyatHam = null;
  }
  // Para işareti yoksa fiyat yok
  if (fiyatHam != null && !fiyatParaIsaretiVarMi(baglam.ham)) {
    console.log(
      `[ilanCozumle] para işareti yok → fiyatBelirsiz (ucretTl=${i.ucretTl})`
    );
    fiyatHam = null;
  }
  const turHam = fiyatHam === null ? null : i.ucretTuru;

  let firmaAdi = i.firmaAdi?.trim() || null;
  let ilgiliKisi = i.ilgiliKisi?.trim() || null;
  // Model kişi adını firmaya yazdıysa ayır.
  if (firmaAdi && kisiAdiMi(firmaAdi) && !ilgiliKisi) {
    ilgiliKisi = firmaAdi;
    firmaAdi = null;
  }

  const aracTipi = i.aracTipi?.trim() || null;
  // Önce model alanı. Ham genelini SADECE kısa/tek-yük mesajlarda tara —
  // komisyoncu listesinde bir satır "damper/kırkayak" diye tüm
  // belirsiz rotaları araç_uyumsuz yapıyordu.
  let aracTipiKod = aracKoduBul(aracTipi);
  if (!aracTipiKod) {
    const rotaN = (baglam.sade.match(/\b(tir|tır|ton|kdv)\b/g) || []).length;
    const kisaTekYuk = baglam.sade.length < 500 && rotaN <= 3;
    if (kisaTekYuk) {
      aracTipiKod = aracKoduBul(baglam.sade);
    }
  }
  // 13.60 tır → TENTELI
  if (uzunluk != null && !aracTipiKod) {
    aracTipiKod = "TENTELI";
  }

  // Ana üsse uzak varış → düşük skor (Şüpheli); kayıt katmanı da eleyebilir.
  if (anaUs && varisIl) {
    const km = yaklasikKarayoluKm(anaUs, varisIl);
    if (km !== null && km > VARIS_UZA_KM) {
      skor = Math.min(skor, 40);
    }
  }

  // İRT / irtibat satırı varsa paylaşanın değil onu kullan
  const irtibat = irtibatTelefonuBul(baglam.ham);
  const telefon = irtibat || telefonTemizle(i.telefon);

  // Fiyat akıl kontrolü
  let ucret: number | null = turHam === "KOMPLE" ? fiyatHam : null;
  let fiyatTon: number | null = turHam === "TON_BASI" ? fiyatHam : null;
  let fiyatBelirsiz = turHam === "BELIRSIZ" || turHam === null;
  if (ucret != null) {
    const tl = ucret / 100;
    if (tl < FIYAT_AKIL.kompleMin || tl > FIYAT_AKIL.kompleMax) {
      console.log(
        `[ilanCozumle] FIYAT_AKIL komple ${tl} TL → belirsiz (${FIYAT_AKIL.kompleMin}–${FIYAT_AKIL.kompleMax})`
      );
      ucret = null;
      fiyatBelirsiz = true;
    }
  }
  if (fiyatTon != null) {
    const tl = fiyatTon / 100;
    if (tl < FIYAT_AKIL.tonMin || tl > FIYAT_AKIL.tonMax) {
      console.log(
        `[ilanCozumle] FIYAT_AKIL ton ${tl} TL → belirsiz (${FIYAT_AKIL.tonMin}–${FIYAT_AKIL.tonMax})`
      );
      fiyatTon = null;
      fiyatBelirsiz = true;
    }
  }

  return {
    firmaAdi,
    ilgiliKisi,
    telefon,
    nereden,
    nereye,
    cikisIl,
    varisIl,
    yuklemeTarihi: tarihCevir(i.yuklemeTarihi),
    ucret,
    fiyatTon,
    fiyatBelirsiz,
    tonaj: tonajTemizle(i.tonaj),
    aracTipi:
      aracTipi ||
      (uzunluk != null ? `tenteli ${uzunluk}m` : null) ||
      (aracTipiKod ? aracTipiKod : null),
    aracTipiKod,
    aracUzunluk: uzunluk,
    koridorTipi: null,
    yukTipi: i.yukTipi?.trim() || null,
    guvenSkoru: skor,
  };
}

/**
 * Kayda alınacak mı?
 * İki uç VEYA (çıkış + telefon — varışsız yükleme).
 * Eşik: GUVEN_MIN_KAYIT (15). Panel bildirim/liste: SUPHE_SINIRI (50).
 */
function kullanilabilirMi(i: CozulmusIlan): boolean {
  if (i.guvenSkoru < GUVEN_MIN_KAYIT) return false;
  if (i.cikisIl && i.varisIl) return true;
  // Varışsız yükleme — telefon varsa kaydet (kullanıcı arar)
  if (i.cikisIl && i.telefon) return true;
  return false;
}

function kullanilamazSebebi(
  i: CozulmusIlan
): "rotaYok" | "guvenDusuk" | null {
  if (i.guvenSkoru < GUVEN_MIN_KAYIT) return "guvenDusuk";
  if (i.cikisIl && i.varisIl) return null;
  if (i.cikisIl && i.telefon) return null;
  return "rotaYok";
}

/** Aynı il çifti (ilçe→il sonrası) tek kalsın; varışsız da tekil. */
function rotaNormDedup(ilanlar: CozulmusIlan[]): CozulmusIlan[] {
  const map = new Map<string, CozulmusIlan>();
  for (const i of ilanlar) {
    if (!i.cikisIl) continue;
    const k = `${i.telefon || ""}|${i.cikisIl}|${i.varisIl || "_"}`;
    const eski = map.get(k);
    if (!eski || i.guvenSkoru > eski.guvenSkoru) map.set(k, i);
  }
  return [...map.values()];
}

/**
 * Satır elemesi / eksik rota yerine kurtar:
 * telefon + koridor ili + yükleme → varışsız CIKIS kaydı.
 */
function yuklemeOlarakKurtar(
  ilan: CozulmusIlan,
  ham: string,
  koridor: Set<string>
): CozulmusIlan | null {
  if (!telefonVarMi(ham) && !ilan.telefon) return null;
  const cikis = ilan.cikisIl || ilBul(ilan.nereden);
  if (!cikis || !koridor.has(cikis)) return null;
  // Yükleme ifadesi satırda veya tüm metinde
  const satirOk =
    yuklemeIfadesiVarMi(ham) ||
    yuklemeIfadesiVarMi(ilan.nereden || "") ||
    !ilan.varisIl;
  if (!satirOk && ilan.varisIl) return null;
  return {
    ...ilan,
    cikisIl: cikis,
    nereden: ilan.nereden || cikis,
    varisIl: null,
    nereye: null,
    koridorTipi: "CIKIS",
    guvenSkoru: Math.min(Math.max(ilan.guvenSkoru, GUVEN_MIN_KAYIT), 40),
    telefon: ilan.telefon,
  };
}

export type CozumFiltre = {
  /** Kayıt filtresi (çekirdek bölge). Yoksa prompt kapsamı kullanılır. */
  filtreIlleri?: string[];
  anaUs?: string | null;
  /** A/B test: varsayılan MODEL_HIZLI yerine bu model. */
  model?: string;
  /** AiCagri kaynak öneki (örn. ab.nano). */
  kaynakOnek?: string;
};

async function tekParcaCozumle(
  parca: string,
  promptIlleri: string[],
  kaynak: string,
  filtre: CozumFiltre = {}
): Promise<{ ilanlar: CozulmusIlan[]; ele: CozumEleSayac }> {
  const model = filtre.model || MODEL_HIZLI;
  const girdi = guvenliKirp(parca, 12000);
  console.log(
    `[ilanCozumle] hamGirdi ${kaynak} guvenMin=${GUVEN_MIN_KAYIT}: ` +
      JSON.stringify(girdi.slice(0, 280))
  );
  const cikti = await aiJson<IlanCikti>({
    model,
    sistem: `${SISTEM}${kapsamTalimati(promptIlleri)}`,
    metin: `Bugünün tarihi: ${new Date().toISOString().slice(0, 10)}\n\nMETİN:\n${girdi}`,
    semaAdi: "yuk_ilanlari",
    sema: ILAN_LISTESI_SEMASI,
    // nano: minimal yok — none en ucuz geçerli effort
    caba: "none",
    maxCikti: AI_MAX_CIKTI,
    kaynak,
  });
  console.log(
    `[ilanCozumle] hamCevap ${kaynak}: ` +
      JSON.stringify(cikti).slice(0, 500)
  );

  const ele = bosCozumEle();
  const hamListe = cikti.ilanlar || [];
  if (hamListe.length === 0) ele.aiCevapBos += 1;

  const baglam = baglamCikar(parca);
  const filtreSet = new Set(filtre.filtreIlleri ?? promptIlleri);
  const sonuc: CozulmusIlan[] = [];
  for (const ham of hamListe) {
    let ilan = ilaniNormalize(ham, baglam, filtre.anaUs ?? null);
    if (!ilan.telefon) ilan.telefon = irtibatTelefonuBul(parca);

    let sebep = kullanilamazSebebi(ilan);
    if (sebep === "rotaYok") {
      const kurtar = yuklemeOlarakKurtar(ilan, parca, filtreSet);
      if (kurtar) {
        ilan = kurtar;
        sebep = null;
        console.log(
          `[ilanCozumle] YUKLEME_KURTAR ${ilan.cikisIl} (varış yok)`
        );
      }
    }
    if (sebep) {
      // Telefon + koridor ili → düşük güvenle yine de dene
      const kurtar = yuklemeOlarakKurtar(ilan, parca, filtreSet);
      if (kurtar) {
        ilan = kurtar;
      } else {
        ele[sebep] += 1;
        console.log(
          `[ilanCozumle] ${sebep} g=${ilan.guvenSkoru} ` +
            `${ilan.nereden || "?"}→${ilan.nereye || "?"} ` +
            `(${ilan.cikisIl || "-"}→${ilan.varisIl || "-"})`
        );
        continue;
      }
    }
    if (
      ilan.varisIl &&
      !rotaAyniSatirdaMi(ilan.nereden, ilan.nereye, parca)
    ) {
      const kurtar = yuklemeOlarakKurtar(ilan, parca, filtreSet);
      if (kurtar) {
        ilan = kurtar;
        console.log(
          `[ilanCozumle] SATIR→YUKLEME ${ilan.cikisIl} (satır elemesi yerine)`
        );
      } else if (ilan.telefon && ilan.cikisIl && filtreSet.has(ilan.cikisIl)) {
        // Telefon + koridor — atma, düşük güven
        ilan.guvenSkoru = Math.min(ilan.guvenSkoru, 35);
        console.log(
          `[ilanCozumle] SATIR_GEVSEK ${ilan.cikisIl}→${ilan.varisIl} g=${ilan.guvenSkoru}`
        );
      } else {
        ele.satirEle += 1;
        console.log(
          `[ilanCozumle] SATIR_ELE ${ilan.nereden || "?"}→${ilan.nereye || "?"} ` +
            `(çıkış/varış aynı satırda değil)`
        );
        continue;
      }
    }
    const { ele: kapsamEle, tip } = kapsamEleVeTip(ilan, filtreSet);
    ele.modelCikti += 1;
    if (kapsamEle === "DISI") {
      // Telefon + koridor çıkış → yükleme kurtar
      const kurtar = yuklemeOlarakKurtar(ilan, parca, filtreSet);
      if (kurtar) {
        sonuc.push(kurtar);
        console.log(`[ilanCozumle] DISI→YUKLEME ${kurtar.cikisIl}`);
        continue;
      }
      ele.bolgeElenen += 1;
      console.log(
        `[ilanCozumle] BÖLGE_ELE DISI ${ilan.cikisIl}→${ilan.varisIl}` +
          ` (${ilan.nereden || "?"}→${ilan.nereye || "?"})`
      );
      continue;
    }
    if (kapsamEle === "CIKIS") {
      // Varış null → kaydet; varış dışarıda biliniyorsa sadece say
      if (!ilan.varisIl) {
        ilan.koridorTipi = "CIKIS";
        console.log(`[ilanCozumle] koridor=CIKIS(yükleme) ${ilan.cikisIl}`);
        sonuc.push(ilan);
        continue;
      }
      ele.cikisSay += 1;
      console.log(
        `[ilanCozumle] CIKIS_SAY ${ilan.cikisIl}→${ilan.varisIl}` +
          ` (${ilan.nereden || "?"}→${ilan.nereye || "?"})`
      );
      continue;
    }
    console.log(
      `[ilanCozumle] koridor=${tip} ${ilan.cikisIl}→${ilan.varisIl || "?"}`
    );
    sonuc.push(ilan);
  }
  // AI kaç/kaçırdı → yükleme kurtarma
  if (sonuc.length === 0 && (telefonVarMi(parca) || irtibatTelefonuBul(parca))) {
    for (const ilan of yuklemeIlanlariMetinden(parca, filtreSet)) {
      sonuc.push(ilan);
      console.log(`[ilanCozumle] METIN_KURTAR ${ilan.cikisIl}`);
    }
  }
  return { ilanlar: rotaNormDedup(sonuc), ele };
}

/** Serbest metinden yük ilanlarını çıkarır. Uzun listeler 5'er rota parçalanır. */
export async function ilanlariCozumle(
  hamMetin: string,
  kapsamIlleri: string[] = [],
  filtre: CozumFiltre = {}
): Promise<CozulmusIlan[]> {
  const metin = hamMetin.trim();
  if (metin.length < 12) return [];
  const onek = filtre.kaynakOnek ? `${filtre.kaynakOnek}.` : "";

  const parcalar = mesajiAiParcalarinaBol(metin, AI_MAX_ROTA_PARCA);
  if (parcalar.length <= 1) {
    const r = await tekParcaCozumle(
      metin,
      kapsamIlleri,
      `${onek}ilanCozumle.tek`,
      filtre
    );
    return r.ilanlar;
  }

  const sonuc: CozulmusIlan[] = [];
  for (let i = 0; i < parcalar.length; i++) {
    const dilim = await tekParcaCozumle(
      parcalar[i],
      kapsamIlleri,
      `${onek}ilanCozumle.tek.p${i + 1}`,
      filtre
    );
    sonuc.push(...dilim.ilanlar);
  }
  return sonuc;
}

export type MesajGirdisi = { anahtar: number; metin: string };
export type MesajIlani = { anahtar: number; ilan: CozulmusIlan };

/** Koridor eleme kırılımı — günlük sayaç için. */
export type BolgeEleKirilim = {
  cikisDisi: number;
  varisDisi: number;
  ikisiDisi: number;
};

export const BOS_BOLGE_KIRILIM: BolgeEleKirilim = {
  cikisDisi: 0,
  varisDisi: 0,
  ikisiDisi: 0,
};

export function bolgeKirilimTopla(
  a: BolgeEleKirilim,
  b: BolgeEleKirilim
): BolgeEleKirilim {
  return {
    cikisDisi: a.cikisDisi + b.cikisDisi,
    varisDisi: a.varisDisi + b.varisDisi,
    ikisiDisi: a.ikisiDisi + b.ikisiDisi,
  };
}

/** Çıkış/varış koridor dışı mı — hangisi? */
export function bolgeEleTuru(
  cikis: string | null | undefined,
  varis: string | null | undefined,
  iller: Set<string>
): keyof BolgeEleKirilim | null {
  if (iller.size === 0 || iller.size >= 70) return null;
  if (!cikis || !varis) return "ikisiDisi";
  const cOk = iller.has(cikis);
  const vOk = iller.has(varis);
  if (cOk && vOk) return null;
  if (!cOk && !vOk) return "ikisiDisi";
  if (!cOk) return "cikisDisi";
  return "varisDisi";
}

export type MesajCozumRaporu = {
  ilanlar: MesajIlani[];
  /** Model yazdı ama sunucu bölge dışı diye eledi. */
  bolgeElenen: number;
  /** BOLGE_ROTA alt kırılımı. */
  bolgeKirilim: BolgeEleKirilim;
  /** Modelden gelen toplam ilan (elemeden önce). */
  modelCikti: number;
  /** Funnel kırılımı. */
  ele: CozumEleSayac;
};

/**
 * Çözümleme kapsamı — prompt ve sunucu AYNI liste.
 * VARIŞ koridorda ise yaz (dönüş yükü); sadece çıkış koridordaysa yazma.
 */
function kapsamTalimati(iller: string[]): string {
  if (iller.length === 0 || iller.length >= 70) return "";
  return `

KAPSAM (KORİDOR):
- VARIŞ şu illerden biriyse ilanı YAZ (çıkış dışarıda olsa da —
  ör. Elazığ→Ankara = dönüş yükü).
- "ANKARA YÜKLEME" / çıkışlı (varış yok) → YAZ, nereye=null.
- Sadece ÇIKIŞ listede + VARIŞ bilinen dışarıdaysa (Ankara→İzmir)
  HİÇ yazma.
- İki uç da dışarıdaysa yazma.
İller: ${iller.join(", ")}
İlçe/semt → bağlı il (Ostim→Ankara, Gebze→Kocaeli, Hadımköy→İstanbul,
Yahşihan→Kırıkkale, Gölbaşı→Ankara, Cerrahpaşa→İstanbul).`;
}

/**
 * Kayda alınmayacak mı?
 * DISI elenir; CIKIS+varış bilinen dış elenir (sadece say);
 * CIKIS+varış null ve TAM/VARIS geçer.
 */
function kapsamEleVeTip(
  ilan: CozulmusIlan,
  iller: Set<string>
): { ele: "DISI" | "CIKIS" | null; tip: KoridorTipi } {
  const tip = koridorTipiBelirle(iller, ilan.cikisIl, ilan.varisIl);
  ilan.koridorTipi = tip;
  if (tip === "DISI") return { ele: "DISI", tip };
  // CIKIS + bilinen dış varış → say, kaydetme; varışsız → kaydet
  if (tip === "CIKIS" && ilan.varisIl) return { ele: "CIKIS", tip };
  return { ele: null, tip };
}

/**
 * Chunk'ları çağrı başına en fazla AI_MAX_ROTA_PARCA rota VE
 * AI_MAX_MESAJ_PARCA dilim olacak şekilde paketler.
 * (Rota=0 sayılan kısa mesajlar eskiden sınırsız paketlenip 2500'e dayanıyordu.)
 */
function rotaPaketleri(mesajlar: MesajGirdisi[]): MesajGirdisi[][] {
  const genis: MesajGirdisi[] = [];
  for (const m of mesajlar) {
    for (const p of mesajiAiParcalarinaBol(m.metin, AI_MAX_ROTA_PARCA)) {
      genis.push({ anahtar: m.anahtar, metin: p });
    }
  }

  const mesajLimit = Math.max(1, Math.floor(AI_MAX_MESAJ_PARCA) || 3);
  const paketler: MesajGirdisi[][] = [];
  let mevcut: MesajGirdisi[] = [];
  let rotaToplam = 0;
  for (const m of genis) {
    const r = rotaSatirSayisi(m.metin);
    const tasma =
      mevcut.length > 0 &&
      (rotaToplam + r > AI_MAX_ROTA_PARCA || mevcut.length >= mesajLimit);
    if (tasma) {
      paketler.push(mevcut);
      mevcut = [];
      rotaToplam = 0;
    }
    mevcut.push(m);
    rotaToplam += r;
  }
  if (mevcut.length > 0) paketler.push(mevcut);
  return paketler;
}

async function partiPaketiCozumle(
  paket: MesajGirdisi[],
  promptIlleri: string[],
  kaynak: string,
  filtre: CozumFiltre = {}
): Promise<MesajCozumRaporu> {
  const govde = paket
    .map((m, sira) => `[${sira + 1}]\n${guvenliKirp(m.metin.trim(), 1200)}`)
    .join("\n\n");
  console.log(
    `[ilanCozumle] hamGirdi ${kaynak} ids=${paket.map((p) => p.anahtar).join(",")} ` +
      `guvenMin=${GUVEN_MIN_KAYIT}: ` +
      JSON.stringify(govde.slice(0, 400))
  );

  const cikti = await aiJson<MesajIlanCikti>({
    model: filtre.model || MODEL_HIZLI,
    sistem: `${SISTEM}

Mesajlar [1], [2] gibi numaralarla ayrılmıştır. Her ilan için mesajNo
alanına ilanın alındığı mesajın numarasını yaz. Bir mesajda birden fazla
ilan varsa hepsini ayrı ayrı listele.${kapsamTalimati(promptIlleri)}`,
    metin: `Bugünün tarihi: ${new Date().toISOString().slice(0, 10)}\n\nMESAJLAR:\n${govde}`,
    semaAdi: "mesaj_yuk_ilanlari",
    sema: MESAJ_ILAN_SEMASI,
    caba: "none",
    maxCikti: AI_MAX_CIKTI,
    kaynak,
  });
  console.log(
    `[ilanCozumle] hamCevap ${kaynak}: ` + JSON.stringify(cikti).slice(0, 500)
  );

  const baglamlar = paket.map((m) => baglamCikar(m.metin));
  const filtreSet = new Set(filtre.filtreIlleri ?? promptIlleri);
  const ilanlar: MesajIlani[] = [];
  let bolgeElenen = 0;
  const bolgeKirilim: BolgeEleKirilim = { ...BOS_BOLGE_KIRILIM };
  let modelCikti = 0;
  const ele = bosCozumEle();
  const hamListe = cikti.ilanlar || [];
  if (hamListe.length === 0) ele.aiCevapBos += 1;

  for (const ham of hamListe) {
    const sira = Math.round(ham.mesajNo) - 1;
    const kaynakMesaj = paket[sira];
    if (!kaynakMesaj) continue;

    let ilan = ilaniNormalize(ham, baglamlar[sira], filtre.anaUs ?? null);
    if (!ilan.telefon) ilan.telefon = irtibatTelefonuBul(kaynakMesaj.metin);

    let sebep = kullanilamazSebebi(ilan);
    if (sebep) {
      const kurtar = yuklemeOlarakKurtar(ilan, kaynakMesaj.metin, filtreSet);
      if (kurtar) {
        ilan = kurtar;
        sebep = null;
      } else {
        ele[sebep] += 1;
        console.log(
          `[ilanCozumle] ${sebep} g=${ilan.guvenSkoru} ham=#${kaynakMesaj.anahtar} ` +
            `${ilan.nereden || "?"}→${ilan.nereye || "?"}`
        );
        continue;
      }
    }
    if (
      ilan.varisIl &&
      !rotaAyniSatirdaMi(ilan.nereden, ilan.nereye, kaynakMesaj.metin)
    ) {
      const kurtar = yuklemeOlarakKurtar(ilan, kaynakMesaj.metin, filtreSet);
      if (kurtar) {
        ilan = kurtar;
      } else if (
        ilan.telefon &&
        ilan.cikisIl &&
        filtreSet.has(ilan.cikisIl)
      ) {
        ilan.guvenSkoru = Math.min(ilan.guvenSkoru, 35);
      } else {
        ele.satirEle += 1;
        console.log(
          `[ilanCozumle] SATIR_ELE ${ilan.nereden || "?"}→${ilan.nereye || "?"} ` +
            `(çıkış/varış aynı satırda değil)`
        );
        continue;
      }
    }
    modelCikti += 1;
    ele.modelCikti += 1;
    const { ele: kapsamEle, tip } = kapsamEleVeTip(ilan, filtreSet);
    if (kapsamEle === "DISI") {
      const kurtar = yuklemeOlarakKurtar(ilan, kaynakMesaj.metin, filtreSet);
      if (kurtar) {
        ilanlar.push({ anahtar: kaynakMesaj.anahtar, ilan: kurtar });
        continue;
      }
      bolgeElenen += 1;
      ele.bolgeElenen += 1;
      bolgeKirilim.ikisiDisi += 1;
      console.log(
        `[ilanCozumle] BÖLGE_ELE DISI ${ilan.cikisIl}→${ilan.varisIl}` +
          ` (${ilan.nereden || "?"}→${ilan.nereye || "?"})`
      );
      continue;
    }
    if (kapsamEle === "CIKIS") {
      if (!ilan.varisIl) {
        ilan.koridorTipi = "CIKIS";
        ilanlar.push({ anahtar: kaynakMesaj.anahtar, ilan });
        continue;
      }
      ele.cikisSay += 1;
      bolgeKirilim.varisDisi += 1;
      console.log(
        `[ilanCozumle] CIKIS_SAY ${ilan.cikisIl}→${ilan.varisIl}` +
          ` (${ilan.nereden || "?"}→${ilan.nereye || "?"})`
      );
      continue;
    }
    if (tip === "VARIS") {
      bolgeKirilim.cikisDisi += 1;
    }
    console.log(
      `[ilanCozumle] koridor=${tip} ham=#${kaynakMesaj.anahtar} ` +
        `${ilan.cikisIl}→${ilan.varisIl || "?"}`
    );
    ilanlar.push({ anahtar: kaynakMesaj.anahtar, ilan });
  }

  // AI boş / hepsi elendi ama telefon+koridor yükleme var → kurtar
  for (const m of paket) {
    if (ilanlar.some((x) => x.anahtar === m.anahtar)) continue;
    if (!telefonVarMi(m.metin) && !irtibatTelefonuBul(m.metin)) continue;
    const kurtarilan = yuklemeIlanlariMetinden(m.metin, filtreSet);
    for (const ilan of kurtarilan) {
      ilanlar.push({ anahtar: m.anahtar, ilan });
      console.log(
        `[ilanCozumle] METIN_KURTAR ham=#${m.anahtar} ${ilan.cikisIl}`
      );
    }
  }

  return { ilanlar, bolgeElenen, bolgeKirilim, modelCikti, ele };
}

/**
 * Ham metinden "ANKARA YÜKLEME" satırlarını çıkar (AI kaçırdıysa).
 */
export function yuklemeIlanlariMetinden(
  metin: string,
  koridor: Set<string>
): CozulmusIlan[] {
  const tel =
    irtibatTelefonuBul(metin) ||
    telefonTemizle(
      (metin.match(
        /(?:\+?90|0)\s*5\d{2}[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}/
      ) || [])[0] || null
    );
  if (!tel && !telefonVarMi(metin)) return [];
  const sonuc: CozulmusIlan[] = [];
  const gorulen = new Set<string>();
  for (const satir of satirlaraBol(metin)) {
    if (!yuklemeIfadesiVarMi(satir)) continue;
    const iller = illeriBul(satir).filter((il) => koridor.has(il));
    for (const il of iller) {
      if (gorulen.has(il)) continue;
      gorulen.add(il);
      sonuc.push({
        firmaAdi: null,
        ilgiliKisi: null,
        telefon: tel,
        nereden: il,
        nereye: null,
        cikisIl: il,
        varisIl: null,
        yuklemeTarihi: null,
        ucret: null,
        fiyatTon: null,
        fiyatBelirsiz: true,
        tonaj: null,
        aracTipi: /tenteli|13[.,]?60/i.test(metin) ? "tenteli" : null,
        aracTipiKod: /tenteli|13[.,]?60/i.test(metin) ? "TENTELI" : null,
        aracUzunluk: /13[.,]?60/.test(metin) ? 13.6 : null,
        koridorTipi: "CIKIS",
        yukTipi: null,
        guvenSkoru: 40,
      });
    }
  }
  return sonuc;
}

function raporBirlestir(a: MesajCozumRaporu, b: MesajCozumRaporu): MesajCozumRaporu {
  return {
    ilanlar: [...a.ilanlar, ...b.ilanlar],
    bolgeElenen: a.bolgeElenen + b.bolgeElenen,
    bolgeKirilim: bolgeKirilimTopla(a.bolgeKirilim, b.bolgeKirilim),
    modelCikti: a.modelCikti + b.modelCikti,
    ele: cozumEleTopla(a.ele, b.ele),
  };
}

/**
 * Paket KESILDI olursa: önceki başarıyı koru, paketi böl / daha ince
 * chunk'la yeniden dene. Tüm parti'yi baştan atma.
 */
async function paketKesilmeyeDiren(
  paket: MesajGirdisi[],
  promptIlleri: string[],
  kaynak: string,
  filtre: CozumFiltre,
  derinlik = 0
): Promise<MesajCozumRaporu> {
  try {
    return await partiPaketiCozumle(paket, promptIlleri, kaynak, filtre);
  } catch (hata) {
    if (!(hata instanceof AiHatasi) || hata.kod !== "KESILDI") throw hata;

    const tahmini = paket.reduce((s, m) => s + rotaSatirSayisi(m.metin), 0);
    console.warn(
      `[ilanCozumle] KESILDI ${kaynak} ~${tahmini} rota / ${paket.length} dilim` +
        ` — çıktı israf; bölünüyor (derinlik ${derinlik})`
    );

    if (paket.length >= 2) {
      const orta = Math.ceil(paket.length / 2);
      const sol = await paketKesilmeyeDiren(
        paket.slice(0, orta),
        promptIlleri,
        `${kaynak}.a`,
        filtre,
        derinlik + 1
      );
      const sag = await paketKesilmeyeDiren(
        paket.slice(orta),
        promptIlleri,
        `${kaynak}.b`,
        filtre,
        derinlik + 1
      );
      return raporBirlestir(sol, sag);
    }

    // Tek dilim: daha küçük rota chunk'larıyla tek-mesaj yoluna düş.
    const m = paket[0];
    const inceLimit = Math.max(2, Math.floor(AI_MAX_ROTA_PARCA / 2));
    const dilimler = mesajiAiParcalarinaBol(m.metin, inceLimit);
    if (dilimler.length <= 1 && derinlik >= 2) {
      console.warn(
        `[ilanCozumle] KESILDI vazgeçildi ${kaynak} — ~${tahmini} rota kaybedildi`
      );
      return {
        ilanlar: [],
        bolgeElenen: 0,
        bolgeKirilim: { ...BOS_BOLGE_KIRILIM },
        modelCikti: 0,
        ele: bosCozumEle(),
      };
    }

    const ilanlar: MesajIlani[] = [];
    let bolgeElenen = 0;
    let bolgeKirilim: BolgeEleKirilim = { ...BOS_BOLGE_KIRILIM };
    let modelCikti = 0;
    let ele = bosCozumEle();
    const hedefler = dilimler.length > 1 ? dilimler : [m.metin];
    for (let i = 0; i < hedefler.length; i++) {
      try {
        const parca = await tekParcaCozumle(
          hedefler[i],
          promptIlleri,
          `${kaynak}.tek${i + 1}`,
          filtre
        );
        modelCikti += parca.ilanlar.length;
        ele = cozumEleTopla(ele, parca.ele);
        for (const ilan of parca.ilanlar) {
          ilanlar.push({ anahtar: m.anahtar, ilan });
        }
      } catch (e) {
        if (e instanceof AiHatasi && e.kod === "KESILDI" && derinlik < 3) {
          const alt = await paketKesilmeyeDiren(
            [{ anahtar: m.anahtar, metin: hedefler[i] }],
            promptIlleri,
            `${kaynak}.r${i + 1}`,
            filtre,
            derinlik + 1
          );
          ilanlar.push(...alt.ilanlar);
          bolgeElenen += alt.bolgeElenen;
          bolgeKirilim = bolgeKirilimTopla(bolgeKirilim, alt.bolgeKirilim);
          modelCikti += alt.modelCikti;
          ele = cozumEleTopla(ele, alt.ele);
          continue;
        }
        throw e;
      }
    }
    return { ilanlar, bolgeElenen, bolgeKirilim, modelCikti, ele };
  }
}

/**
 * Grup mesajlarını çözümler; her ilan geldiği mesaja bağlanır.
 * Uzun listeler 5 rota/çağrı paketlerine bölünür — kesilme / yeniden
 * deneme israfını önlemek için.
 */
export async function mesajlariCozumle(
  mesajlar: MesajGirdisi[],
  kapsamIlleri: string[] = [],
  filtre: CozumFiltre = {}
): Promise<MesajCozumRaporu> {
  const gecerli = mesajlar.filter((m) => m.metin.trim().length >= 12);
  if (gecerli.length === 0) {
    return {
      ilanlar: [],
      bolgeElenen: 0,
      bolgeKirilim: { ...BOS_BOLGE_KIRILIM },
      modelCikti: 0,
      ele: bosCozumEle(),
    };
  }

  const paketler = rotaPaketleri(gecerli);
  const ilanlar: MesajIlani[] = [];
  let bolgeElenen = 0;
  let bolgeKirilim: BolgeEleKirilim = { ...BOS_BOLGE_KIRILIM };
  let modelCikti = 0;
  let ele = bosCozumEle();

  for (let i = 0; i < paketler.length; i++) {
    const kaynak =
      paketler.length > 1 ? `ilanCozumle.parti.p${i + 1}` : "ilanCozumle.parti";
    const rapor = await paketKesilmeyeDiren(
      paketler[i],
      kapsamIlleri,
      kaynak,
      filtre
    );
    ilanlar.push(...rapor.ilanlar);
    bolgeElenen += rapor.bolgeElenen;
    bolgeKirilim = bolgeKirilimTopla(bolgeKirilim, rapor.bolgeKirilim);
    modelCikti += rapor.modelCikti;
    ele = cozumEleTopla(ele, rapor.ele);
  }

  if (bolgeElenen > 0 || ele.aiCevapBos > 0 || ele.rotaYok > 0) {
    console.log(
      `[ilanCozumle] ele funnel: ` +
        JSON.stringify({ ...ele, bolgeKirilim, kabul: ilanlar.length })
    );
  }

  return { ilanlar, bolgeElenen, bolgeKirilim, modelCikti, ele };
}
