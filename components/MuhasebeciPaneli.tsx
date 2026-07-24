"use client";

import {
  useActionState,
  useMemo,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import {
  fisleriGonderildiIsaretle,
  muhasebeciNumaraKaydet,
  type FormSonuc,
} from "@/app/actions";
import { tlYaz } from "@/lib/para";

type FisOge = {
  id: number;
  tarihYazi: string;
  kategoriAd: string;
  aciklama: string | null;
  toplamTutar: number;
  fisResmi: string;
  gonderildi: boolean;
};

function telefonTemizle(telefon: string): string {
  let t = telefon.replace(/[\s\-()]/g, "");
  if (t.startsWith("+")) t = t.slice(1);
  return t;
}

function mobilMi(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

async function zipIndir(ids: number[], dosyaAdi: string): Promise<void> {
  const zipYanit = await fetch("/api/fis-zip", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  if (!zipYanit.ok) {
    const j = await zipYanit.json().catch(() => null);
    throw new Error(j?.hata || "ZIP oluşturulamadı.");
  }
  const zipBlob = await zipYanit.blob();
  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = dosyaAdi;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function fisDosyalariHazirla(fisler: FisOge[]): Promise<File[]> {
  const dosyalar: File[] = [];
  for (const fis of fisler) {
    const yanit = await fetch(fis.fisResmi);
    if (!yanit.ok) throw new Error(`Fiş yüklenemedi: ${fis.fisResmi}`);
    const blob = await yanit.blob();
    const uzanti = fis.fisResmi.split(".").pop() || "jpg";
    const ad = `${fis.tarihYazi.replace(/\./g, "-")}_${fis.kategoriAd}_${fis.id}.${uzanti}`;
    dosyalar.push(new File([blob], ad, { type: blob.type || "image/jpeg" }));
  }
  return dosyalar;
}

export default function MuhasebeciPaneli({
  baslangicTelefon,
  fisler,
  ayEtiket,
  seciliAy,
}: {
  baslangicTelefon: string;
  fisler: FisOge[];
  ayEtiket: string;
  seciliAy: string;
}) {
  const [telefonDurum, telefonAksiyon, telefonBekliyor] = useActionState<
    FormSonuc,
    FormData
  >(muhasebeciNumaraKaydet, null);

  const [telefon, setTelefon] = useState(baslangicTelefon);
  const [secilen, setSecilen] = useState<number[]>(() =>
    fisler.filter((f) => !f.gonderildi).map((f) => f.id)
  );
  const [mesaj, setMesaj] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, baslat] = useTransition();
  const mobil = useSyncExternalStore(
    () => () => {},
    mobilMi,
    () => false
  );

  const seciliFisler = useMemo(
    () => fisler.filter((f) => secilen.includes(f.id)),
    [fisler, secilen]
  );

  function toggle(id: number) {
    setSecilen((onceki) =>
      onceki.includes(id) ? onceki.filter((x) => x !== id) : [...onceki, id]
    );
  }

  function hepsiniSec() {
    setSecilen(fisler.map((f) => f.id));
  }

  function sadeceYeni() {
    setSecilen(fisler.filter((f) => !f.gonderildi).map((f) => f.id));
  }

  function onKosul(): boolean {
    setMesaj(null);
    setHata(null);
    if (!telefon.trim()) {
      setHata("Önce muhasebecinin telefon numarasını kaydet.");
      return false;
    }
    if (seciliFisler.length === 0) {
      setHata("Gönderilecek fiş seçilmedi.");
      return false;
    }
    return true;
  }

  /** Mobil: WhatsApp uygulamasına paylaş */
  async function mobilWhatsappGonder() {
    if (!onKosul()) return;

    baslat(async () => {
      try {
        const dosyalar = await fisDosyalariHazirla(seciliFisler);
        const metin = `${ayEtiket} fişleri (${seciliFisler.length} adet) — Nakliye Defteri`;
        const tel = telefonTemizle(telefon);

        const nav = navigator as Navigator & {
          canShare?: (data?: ShareData) => boolean;
          share?: (data: ShareData) => Promise<void>;
        };

        // Android Chrome: dosyaları doğrudan WhatsApp'a paylaş
        if (nav.share && nav.canShare?.({ files: dosyalar })) {
          await nav.share({ files: dosyalar, title: "Fişler", text: metin });
          await fisleriGonderildiIsaretle(seciliFisler.map((f) => f.id));
          setMesaj(
            `${seciliFisler.length} fiş WhatsApp'a gönderildi olarak işaretlendi. Listeden muhasebecini seçtiysen tamamdır.`
          );
          return;
        }

        // iOS / share desteklemiyorsa: ZIP indir + WhatsApp sohbetini aç
        await zipIndir(
          seciliFisler.map((f) => f.id),
          `fisler-${seciliAy}.zip`
        );
        const waMetin = encodeURIComponent(
          `${metin}\nAz önce indirilen ZIP'i bu sohbete ekliyorum.`
        );
        window.location.href = `https://wa.me/${tel}?text=${waMetin}`;

        await fisleriGonderildiIsaretle(seciliFisler.map((f) => f.id));
        setMesaj(
          `ZIP indirildi, WhatsApp açılıyor. Sohbette + / ataşman ile ZIP'i ekle.`
        );
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") {
          setHata("Paylaşım iptal edildi.");
          return;
        }
        setHata(e instanceof Error ? e.message : "Gönderim başarısız.");
      }
    });
  }

  /** Masaüstü: WhatsApp Web veya Desktop uygulaması */
  async function masaustuWhatsappGonder() {
    if (!onKosul()) return;

    baslat(async () => {
      try {
        const metin = `${ayEtiket} fişleri (${seciliFisler.length} adet) — Nakliye Defteri`;
        const tel = telefonTemizle(telefon);
        const zipAdi = `fisler-${seciliAy}.zip`;

        await zipIndir(
          seciliFisler.map((f) => f.id),
          zipAdi
        );

        // WhatsApp Web sohbetini aç (tarayıcıda açıksa / Desktop varsa oraya düşer)
        const waMetin = encodeURIComponent(
          `${metin}\nİndirdiğim ${zipAdi} dosyasını şimdi ekliyorum.`
        );
        const webUrl = `https://web.whatsapp.com/send?phone=${tel}&text=${waMetin}`;
        window.open(webUrl, "_blank", "noopener,noreferrer");

        await fisleriGonderildiIsaretle(seciliFisler.map((f) => f.id));
        setMesaj(
          `1) ${zipAdi} indirildi (İndirilenler klasörüne bak).\n2) WhatsApp Web / Desktop açıldı.\n3) Sohbette ataşman (📎) ile ZIP'i ekleyip gönder.`
        );
      } catch (e) {
        setHata(e instanceof Error ? e.message : "Gönderim başarısız.");
      }
    });
  }

  async function sadeceZipIndir() {
    setMesaj(null);
    setHata(null);
    if (seciliFisler.length === 0) {
      setHata("İndirilecek fiş seçilmedi.");
      return;
    }
    baslat(async () => {
      try {
        await zipIndir(
          seciliFisler.map((f) => f.id),
          `fisler-${seciliAy}.zip`
        );
        setMesaj("ZIP indirildi. WhatsApp Web/Desktop'ta sohbete sürükleyip bırakabilirsin.");
      } catch (e) {
        setHata(e instanceof Error ? e.message : "İndirme başarısız.");
      }
    });
  }

  return (
    <div className="space-y-5">
      <form action={telefonAksiyon} className="kart-paper p-4">
        <label htmlFor="telefon" className="etiket">
          Muhasebeci telefon numarası
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="telefon"
            name="telefon"
            type="tel"
            required
            placeholder="05XX XXX XX XX"
            value={telefon}
            onChange={(e) => setTelefon(e.target.value)}
            className="alan"
          />
          <button
            type="submit"
            disabled={telefonBekliyor}
            className="btn btn-ink shrink-0"
          >
            {telefonBekliyor ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </div>
        {telefonDurum?.hata && (
          <p className="mt-2 text-sm font-semibold text-ember">{telefonDurum.hata}</p>
        )}
        {!telefonDurum?.hata && baslangicTelefon && telefon === baslangicTelefon && (
          <p className="mt-2 text-xs text-[#6a7a90]">Kayıtlı numara: {baslangicTelefon}</p>
        )}
      </form>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-fog">
          {ayEtiket} · {fisler.length} fişli gider · {secilen.length} seçili
        </div>
        <div className="flex gap-2 text-sm">
          <button
            type="button"
            onClick={sadeceYeni}
            className="rounded-lg px-2.5 py-1.5 font-semibold text-fog hover:bg-white/5 hover:text-paper"
          >
            Sadece yeniler
          </button>
          <button
            type="button"
            onClick={hepsiniSec}
            className="rounded-lg px-2.5 py-1.5 font-semibold text-fog hover:bg-white/5 hover:text-paper"
          >
            Tümünü seç
          </button>
        </div>
      </div>

      {fisler.length === 0 ? (
        <div className="bos-durum">
          Bu ayda fiş resmi olan gider yok. Gider eklerken fiş fotoğrafı yükle.
        </div>
      ) : (
        <div className="space-y-2">
          {fisler.map((fis) => {
            const secili = secilen.includes(fis.id);
            return (
              <label
                key={fis.id}
                className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3 transition-all ${
                  secili
                    ? "border-amber/40 bg-asphalt-3 ring-1 ring-amber/20"
                    : "border-white/10 bg-asphalt-2/60"
                }`}
              >
                <input
                  type="checkbox"
                  checked={secili}
                  onChange={() => toggle(fis.id)}
                  className="h-5 w-5 accent-[#f0a020]"
                />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={fis.fisResmi}
                  alt=""
                  className="h-14 w-14 rounded-lg border border-white/10 object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-paper">
                    {fis.kategoriAd}
                    {fis.gonderildi && (
                      <span className="ml-2 text-xs font-semibold text-ok">
                        (daha önce gönderildi)
                      </span>
                    )}
                  </div>
                  <div className="truncate text-sm text-fog">
                    {fis.tarihYazi}
                    {fis.aciklama ? ` · ${fis.aciklama}` : ""} · {tlYaz(fis.toplamTutar)}
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      )}

      {(hata || mesaj) && (
        <div
          className={`whitespace-pre-line rounded-xl border px-3 py-2.5 text-sm font-semibold ${
            hata
              ? "border-ember/30 bg-ember/10 text-ember"
              : "border-ok/30 bg-ok/10 text-ok"
          }`}
        >
          {hata || mesaj}
        </div>
      )}

      <div className="sticky bottom-20 z-10 space-y-2 rounded-2xl border border-white/10 bg-asphalt-2/95 p-3 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl md:bottom-4">
        {mobil ? (
          <>
            <button
              type="button"
              disabled={bekliyor || seciliFisler.length === 0}
              onClick={mobilWhatsappGonder}
              className="btn btn-teal btn-block"
            >
              {bekliyor
                ? "Hazırlanıyor..."
                : `WhatsApp ile Gönder (${seciliFisler.length} fiş)`}
            </button>
            <p className="text-center text-xs text-fog">
              Telefonunda WhatsApp açılır; muhasebecini seçip fişleri gönderirsin.
            </p>
          </>
        ) : (
          <>
            <button
              type="button"
              disabled={bekliyor || seciliFisler.length === 0}
              onClick={masaustuWhatsappGonder}
              className="btn btn-teal btn-block"
            >
              {bekliyor
                ? "Hazırlanıyor..."
                : `WhatsApp Web / Masaüstü (${seciliFisler.length} fiş)`}
            </button>
            <p className="text-center text-xs leading-relaxed text-fog">
              ZIP iner + WhatsApp Web açılır. Tarayıcıda veya Desktop uygulamasında
              sohbete 📎 ile ZIP&apos;i ekle.
            </p>
          </>
        )}

        {/* Diğer yol her zaman erişilebilir */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {!mobil && (
            <button
              type="button"
              disabled={bekliyor || seciliFisler.length === 0}
              onClick={mobilWhatsappGonder}
              className="btn btn-ghost btn-block !text-sm"
            >
              Mobil gibi paylaş
            </button>
          )}
          {mobil && (
            <button
              type="button"
              disabled={bekliyor || seciliFisler.length === 0}
              onClick={masaustuWhatsappGonder}
              className="btn btn-ghost btn-block !text-sm"
            >
              Web / Desktop yolu
            </button>
          )}
          <button
            type="button"
            disabled={bekliyor || seciliFisler.length === 0}
            onClick={sadeceZipIndir}
            className="btn btn-ghost btn-block !text-sm"
          >
            Sadece ZIP indir
          </button>
        </div>
      </div>
    </div>
  );
}
