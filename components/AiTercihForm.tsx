"use client";

import { useActionState } from "react";
import { aiTercihKaydet, type AiSonuc } from "@/app/ai-actions";
import { ARAC_TIPLERI, type AracTipiKodu } from "@/lib/arac";
import { BOLGELER, type BolgeKodu } from "@/lib/bolgeler";

export default function AiTercihForm({
  sehir,
  rotalar,
  minUcretYazi,
  bolgeler,
  aracTipleri,
  maxTonaj,
  anaUs,
  ekIller,
  koridorIller,
  telegramAcik,
  pushAcik,
  telegramUyeAcik,
  waSablon,
  tdmKaraListe,
  tdmGunlukLimit,
  autoDeploy,
}: {
  sehir: string;
  rotalar: string;
  minUcretYazi: string;
  bolgeler: BolgeKodu[];
  aracTipleri: AracTipiKodu[];
  maxTonaj: string;
  anaUs: string;
  ekIller: string;
  koridorIller: string;
  telegramAcik: boolean;
  pushAcik: boolean;
  telegramUyeAcik: boolean;
  waSablon: {
    ad: string;
    firma: string;
    arac: string;
    tonaj: string;
    musaitlik: string;
    tonTercih: string;
    imza: string;
    mesajSablon: string;
  };
  tdmKaraListe: string;
  tdmGunlukLimit: string;
  autoDeploy: boolean;
}) {
  const [durum, aksiyon, bekliyor] = useActionState<AiSonuc, FormData>(
    aiTercihKaydet,
    null
  );

  return (
    <form action={aksiyon} className="space-y-3">
      <div className="space-y-3 rounded-xl border border-amber/20 bg-amber/5 p-3">
        <div className="text-xs font-bold uppercase tracking-wider text-amber">
          Aracım
        </div>
        <div>
          <span className="etiket">Araç tipi</span>
          <div className="mt-1 grid grid-cols-2 gap-1.5">
            {ARAC_TIPLERI.filter((a) => a.kod !== "DIGER").map((a) => (
              <label
                key={a.kod}
                className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/4 px-2.5 py-2"
              >
                <input
                  type="checkbox"
                  name="aracTipleri"
                  value={a.kod}
                  defaultChecked={aracTipleri.includes(a.kod)}
                  className="h-4.5 w-4.5 rounded accent-[#f0a020]"
                />
                <span className="text-sm font-semibold text-paper">{a.ad}</span>
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-fog">
            Tenteli / kapalı kasa seçiliyse frigo, damper, lowbed, kısadorse,
            açık dorse vb. elenir. «açık veya kapalı» geçer. Tipi yazmayan
            ilanlar geçer; kartta sarı uyarı çıkar.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="maxTonaj" className="etiket">
              Max tonaj
            </label>
            <input
              id="maxTonaj"
              name="maxTonaj"
              type="text"
              inputMode="numeric"
              placeholder="Örnek: 24"
              defaultValue={maxTonaj}
              className="alan"
            />
          </div>
          <div>
            <label htmlFor="anaUs" className="etiket">
              Ana üs
            </label>
            <input
              id="anaUs"
              name="anaUs"
              type="text"
              placeholder="Örnek: Ankara"
              defaultValue={anaUs}
              className="alan"
            />
          </div>
        </div>
      </div>

      <div>
        <label htmlFor="sehir" className="etiket">
          Bulunduğun şehir
        </label>
        <input
          id="sehir"
          name="sehir"
          type="text"
          placeholder="Örnek: Ankara"
          defaultValue={sehir}
          className="alan"
        />
        <p className="mt-1 text-xs text-fog">
          Bu şehirden çıkan yükler öncelikli bildirilir.
        </p>
      </div>

      <div>
        <label htmlFor="rotalar" className="etiket">
          Sık çalıştığın rotalar
        </label>
        <input
          id="rotalar"
          name="rotalar"
          type="text"
          placeholder="Ankara-İstanbul, Mersin-Bursa"
          defaultValue={rotalar}
          className="alan"
        />
        <p className="mt-1 text-xs text-fog">
          Virgülle ayır. Tek şehir yazarsan o şehre giden/gelen her yük sayılır.
        </p>
      </div>

      <div>
        <label htmlFor="minUcret" className="etiket">
          En düşük ücret (isteğe bağlı)
        </label>
        <input
          id="minUcret"
          name="minUcret"
          type="text"
          inputMode="decimal"
          placeholder="Örnek: 15.000"
          defaultValue={minUcretYazi}
          className="alan"
        />
        <p className="mt-1 text-xs text-fog">
          Altındaki ilanlar için bildirim gelmez (ekranda yine görünür).
        </p>
      </div>

      <div>
        <label htmlFor="koridorIller" className="etiket">
          Koridor illeri (çalışma alanı)
        </label>
        <textarea
          id="koridorIller"
          name="koridorIller"
          rows={3}
          placeholder="Ankara, Kırıkkale, Çankırı, Bolu, Düzce, Sakarya, Kocaeli, İstanbul"
          defaultValue={koridorIller}
          className="alan"
        />
        <p className="mt-1 text-xs text-fog">
          HEM çıkış HEM varış bu listede olmalı. Virgülle ayır. Eskişehir /
          Bursa eklemek için listeye yazıp kaydet — kod gerekmez.
        </p>
      </div>

      <div>
        <span className="etiket">Grup keşfi — bölgeler</span>
        <div className="mt-1 grid grid-cols-2 gap-1.5">
          {BOLGELER.map((b) => (
            <label
              key={b.kod}
              className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/4 px-2.5 py-2"
            >
              <input
                type="checkbox"
                name="bolgeler"
                value={b.kod}
                defaultChecked={bolgeler.includes(b.kod)}
                className="h-4.5 w-4.5 rounded accent-[#f0a020]"
              />
              <span className="text-sm font-semibold text-paper">{b.ad}</span>
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-fog">
          Sadece Telegram grup araması için. İlan filtresi yukarıdaki
          koridor listesidir.
        </p>
      </div>

      <div>
        <label htmlFor="ekIller" className="etiket">
          Koridora ek iller (kısayol)
        </label>
        <input
          id="ekIller"
          name="ekIller"
          type="text"
          placeholder="Örnek: Eskişehir, Bilecik, Bursa"
          defaultValue={ekIller}
          className="alan"
        />
        <p className="mt-1 text-xs text-fog">
          Koridor alanına yazmak yerine buraya da ekleyebilirsin.
        </p>
      </div>

      <div className="space-y-2 rounded-xl border border-white/10 bg-white/4 p-3">
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            name="telegramUye"
            value="1"
            defaultChecked={telegramUyeAcik}
            className="h-5 w-5 rounded accent-[#f0a020]"
          />
          <span className="text-sm font-semibold text-paper">
            Telegram gruplarını kendi hesabımla tara
          </span>
        </label>
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            name="bildirimTelegram"
            value="1"
            defaultChecked={telegramAcik}
            className="h-5 w-5 rounded accent-[#f0a020]"
          />
          <span className="text-sm font-semibold text-paper">
            Telegram bildirimi
          </span>
        </label>
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            name="bildirimPush"
            value="1"
            defaultChecked={pushAcik}
            className="h-5 w-5 rounded accent-[#f0a020]"
          />
          <span className="text-sm font-semibold text-paper">
            Telefon bildirimi (push)
          </span>
        </label>
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            name="autoDeploy"
            value="1"
            defaultChecked={autoDeploy}
            className="h-5 w-5 rounded accent-[#f0a020]"
          />
          <span className="text-sm font-semibold text-paper">
            Otomatik deploy (VPS)
          </span>
        </label>
        <p className="text-xs text-fog pl-8">
          Açıkken dakikada bir GitHub main kontrol edilir; yeni commit varsa
          build + restart. Build bozulursa eski sürüm geri yüklenir.
        </p>
      </div>

        <div className="space-y-3 rounded-xl border border-teal/20 bg-teal/5 p-3">
        <div className="text-xs font-bold uppercase tracking-wider text-teal">
          Bilgi Sor mesajı (taahhüt yok)
        </div>
        <p className="text-xs text-fog">
          [Bilgi Sor] bu metni gönderir. AI yok. Yer tutucu: {"{rota}"}.
          Araç / müsaitlik / «alırım» yazma.
        </p>
        <div>
          <label htmlFor="waMesajSablon" className="etiket">
            Mesaj metni
          </label>
          <textarea
            id="waMesajSablon"
            name="waMesajSablon"
            rows={4}
            placeholder={
              "Merhaba, {rota} işiniz için bilgi alabilir miyim?\nKaç ton, navlun ne kadar, yükleme ne zaman ve tam adres neresi?"
            }
            defaultValue={
              waSablon.mesajSablon ||
              "Merhaba, {rota} işiniz için bilgi alabilir miyim?\nKaç ton, navlun ne kadar, yükleme ne zaman ve tam adres neresi?"
            }
            className="alan"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="waAd" className="etiket">
              Adım (opsiyonel)
            </label>
            <input
              id="waAd"
              name="waAd"
              type="text"
              placeholder="Mertcan"
              defaultValue={waSablon.ad}
              className="alan"
            />
          </div>
          <div>
            <label htmlFor="waFirma" className="etiket">
              Firma (opsiyonel)
            </label>
            <input
              id="waFirma"
              name="waFirma"
              type="text"
              placeholder="… Nakliyat"
              defaultValue={waSablon.firma}
              className="alan"
            />
          </div>
        </div>
        <div>
          <label htmlFor="waImza" className="etiket">
            İmza (isteğe bağlı, kısa)
          </label>
          <input
            id="waImza"
            name="waImza"
            type="text"
            placeholder="İyi çalışmalar"
            defaultValue={waSablon.imza}
            className="alan"
          />
        </div>
        {/* Gizli alanlar — form uyumu için eski alanlar */}
        <input type="hidden" name="waArac" value={waSablon.arac || ""} />
        <input type="hidden" name="waTonaj" value={waSablon.tonaj || ""} />
        <input
          type="hidden"
          name="waMusaitlik"
          value={waSablon.musaitlik || ""}
        />
        <input
          type="hidden"
          name="waTonTercih"
          value={waSablon.tonTercih || ""}
        />

        <div>
          <label htmlFor="tdmGunlukLimit" className="etiket">
            Günlük Bilgi Sor limiti (Telegram)
          </label>
          <input
            id="tdmGunlukLimit"
            name="tdmGunlukLimit"
            type="text"
            inputMode="numeric"
            placeholder="10"
            defaultValue={tdmGunlukLimit}
            className="alan"
          />
          <p className="mt-1 text-xs text-fog">
            Varsayılan 10. Ara ≥2 dk. FloodWait → 24s durur, haber verir. 1–30.
            Otomatik gönderme yok — sadece [Bilgi Sor].
          </p>
        </div>
        <div>
          <label htmlFor="tdmKaraListe" className="etiket">
            DM kara liste (telefon / user id)
          </label>
          <textarea
            id="tdmKaraListe"
            name="tdmKaraListe"
            rows={2}
            placeholder="0532..., telegram user id — virgülle"
            defaultValue={tdmKaraListe}
            className="alan"
          />
        </div>
      </div>

      {durum && "hata" in durum && (
        <div className="rounded-xl border border-ember/30 bg-ember/10 px-3 py-2.5 text-sm font-semibold text-ember">
          {durum.hata}
        </div>
      )}
      {durum && "bilgi" in durum && (
        <div className="rounded-xl border border-ok/30 bg-ok/10 px-3 py-2.5 text-sm font-semibold text-ok">
          {durum.bilgi}
        </div>
      )}
      <p className="text-[11px] text-fog">
        Kayıt: hepsi ya hiçbiri. Bir alan hatalıysa hiçbir ayar değişmez.
      </p>

      <button type="submit" disabled={bekliyor} className="btn btn-amber btn-block">
        {bekliyor ? "Kaydediliyor..." : "Tercihleri Kaydet"}
      </button>
    </form>
  );
}
