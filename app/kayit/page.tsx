import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { HareketKok } from "@/components/ana/Hareket";
import { anaYazi } from "@/components/ana/yazi";
import KayitForm from "@/components/uyelik/KayitForm";
import UyelikUst from "@/components/uyelik/UyelikUst";
import { OTURUM_COOKIE, oturumCoz } from "@/lib/auth";
import { smsHazirMi } from "@/lib/sms";

export default async function KayitSayfasi() {
  // Oturumu açık olan kayıt ekranını görmez
  if (await oturumCoz((await cookies()).get(OTURUM_COOKIE)?.value)) redirect("/");
  return (
    <div className={`ana ${anaYazi.variable}`}>
      <HareketKok>
        <div className="uy-kabuk">
          <div className="ana-ic pb-8">
            <UyelikUst geriHref="/giris" />
            <div className="ana-gir mt-10" style={{ animationDelay: "40ms" }}>
              <h1 className="text-[1.75rem] font-extrabold tracking-[-0.03em]">Seni tanıyalım</h1>
              <p className="mt-1 text-[15px] text-[#4b5375]">Birkaç adım sonra yola hazırsın.</p>
            </div>
            <div className="ana-gir mt-6" style={{ animationDelay: "90ms" }}>
              <KayitForm smsVar={smsHazirMi()} />
            </div>
          </div>
        </div>
      </HareketKok>
    </div>
  );
}
