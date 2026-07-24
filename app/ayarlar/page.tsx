import Link from "next/link";
import { cikisYap } from "@/app/auth-actions";
import SifreDegistirForm from "@/components/SifreDegistirForm";
import HizliAraForm from "@/components/HizliAraForm";
import { prisma } from "@/lib/prisma";

function bugunAy(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export const revalidate = 30;

export default async function AyarlarSayfasi() {
  const ay = bugunAy();
  const hizliAra = await prisma.ayar.findUnique({
    where: { anahtar: "hizli_ara_telefon" },
  });

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div className="reveal">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber">
          Sistem
        </p>
        <h1 className="font-display text-3xl font-extrabold text-paper">Ayarlar</h1>
      </div>

      <section className="kart space-y-3 p-4 sm:p-5 reveal reveal-d1">
        <h2 className="font-display text-lg font-bold text-paper">Hızlı ara</h2>
        <p className="text-sm text-fog">
          Ana ekrandaki Ara butonu bu numarayı açar (eş, ortak, ofis…).
        </p>
        <HizliAraForm baslangic={hizliAra?.deger || ""} />
      </section>

      <section className="kart space-y-3 p-4 sm:p-5 reveal reveal-d2">
        <h2 className="font-display text-lg font-bold text-paper">Excel döküm</h2>
        <p className="text-sm text-fog">
          Seçili ayın yük, gider ve özetini Excel olarak indir.
        </p>
        <a href={`/api/excel?ay=${ay}`} className="btn btn-teal inline-flex">
          Bu ayı Excel indir
        </a>
        <Link href="/raporlar" className="block text-sm text-fog hover:text-amber">
          Başka ay için önce Raporlar&apos;dan ay seç → sonra buraya dön
        </Link>
      </section>

      <section className="kart space-y-3 p-4 sm:p-5 reveal reveal-d3">
        <h2 className="font-display text-lg font-bold text-paper">Yedekle</h2>
        <p className="text-sm text-fog">
          Tüm veritabanı + fiş fotoğrafları tek ZIP. Güvenli bir yere kaydet
          (USB, Drive, WhatsApp Kendine Gönder).
        </p>
        <a href="/api/yedek" className="btn btn-amber inline-flex">
          Yedek ZIP indir
        </a>
      </section>

      <section className="kart-paper space-y-3 p-4 sm:p-5 reveal reveal-d4">
        <h2 className="font-display text-lg font-bold text-ink">Şifre değiştir</h2>
        <SifreDegistirForm />
      </section>

      <section className="kart space-y-3 p-4 sm:p-5 reveal reveal-d5">
        <h2 className="font-display text-lg font-bold text-paper">Oturum</h2>
        <form action={cikisYap}>
          <button type="submit" className="btn btn-ghost">
            Çıkış Yap
          </button>
        </form>
      </section>
    </div>
  );
}
