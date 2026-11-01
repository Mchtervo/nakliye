"use client";

import { AnimatePresence, m } from "motion/react";
import { useActionState, useEffect, useState, useTransition } from "react";
import { krediEkle, krediSil, taksitDuzenle, taksitGeriAl, taksitOde, type KrediSonuc } from "@/app/kredi-actions";
import AltPanel from "@/components/ana/AltPanel";
import RaporUst from "@/components/finans/RaporUst";
import { Uyari } from "@/components/uyelik/Alanlar";

export type TaksitG = { id: number; sira: number; vadeYazi: string; tutar: number; anaparaPay: number; faizPay: number; odendi: boolean; kalanGun: number };
export type KrediG = {
  id: number;
  ad: string;
  kurum: string | null;
  anapara: number;
  kalan: number;
  kalanAnapara: number;
  toplamFaiz: number;
  odenen: number;
  taksitSayisi: number;
  odenenTaksit: number;
  taksitler: TaksitG[];
};

const tl = (k: number) => `₺${(k / 100).toLocaleString("tr-TR", { maximumFractionDigits: 2 })}`;
const tlGiris = (k: number) => (k / 100).toLocaleString("tr-TR", { maximumFractionDigits: 2 });
const gunYazi = (g: number) => (g < 0 ? `${-g} gün geçti` : g === 0 ? "bugün" : `${g} gün`);

function KrediFormu({ kapat }: { kapat: () => void }) {
  const [d, aksiyon, bekliyor] = useActionState<KrediSonuc, FormData>(krediEkle, { hata: null, tamam: false });
  useEffect(() => {
    if (d.tamam) kapat();
  }, [d, kapat]);
  return (
    <form action={aksiyon} className="space-y-3 px-5 pb-6 pt-1">
      <h2 className="text-[1.3rem] font-extrabold">Kredi ekle</h2>
      <label className="block">
        <span className="ana-etiket">Kredinin adı</span>
        <input name="ad" required className="ana-alan" placeholder="Ör. Çekici kredisi" />
      </label>
      <label className="block">
        <span className="ana-etiket">Banka / kurum</span>
        <input name="kurum" className="ana-alan" placeholder="İsteğe bağlı" />
      </label>
      <div className="grid grid-cols-2 gap-2.5">
        <label className="block">
          <span className="ana-etiket">Çekilen tutar (₺)</span>
          <input name="anapara" inputMode="decimal" required className="ana-alan" />
        </label>
        <label className="block">
          <span className="ana-etiket">Aylık taksit (₺)</span>
          <input name="taksitTutari" inputMode="decimal" required className="ana-alan" />
        </label>
        <label className="block">
          <span className="ana-etiket">Taksit sayısı</span>
          <input name="adet" inputMode="numeric" required className="ana-alan" />
        </label>
        <label className="block">
          <span className="ana-etiket">İlk taksit</span>
          <input name="ilkVade" type="date" required className="ana-alan" />
        </label>
      </div>
      <p className="rp-not">
        <span aria-hidden>ⓘ</span>
        <span>Anapara taksitlere eşit dağıtılır; kalanı faiz/masraftır. Bankanın planı farklıysa taksiti açıp düzelt.</span>
      </p>
      {d.hata && <Uyari>{d.hata}</Uyari>}
      <button type="submit" disabled={bekliyor} className="ana-ana-dugme w-full">
        {bekliyor ? "Kaydediliyor…" : "Krediyi kaydet"}
      </button>
    </form>
  );
}

function TaksitFormu({ t, kapat }: { t: TaksitG; kapat: () => void }) {
  const [d, aksiyon, bekliyor] = useActionState<KrediSonuc, FormData>(taksitDuzenle, { hata: null, tamam: false });
  useEffect(() => {
    if (d.tamam) kapat();
  }, [d, kapat]);
  return (
    <form action={aksiyon} className="space-y-3 px-5 pb-6 pt-1">
      <h2 className="text-[1.3rem] font-extrabold">{t.sira}. taksit · {t.vadeYazi}</h2>
      <input type="hidden" name="taksitId" value={t.id} />
      <div className="grid grid-cols-2 gap-2.5">
        <label className="block">
          <span className="ana-etiket">Taksit tutarı (₺)</span>
          <input name="tutar" inputMode="decimal" defaultValue={tlGiris(t.tutar)} className="ana-alan" />
        </label>
        <label className="block">
          <span className="ana-etiket">Anapara payı (₺)</span>
          <input name="anaparaPay" inputMode="decimal" defaultValue={tlGiris(t.anaparaPay)} className="ana-alan" />
        </label>
      </div>
      <p className="text-[12.5px] text-[var(--a-ikincil)]">Faiz/masraf = taksit − anapara payı.</p>
      {d.hata && <Uyari>{d.hata}</Uyari>}
      <button type="submit" disabled={bekliyor} className="ana-ana-dugme w-full">
        {bekliyor ? "Kaydediliyor…" : "Kaydet"}
      </button>
    </form>
  );
}

