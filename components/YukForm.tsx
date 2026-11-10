"use client";

import Link from "next/link";
import { useActionState, useEffect, useState, type ReactNode } from "react";
import { yukEkle, yukGuncelle, type FormSonuc } from "@/app/actions";
import TutarKdvGirisi from "@/components/TutarKdvGirisi";
import RotaCizgi from "@/components/yuk/RotaCizgi";
import { seferKmTahmini } from "@/lib/seferYer";
import type { AracSecenek } from "@/lib/aktifArac";

export type YukFormBaslangic = {
  id: number;
  tarih: string;
  firmaId: number;
  nereden: string;
  nereye: string;
  aciklama: string;
  tutarYazi: string;
  kdvli: boolean;
  kdvDahilMi: boolean;
  /** Elle girilmiş km (boşsa otomatik) */
  km?: string;
  /** Seferi yapan araç (boşsa ilk araç) */
  aracId?: number | null;
};

/** AI ilanından gelen ön dolgu (yeni yük eklerken). */
export type YukFormHazirlik = {
  nereden?: string;
  nereye?: string;
  firmaAdi?: string;
  tutarYazi?: string;
  aciklama?: string;
};

const IKON: Record<string, ReactNode> = {
  takvim: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  bina: <path d="M4 21V5l8-2v18M12 21h8V9l-8-2M7 8h2M7 12h2M7 16h2M15 12h2M15 16h2" />,
  pin: (
    <>
      <path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.3" />
    </>
  ),
  yol: <path d="M9 3 6 21M15 3l3 18M12 5v2M12 11v2M12 17v2" />,
  tir: (
    <>
      <path d="M2.5 6.5h11v9h-11zM13.5 9.5h4l3 3v3h-7" />
      <circle cx="6.5" cy="17" r="1.8" />
      <circle cx="17" cy="17" r="1.8" />
    </>
  ),
  not: <path d="M7 3h7l4 4v14H7zM14 3v4h4M9.5 12h5M9.5 16h5" />,
};

function Ikon({ ad }: { ad: string }) {
  return (
    <span className="sf-alan-ikon" aria-hidden>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {IKON[ad]}
      </svg>
    </span>
  );
}

/**
 * Sefer formu (yeni / düzenle): lacivert başlıkta canlı rota, altında
 * beyaz sayfada alanlar. Kayıt ve hesap kuralları sunucuda (yukEkle/yukGuncelle).
 */
