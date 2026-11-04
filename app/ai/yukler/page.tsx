import { prisma } from "@/lib/prisma";
import { aktifBaglam } from "@/lib/baglam";
import { anaPrisma } from "@/lib/prismaAna";
import { uyeIlanDurumlari } from "@/lib/uyeIlan";
import { kurustanGiris, tlYaz } from "@/lib/para";
import { aiTercihleriOku } from "@/lib/ayarlar";
import { aiKapaliMi, aiKullanilabilir } from "@/lib/ai/istemci";
import { aracTipiAdi } from "@/lib/arac";
import { ilBul, sehirHavzasi } from "@/lib/iller";
import { SUPHE_SINIRI, tercihKosulu, webKaynakHaricKosulu } from "@/lib/kaynaklar/filtre";
import YukBulGorunum from "@/components/yuk/YukBulGorunum";
import type { RotaCip } from "@/components/yuk/AramaTepsisi";
import { fiyatAkliDisiMi } from "@/lib/ai/ilanCozumle";
import {
  hatAnahtar,
  hatOrtalamalariYukle,
  karHesapla,
  karOzetYazi,
} from "@/lib/karHesap";
import { panelTazeSinir, solukMu, yeniIlanSinir } from "@/lib/ilanTazelik";
import { gorusmeSatiri } from "@/lib/kaynaklar/waGorusme";
import { daemonSorunlari, eslemeKodu } from "@/lib/kaynaklar/daemonNabiz";
import { whatsappYeniKodIste } from "@/app/ai-actions";
import type { Prisma } from "@prisma/client";
import { aracKonumu, aracYonleri, konumKosulu } from "@/lib/konum";
import { yakinCevredeMi, yakinlikYazisi, yuklemeYakinligi } from "@/lib/yakinlik";

/** Yakın çevre için aday çıkış illeri (il merkezi km); asıl süzme ilçe mesafesiyle */
const ADAY_IL_KM = 110;
import { aktifYolculuklar, yakinIller } from "@/lib/donus";

export const dynamic = "force-dynamic";

/** Üyede: dönüş eşleştirmesi ve şüpheli kutusu yöneticinin işi */
const UYE_SEKMELERI = ["YENI", "ILGILENIYOR", "HEPSI"];

const SEKMELER = [
  { kod: "YENI", ad: "Yeni" },
  { kod: "ILGILENIYOR", ad: "Takip" },
  { kod: "DONUS", ad: "Dönüş" },
  { kod: "HEPSI", ad: "Hepsi" },
  { kod: "SUPHELI", ad: "Şüpheli" },
] as const;

const DORT_SAAT_MS = 4 * 60 * 60 * 1000;

const VARSAYILAN_CIPLER: RotaCip[] = [
  { etiket: "Ankara→İstanbul", nereden: "Ankara", nereye: "İstanbul" },
  { etiket: "İstanbul→Ankara", nereden: "İstanbul", nereye: "Ankara" },
  { etiket: "Gebze→Ankara", nereden: "Gebze", nereye: "Ankara" },
  { etiket: "Ankara→Bolu", nereden: "Ankara", nereye: "Bolu" },
  { etiket: "Kocaeli→Ankara", nereden: "Kocaeli", nereye: "Ankara" },
];


function iyiIsMi(ilan: {
  sonGorulme: Date;
  guvenSkoru: number;
  ucret: number | null;
  fiyatTon: number | null;
}): boolean {
  const taze = Date.now() - ilan.sonGorulme.getTime() < DORT_SAAT_MS;
  const fiyatVar =
    (ilan.ucret !== null && ilan.ucret > 0) ||
    (ilan.fiyatTon !== null && ilan.fiyatTon > 0);
  return taze && ilan.guvenSkoru >= 70 && fiyatVar;
}