function KrediKarti({ k, duzenle }: { k: KrediG; duzenle: (t: TaksitG) => void }) {
  const [acik, setAcik] = useState(false);
  const [bekliyor, baslat] = useTransition();
  const [hata, setHata] = useState<string | null>(null);
  const sonraki = k.taksitler.find((t) => !t.odendi);
  const oran = k.taksitSayisi ? k.odenenTaksit / k.taksitSayisi : 0;
  const yap = (is: () => Promise<KrediSonuc>) =>
    baslat(async () => {
      const r = await is().catch(() => ({ hata: "Bağlantı hatası. Tekrar dene.", tamam: false }));
      setHata(r.hata);
    });

  return (
    <li className="rp-kart space-y-3 px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="block truncate text-[16px] font-extrabold">{k.ad}</span>
          <span className="block text-[12.5px] text-[var(--a-ikincil)]">
            {[k.kurum, `${k.odenenTaksit}/${k.taksitSayisi} taksit ödendi`].filter(Boolean).join(" · ")}
          </span>
        </span>
        <span className="text-right">
          <span className="block text-[11.5px] font-semibold text-[var(--a-ikincil)]">Kalan</span>
          <span className="block text-[17px] font-extrabold tabular-nums">{tl(k.kalan)}</span>
        </span>
      </div>
      <span className="block h-[7px] overflow-hidden rounded-full bg-[#eceef6]">
        <m.span className="block h-full rounded-full bg-gradient-to-r from-[#7dd3fc] to-[#4f46e5]" initial={{ width: 0 }} animate={{ width: `${oran * 100}%` }} transition={{ duration: 0.5 }} />
      </span>
      <dl className="grid grid-cols-3 gap-2 text-center">
        {[
          ["Anapara", tl(k.anapara)],
          ["Kalan anapara", tl(k.kalanAnapara)],
          ["Faiz/masraf", tl(k.toplamFaiz)],
        ].map(([a, b]) => (
          <div key={a} className="rounded-xl bg-[#f6f7fb] px-1 py-2">
            <dt className="text-[11px] text-[var(--a-ikincil)]">{a}</dt>
            <dd className="text-[13px] font-extrabold tabular-nums">{b}</dd>
          </div>
        ))}
      </dl>
      {sonraki ? (
        <div className="flex items-center gap-3 rounded-2xl bg-[#eef0ff] px-3 py-2.5">
          <span className="min-w-0 flex-1">
            <span className="block text-[13.5px] font-extrabold">
              {sonraki.sira}. taksit · {tl(sonraki.tutar)}
            </span>
            <span className={`block text-[12px] ${sonraki.kalanGun <= 3 ? "font-bold text-[#c2410c]" : "text-[var(--a-ikincil)]"}`}>
              {sonraki.vadeYazi} · {gunYazi(sonraki.kalanGun)}
            </span>
          </span>
          <button type="button" disabled={bekliyor} onClick={() => confirm(`${sonraki.sira}. taksit (${tl(sonraki.tutar)}) ödendi olarak kaydedilsin mi?`) && yap(() => taksitOde(sonraki.id))} className="ana-ana-dugme !min-h-10 !px-4 !text-[14px]">
            {bekliyor ? "…" : "Ödendi"}
          </button>
        </div>
      ) : (
        <p className="rounded-2xl bg-[#dcfce7] px-3 py-2.5 text-[13.5px] font-bold text-[#166534]">Tüm taksitler ödendi.</p>
      )}
      {hata && <Uyari>{hata}</Uyari>}
      <button type="button" onClick={() => setAcik((a) => !a)} className="text-[13.5px] font-bold text-[#3730a3]" aria-expanded={acik}>
        {acik ? "Planı gizle" : "Ödeme planını gör"}
      </button>
      <AnimatePresence initial={false}>
        {acik && (
          <m.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <ul>
              {k.taksitler.map((t) => (
                <li key={t.id} className="flex items-center gap-2 border-b border-[var(--a-cizgi)] py-2 text-[13px] last:border-0">
                  <span className="w-7 font-bold text-[var(--a-ikincil)]">{t.sira}</span>
                  <button type="button" disabled={t.odendi} onClick={() => duzenle(t)} className="min-w-0 flex-1 text-left">
                    <span className="block font-semibold">{t.vadeYazi}</span>
                    <span className="block text-[11.5px] text-[var(--a-ikincil)]">
                      Anapara {tl(t.anaparaPay)} · faiz/masraf {tl(t.faizPay)}
                    </span>
                  </button>
                  <span className="font-extrabold tabular-nums">{tl(t.tutar)}</span>
                  {t.odendi ? (
                    <button type="button" disabled={bekliyor} onClick={() => confirm("Ödeme geri alınsın mı? Bu ekranın yazdığı gider de silinir.") && yap(() => taksitGeriAl(t.id))} className="ar-gun !bg-[#dcfce7] !text-[#166534]">
                      Ödendi ✓
                    </button>
                  ) : (
                    <button type="button" disabled={bekliyor} onClick={() => yap(() => taksitOde(t.id))} className="ar-gun">
                      Öde
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <button
              type="button"
              disabled={bekliyor}
              onClick={() => confirm("Kredi planı silinsin mi? Ödenmiş taksitlerin giderleri yerinde kalır.") && baslat(async () => krediSil(k.id))}
              className="mt-2 w-full py-2 text-[13.5px] font-bold text-[#dc2626]"
            >
              Krediyi sil
            </button>
          </m.div>
        )}
      </AnimatePresence>
    </li>
  );
}

/** Krediler: plan, kalan borç, anapara / faiz ayrımı, taksit ödeme. */
export default function KrediGorunum({ krediler }: { krediler: KrediG[] }) {
  const [panel, setPanel] = useState<null | { tur: "yeni" } | { tur: "taksit"; t: TaksitG }>(null);
  const kalan = krediler.reduce((t, k) => t + k.kalan, 0);
  const kapat = () => setPanel(null);
  return (
    <>
      <RaporUst geriHref="/">
        <h1 className="text-[1.6rem] font-extrabold leading-tight tracking-[-0.03em] text-white">Krediler</h1>
        <p className="mt-3 text-[14px] font-semibold text-[#dfe4ff]">Toplam kalan borç</p>
        <p className="text-[2.2rem] font-extrabold leading-none tracking-[-0.03em] text-white tabular-nums">{tl(kalan)}</p>
        <p className="mt-1.5 text-[12px] text-[#9aa6e8]">Ödenmemiş taksitlerin toplamı (faiz/masraf dahil)</p>
      </RaporUst>
      <div className="ana-ic relative z-10 -mt-10 space-y-4 pb-8">
        {krediler.length === 0 ? (
          <p className="rp-bos">Kredi planı yok. Ekleyince taksitler ana sayfada ve bildirimlerde hatırlatılır.</p>
        ) : (
          <ul className="space-y-3">
            {krediler.map((k) => (
              <KrediKarti key={k.id} k={k} duzenle={(t) => setPanel({ tur: "taksit", t })} />
            ))}
          </ul>
        )}
        <button type="button" onClick={() => setPanel({ tur: "yeni" })} className="rp-genis-dugme w-full justify-center !text-[15px] font-extrabold text-[#3730a3]">
          + Kredi ekle
        </button>
        <p className="rp-not">
          <span aria-hidden>ⓘ</span>
          <span>“Ödendi” tek bir “Kredi ödemesi” gideri yazar; aynı tutarda elle girdiğin kredi gideri varsa yenisini yazmaz, ona bağlanır.</span>
        </p>
      </div>
      <AltPanel acik={panel !== null} etiket="Kredi" kapat={kapat}>
        {panel?.tur === "yeni" && <KrediFormu kapat={kapat} />}
        {panel?.tur === "taksit" && <TaksitFormu key={panel.t.id} t={panel.t} kapat={kapat} />}
      </AltPanel>
    </>
  );
}
