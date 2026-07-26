import { aiJson } from "@/lib/ai/istemci";
import { AI_MAX_CIKTI } from "@/lib/ai/modeller";
import { MODEL_HIZLI } from "@/lib/ai/modeller";
import {
  ILAN_LISTESI_SEMASI,
  MESAJ_ILAN_SEMASI,
  type IlanCikti,
  type MesajIlanCikti,
} from "@/lib/ai/semalar";
import { aracKoduBul, type AracTipiKodu } from "@/lib/arac";
import { ilBul, illeriBul, sadelestir } from "@/lib/iller";
import { guvenliKirp } from "@/lib/metin";

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
- "Ankara > Bolu", "Ankara-Bolu", "Ankaradan Boluya" gibi yazımların hepsi
  çıkış ve varış demektir.
- ÇOK GÜZERGAHLI MESAJ: Bir mesajda birden çok güzergah listelenmiş olabilir
  ("ÇAN'DAN: VAN 2400+, KONYA 850+, MERSİN 1100+"). Her satırı AYRI ilan yap.
  Ortak çıkış yerini hepsine uygula ama bir satırın varışını veya fiyatını
  ASLA başka satıra taşıma. "İlk N rota" diye kesme — hepsini çıkar.
- FİYAT TÜRÜ: ton mu komple mi ayırt et. "ton", "/ton", "TL/ton" veya
  X+KDV liste formatı ("VAN 2400+", "900+KDV") → TON_BASI. "komple",
  "navlun", "toplam", "araç" ile verilen tek büyük tutar → KOMPLE.
  Anlaşılmıyorsa ucretTl null ve ucretTuru BELIRSIZ.
- Ücret "8500", "8.500 TL", "8500tl" gibi yazılabilir; sadece sayıyı ver.
  Ücret yazmıyorsa null bırak.
- tonaj: yükün ton cinsinden ağırlığı ("24 ton" -> 24). "3 TİR", "10 araç"
  gibi ifadeler ARAÇ ADEDİDİR, tonaj değildir; onları tonaja yazma.
- Telefonu sadece rakam olarak ver (05321234567).
- Uydurma bilgi ekleme; yoksa null bırak.
- guvenSkoru: metin net bir yük ilanıysa 80-100, şüpheliyse 40-70, zayıfsa 0-39.`;

export type CozulmusIlan = {
  firmaAdi: string | null;
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
  yukTipi: string | null;
  guvenSkoru: number;
};

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
export type MetinBaglami = { sade: string; iller: Set<string> };

export function baglamCikar(hamMetin: string): MetinBaglami {
  return { sade: sadelestir(hamMetin), iller: new Set(illeriBul(hamMetin)) };
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

function ilaniNormalize(i: HamIlan, baglam: MetinBaglami): CozulmusIlan {
  let nereden = i.nereden?.trim() || null;
  let nereye = i.nereye?.trim() || null;
  let skor = Math.max(0, Math.min(100, Math.round(i.guvenSkoru ?? 0)));

  // Uydurulan alan silinir; skor 40 altına iner → Şüpheli sekmesine düşer.
  if (!yerMetindeVarMi(nereden, baglam)) {
    nereden = null;
    skor = Math.min(skor, 35);
  }
  if (!yerMetindeVarMi(nereye, baglam)) {
    nereye = null;
    skor = Math.min(skor, 35);
  }

  // İl sunucuda türetilir; türetilen il de ham metin bağlamında olmalı.
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

  const fiyat = ucretKurusaCevir(i.ucretTl);
  const tur = fiyat === null ? null : i.ucretTuru;

  return {
    firmaAdi: i.firmaAdi?.trim() || null,
    telefon: telefonTemizle(i.telefon),
    nereden,
    nereye,
    cikisIl,
    varisIl,
    yuklemeTarihi: tarihCevir(i.yuklemeTarihi),
    ucret: tur === "KOMPLE" ? fiyat : null, // fiyatKomple
    fiyatTon: tur === "TON_BASI" ? fiyat : null,
    fiyatBelirsiz: tur === "BELIRSIZ",
    tonaj: tonajTemizle(i.tonaj),
    aracTipi: i.aracTipi?.trim() || null,
    aracTipiKod: aracKoduBul(i.aracTipi),
    yukTipi: i.yukTipi?.trim() || null,
    guvenSkoru: skor,
  };
}

/**
 * Kayda alınacak mı? Düşük güven (<50) Şüpheli'ye gider; tamamen boş /
 * uydurma temizlenmiş ilanlar atılır. Eski eşik 40, uydurma cezalı
 * ilanları (skor 35) düşürüyordu — Şüpheli sekmesi boş kalıyordu.
 */
function kullanilabilirMi(i: CozulmusIlan): boolean {
  const yerVar = Boolean(i.cikisIl || i.varisIl || i.nereden || i.nereye);
  return yerVar && i.guvenSkoru >= 15;
}

/** Serbest metinden yük ilanlarını çıkarır. */
export async function ilanlariCozumle(
  hamMetin: string,
  kapsamIlleri: string[] = []
): Promise<CozulmusIlan[]> {
  const metin = hamMetin.trim();
  if (metin.length < 12) return [];

  const cikti = await aiJson<IlanCikti>({
    model: MODEL_HIZLI,
    sistem: `${SISTEM}${kapsamTalimati(kapsamIlleri)}`,
    metin: `Bugünün tarihi: ${new Date().toISOString().slice(0, 10)}\n\nMETİN:\n${guvenliKirp(metin, 12000)}`,
    semaAdi: "yuk_ilanlari",
    sema: ILAN_LISTESI_SEMASI,
    caba: "low",
    maxCikti: AI_MAX_CIKTI,
    kaynak: "ilanCozumle.tek",
  });

  const baglam = baglamCikar(metin);
  const kapsam = new Set(kapsamIlleri);
  const sonuc: CozulmusIlan[] = [];
  for (const ham of cikti.ilanlar || []) {
    const ilan = ilaniNormalize(ham, baglam);
    if (!kullanilabilirMi(ilan)) continue;
    if (kapsamDisiMi(ilan, kapsam)) continue;
    sonuc.push(ilan);
  }
  return sonuc;
}

export type MesajGirdisi = { anahtar: number; metin: string };
export type MesajIlani = { anahtar: number; ilan: CozulmusIlan };

export type MesajCozumRaporu = {
  ilanlar: MesajIlani[];
  /** Model yazdı ama sunucu bölge dışı diye eledi. */
  bolgeElenen: number;
  /** Modelden gelen toplam ilan (elemeden önce). */
  modelCikti: number;
};

/**
 * Çözümlemenin il kapsamı. Bir komisyoncu tek mesajda 30 rota
 * listeliyor; hepsinin JSON'unu yazdırmak çıktı token'ının çoğunu
 * ilgilenilmeyen güzergahlara harcamak demek.
 *
 * "İlk N rota" kesmiyoruz — sıralama rastgele, iyi yük kaybolur.
 * Bunun yerine sadece hedef bölge + komşulara değen rotalar çıkarılır.
 */
function kapsamTalimati(iller: string[]): string {
  if (iller.length === 0 || iller.length >= 70) return "";
  return `

