import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { kurustanGiris, tlYaz } from "@/lib/para";
import { aiTercihleriOku } from "@/lib/ayarlar";
import { aiKapaliMi, aiKullanilabilir } from "@/lib/ai/istemci";
import { aracTipiAdi } from "@/lib/arac";
import { ilBul } from "@/lib/iller";
import { SUPHE_SINIRI, tercihKosulu } from "@/lib/kaynaklar/filtre";
import {
  eskiIlanlariTemizle,
  simdiTara,
} from "@/app/ai-actions";
import AksiyonButonu from "@/components/AksiyonButonu";
import IlanAramaCubugu, { type RotaCip } from "@/components/IlanAramaCubugu";
import IlanKart from "@/components/IlanKart";
import { donusOnerileriBul } from "@/lib/seferPlan";
import {
  hatAnahtar,
  hatOrtalamalariYukle,
  karHesapla,
  karOzetYazi,
} from "@/lib/karHesap";
import { solukMu } from "@/lib/ilanTazelik";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const SEKMELER = [
  { kod: "YENI", ad: "Yeni" },
  { kod: "ILGILENIYOR", ad: "Takip" },
  { kod: "DONUS", ad: "Dönüş" },
  { kod: "MUSTERI", ad: "Müşteri" },
  { kod: "SUPHELI", ad: "Şüpheli" },
  { kod: "HEPSI", ad: "Hepsi" },
] as const;

const DORT_SAAT_MS = 4 * 60 * 60 * 1000;

const VARSAYILAN_CIPLER: RotaCip[] = [
  { etiket: "Ankara→İstanbul", nereden: "Ankara", nereye: "İstanbul" },
  { etiket: "İstanbul→Ankara", nereden: "İstanbul", nereye: "Ankara" },
  { etiket: "Gebze→Ankara", nereden: "Gebze", nereye: "Ankara" },
  { etiket: "Ankara→Bolu", nereden: "Ankara", nereye: "Bolu" },
  { etiket: "Kocaeli→Ankara", nereden: "Kocaeli", nereye: "Ankara" },
];

/** Taze + güven + fiyat belli → üstte. */
function siralamaSkoru(ilan: {
  createdAt: Date;
  guvenSkoru: number;
  ucret: number | null;
  fiyatTon: number | null;
}): number {
  const saat = (Date.now() - ilan.createdAt.getTime()) / 3_600_000;
  const taze = Math.max(0, 36 - saat);
  const fiyat =
    (ilan.ucret !== null && ilan.ucret > 0) ||
    (ilan.fiyatTon !== null && ilan.fiyatTon > 0)
      ? 28
      : 0;
  const guvenBonus = ilan.guvenSkoru >= 70 ? 18 : ilan.guvenSkoru >= 50 ? 8 : 0;
  return ilan.guvenSkoru + taze + fiyat + guvenBonus;
}

