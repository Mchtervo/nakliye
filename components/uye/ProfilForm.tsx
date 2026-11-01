"use client";

import { AnimatePresence, m } from "motion/react";
import { useActionState, useEffect, useState } from "react";
import { sifreDegistir } from "@/app/auth-actions";
import { profilKaydet } from "@/app/uye-actions";

const ARAC_TIPLERI = ["Tır", "Kamyon", "Kamyonet", "Panelvan"];
const KASA_TIPLERI = ["Tenteli", "Kapalı kasa", "Frigo", "Damper", "Açık kasa", "Lowbed", "Konteyner", "Diğer"];

export type ProfilBaslangic = {
  aracTipi: string;
  kasaTipi: string;
  plaka: string;
  ad: string;
  telefon: string;
  sehir: string;
};

function Alan({ id, etiket, children, zorunlu }: { id: string; etiket: string; children: React.ReactNode; zorunlu?: boolean }) {
  return (
    <div>
      <label htmlFor={id} className="sf-etiket">
        {etiket}
        {zorunlu && <span className="ml-1 text-[#dc2626]">*</span>}
      </label>
      <div className="sf-alan">{children}</div>
    </div>
  );
}

/** Üye profili: araç (ilk adım) + kişisel bilgiler. */
export function ProfilForm({ b }: { b: ProfilBaslangic }) {
  // Başarı yalnız sunucu kaydı gerçekten bitince (tamam: true döner)
  const [durum, aksiyon, bekliyor] = useActionState<{ hata: string | null; tamam: boolean; n: number }, FormData>(async (o, f) => {
    const r = await profilKaydet(null, f);
    return r?.hata ? { hata: r.hata, tamam: false, n: o.n + 1 } : { hata: null, tamam: true, n: o.n + 1 };
  }, { hata: null, tamam: false, n: 0 });
  const [gizle, setGizle] = useState(0);
  const [tip, setTip] = useState(b.aracTipi || "Tır");

  useEffect(() => {
    if (!durum.tamam) return;
    const t = window.setTimeout(() => setGizle(durum.n), 2200);
    return () => window.clearTimeout(t);
  }, [durum]);

  return (
    <form action={aksiyon} className="space-y-4">
      <section className="rounded-[1.5rem] bg-white p-4 shadow-[var(--a-golge)]" aria-labelledby="profil-arac">
        <h2 id="profil-arac" className="ana-baslik">
          Aracın
        </h2>
        <p className="mb-3 text-[12.5px] text-[var(--a-ikincil)]">Yük önerileri ve seferler bu araca göre.</p>
        <input type="hidden" name="aracTipi" value={tip} />
        <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Araç tipi">
          {ARAC_TIPLERI.map((t) => (
            <button key={t} type="button" aria-pressed={tip === t} onClick={() => setTip(t)} className={`ks-yon relative !min-h-11 !text-[13px] ${tip === t ? "!text-white" : "!text-[#3b4262]"}`}>
              {tip === t && <m.span layoutId="arac-tipi" className="absolute inset-0 rounded-[1rem] bg-gradient-to-br from-[#6d6af8] to-[#4338ca]" transition={{ type: "spring", stiffness: 520, damping: 42 }} aria-hidden />}
              <span className="relative">{t}</span>
            </button>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <Alan id="kasaTipi" etiket="Kasa tipi">
            <select id="kasaTipi" name="kasaTipi" defaultValue={b.kasaTipi || "Tenteli"} className="sf-girdi sf-secim">
              {KASA_TIPLERI.map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </Alan>
          <Alan id="plaka" etiket="Plaka" zorunlu>
            <input id="plaka" name="plaka" required defaultValue={b.plaka} placeholder="06 ABC 123" autoCapitalize="characters" className="sf-girdi uppercase" />
          </Alan>
        </div>
      </section>

      <section className="rounded-[1.5rem] bg-white p-4 shadow-[var(--a-golge)]" aria-labelledby="profil-bilgi">
        <h2 id="profil-bilgi" className="ana-baslik mb-3">
          Bilgilerin
        </h2>
        <div className="space-y-3">
          <Alan id="ad" etiket="Ad soyad" zorunlu>
            <input id="ad" name="ad" required defaultValue={b.ad} autoComplete="name" placeholder="Adın ve soyadın" className="sf-girdi" />
          </Alan>
          <div className="grid grid-cols-2 gap-2.5">
            <Alan id="telefon" etiket="Telefon" zorunlu>
              <input id="telefon" name="telefon" required type="tel" inputMode="tel" defaultValue={b.telefon} autoComplete="tel" placeholder="05xx xxx xx xx" className="sf-girdi" />
            </Alan>
            <Alan id="sehir" etiket="Şehir">
              <input id="sehir" name="sehir" defaultValue={b.sehir} placeholder="Ankara" className="sf-girdi" />
            </Alan>
          </div>
        </div>
      </section>

      {durum.hata && (
        <p role="alert" className="rounded-2xl bg-[#fee2e2] px-3 py-2.5 text-[13px] font-semibold text-[#b91c1c]">
          {durum.hata}
        </p>
      )}
      <AnimatePresence>
        {durum.tamam && !bekliyor && gizle !== durum.n && (
          <m.p
            role="status"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-2xl bg-[#dcfce7] px-3 py-2.5 text-center text-[13.5px] font-bold text-[#15803d]"
          >
            ✓ Bilgilerin kaydedildi
          </m.p>
        )}
      </AnimatePresence>
      <button type="submit" disabled={bekliyor} className="ana-ana-dugme w-full !min-h-12 !text-[15px] disabled:opacity-60">
        {bekliyor ? "Kaydediliyor…" : "Kaydet"}
      </button>
    </form>
  );
}

/** Üye şifre değişikliği (açık tasarım). */
export function SifreForm() {
  const [durum, aksiyon, bekliyor] = useActionState<{ hata: string | null; tamam: boolean }, FormData>(async (_o, f) => {
    const r = await sifreDegistir(null, f);
    return { hata: r?.hata ?? null, tamam: !r?.hata };
  }, { hata: null, tamam: false });
  const tamam = durum.tamam && !bekliyor;
  return (
    <form action={aksiyon} className="space-y-3">
      {(
        [
          ["mevcut", "Mevcut şifre", "current-password"],
          ["yeni", "Yeni şifre", "new-password"],
          ["yeni2", "Yeni şifre (tekrar)", "new-password"],
        ] as const
      ).map(([ad, etiket, ac]) => (
        <Alan key={ad} id={`sifre-${ad}`} etiket={etiket}>
          <input id={`sifre-${ad}`} name={ad} type="password" required autoComplete={ac} className="sf-girdi" />
        </Alan>
      ))}
      {durum.hata && (
        <p role="alert" className="rounded-2xl bg-[#fee2e2] px-3 py-2.5 text-[13px] font-semibold text-[#b91c1c]">
          {durum.hata}
        </p>
      )}
      {tamam && (
        <p role="status" className="rounded-2xl bg-[#dcfce7] px-3 py-2.5 text-center text-[13.5px] font-bold text-[#15803d]">
          ✓ Şifre değişti
        </p>
      )}
      <button type="submit" disabled={bekliyor} className="sf-ikincil-dugme w-full !min-h-11">
        {bekliyor ? "Kaydediliyor…" : "Şifreyi değiştir"}
      </button>
    </form>
  );
}
