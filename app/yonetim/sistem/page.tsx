import Link from "next/link";
import YonetimKabuk from "@/components/yonetim/YonetimKabuk";
import { aiMaliyetOzeti } from "@/lib/ai/maliyetOzeti";
import { yoneticiSayfasi } from "@/lib/yetki";
import { ISLEM_ADI, aiDonemHarcamasi, genelDurum, islenemeyenMesajlar, kaynakDurumlari, kaynakKalitesi, sonYonetimKayitlari, sorunluKaynaklar } from "@/lib/yonetimVeri";

export const dynamic = "force-dynamic";

/** Sistem durumu: kaynaklar, işleme kuyruğu, grup kalitesi, AI maliyeti, işlem kayıtları. */
export default async function YonetimSistem() {
  await yoneticiSayfasi();
  const [kaynaklar, g, kalite, ai, kayitlar, sorunlu, islenemeyen, donem] = await Promise.all([
    kaynakDurumlari(),
    genelDurum(),
    kaynakKalitesi(),
    aiMaliyetOzeti().catch(() => null),
    sonYonetimKayitlari(25),
    sorunluKaynaklar(),
    islenemeyenMesajlar(),
    aiDonemHarcamasi(),
  ]);
  const aiOran = ai && ai.limitUsd > 0 ? Math.min(1, ai.bugunMikro / 1_000_000 / ai.limitUsd) : 0;

  return (
    <YonetimKabuk sekme="sistem" baslik="Sistem durumu" alt="Kaynaklar, kuyruk ve AI" rozet={{ ilanlar: g.sikayet }}>
      <section aria-labelledby="s-kaynak">
        <h2 id="s-kaynak" className="ana-baslik px-1">
          Kaynaklar
        </h2>
        <ul className="rp-kart mt-2 px-3">
          {kaynaklar.map((k) => (
            <li key={k.ad} className="flex items-center gap-3 border-b border-[var(--a-cizgi)] py-3 last:border-0">
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-bold">{k.ad}</span>
                <span className="block text-[12px] text-[var(--a-ikincil)]">{k.ayrinti}</span>
              </span>
              <span className={`yn-durum ${k.durum === "CALISIYOR" ? "yn-durum-iyi" : k.durum === "SORUNLU" ? "yn-durum-kotu" : "yn-durum-belirsiz"}`}>
                {k.durum === "CALISIYOR" ? "Çalışıyor" : k.durum === "SORUNLU" ? "Sorunlu" : "Bilinmiyor"}
              </span>
            </li>
          ))}
        </ul>
        {sorunlu.length > 0 && (
          <>
            <h3 className="mt-3 px-1 text-[14px] font-extrabold text-[#b91c1c]">Çalışmayan / sessiz kaynaklar ({sorunlu.length})</h3>
            <ul className="rp-kart mt-2 px-3">
              {sorunlu.map((k) => (
                <li key={k.id} className="border-b border-[var(--a-cizgi)] py-2.5 last:border-0">
                  <span className="block truncate text-[14px] font-bold">
                    {k.ad} <span className="font-medium text-[var(--a-ikincil)]">· {k.tur}</span>
                  </span>
                  <span className={`block truncate text-[12px] ${k.sonHata ? "text-[#dc2626]" : "text-[var(--a-ikincil)]"}`}>{k.neden}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="rp-kart px-4 py-3.5" aria-labelledby="s-kuyruk">
        <h2 id="s-kuyruk" className="text-[13px] font-semibold text-[var(--a-ikincil)]">
          İşleme kuyruğu
        </h2>
        <p className="text-[1.35rem] font-extrabold tabular-nums">
          {g.kuyruk.toLocaleString("tr-TR")} <span className="text-[14px] font-semibold">mesaj AI çözümü bekliyor</span>
        </p>
        <p className={`text-[12.5px] ${g.kuyrukHata > 0 ? "font-semibold text-[#dc2626]" : "text-[var(--a-ikincil)]"}`}>
          {g.kuyrukHata > 0 ? `${g.kuyrukHata} mesaj 3 denemede çözülemedi` : "Kalıcı hatalı mesaj yok"}
        </p>
        {islenemeyen.length > 0 && (
          <ul className="mt-2 border-t border-[var(--a-cizgi)] pt-1">
            {islenemeyen.map((m) => (
              <li key={m.id} className="border-b border-[var(--a-cizgi)] py-2 last:border-0">
                <span className="block truncate text-[12.5px] font-semibold">
                  {m.kaynak} · {m.zaman}
                </span>
                <span className="block truncate text-[12px] text-[#3b4262]">{m.metin}</span>
                {m.hata && <span className="block truncate text-[11.5px] text-[#dc2626]">{m.hata}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section id="kalite" aria-labelledby="s-kalite">
        <div className="flex items-baseline justify-between px-1">
          <h2 id="s-kalite" className="ana-baslik">
            Grup kalitesi
          </h2>
          <Link href="/ai/gruplar" className="ana-link text-[13px]">
            Kaynak yönetimi →
          </Link>
        </div>
        <ul className="rp-kart mt-2 px-3">
          {kalite.turler.length === 0 && <li className="py-4 text-center text-[14px] text-[var(--a-ikincil)]">Kaynak yok.</li>}
          {kalite.turler.map((t) => (
            <li key={t.ad} className="flex items-center gap-3 border-b border-[var(--a-cizgi)] py-3 last:border-0">
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-bold">{t.ad}</span>
                <span className="block text-[12px] text-[var(--a-ikincil)]">
                  {t.aktif} aktif · {t.aday} aday · {t.pasif} pasif
                </span>
              </span>
              <span className="text-right">
                <span className="block text-[15px] font-extrabold tabular-nums">{t.ilan.toLocaleString("tr-TR")}</span>
                <span className="block text-[11px] text-[var(--a-ikincil)]">bulunan ilan</span>
              </span>
            </li>
          ))}
        </ul>
        {kalite.sessiz > 0 && <p className="rp-not mt-2">{kalite.sessiz} aktif kaynak 3 günden uzun süredir taranmadı.</p>}
      </section>

      <section id="ai" aria-labelledby="s-ai">
        <div className="flex items-baseline justify-between px-1">
          <h2 id="s-ai" className="ana-baslik">
            AI maliyetleri
          </h2>
          <Link href="/ayarlar" className="ana-link text-[13px]">
            Limit ayarı →
          </Link>
        </div>
        {ai ? (
          <div className="rp-kart mt-2 space-y-2 px-4 py-3.5">
            <p className="flex items-baseline justify-between">
              <span className="text-[1.35rem] font-extrabold tabular-nums">
                {ai.bugunYazi} <span className="text-[14px] font-semibold text-[var(--a-ikincil)]">/ {ai.limitYazi}</span>
              </span>
              <span className={`text-[13px] font-bold ${ai.butceKesildi || ai.killSwitch ? "text-[#dc2626]" : "text-[#4f46e5]"}`}>
                {ai.killSwitch ? "AI kapalı" : ai.butceKesildi ? "Bütçe kesildi" : `%${Math.round(aiOran * 100)}`}
              </span>
            </p>
            <span className="block h-[7px] overflow-hidden rounded-full bg-[#eceef6]">
              <span className="block h-full rounded-full bg-gradient-to-r from-[#6d74ff] to-[#4338ca]" style={{ width: `${aiOran * 100}%` }} />
            </span>
            <div className="grid grid-cols-2 gap-2 text-center">
              {[
                ["Son 7 gün", donem.yedi],
                ["Son 30 gün", donem.otuz],
              ].map(([ad, d]) => (
                <div key={ad as string} className="rounded-xl bg-[#f6f7fb] py-2">
                  <span className="block text-[11.5px] text-[var(--a-ikincil)]">{ad as string}</span>
                  <span className="block text-[15px] font-extrabold tabular-nums">{(d as { tutar: string }).tutar}</span>
                  <span className="block text-[11px] text-[var(--a-ikincil)]">{(d as { cagri: number }).cagri} çağrı</span>
                </div>
              ))}
            </div>
            <p className="text-[12.5px] text-[var(--a-ikincil)]">
              Bugün {ai.gunluk.cagri} çağrı ({ai.gunluk.basarili} başarılı) · kalan {ai.kalanYazi}
              {ai.kesilmeSayisi > 0 ? ` · ${ai.kesilmeSayisi} yanıt kesildi` : ""}
            </p>
            {ai.sonCagrilar.length > 0 && (
              <ul className="border-t border-[var(--a-cizgi)] pt-1.5">
                {ai.sonCagrilar.slice(0, 5).map((c, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 py-1 text-[12.5px]">
                    <span className="min-w-0 truncate">
                      {c.zamanYazi} · {c.kaynak}
                    </span>
                    <span className={`shrink-0 font-semibold tabular-nums ${c.basarili ? "" : "text-[#dc2626]"}`}>{c.maliyetYazi}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <p className="rp-bos mt-2">AI maliyet bilgisi okunamadı.</p>
        )}
      </section>

      <section aria-labelledby="s-ayar">
        <h2 id="s-ayar" className="ana-baslik px-1">
          Sistem ayarları
        </h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {[
            ["/ayarlar", "Tüm ayarlar"],
            ["/ai", "Yük merkezi"],
            ["/ai/gruplar", "Kaynaklar"],
            ["/ai/analiz", "Günlük analiz"],
          ].map(([h, a]) => (
            <Link key={h} href={h} className="ana-hap">
              {a}
            </Link>
          ))}
        </div>
      </section>

      <section id="kayitlar" aria-labelledby="s-kayit">
        <h2 id="s-kayit" className="ana-baslik px-1">
          Yönetim işlem kayıtları
        </h2>
        {kayitlar.length === 0 ? (
          <p className="rp-bos mt-2">Henüz kayıt yok.</p>
        ) : (
          <ul className="rp-kart mt-2 px-4">
            {kayitlar.map((k) => (
              <li key={k.id} className="flex items-center justify-between gap-3 border-b border-[var(--a-cizgi)] py-2.5 last:border-0">
                <span className="min-w-0">
                  <span className="block truncate text-[13.5px] font-semibold">{ISLEM_ADI[k.islem] ?? k.islem}</span>
                  <span className="block truncate text-[12px] text-[var(--a-ikincil)]">{[k.uyeAd, k.ayrinti].filter(Boolean).join(" · ")}</span>
                </span>
                <span className="shrink-0 text-[12px] text-[var(--a-ikincil)]">{k.zamanYazi}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </YonetimKabuk>
  );
}