function iyiIsMi(ilan: {
  createdAt: Date;
  guvenSkoru: number;
  ucret: number | null;
  fiyatTon: number | null;
}): boolean {
  const taze = Date.now() - ilan.createdAt.getTime() < DORT_SAAT_MS;
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

function sekmeHref(kod: string, nereden: string, nereye: string): string {
  if (kod === "MUSTERI") return "/ai/musteriler";
  const p = new URLSearchParams();
  p.set("sekme", kod);
  if (nereden) p.set("nereden", nereden);
  if (nereye) p.set("nereye", nereye);
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
  }>;
}) {
  const sp = await searchParams;
  const sekme = SEKMELER.some((s) => s.kod === sp.sekme)
    ? (sp.sekme as string)
    : "YENI";
  const odakId = Number(sp.id);
  const odak =
    Number.isInteger(odakId) && odakId > 0 ? odakId : null;

  const neredenHam = (sp.nereden || "").trim();
  const nereyeHam = (sp.nereye || "").trim();
  const cikisIl = neredenHam ? ilBul(neredenHam) : null;
  const varisIl = nereyeHam ? ilBul(nereyeHam) : null;
  const neredenHata = Boolean(neredenHam && !cikisIl);
  const nereyeHata = Boolean(nereyeHam && !varisIl);

  const tercih = await aiTercihleriOku();

  // Arşiv canlandırma cron'da (ai-kuyruk) — sayfa açılışında DB yazısı paneli kilitliyordu.

  const tabanFiltre: Prisma.YukIlaniWhereInput =
    sekme === "SUPHELI"
      ? { guvenSkoru: { lt: SUPHE_SINIRI } }
      : sekme === "HEPSI"
        ? {
            guvenSkoru: { gte: SUPHE_SINIRI },
            durum: { notIn: ["ARSIV", "ELENDI"] },
          }
        : sekme === "DONUS"
          ? { donusTalebiId: { not: null }, guvenSkoru: { gte: SUPHE_SINIRI } }
          : sekme === "YENI"
            ? { durum: "YENI", ...tercihKosulu(tercih) }
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

  const rotaKosul: Prisma.YukIlaniWhereInput = {};
  if (cikisIl) rotaKosul.cikisIl = cikisIl;
  if (varisIl) rotaKosul.varisIl = varisIl;
  if (neredenHata) rotaKosul.cikisIl = "__yok__";
  if (nereyeHata) rotaKosul.varisIl = "__yok__";

  const filtre: Prisma.YukIlaniWhereInput = {
    AND: [tabanFiltre, rotaKosul],
  };

  const [ilanlar, kaynakSayisi, yeniSayisi, donusSayisi, supheliSayisi, hatMap] =
    await Promise.all([
      prisma.yukIlani.findMany({
        where: filtre,
        orderBy: [{ createdAt: "desc" }],
        take: 40,
        include: { kaynak: { select: { ad: true, tur: true } } },
      }),
      prisma.ilanKaynagi.count({ where: { aktif: true } }),
      prisma.yukIlani.count({
        where: { durum: "YENI", ...tercihKosulu(tercih) },
      }),
      prisma.yukIlani.count({ where: { donusTalebiId: { not: null } } }),
      prisma.yukIlani.count({ where: { guvenSkoru: { lt: SUPHE_SINIRI } } }),
      hatOrtalamalariYukle(),
    ]);

  const aiAcik = aiKullanilabilir();
  const killSwitch = aiKapaliMi();
  const anahtarVar = Boolean(process.env.OPENAI_API_KEY);
  const cipler = rotaCipleri(tercih.rotalar);

  let sirali = [...ilanlar].sort(
    (a, b) => siralamaSkoru(b) - siralamaSkoru(a)
  );
  if (odak) {
    const idx = sirali.findIndex((i) => i.id === odak);
    if (idx > 0) {
      sirali = [sirali[idx], ...sirali.filter((i) => i.id !== odak)];
    }
  }

  const iyiSayisi = sirali.filter(iyiIsMi).length;
  const filtreOzet = [
    cikisIl
      ? `çıkış ${cikisIl}${neredenHam !== cikisIl ? ` (${neredenHam})` : ""}`
      : null,
    varisIl
      ? `varış ${varisIl}${nereyeHam !== varisIl ? ` (${nereyeHam})` : ""}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  // Dönüş önerisi — sadece ilk 3 kart (eskiden 12× ayrı sorgu paneli kilitliyordu)
  const donusMap = new Map<
    number,
    { id: number; rota: string; fiyat: string | null }[]
  >();
  await Promise.all(
    sirali.slice(0, 3).map(async (ilan) => {
      const oneriler = await donusOnerileriBul(
        ilan.varisIl,
        tercih.anaUs || ilan.cikisIl,
        ilan.id,
        1
      );
      if (oneriler.length === 0) return;
      donusMap.set(
        ilan.id,
        oneriler.map((o) => ({
          id: o.id,
          rota: `${o.nereden || o.cikisIl} → ${o.nereye || o.varisIl}`,
          fiyat:
            o.ucret && o.ucret > 0
              ? tlYaz(o.ucret)
              : o.fiyatTon && o.tonaj
                ? `~${tlYaz(o.fiyatTon * o.tonaj)}`
                : null,
        }))
      );
    })
  );

  function karIcin(ilan: (typeof sirali)[0]) {
    const key = hatAnahtar(ilan.cikisIl, ilan.varisIl);
    const hat = key ? hatMap.get(key) : null;
    const ozet = karHesapla(ilan, tercih.maliyet, hat);
    const yazi = karOzetYazi(ozet);
    if (!yazi.mesafe && !yazi.net) return null;
    return {
      ...yazi,
      netPozitif: ozet.netTl === null ? undefined : ozet.netTl >= 0,
    };
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 reveal">
        <div>
          <p className="sayfa-eyebrow">İlanlar</p>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-paper sm:text-4xl">
            Yük bul
          </h1>
          {iyiSayisi > 0 ? (
            <p className="mt-1.5 text-sm font-semibold text-teal">
              {iyiSayisi} taze iyi iş
            </p>
          ) : (
            <p className="mt-1.5 text-sm text-fog">
              {yeniSayisi > 0
                ? `${yeniSayisi} yeni ilan hazır`
                : kaynakSayisi > 0
                  ? "Şu an öne çıkan yok — biraz bekle"
                  : "Kaynak yok — Ayarlar’dan aç"}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AksiyonButonu
            calistir={simdiTara}
            etiket="Yenile"
            bekleyenEtiket="..."
            sinif="btn btn-amber !px-3 !py-2 text-xs sm:text-sm"
          />
          <Link
            href="/ayarlar#ai"
            className="btn btn-ghost !px-3 !py-2 text-xs sm:text-sm"
          >
            Filtre
          </Link>
        </div>
      </div>
      <div className="lane-strip max-w-[10rem] opacity-70" />

      {killSwitch && (
        <div className="rounded-xl border border-amber/30 bg-amber/10 px-3 py-2.5 text-sm text-paper">
          <strong>AI kapalı.</strong> Tarama devam eder; kuyruk birikir.
        </div>
      )}

      {!killSwitch && !anahtarVar && (
        <div className="rounded-xl border border-ember/30 bg-ember/10 px-3 py-2.5 text-sm text-paper">
          <strong>OpenAI anahtarı yok.</strong>
        </div>
      )}

      {aiAcik && kaynakSayisi === 0 && (
        <div className="rounded-xl border border-white/10 bg-white/4 px-3 py-2.5 text-sm text-fog">
          Telegram botunu gruba ekle veya Ayarlar&apos;dan kaynak ekle.
        </div>
      )}

      <IlanAramaCubugu
        key={`${neredenHam}|${nereyeHam}|${sekme}`}
        sekme={sekme}
        nereden={neredenHam}
        nereye={nereyeHam}
        cipler={cipler}
      />

      {(neredenHata || nereyeHata) && (
        <p className="text-xs text-ember">
          Yer adı çözülemedi
          {neredenHata ? `: «${neredenHam}»` : ""}
          {nereyeHata ? `${neredenHata ? "," : ":"} «${nereyeHam}»` : ""}
          . İl veya ilçe yaz (Ostim, Gebze, Hadımköy…).
        </p>
      )}

      {filtreOzet && !neredenHata && !nereyeHata && (
        <p className="text-xs text-teal">Filtre: {filtreOzet}</p>
      )}

      <div className="-mx-1 flex gap-1 overflow-x-auto rounded-2xl border border-white/10 bg-[#121a26] p-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {SEKMELER.map((s) => {
          const aktif = s.kod === sekme;
          const rozet =
            s.kod === "YENI"
              ? yeniSayisi
              : s.kod === "DONUS"
                ? donusSayisi
                : s.kod === "SUPHELI"
                  ? supheliSayisi
                  : null;
          return (
            <Link
              key={s.kod}
              href={sekmeHref(s.kod, neredenHam, nereyeHam)}
              className={`shrink-0 rounded-xl px-3 py-2.5 text-center text-xs font-bold sm:text-sm ${
                aktif
                  ? "bg-amber/15 text-amber"
                  : "text-fog hover:text-paper"
              }`}
            >
              {s.ad}
              {rozet !== null && rozet > 0 && (
                <span className="ml-1 text-xs font-bold text-amber">{rozet}</span>
              )}
            </Link>
          );
        })}
      </div>

      {sekme === "YENI" && (
        <p className="text-xs text-fog">
          {[
            tercih.aracTipleri.map((k) => aracTipiAdi(k)).join(" / ") || null,
            tercih.maxTonaj ? `≤${tercih.maxTonaj}t` : null,
            tercih.minUcret ? `≥${tlYaz(tercih.minUcret)}` : null,
          ]
            .filter(Boolean)
            .join(" · ") || "filtre yok"}
          {" · "}
          <Link href="/ayarlar#ai" className="text-amber">
            değiştir
          </Link>
        </p>
      )}

      {sirali.length === 0 ? (
        <div className="bos-durum">
          {neredenHam || nereyeHam
            ? "Bu rotada ilan yok."
            : sekme === "YENI"
              ? "Şu an yeni ilan yok."
              : "Bu listede kayıt yok."}
        </div>
      ) : (
        <div className="space-y-3">
          {sirali.map((ilan) => {
            return (
              <IlanKart
                key={ilan.id}
                ilan={{
                  id: ilan.id,
                  durum: ilan.durum,
                  nereden: ilan.nereden,
                  nereye: ilan.nereye,
                  cikisIl: ilan.cikisIl,
                  varisIl: ilan.varisIl,
                  tonaj: ilan.tonaj,
                  aracTipi: ilan.aracTipi,
                  aracTipiKod: ilan.aracTipiKod,
                  ucret: ilan.ucret,
                  fiyatTon: ilan.fiyatTon,
                  fiyatBelirsiz: ilan.fiyatBelirsiz,
                  firmaAdi: ilan.firmaAdi,
                  telefon: ilan.telefon,
                  gonderenUserId: ilan.gonderenUserId,
                  guvenSkoru: ilan.guvenSkoru,
                  hamMetin: ilan.hamMetin,
                  createdAt: ilan.createdAt,
                  donusTalebiId: ilan.donusTalebiId,
                  kaynakAd: ilan.kaynak?.ad ?? null,
                  ucretYazi:
                    ilan.ucret !== null ? kurustanGiris(ilan.ucret) : null,
                  odakli: odak === ilan.id,
                  soluk: solukMu(ilan.createdAt),
                  vurgulu: iyiIsMi(ilan),
                  kar: karIcin(ilan),
                  donusOnerileri: donusMap.get(ilan.id),
                }}
              />
            );
          })}
        </div>
      )}

      {sirali.length > 0 && (
        <div className="flex justify-center pb-4">
          <AksiyonButonu
            calistir={eskiIlanlariTemizle}
            etiket="14 günden eskileri temizle"
            bekleyenEtiket="..."
            onay="14 günden eski, işlem yapılmamış ilanlar silinsin mi?"
            sinif="text-xs font-semibold text-fog hover:text-amber"
          />
        </div>
      )}
    </div>
  );
}
