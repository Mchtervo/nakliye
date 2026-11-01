import Link from "next/link";
import type { ReactNode } from "react";
import YonetimKabuk from "@/components/yonetim/YonetimKabuk";
import { aiMaliyetOzeti } from "@/lib/ai/maliyetOzeti";
import { yoneticiSayfasi } from "@/lib/yetki";
import { genelDurum, kaynakDurumlari } from "@/lib/yonetimVeri";

export const dynamic = "force-dynamic";

function Ok() {
  return (
    <span className="shrink-0 text-[20px] leading-none text-[var(--a-ikincil)]" aria-hidden>
      ›
    </span>
  );
}

function Satir({ href, ikon, ton, ad, alt, sag }: { href: string; ikon: ReactNode; ton: string; ad: string; alt: string; sag?: ReactNode }) {
  return (
    <li className="border-b border-[var(--a-cizgi)] last:border-0">
      <Link href={href} className="rp-satir">
        <span className={`ana-mini-ikon rp-ikon ${ton}`} aria-hidden>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {ikon}
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-bold">{ad}</span>
          <span className="block truncate text-[12px] text-[var(--a-ikincil)]">{alt}</span>
        </span>
        {sag}
        <Ok />
      </Link>
    </li>
  );
}

/** Mobil yönetim — genel durum ve bekleyen işler (üyelerin finansı burada yok). */
export default async function YonetimGenel() {
  await yoneticiSayfasi();
  const [g, kaynaklar, ai] = await Promise.all([genelDurum(), kaynakDurumlari(), aiMaliyetOzeti().catch(() => null)]);
  const aiOran = ai && ai.limitUsd > 0 ? Math.min(1, ai.bugunMikro / 1_000_000 / ai.limitUsd) : 0;
  const sorunluKaynak = kaynaklar.filter((k) => k.durum === "SORUNLU").length;

  return (
    <YonetimKabuk sekme="genel" baslik="Kaynak ve sistem" alt="Sistem durumunu izle" rozet={{ ilanlar: g.sikayet, sistem: sorunluKaynak }}>
      <section className="grid grid-cols-2 gap-2.5" aria-label="Özet">
        {[
          { ad: "Aktif üye", deger: g.uyeAktif, alt: `${g.uyeToplam} hesap`, href: "/yonetim/uyeler" },
          { ad: "Son 24 saatte ilan", deger: g.ilan24, alt: "Ortak yük listesi", href: "/ai/yukler" },
          { ad: "Aktif kaynak", deger: g.kaynakAktif, alt: `${g.kaynakAday} aday`, href: "/ai/gruplar" },
          { ad: "Açık şikâyet", deger: g.sikayet, alt: "İlan bildirimleri", href: "/yonetim/ilanlar" },
        ].map((s) => (
          <Link key={s.ad} href={s.href} className="yn-sayac">
            <span className="text-[12.5px] font-semibold text-[var(--a-ikincil)]">{s.ad}</span>
            <span className={`text-[1.6rem] font-extrabold tabular-nums ${s.ad === "Açık şikâyet" && s.deger > 0 ? "text-[#dc2626]" : ""}`}>{s.deger.toLocaleString("tr-TR")}</span>
            <span className="text-[11.5px] text-[var(--a-ikincil)]">{s.alt}</span>
          </Link>
        ))}
      </section>

      <section aria-labelledby="kaynak-durumu">
        <h2 id="kaynak-durumu" className="ana-baslik px-1">
          Kaynak durumu
        </h2>
        <ul className="rp-kart mt-2 px-3">
          {kaynaklar.map((k) => (
            <li key={k.ad} className="flex items-center gap-3 border-b border-[var(--a-cizgi)] py-3 last:border-0">
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-bold">{k.ad}</span>
                <span className="block truncate text-[12px] text-[var(--a-ikincil)]">{k.ayrinti}</span>
              </span>
              <span className={`yn-durum ${k.durum === "CALISIYOR" ? "yn-durum-iyi" : k.durum === "SORUNLU" ? "yn-durum-kotu" : "yn-durum-belirsiz"}`}>
                {k.durum === "CALISIYOR" ? "Çalışıyor" : k.durum === "SORUNLU" ? "Sorunlu" : "Bilinmiyor"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid grid-cols-1 gap-2.5" aria-label="Kuyruk ve AI">
        <Link href="/yonetim/sistem" className="rp-kart flex items-center gap-3 px-4 py-3.5">
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-semibold text-[var(--a-ikincil)]">İşleme kuyruğu</span>
            <span className="block text-[1.25rem] font-extrabold tabular-nums">
              {g.kuyruk.toLocaleString("tr-TR")} <span className="text-[14px] font-semibold">mesaj bekliyor</span>
            </span>
            {g.kuyrukHata > 0 && <span className="block text-[12px] font-semibold text-[#dc2626]">{g.kuyrukHata} mesaj 3 denemede çözülemedi</span>}
          </span>
          <Ok />
        </Link>
        {ai && (
          <Link href="/yonetim/sistem#ai" className="rp-kart block px-4 py-3.5">
            <span className="flex items-baseline justify-between gap-2">
              <span className="text-[13px] font-semibold text-[var(--a-ikincil)]">AI kullanımı · bugün</span>
              <span className={`text-[12.5px] font-bold ${ai.butceKesildi || ai.killSwitch ? "text-[#dc2626]" : "text-[#4f46e5]"}`}>
                {ai.killSwitch ? "AI kapalı" : ai.butceKesildi ? "Bütçe kesildi" : `%${Math.round(aiOran * 100)}`}
              </span>
            </span>
            <span className="mt-0.5 block text-[1.25rem] font-extrabold tabular-nums">
              {ai.bugunYazi} <span className="text-[14px] font-semibold text-[var(--a-ikincil)]">/ {ai.limitYazi}</span>
            </span>
            <span className="mt-2 block h-[7px] overflow-hidden rounded-full bg-[#eceef6]">
              <span className="block h-full rounded-full bg-gradient-to-r from-[#6d74ff] to-[#4338ca]" style={{ width: `${aiOran * 100}%` }} />
            </span>
          </Link>
        )}
      </section>

      {(g.kurulumBekleyen > 0 || g.kaynakAday > 0 || g.sikayet > 0 || g.kuyrukHata > 0) && (
        <section aria-labelledby="bekleyen-isler">
          <h2 id="bekleyen-isler" className="ana-baslik px-1">
            Bekleyen işler
          </h2>
          <ul className="rp-kart mt-2 px-3">
            {g.sikayet > 0 && <Satir href="/yonetim/ilanlar" ton="ana-ton-kirmizi" ikon={<path d="M12 3l9 16H3zM12 10v4M12 17h.01" />} ad={`${g.sikayet} açık şikâyet`} alt="İlanı kaldır ya da yok say" />}
            {g.kurulumBekleyen > 0 && <Satir href="/yonetim/uyeler?durum=kurulum" ton="ana-ton-turuncu" ikon={<path d="M2.5 7h11v9h-11zM13.5 10h4l3 3.2V16h-7z" />} ad={`${g.kurulumBekleyen} üye kurulumu bitirmedi`} alt="Araç bilgileri eksik" />}
            {g.kaynakAday > 0 && <Satir href="/ai/gruplar" ton="ana-ton-indigo" ikon={<path d="M12 5v14M5 12h14" />} ad={`${g.kaynakAday} aday kaynak`} alt="Katılmayı / takibi bekliyor" />}
            {g.kuyrukHata > 0 && <Satir href="/yonetim/sistem" ton="ana-ton-kirmizi" ikon={<path d="M12 8v5M12 16h.01M4 12a8 8 0 1 0 16 0 8 8 0 0 0-16 0" />} ad="Çözülemeyen mesajlar" alt={`${g.kuyrukHata} mesaj`} />}
          </ul>
        </section>
      )}

      <section aria-labelledby="yonetim-menusu">
        <h2 id="yonetim-menusu" className="ana-baslik px-1">
          Yönetim menüsü
        </h2>
        <ul className="rp-kart mt-2 px-3">
          <Satir href="/ai" ton="ana-ton-indigo" ikon={<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12L4 7.5" />} ad="Yük merkezi" alt="Toplanan ilanlar ve tarama" />
          <Satir href="/ai/gruplar" ton="ana-ton-indigo" ikon={<path d="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3 20c.7-3.3 3-5 6-5s5.3 1.7 6 5" />} ad="Kaynak yönetimi" alt="Telegram, WhatsApp ve web" />
          <Satir href="/yonetim/sistem#kalite" ton="ana-ton-yesil" ikon={<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" />} ad="Grup kalitesi" alt="Kaynak türleri ve sessiz gruplar" />
          <Satir href="/yonetim/sistem#ai" ton="ana-ton-turuncu" ikon={<path d="M8 8h8v8H8zM4 10h2M4 14h2M18 10h2M18 14h2M10 4v2M14 4v2M10 18v2M14 18v2" />} ad="AI maliyetleri" alt="Kullanım ve günlük limit" />
          <Satir href="/ayarlar" ton="ana-ton-gri" ikon={<path d="M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 3v3M12 18v3M3 12h3M18 12h3" />} ad="Sistem ayarları" alt="Koridor, AI, bildirim, yedek" />
          <Satir href="/yonetim/sistem#kayitlar" ton="ana-ton-gri" ikon={<path d="M5 6h14M5 12h14M5 18h9" />} ad="İşlem kayıtları" alt="Yönetici işlemleri" />
        </ul>
        <Link href="/" className="rp-genis-dugme mt-3">
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-extrabold text-[#3730a3]">Kendi defterim</span>
            <span className="block text-[12px] text-[var(--a-ikincil)]">Yalnız senin işletme kayıtların</span>
          </span>
          <Ok />
        </Link>
      </section>
    </YonetimKabuk>
  );
}