export default function YukForm({
  firmalar,
  araclar = [],
  bugunTarih,
  baslangic,
  hazir,
  baslik,
  altBaslik,
  ust,
}: {
  firmalar: { id: number; ad: string }[];
  /** Birden fazla araç varsa "Hangi tır?" seçimi görünür */
  araclar?: AracSecenek[];
  bugunTarih: string;
  baslangic?: YukFormBaslangic;
  hazir?: YukFormHazirlik;
  baslik: string;
  altBaslik: string;
  /** Başlık altı bilgi (ör. "Bulunan ilandan dolduruldu") */
  ust?: ReactNode;
}) {
  const duzenle = Boolean(baslangic);
  const [durum, aksiyon, bekliyor] = useActionState<FormSonuc, FormData>(duzenle ? yukGuncelle : yukEkle, null);

  const eslesenFirma = hazir?.firmaAdi
    ? firmalar.find((f) => f.ad.toLocaleLowerCase("tr") === hazir.firmaAdi?.toLocaleLowerCase("tr"))
    : undefined;

  const [firmaSecim, setFirmaSecim] = useState(() => {
    if (baslangic) return String(baslangic.firmaId);
    if (eslesenFirma) return String(eslesenFirma.id);
    if (hazir?.firmaAdi || firmalar.length === 0) return "yeni";
    return "";
  });

  // Bu telefonun bildirim adresi: "Yeni sefer" bildirimi kaydı girene gitmesin
  const [cihaz, setCihaz] = useState("");
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .getRegistration()
      .then((k) => k?.pushManager.getSubscription())
      .then((a) => a?.endpoint && setCihaz(a.endpoint))
      .catch(() => {});
  }, []);

  const [nereden, setNereden] = useState(baslangic?.nereden || hazir?.nereden || "");
  const [nereye, setNereye] = useState(baslangic?.nereye || hazir?.nereye || "");
  const tahminiKm = nereden.trim() && nereye.trim() ? seferKmTahmini(nereden, nereye) : null;

  return (
    <div className="sf-sayfa">
      <header className="ana-ust sf-ust">
        <div className="ana-ust-zemin" aria-hidden />
        <div className="ana-ic relative">
          <div className="ana-gir flex items-center gap-3 pt-3">
            <Link href="/yukler" aria-label="Seferlere dön" className="ana-zil flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                <path d="M19 12H5M11 6l-6 6 6 6" />
              </svg>
            </Link>
            <div className="min-w-0 leading-tight">
              <p className="text-[12.5px] font-semibold text-[#9fb0ff]">Nakliye Defteri</p>
              <h1 className="text-[1.6rem] font-extrabold tracking-[-0.03em] text-white">{baslik}</h1>
            </div>
          </div>
          <p className="ana-gir mt-0.5 text-[14px] text-[#b8c1f5]" style={{ animationDelay: "40ms" }}>
            {altBaslik}
          </p>
          <div className="ana-gir" style={{ animationDelay: "60ms" }}>
            <RotaCizgi sol={nereden.trim() || null} sag={nereye.trim() || null} />
          </div>
        </div>
      </header>

      <div className="ana-ic relative z-10">
        <form action={aksiyon} className="sf-kagit ana-gir" style={{ animationDelay: "100ms" }}>
          <span className="sf-tutamac" aria-hidden />
          {baslangic && <input type="hidden" name="yukId" value={baslangic.id} />}
          {cihaz && <input type="hidden" name="cihaz" value={cihaz} />}
          {ust}

          <div>
            <label htmlFor="tarih" className="sf-etiket">
              Tarih
            </label>
            <div className="sf-alan">
              <Ikon ad="takvim" />
              <input id="tarih" name="tarih" type="date" required defaultValue={baslangic?.tarih || bugunTarih} className="sf-girdi" />
            </div>
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <label htmlFor="firmaId" className="sf-etiket">
                Firma
              </label>
              {firmaSecim !== "yeni" && (
                <button type="button" onClick={() => setFirmaSecim("yeni")} className="ana-link !text-[12.5px]">
                  + Yeni firma
                </button>
              )}
            </div>
            <div className="sf-alan">
              <Ikon ad="bina" />
              <select id="firmaId" name="firmaId" required value={firmaSecim} onChange={(e) => setFirmaSecim(e.target.value)} className="sf-girdi sf-secim">
                <option value="" disabled>
                  Firma seç…
                </option>
                {firmalar.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.ad}
                  </option>
                ))}
                <option value="yeni">+ Yeni firma ekle</option>
              </select>
            </div>
          </div>

          {firmaSecim === "yeni" && (
            <div className="reveal">
              <label htmlFor="yeniFirmaAdi" className="sf-etiket">
                Yeni firma adı
              </label>
              <div className="sf-alan">
                <Ikon ad="bina" />
                <input
                  id="yeniFirmaAdi"
                  name="yeniFirmaAdi"
                  type="text"
                  required
                  placeholder="Örnek: ABC Lojistik"
                  defaultValue={eslesenFirma ? "" : hazir?.firmaAdi || ""}
                  className="sf-girdi"
                />
              </div>
            </div>
          )}

          {araclar.length > 1 && (
            <div>
              <label htmlFor="aracId" className="sf-etiket">
                Tır / şoför
              </label>
              <div className="sf-alan">
                <Ikon ad="tir" />
                <select
                  id="aracId"
                  name="aracId"
                  defaultValue={String(
                    (baslangic ? (baslangic.aracId ?? araclar[0]?.id) : araclar.find((a) => a.aktif)?.id) ?? ""
                  )}
                  className="sf-girdi sf-secim"
                >
                  {araclar.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.etiket}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div>
            <label htmlFor="nereden" className="sf-etiket">
              Nereden
            </label>
            <div className="sf-alan">
              <Ikon ad="pin" />
              <input id="nereden" name="nereden" type="text" required placeholder="Örnek: Mersin" value={nereden} onChange={(e) => setNereden(e.target.value)} className="sf-girdi" autoComplete="off" />
            </div>
          </div>

          <div>
            <label htmlFor="nereye" className="sf-etiket">
              Nereye
            </label>
            <div className="sf-alan">
              <Ikon ad="pin" />
              <input id="nereye" name="nereye" type="text" required placeholder="Örnek: İstanbul" value={nereye} onChange={(e) => setNereye(e.target.value)} className="sf-girdi" autoComplete="off" />
            </div>
          </div>

          <div>
            <label htmlFor="km" className="sf-etiket">
              Kilometre <span className="font-medium text-[var(--a-ikincil)]">(boş bırakırsan otomatik)</span>
            </label>
            <div className="sf-alan">
              <Ikon ad="yol" />
              <input
                id="km"
                name="km"
                type="text"
                inputMode="numeric"
                placeholder={tahminiKm !== null ? `≈ ${tahminiKm.toLocaleString("tr-TR")} km` : "Örnek: 450"}
                defaultValue={baslangic?.km || ""}
                className="sf-girdi"
              />
              {tahminiKm !== null && tahminiKm > 0 && <span className="shrink-0 text-[11.5px] text-[var(--a-ikincil)]">tahmini</span>}
            </div>
            <p className="mt-1 text-[11.5px] text-[var(--a-ikincil)]">
              {tahminiKm === null
                ? nereden.trim() && nereye.trim()
                  ? "Yer tanınmadı — km'yi elle yaz."
                  : "Nereden ve nereye yazınca tahmini km çıkar."
                : tahminiKm === 0
                  ? "Aynı il içi — gerçek km'yi elle yazabilirsin."
                  : `Tahmin: ${tahminiKm.toLocaleString("tr-TR")} km (il merkezleri arası). Farklıysa yaz.`}
            </p>
          </div>

          <TutarKdvGirisi
            tema="acik"
            etiket="Navlun"
            baslangicTutar={baslangic?.tutarYazi || hazir?.tutarYazi || ""}
            baslangicKdvli={baslangic?.kdvli}
            baslangicKdvDahilMi={baslangic?.kdvDahilMi ?? true}
            kdvEtiketi="KDV"
            kdvNotu="Müşteri faturasındaki KDV — devlet borcu sayılır."
          />

          <div>
            <label htmlFor="aciklama" className="sf-etiket">
              Açıklama <span className="font-medium text-[var(--a-ikincil)]">(isteğe bağlı)</span>
            </label>
            <div className="sf-alan">
              <Ikon ad="not" />
              <input id="aciklama" name="aciklama" type="text" placeholder="Örnek: 24 ton demir" defaultValue={baslangic?.aciklama || hazir?.aciklama || ""} className="sf-girdi" />
            </div>
          </div>

          {!duzenle && (
            <label className="flex cursor-pointer items-center gap-3 rounded-2xl bg-[#f3f5fb] p-3">
              <input type="checkbox" name="odendiMi" value="1" className="h-5 w-5 rounded accent-[#4f46e5]" />
              <span className="text-[13.5px] font-semibold">Ödemesi peşin alındı (ödendi olarak kaydet)</span>
            </label>
          )}

          {duzenle && (
            <p className="rounded-2xl bg-[#eef1fd] px-3 py-2.5 text-[12.5px] text-[#3b4262]">
              Ödeme durumu tahsilatlara göre kendiliğinden güncellenir. Eksik ödemeyi Seferler&apos;de &quot;Ödeme gir&quot; ile ekle.
            </p>
          )}

          {durum?.hata && (
            <p role="alert" className="rounded-2xl bg-[#fee2e2] px-3 py-2.5 text-[13.5px] font-semibold text-[#b91c1c]">
              {durum.hata}
            </p>
          )}

          <button type="submit" disabled={bekliyor} className="ana-ana-dugme w-full !min-h-12 !text-[15px] disabled:opacity-60">
            {bekliyor ? "Kaydediliyor…" : duzenle ? "Değişiklikleri kaydet" : "Seferi kaydet"}
          </button>
        </form>
      </div>
    </div>
  );
}