function rotaCipleri(rotalar: string[]): RotaCip[] {
  const sonuc: RotaCip[] = [];
  const gorulen = new Set<string>();
  const ekle = (c: RotaCip) => {
    const k = `${c.nereden}|${c.nereye}`.toLocaleLowerCase("tr-TR");
    if (gorulen.has(k)) return;
    gorulen.add(k);
    sonuc.push(c);
  };
  for (const r of rotalar) {
    const parca = r
      .split(/[->→]+/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (parca.length < 2) continue;
    const a = ilBul(parca[0]) || parca[0];
    const b = ilBul(parca[1]) || parca[1];
    ekle({ etiket: `${a}→${b}`, nereden: a, nereye: b });
  }
  for (const c of VARSAYILAN_CIPLER) ekle(c);
  return sonuc.slice(0, 8);
}

function sekmeHref(
  kod: string,
  nereden: string,
  nereye: string,
  arsiv = false
): string {
  if (kod === "MUSTERI") return "/ai/musteriler";
  const p = new URLSearchParams();
  p.set("sekme", kod);
  if (nereden) p.set("nereden", nereden);
  if (nereye) p.set("nereye", nereye);
  if (arsiv) p.set("arsiv", "1");
  return `/ai/yukler?${p.toString()}`;
}

export default async function AiYuklerSayfasi({
  searchParams,
}: {
  searchParams: Promise<{
    sekme?: string;
    id?: string;
    nereden?: string;
    nereye?: string;
    arsiv?: string;
    /** 1: araç konumu filtresi olmadan tüm koridor */
    her?: string;
  }>;
}) {
  const sp = await searchParams;
  // Üye: ilanlar ortak listeden (ana şema) salt okunur gelir; takip/gizleme
  // üyenin kendi defterinde. Yöneticinin ilan durumları, görüşmeleri, Telegram
  // kimlikleri üyeye geçmez.
  const uye = (await aktifBaglam()).uyeId !== null;
  const ilanDb = uye ? anaPrisma : prisma;
  const uyeDurum = uye ? await uyeIlanDurumlari() : new Map<number, string>();
  const uyeTakipIdleri = [...uyeDurum].filter(([, d]) => d !== "ELENDI").map(([id]) => id);
  const uyeGizliIdler = [...uyeDurum].filter(([, d]) => d === "ELENDI").map(([id]) => id);
  const sekmeKodlari = uye ? UYE_SEKMELERI : SEKMELER.map((s) => s.kod);
  const sekme = sekmeKodlari.includes(sp.sekme as string)
    ? (sp.sekme as string)
    : "YENI";
  const odakId = Number(sp.id);
  const odak =
    Number.isInteger(odakId) && odakId > 0 ? odakId : null;
  const arsivGoster = sp.arsiv === "1";

  const neredenHam = (sp.nereden || "").trim();
  const nereyeHam = (sp.nereye || "").trim();
  const cikisIl = neredenHam ? ilBul(neredenHam) : null;
  const varisIl = nereyeHam ? ilBul(nereyeHam) : null;
  const neredenHata = Boolean(neredenHam && !cikisIl);
  const nereyeHata = Boolean(nereyeHam && !varisIl);

  const tercih = await aiTercihleriOku();

  // Arşiv canlandırma cron'da (ai-kuyruk) — sayfa açılışında DB yazısı paneli kilitliyordu.

  const rotaFiltresiVar = Boolean(neredenHam || nereyeHam);
  const aktifDurumlar = [
    "YENI",
    "ILGILENIYOR",
    "ILETISIME_GECILDI",
    "PAZARLIKTA",
    "CEVAP_YOK",
    "ALINDI",
  ] as const;

  // Şehir/rota aranınca «Yeni» sekmesi Ankara çıkışını yutuyordu:
  // Bilgi Sor / Ara sonrası durum ILETISIME_GECILDI oluyor, Yeni'de 0 kalıyordu.
  let tabanFiltre: Prisma.YukIlaniWhereInput =
    sekme === "SUPHELI"
      ? {
          OR: [
            { guvenSkoru: { lt: SUPHE_SINIRI }, durum: { not: "ARSIV" } },
            { durum: "ELENDI" },
          ],
        }
      : sekme === "HEPSI"
        ? {
            guvenSkoru: { gte: SUPHE_SINIRI },
            durum: { notIn: ["ARSIV", "ELENDI"] },
          }
        : sekme === "DONUS"
          ? {
              guvenSkoru: { gte: SUPHE_SINIRI },
              OR: [
                { koridorTipi: "VARIS" },
                { donusTalebiId: { not: null } },
              ],
            }
          : sekme === "YENI"
            ? { durum: "YENI", ...tercihKosulu(tercih, { webDahil: true }) }
            : sekme === "ILGILENIYOR"
              ? {
                  durum: {
                    in: [
                      "ILGILENIYOR",
                      "ILETISIME_GECILDI",
                      "PAZARLIKTA",
                      "CEVAP_YOK",
                      "ALINDI",
                    ],
                  },
                  guvenSkoru: { gte: SUPHE_SINIRI },
                }
              : { durum: sekme, guvenSkoru: { gte: SUPHE_SINIRI } };

  if (rotaFiltresiVar && (sekme === "YENI" || sekme === "ILGILENIYOR")) {
    // Elle şehir/rota aranınca web sitesi (yuklegel) ilanları da sonuca girer
    tabanFiltre = {
      durum: { in: [...aktifDurumlar] },
      ...tercihKosulu(tercih, { webDahil: true }),
    };
  }

  if (uye) {
    // Yöneticinin ilan durumu (ilgileniyor, aldı…) üyenin listesini etkilemez
    tabanFiltre =
      sekme === "ILGILENIYOR"
        ? { id: { in: uyeTakipIdleri } }
        : sekme === "HEPSI"
          ? { guvenSkoru: { gte: SUPHE_SINIRI }, id: { notIn: uyeGizliIdler } }
          : {
              // Yöneticinin Yeni sekmesiyle aynı kural (güven eşiği yok)
              ...tercihKosulu(tercih, { webDahil: true }),
              // Yeni: üyenin henüz dokunmadıkları (rota aramasında takiptekiler de görünür)
              id: { notIn: rotaFiltresiVar ? uyeGizliIdler : [...uyeDurum.keys()] },
            };
  }

  // Tek şehir: çıkış VEYA varış. İkisi dolu: havza (Gebze=Kocaeli → İstanbul
  // aramasına girsin; aksi halde Ankara→İstanbul chip’i sürekli boş kalır).
  let rotaKosul: Prisma.YukIlaniWhereInput = {};
  if (neredenHata || nereyeHata) {
    if (neredenHata) rotaKosul.cikisIl = "__yok__";
    if (nereyeHata) rotaKosul.varisIl = "__yok__";
  } else if (cikisIl && varisIl) {
    rotaKosul = {
      cikisIl: { in: sehirHavzasi(cikisIl) },
      varisIl: { in: sehirHavzasi(varisIl) },
    };
  } else if (cikisIl && !nereyeHam) {
    rotaKosul = { OR: [{ cikisIl }, { varisIl: cikisIl }] };
  } else if (varisIl && !neredenHam) {
    rotaKosul = { OR: [{ varisIl }, { cikisIl: varisIl }] };
  } else if (cikisIl) {
    rotaKosul = { cikisIl };
  } else if (varisIl) {
    rotaKosul = { varisIl };
  }

  // Yeni sekmesi: son 2 saatte paylaşılan (eskisi "iş verildi" çıkıyor).
  // Takipteki işler (İlgileniyor vb.) 6 saat kalır.
  const tazeSinir =
    sekme === "YENI" && !arsivGoster ? yeniIlanSinir() : panelTazeSinir();
  const tazelikKosul: Prisma.YukIlaniWhereInput = arsivGoster
    ? {
        // Arşiv filtresi açık: ARSIV dahil, 60 güne kadar (havuz gibi)
        OR: [
          { durum: "ARSIV" },
          {
            AND: [
              {
                OR: [
                  { createdAt: { gte: tazeSinir } },
                  { sonGorulme: { gte: tazeSinir } },
                ],
              },
              ...(sekme === "SUPHELI"
                ? []
                : [{ durum: { notIn: ["ELENDI"] } }]),
            ],
          },
        ],
      }
    : sekme === "SUPHELI"
      ? {
          OR: [
            { createdAt: { gte: tazeSinir } },
            { sonGorulme: { gte: tazeSinir } },
          ],
          durum: { not: "ARSIV" },
        }
      : {
          OR: [
            { createdAt: { gte: tazeSinir } },
            { sonGorulme: { gte: tazeSinir } },
          ],
          durum: { notIn: ["ARSIV", "ELENDI"] },
        };

  const numaraKosul: Prisma.YukIlaniWhereInput = {
    AND: [{ telefon: { not: null } }, { telefon: { not: "" } }],
  };
  // Araç konumu (Yolculuk / Eve döndüm): Yeni sekmesi yalnız o çevreden çıkanlar.
  const [konum, yonler] = await Promise.all([aracKonumu(), aracYonleri()]);
  const yonCevreleri = Object.fromEntries(yonler.map((il) => [il, yakinIller(il).slice(1)]));
  const konumFiltresi = Boolean(
    (konum || yonler.length > 0) && sekme === "YENI" && !rotaFiltresiVar && sp.her !== "1"
  );
  const filtre: Prisma.YukIlaniWhereInput = {
    AND: [
      tabanFiltre,
      rotaKosul,
      tazelikKosul,
      numaraKosul,
      konumFiltresi ? konumKosulu(konum, yonler, ADAY_IL_KM) : {},
    ],
  };
  const tekSehirArama = Boolean(
    (cikisIl && !nereyeHam && !neredenHata) ||
      (varisIl && !neredenHam && !nereyeHata)
  );
  const tekSehirAd = cikisIl || varisIl;

  const sayacTazelik: Prisma.YukIlaniWhereInput = {
    OR: [{ createdAt: { gte: tazeSinir } }, { sonGorulme: { gte: tazeSinir } }],
    durum: { notIn: ["ARSIV", "ELENDI"] },
    AND: [{ telefon: { not: null } }, { telefon: { not: "" } }],
  };

  const [ilanlarHam, kaynakSayisi, yeniSayisi, donusSayisi, supheliSayisi, hatMap] =
    await Promise.all([
      ilanDb.yukIlani.findMany({
        where: filtre,
        orderBy: [{ createdAt: "desc" }],
        take: 40,
        include: { kaynak: { select: { ad: true, tur: true } } },
      }),
      ilanDb.ilanKaynagi.count({ where: { aktif: true } }),
      ilanDb.yukIlani.count({
        where: {
          AND: [
            uye ? { id: { notIn: [...uyeDurum.keys()] } } : { durum: "YENI" },
            sayacTazelik,
            tercihKosulu(tercih, { webDahil: true }),
            // Liste konuma göre süzülüyorsa sayaç da aynı ilanları saysın
            konumFiltresi ? konumKosulu(konum, yonler, ADAY_IL_KM) : {},
          ],
        },
      }),
      uye ? Promise.resolve(0) : prisma.yukIlani.count({
        where: {
          AND: [
            {
              OR: [
                { koridorTipi: "VARIS" },
                { donusTalebiId: { not: null } },
              ],
            },
            sayacTazelik,
            webKaynakHaricKosulu(),
          ],
        },
      }),
      uye ? Promise.resolve(0) : prisma.yukIlani.count({
        where: {
          AND: [
            {
              OR: [
                { guvenSkoru: { lt: SUPHE_SINIRI }, durum: { not: "ARSIV" } },
                { durum: "ELENDI" },
              ],
            },
            {
              OR: [
                { createdAt: { gte: tazeSinir } },
                { sonGorulme: { gte: tazeSinir } },
              ],
              durum: { not: "ARSIV" },
            },
            webKaynakHaricKosulu(),
          ],
        },
      }),
      hatOrtalamalariYukle(),
    ]);

  // Bildirimden gelinen ilan (id=) listenin filtresine takılsa da en üstte görünsün
  const odakEk =
    odak && !ilanlarHam.some((i) => i.id === odak)
      ? await ilanDb.yukIlani.findUnique({
          where: { id: odak },
          include: { kaynak: { select: { ad: true, tur: true } } },
        })
      : null;
  // Yakın çevre: aday iller geniş alınır, yükleme noktası ~70 km içinde olanlar kalır (yalnız görüntü)
  const ilanlar = (odakEk ? [odakEk, ...ilanlarHam] : ilanlarHam).filter(
    (i) => !konumFiltresi || !konum || i.id === odak || yakinCevredeMi(konum, i)
  );

  const gorusmeMap = new Map<number, string>();
  // Yöneticinin WhatsApp görüşmeleri üyeye gösterilmez
  if (ilanlar.length > 0 && !uye) {
    const gorusmeler = await prisma.whatsAppGorusme.findMany({
      where: { ilanId: { in: ilanlar.map((i) => i.id) } },
      orderBy: { id: "desc" },
      select: {
        ilanId: true,
        durum: true,
        ozet: true,
        cevapMetin: true,
        hata: true,
        hatirlatma: true,
      },
    });
    for (const g of gorusmeler) {
      if (!gorusmeMap.has(g.ilanId)) gorusmeMap.set(g.ilanId, gorusmeSatiri(g));
    }
  }

  const aiAcik = aiKullanilabilir();
  const okuyucuSorunlari = uye ? [] : await daemonSorunlari().catch(() => []);
  const killSwitch = aiKapaliMi();
  const anahtarVar = Boolean(process.env.OPENAI_API_KEY);
  const cipler = rotaCipleri(tercih.rotalar);

  let sirali = ilanlar
    .filter((i) => i.id === odak || (i.telefon || "").replace(/\D/g, "").length >= 10)
    .sort((a, b) => {
    // İki şehir: tam rota üstte, sonra aynı çıkış/varış, havza en sonda
    if (cikisIl && varisIl) {
      const puan = (i: (typeof ilanlar)[0]) => {
        if (i.cikisIl === cikisIl && i.varisIl === varisIl) return 3;
        if (i.cikisIl === cikisIl || i.varisIl === varisIl) return 2;
        return 1;
      };
      const d = puan(b) - puan(a);
      if (d !== 0) return d;
    }
    // Nereden dolu → önce o ilden çıkanlar (Ankara aramada Pamukova→Ankara üste binmesin)
    if (cikisIl && !nereyeHam) {
      const aC = a.cikisIl === cikisIl ? 1 : 0;
      const bC = b.cikisIl === cikisIl ? 1 : 0;
      if (aC !== bC) return bC - aC;
    }
    if (varisIl && !neredenHam) {
      const aV = a.varisIl === varisIl ? 1 : 0;
      const bV = b.varisIl === varisIl ? 1 : 0;
      if (aV !== bV) return bV - aV;
    }
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
  if (odak) {
    const idx = sirali.findIndex((i) => i.id === odak);
    if (idx > 0) {
      sirali = [sirali[idx], ...sirali.filter((i) => i.id !== odak)];
    }
  }

  const iyiSayisi = sirali.filter(iyiIsMi).length;
  const cikisHavza =
    cikisIl && varisIl ? sehirHavzasi(cikisIl) : cikisIl ? [cikisIl] : [];
  const varisHavza =
    cikisIl && varisIl ? sehirHavzasi(varisIl) : varisIl ? [varisIl] : [];
  const filtreOzet = tekSehirArama
    ? `${tekSehirAd} (çıkış veya varış · aktif ilanlar)`
    : cikisIl && varisIl
      ? `çıkış ${cikisHavza.join("/")} · varış ${varisHavza.join("/")} · aktif`
      : [
          cikisIl
            ? `çıkış ${cikisIl}${neredenHam !== cikisIl ? ` (${neredenHam})` : ""}`
            : null,
          varisIl
            ? `varış ${varisIl}${nereyeHam !== varisIl ? ` (${nereyeHam})` : ""}`
            : null,
          rotaFiltresiVar ? "aktif ilanlar" : null,
        ]
          .filter(Boolean)
          .join(" · ");

  // Dönüş önerisi listede ekstra 3 sorgu yapıyordu — kart menüsüne bırakıldı.
  const donusMap = new Map<
    number,
    { id: number; rota: string; fiyat: string | null }[]
  >();

  function karIcin(ilan: (typeof sirali)[0]) {
    const key = hatAnahtar(ilan.cikisIl, ilan.varisIl);
    const hat = key ? hatMap.get(key) : null;
    // Anlamsız fiyat (₺13/ton vb.) → kâr gösterme
    if (
      ilan.fiyatBelirsiz ||
      fiyatAkliDisiMi(ilan) ||
      ((!ilan.ucret || ilan.ucret <= 0) &&
        (!ilan.fiyatTon || ilan.fiyatTon <= 0))
    ) {
      const ozet = karHesapla(
        { ...ilan, ucret: null, fiyatTon: null },
        tercih.maliyet,
        hat
      );
      const yazi = karOzetYazi(ozet);
      return {
        mesafe: yazi.mesafe,
        yakit: null,
        hgs: null,
        net: "fiyat okunamadı",
        tlKm: null,
        uyari: null,
        netPozitif: undefined as boolean | undefined,
      };
    }
    const ozet = karHesapla(ilan, tercih.maliyet, hat);
    const yazi = karOzetYazi(ozet);
    if (!yazi.mesafe && !yazi.net) return null;
    // Negatif net → yanlış fiyat okuması; yanıltma
    if (ozet.netTl !== null && ozet.netTl < 0) {
      return {
        ...yazi,
        net: "fiyat okunamadı",
        netPozitif: undefined as boolean | undefined,
        uyari: "Fiyat akıl dışı — kâr hesaplanmadı",
      };
    }
    return {
      ...yazi,
      netPozitif: ozet.netTl === null ? undefined : ozet.netTl >= 0,
    };
  }

  // Dönüş sekmesi: aktif yolculuk (en yenisi) — başlık rotası ve panel
  const yolculuk =
    sekme === "DONUS" ? ((await aktifYolculuklar().catch(() => []))[0] ?? null) : null;

  const aracFiltreYazi =
    [
      tercih.aracTipleri.map((k) => aracTipiAdi(k)).join("/") || null,
      tercih.maxTonaj ? `≤${tercih.maxTonaj}t` : null,
      tercih.minUcret ? `≥${tlYaz(tercih.minUcret)}` : null,
    ]
      .filter(Boolean)
      .join(" · ") || "Filtre yok";

  const bildirimler = uye ? null : (
    <>
      {okuyucuSorunlari.map((s) => {
        const kod = s.ad === "whatsapp" ? eslemeKodu(s.detay) : null;
        const eslemeSorunu = s.ad === "whatsapp" && /eşleme|oturumu kapandı/i.test(s.baslik);
        return (
          <div key={s.ad} className="rounded-2xl bg-[#fee2e2] px-4 py-3 text-[13px] text-[#7f1d1d]">
            <strong>{s.baslik}.</strong>{" "}
            {kod ? (
              <>
                <span className="mt-2 block select-all font-mono text-[26px] font-bold tracking-[0.2em]">{kod}</span>
                <span className="block">
                  WhatsApp → Bağlı cihazlar → Cihaz bağla → «Bunun yerine telefon numarasıyla bağla» → bu kodu gir.
                </span>
              </>
            ) : (
              <span className="select-all">{s.detay}</span>
            )}
            {eslemeSorunu && (
              <form action={whatsappYeniKodIste} className="mt-2">
                <button type="submit" className="rounded-xl bg-[#7f1d1d] px-3 py-2 text-[13px] font-semibold text-white">
                  Yeni kod al
                </button>
                <span className="ml-2 text-[12px]">20 sn sonra sayfayı yenile</span>
              </form>
            )}
          </div>
        );
      })}
      {killSwitch && (
        <div className="rounded-2xl bg-[#fff1dc] px-4 py-3 text-[13px] text-[#7c2d12]">
          <strong>AI kapalı.</strong> Tarama devam eder; kuyruk birikir.
        </div>
      )}
      {!killSwitch && !anahtarVar && (
        <div className="rounded-2xl bg-[#fee2e2] px-4 py-3 text-[13px] text-[#7f1d1d]">
          <strong>OpenAI anahtarı yok.</strong>
        </div>
      )}
      {aiAcik && kaynakSayisi === 0 && (
        <div className="rounded-2xl bg-white px-4 py-3 text-[13px] text-[#3b4262]">
          Telegram botunu gruba ekle veya Ayarlar&apos;dan kaynak ekle.
        </div>
      )}
    </>
  );

  return (
    <YukBulGorunum
      v={{
        sekme,
        nereden: neredenHam,
        nereye: nereyeHam,
        cipler,
        sekmeler: SEKMELER.filter((s) => sekmeKodlari.includes(s.kod) && (s.kod !== "SUPHELI" || sekme === "SUPHELI")).map((s) => ({
          kod: s.kod,
          ad: s.ad,
          href: sekmeHref(s.kod, neredenHam, nereyeHam, arsivGoster),
          rozet: s.kod === "YENI" ? yeniSayisi : s.kod === "DONUS" ? donusSayisi : s.kod === "SUPHELI" ? supheliSayisi : null,
        })),
        konum,
        yonler,
        yonCevreleri,
        konumFiltresi,
        konumLink: konumFiltresi ? "/ai/yukler?her=1" : "/ai/yukler",
        aracFiltreYazi,
        yonSeciciGoster: sekme === "YENI" && !rotaFiltresiVar,
        durumSatiri:
          iyiSayisi > 0
            ? `${iyiSayisi} taze iyi iş`
            : yeniSayisi > 0
              ? `${yeniSayisi} yeni ilan`
              : kaynakSayisi > 0
                ? "Şu an yeni ilan yok"
                : uye
                  ? "Şu an yeni ilan yok"
                  : "Kaynak yok — Ayarlar’dan aç",
        bildirimler,
        ilanlar: sirali.map((ilan) => ({
          id: ilan.id,
          durum: uye ? (uyeDurum.get(ilan.id) ?? "YENI") : ilan.durum,
          nereden: ilan.nereden,
          nereye: ilan.nereye,
          cikisIl: ilan.cikisIl,
          varisIl: ilan.varisIl,
          tonaj: ilan.tonaj,
          yukTipi: ilan.yukTipi,
          aracTipi: ilan.aracTipi,
          aracTipiKod: ilan.aracTipiKod,
          aracUzunluk: ilan.aracUzunluk,
          koridorTipi: ilan.koridorTipi,
          ucret: ilan.ucret,
          fiyatTon: ilan.fiyatTon,
          fiyatBelirsiz: ilan.fiyatBelirsiz,
          firmaAdi: ilan.firmaAdi,
          telefon: ilan.telefon,
          waNot: gorusmeMap.get(ilan.id) ?? null,
          // Telegram kimliği yöneticinin hesabıyla mesaj için: üyede yok
          gonderenUserId: uye ? null : ilan.gonderenUserId,
          uye,
          yakinlik: konum ? yakinlikYazisi(konum, yuklemeYakinligi(konum, ilan)) : null,
          guvenSkoru: ilan.guvenSkoru,
          hamMetin: ilan.hamMetin,
          createdAt: ilan.createdAt,
          sonGorulme: ilan.sonGorulme,
          donusTalebiId: ilan.donusTalebiId,
          kaynakAd: ilan.kaynak?.ad ?? null,
          ucretYazi: ilan.ucret !== null ? kurustanGiris(ilan.ucret) : null,
          odakli: odak === ilan.id,
          soluk: solukMu(ilan.sonGorulme),
          vurgulu: iyiIsMi(ilan),
          kar: karIcin(ilan),
          donusOnerileri: donusMap.get(ilan.id),
        })),
        supheli: { sayi: supheliSayisi, href: sekmeHref("SUPHELI", neredenHam, nereyeHam, arsivGoster) },
        bosMesaj:
          neredenHam || nereyeHam
            ? tekSehirArama
              ? `${tekSehirAd} çıkışlı / varışlı ilan yok.`
              : "Bu rotada ilan yok."
            : sekme === "YENI"
              ? "Şu an yeni ilan yok."
              : sekme === "ILGILENIYOR"
                ? "Takipte ilan yok. Kalbe basarak takibe alabilirsin."
                : "Bu listede kayıt yok.",
        filtreKaldirHref: neredenHam || nereyeHam ? `/ai/yukler?sekme=${encodeURIComponent(sekme)}` : null,
        filtreOzet: filtreOzet && !neredenHata && !nereyeHata ? filtreOzet : null,
        yerHatasi:
          neredenHata || nereyeHata
            ? `Yer adı çözülemedi${neredenHata ? `: «${neredenHam}»` : ""}${nereyeHata ? `${neredenHata ? "," : ":"} «${nereyeHam}»` : ""}. İl veya ilçe yaz (Ostim, Gebze, Hadımköy…).`
            : null,
        arsiv: { goster: arsivGoster, href: sekmeHref(sekme, neredenHam, nereyeHam, !arsivGoster) },
        uye,
        yolculuk: yolculuk
          ? { id: yolculuk.id, cikis: yolculuk.cikis, varis: yolculuk.varis, cikisIl: yolculuk.cikisIl, cevre: yakinIller(yolculuk.cikisIl).slice(1) }
          : null,
      }}
    />
  );
}
