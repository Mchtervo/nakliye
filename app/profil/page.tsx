import Image from "next/image";
import { redirect } from "next/navigation";
import { cikisYap } from "@/app/auth-actions";
import { HareketKok } from "@/components/ana/Hareket";
import { anaYazi } from "@/components/ana/yazi";
import { ProfilForm, SifreForm } from "@/components/uye/ProfilForm";
import { aktifBaglam } from "@/lib/baglam";
import { uyeDurumu } from "@/lib/uyeProfil";

export const dynamic = "force-dynamic";

export default async function ProfilSayfasi({ searchParams }: { searchParams: Promise<{ ilk?: string }> }) {
  const b = await aktifBaglam();
  // Yöneticinin profili Ayarlar'dadır
  if (b.uyeId === null) redirect("/ayarlar");
  const d = await uyeDurumu(b.uyeId);
  if (!d) redirect("/giris");
  const ilk = (await searchParams).ilk === "1" && !d.arac?.plaka;
  const [aracTipi = "", kasaTipi = ""] = (d.arac?.ad ?? "").split(" · ");

  return (
    <div className={`ana ${anaYazi.variable}`}>
      <HareketKok>
        <header className="ana-ust ks-ust">
          <div className="ana-ust-zemin" aria-hidden />
          <div className="ana-ic relative">
            <div className="ana-gir flex items-center gap-2 pt-3">
              <Image src="/ana/logo-2.png" alt="" width={40} height={36} className="h-9 w-10 shrink-0" />
              <div className="min-w-0 leading-tight">
                <p className="truncate text-[16px] font-extrabold tracking-[-0.02em] text-white">Nakliye Defteri</p>
                <p className="text-[12px] font-semibold text-[#9fb0ff]">Yük Avcısı</p>
              </div>
            </div>
            <div className="ana-gir mt-4" style={{ animationDelay: "40ms" }}>
              <h1 className="text-[1.75rem] font-extrabold leading-tight tracking-[-0.03em] text-white">{ilk ? "Hoş geldin!" : "Profilim"}</h1>
              <p className="mt-1 text-[14px] text-[#c7cffd]">{ilk ? "Önce aracını ekle; sonra yükleri ve defterini kullanmaya başla." : `@${d.kullaniciAdi}`}</p>
            </div>
          </div>
        </header>

        <div className="ana-ic relative z-10 -mt-8 space-y-4 pb-6">
          {d.eksikler.length > 0 && (
            <p className="ana-gir rounded-[1.2rem] bg-[#fff4e6] px-4 py-3 text-[13.5px] text-[#9a3412]">
              <b>Eksik:</b> {d.eksikler.join(", ")}
            </p>
          )}
          <ProfilForm
            b={{
              aracTipi,
              kasaTipi,
              plaka: d.arac?.plaka ?? "",
              ad: d.ad ?? "",
              telefon: d.telefon ?? "",
              sehir: d.sehir ?? "",
            }}
          />
          {!b.yoneticiGoruyor && (
            <section className="rounded-[1.5rem] bg-white p-4 shadow-[var(--a-golge)]" aria-labelledby="profil-sifre">
              <h2 id="profil-sifre" className="ana-baslik mb-3">
                Şifre
              </h2>
              <SifreForm />
            </section>
          )}
          {!b.yoneticiGoruyor && (
            <form action={cikisYap}>
              <button type="submit" className="sf-ikincil-dugme w-full !min-h-11 !text-[#dc2626]">
                Çıkış yap
              </button>
            </form>
          )}
        </div>
      </HareketKok>
    </div>
  );
}
