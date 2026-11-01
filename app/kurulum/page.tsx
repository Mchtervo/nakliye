import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { HareketKok } from "@/components/ana/Hareket";
import { anaYazi } from "@/components/ana/yazi";
import { AracAdimi, DogrulamaAdimi, KonumAdimi, SinifAdimi } from "@/components/uyelik/KurulumAdimlari";
import UyelikUst from "@/components/uyelik/UyelikUst";
import { DonemGecis } from "@/components/finans/RaporGrafik";
import type { KurulumTaslak } from "@/app/kurulum-actions";
import { aktifBaglam } from "@/lib/baglam";
import { anaPrisma } from "@/lib/prismaAna";
import { ILLER } from "@/lib/iller";
import { aracEtiketi } from "@/lib/aracTip";
import { smsHazirMi } from "@/lib/sms";
import { telefonMaskeli } from "@/lib/uyelik";

export const dynamic = "force-dynamic";

function Ust({ adim, geri, baslik, alt, gorsel, children }: { adim?: number; geri?: string; baslik: ReactNode; alt?: string; gorsel?: string; children?: ReactNode }) {
  return (
    <header className="ana-ust uy-kurulum-ust">
      <div className="ana-ust-zemin" aria-hidden />
      <div className="ana-ic relative">
        <UyelikUst koyu geriHref={geri} adim={adim ? { no: adim, toplam: 3 } : undefined} />
        <div className="relative mt-6">
          <div className={`ana-gir relative z-10 ${gorsel ? "max-w-[56%]" : ""}`}>
            <h1 className="text-[1.85rem] font-extrabold leading-[1.08] tracking-[-0.03em] text-white">{baslik}</h1>
            {alt && <p className="mt-1.5 text-[14px] text-[#c7cffd]">{alt}</p>}
            {children}
          </div>
          {gorsel && <Image src={gorsel} alt="" width={640} height={370} className="uy-kurulum-gorsel" priority />}
        </div>
      </div>
    </header>
  );
}

/**
 * İlk kurulum: telefon doğrulama (SMS varsa) → araç tipi → şehirler →
 * kasa ve taşıma bilgileri → Hazırsın. Her adım kaydedilir; yarım kalırsa
 * girişte buradan devam edilir.
 */
export default async function KurulumSayfasi({ searchParams }: { searchParams: Promise<{ adim?: string }> }) {
  const b = await aktifBaglam();
  if (b.uyeId === null) redirect("/");
  const u = await anaPrisma.uye.findUnique({ where: { id: b.uyeId } });
  if (!u) redirect("/oturum-kapandi");
  const t = (u.kurulumTaslak ?? {}) as KurulumTaslak;

  const sp = await searchParams;
  const enCok = u.kurulumBitti ? 4 : Math.min(u.kurulumAdim + 1, 3);
  let adim = sp.adim ? Math.min(Math.max(0, Number(sp.adim) || 0), enCok) : u.kurulumBitti ? -1 : enCok;
  if (adim === -1) redirect("/");
  const smsVar = smsHazirMi();
  // Doğrulama yalnız SMS gerçekten gönderilebiliyorsa ve henüz yapılmadıysa
  if (adim === 1 && !sp.adim && u.kurulumAdim === 0 && smsVar && !u.telefonDogrulandi && u.telefon) adim = 0;
  if (adim === 0 && (!smsVar || u.telefonDogrulandi)) adim = 1;

  let icerik: ReactNode;
  if (adim === 0) {
    icerik = (
      <>
        <Ust baslik="Telefonunu doğrula" alt="Hesabını korumak için" />
        <DonemGecis className="ana-ic relative z-10 -mt-6 pb-8">
          <DogrulamaAdimi telefonMaskeli={u.telefon ? telefonMaskeli(u.telefon) : ""} />
        </DonemGecis>
      </>
    );
  } else if (adim === 1) {
    icerik = (
      <>
        <Ust adim={1} baslik={<>Yol arkadaşın<br />hangisi?</>} alt="Araç tipini seç." />
        <DonemGecis className="ana-ic relative z-10 -mt-6 space-y-3 pb-8">
          {!smsVar && !u.telefonDogrulandi && (
            <p className="rp-not">
              <span aria-hidden>ⓘ</span>
              <span>SMS hizmeti henüz kurulu olmadığı için telefonun doğrulanmadı; hesabın yine de açıldı.</span>
            </p>
          )}
          <SinifAdimi secili={t.sinif} />
        </DonemGecis>
      </>
    );
  } else if (adim === 2) {
    icerik = (
      <>
        <Ust adim={2} geri="/kurulum?adim=1" baslik={<>Nereden<br />yola çıkıyorsun?</>} gorsel="/ana/arac/konum-pin.webp" />
        <DonemGecis className="ana-ic relative z-10 -mt-6 pb-8">
          <KonumAdimi iller={[...ILLER]} anaUs={t.anaUs} konumIl={t.konumIl} />
        </DonemGecis>
      </>
    );
  } else if (adim === 3) {
    icerik = (
      <>
        <Ust adim={3} geri="/kurulum?adim=2" baslik={<>Aracını<br />tanıyalım</>} alt="Kasa tipini ve taşıma bilgilerini ekle." gorsel="/ana/arac/kurulum.webp">
          {t.sinif && <span className="uy-cip mt-3">{aracEtiketi({ ad: "", sinif: t.sinif })}</span>}
        </Ust>
        <DonemGecis className="ana-ic relative z-10 -mt-6 pb-8">
          <AracAdimi taslak={t} />
        </DonemGecis>
      </>
    );
  } else {
    icerik = (
      <>
        <Ust baslik="Hazırsın!" alt="Defterin ve yük aramaların aracına göre ayarlandı." gorsel="/ana/arac/kurulum.webp" />
        <DonemGecis className="ana-ic relative z-10 -mt-6 space-y-4 pb-8">
          <div className="rp-kart space-y-1 px-4 py-4">
            <p className="text-[13px] font-semibold text-[var(--a-ikincil)]">Aracın</p>
            <p className="text-[18px] font-extrabold">{aracEtiketi({ ad: "Araç", sinif: t.sinif, kasaTipi: t.kasaTipi })}</p>
            <p className="text-[13.5px] text-[#3b4262]">
              {[t.kapasiteTon ? `${String(t.kapasiteTon).replace(".", ",")} ton` : null, t.plaka, t.konumIl ? `Şu an ${t.konumIl}` : null].filter(Boolean).join(" · ") || "Taşıma bilgilerini sonra ekleyebilirsin."}
            </p>
          </div>
          <Link href="/ai/yukler" className="uy-devam">
            <span className="flex-1 text-center">Yükleri gör</span>
            <span className="uy-devam-ok" aria-hidden>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </span>
          </Link>
          <Link href="/" className="kk-cerceve-dugme w-full">
            Ana sayfaya geç
          </Link>
        </DonemGecis>
      </>
    );
  }

  return (
    <div className={`ana ${anaYazi.variable}`}>
      <HareketKok>
        <div key={adim}>{icerik}</div>
      </HareketKok>
    </div>
  );
}
