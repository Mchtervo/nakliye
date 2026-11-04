import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { HareketKok } from "@/components/ana/Hareket";
import { anaYazi } from "@/components/ana/yazi";
import UyelikUst from "@/components/uyelik/UyelikUst";
import VitrinListe from "@/components/vitrin/VitrinListe";
import { GORUNUM_COOKIE, OTURUM_COOKIE, etkinOturum } from "@/lib/auth";
import { vitrinKartlari } from "@/lib/vitrin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Güncel yük ilanları | Yük Avcısı",
  description: "Türkiye genelinde güncel nakliye yük ilanlarından bir seçki. Telefon ve WhatsApp bilgisi üyelere açık.",
};

/**
 * Herkese açık vitrin: üye olmayan birkaç ilanı görür, iletişim bilgisi göremez.
 * Giriş yapmış kullanıcı doğrudan gerçek listeye gider.
 */
export default async function IlanlarSayfasi() {
  const jar = await cookies();
  if (await etkinOturum(jar.get(OTURUM_COOKIE)?.value, jar.get(GORUNUM_COOKIE)?.value)) redirect("/ai/yukler");

  const { kartlar, canliSayi } = await vitrinKartlari().catch(() => ({ kartlar: [], canliSayi: 0 }));

  return (
    <div className={`ana ${anaYazi.variable}`}>
      <HareketKok>
        <div className="uy-kabuk">
          <div className="ana-ic space-y-4 pb-10">
            <UyelikUst geriHref="/giris" />
            <div className="pt-4">
              <h1 className="text-[1.6rem] font-extrabold leading-tight tracking-[-0.03em] text-[var(--a-murekkep)]">Güncel yük ilanları</h1>
              <p className="mt-1 text-[13.5px] text-[var(--a-ikincil)]">Telegram, WhatsApp ve ilan sitelerinden toplanır. Üyeler anlık görür.</p>
            </div>
            <VitrinListe ilanlar={kartlar} canliSayi={canliSayi} />
          </div>
        </div>
      </HareketKok>
    </div>
  );
}