KAPSAM (ZORUNLU): Sadece çıkışı VEYA varışı şu illerden birinde olan
güzergahları çıkar. Diğer güzergahları HİÇ yazma, listeye ekleme.
${iller.join(", ")}
İlçe/semt adı yazılmışsa bağlı olduğu ile göre değerlendir
(ör. Ostim→Ankara, Gebze→Kocaeli, Hadımköy→İstanbul).`;
}

/** İlan kapsam dışı mı? Sadece iki uç da bilinip ikisi de dışardaysa evet. */
function kapsamDisiMi(ilan: CozulmusIlan, iller: Set<string>): boolean {
  if (iller.size === 0) return false;
  const cikis = ilan.cikisIl;
  const varis = ilan.varisIl;
  if (!cikis && !varis) return false;
  if (cikis && iller.has(cikis)) return false;
  if (varis && iller.has(varis)) return false;
  // Bir uç çözülemediyse kapsam dışı olduğunu kanıtlayamayız, elemeyiz.
  return Boolean(cikis) && Boolean(varis);
}

/**
 * Grup mesajlarını tek çağrıda çözümler; her ilan geldiği mesaja bağlanır.
 * Mesaj başına ayrı istek atmak hem yavaş hem pahalı olduğu için toplu
 * gönderilir, ancak ham metin eşlemesi mesaj bazında korunur.
 */
export async function mesajlariCozumle(
  mesajlar: MesajGirdisi[],
  kapsamIlleri: string[] = []
): Promise<MesajCozumRaporu> {
  const gecerli = mesajlar.filter((m) => m.metin.trim().length >= 12);
  if (gecerli.length === 0) {
    return { ilanlar: [], bolgeElenen: 0, modelCikti: 0 };
  }

  const govde = gecerli
    .map((m, sira) => `[${sira + 1}]\n${guvenliKirp(m.metin.trim(), 1200)}`)
    .join("\n\n");

  const cikti = await aiJson<MesajIlanCikti>({
    model: MODEL_HIZLI,
    sistem: `${SISTEM}

Mesajlar [1], [2] gibi numaralarla ayrılmıştır. Her ilan için mesajNo
alanına ilanın alındığı mesajın numarasını yaz. Bir mesajda birden fazla
ilan varsa hepsini ayrı ayrı listele.${kapsamTalimati(kapsamIlleri)}`,
    metin: `Bugünün tarihi: ${new Date().toISOString().slice(0, 10)}\n\nMESAJLAR:\n${govde}`,
    semaAdi: "mesaj_yuk_ilanlari",
    sema: MESAJ_ILAN_SEMASI,
    caba: "low",
    // Reasoning de bu havuzdan yer; 1500 varsayılan (OPENAI_MAX_CIKTI).
    maxCikti: AI_MAX_CIKTI,
    kaynak: "ilanCozumle.parti",
  });

  // Doğrulama mesaj bazında yapılır: hem uydurma yeri hem de ilanı yanlış
  // mesaja bağlama hatasını yakalar.
  const baglamlar = gecerli.map((m) => baglamCikar(m.metin));
  const kapsam = new Set(kapsamIlleri);

  const ilanlar: MesajIlani[] = [];
  let bolgeElenen = 0;
  let modelCikti = 0;

  for (const ham of cikti.ilanlar || []) {
    const sira = Math.round(ham.mesajNo) - 1;
    const kaynak = gecerli[sira];
    if (!kaynak) continue;

    const ilan = ilaniNormalize(ham, baglamlar[sira]);
    if (!kullanilabilirMi(ilan)) continue;
    modelCikti += 1;
    if (kapsamDisiMi(ilan, kapsam)) {
      bolgeElenen += 1;
      continue;
    }
    ilanlar.push({ anahtar: kaynak.anahtar, ilan });
  }

  if (bolgeElenen > 0) {
    console.log(
      `[ilanCozumle] bölge dışı rota elendi: ${bolgeElenen}` +
        ` (kabul: ${ilanlar.length}, model: ${modelCikti})`
    );
  }

  return { ilanlar, bolgeElenen, modelCikti };
}
