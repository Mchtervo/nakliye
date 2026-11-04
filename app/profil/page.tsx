import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { cikisYap } from "@/app/auth-actions";
import { HareketKok } from "@/components/ana/Hareket";
import { anaYazi } from "@/components/ana/yazi";
import RaporUst from "@/components/finans/RaporUst";
import KisiselTercih from "@/components/uye/KisiselTercih";
import ProfilFotografi from "@/components/uye/ProfilFotografi";
import { ProfilForm, SifreForm } from "@/components/uye/ProfilForm";
import TumCihazlar from "@/components/uyelik/TumCihazlar";
import { aktifArac } from "@/lib/aktifArac";
import { aracEtiketi } from "@/lib/aracTip";
import { aiTercihleriOku } from "@/lib/ayarlar";
import { aktifBaglam } from "@/lib/baglam";
import { ILLER } from "@/lib/iller";
import { aracKonumu } from "@/lib/konum";
import { prisma } from "@/lib/prisma";
import { telefonGoster } from "@/lib/telefon";
import { uyeDurumu } from "@/lib/uyeProfil";

export const dynamic = "force-dynamic";

function Bolum({ baslik, children }: { baslik: string; children: ReactNode }) {
  return (
    <section className="ana-gir space-y-2">
      <h2 className="ana-baslik px-1">{baslik}</h2>
      {children}
    </section>
  );
}

function Ok() {
  return (
    <span className="text-[20px] text-[var(--a-ikincil)]" aria-hidden>
      ›
    </span>
  );
}

/** Üyenin kişisel ayarları: tercihler, araç, hesap bilgileri, güvenlik. */
export default async function ProfilSayfasi() {
  const b = await aktifBaglam();
  // Yöneticinin ayarları Ayarlar sayfasındadır
  if (b.uyeId === null) redirect("/ayarlar");
  const d = await uyeDurumu(b.uyeId);
  if (!d) redirect("/giris");
  const [tercih, konum, arac, muhasebeci] = await Promise.all([
    aiTercihleriOku(),
    aracKonumu().catch(() => null),
    aktifArac().catch(() => null),
    prisma.ayar.findUnique({ where: { anahtar: "muhasebeci_telefon" } }),
  ]);

  return (
    <div className={`ana ${anaYazi.variable}`}>
      <HareketKok>
        <RaporUst gorsel={{ src: "/ana/kisi.webp", genislik: 110 }}>
          <div className="max-w-[66%]">
            <h1 className="text-[1.6rem] font-extrabold leading-tight tracking-[-0.03em] text-white">Kişisel ayarlar</h1>
            <p className="mt-0.5 text-[13.5px] text-[#c7cffd]">{d.ad || d.kullaniciAdi} · tercihlerini düzenle</p>
          </div>
        </RaporUst>

        <div className="ana-ic relative z-10 -mt-10 space-y-6 pb-8">
          {d.eksikler.length > 0 && (
            <p className="rounded-[1.2rem] bg-[#fff4e6] px-4 py-3 text-[13.5px] text-[#9a3412]">
              <b>Eksik:</b> {d.eksikler.join(", ")}
            </p>
          )}

          <Bolum baslik="Profil fotoğrafı">
            <ProfilFotografi fotograf={d.fotograf} ad={d.ad || d.kullaniciAdi} />
          </Bolum>

          <Bolum baslik="Temel bilgiler">
            <KisiselTercih iller={[...ILLER]} anaUs={tercih.anaUs ?? d.sehir ?? ""} konumIl={konum ?? ""} push={tercih.pushAcik} />
          </Bolum>

          <Bolum baslik="Aracın">
            <Link href="/arac" className="rp-genis-dugme">
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-extrabold text-[#3730a3]">{arac ? aracEtiketi(arac) : "Araç ekle"}</span>
                <span className="block text-[12.5px] text-[var(--a-ikincil)]">
                  {arac
                    ? [arac.plaka, arac.kapasiteTon ? `${String(arac.kapasiteTon).replace(".", ",")} ton` : "Tonaj girilmedi"].filter(Boolean).join(" · ")
                    : "Kasa, tonaj, km ve belgeler"}
                </span>
              </span>
              <Ok />
            </Link>
          </Bolum>

          <Bolum baslik="Hesap ve destek">
            <ProfilForm b={{ aracTipi: "", kasaTipi: "", plaka: "", ad: d.ad ?? "", telefon: d.telefon ? telefonGoster(d.telefon) : "", sehir: d.sehir ?? "" }} />
            <Link href="/muhasebeci" className="rp-genis-dugme">
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-extrabold text-[#3730a3]">Muhasebeci telefonu</span>
                <span className="block text-[12.5px] text-[var(--a-ikincil)]">{muhasebeci?.deger ? telefonGoster(muhasebeci.deger) : "Muhasebeciye gönder sayfasından kaydet"}</span>
              </span>
              <Ok />
            </Link>
          </Bolum>

          {!b.yoneticiGoruyor && (
            <Bolum baslik="Şifre ve oturum">
              <div className="rp-kart space-y-4 p-4">
                <SifreForm />
                <TumCihazlar />
              </div>
              <form action={cikisYap}>
                <button type="submit" className="sf-ikincil-dugme w-full !min-h-11 !text-[#dc2626]">
                  Çıkış yap
                </button>
              </form>
            </Bolum>
          )}
        </div>
      </HareketKok>
    </div>
  );
}
