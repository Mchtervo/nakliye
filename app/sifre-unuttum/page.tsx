import { HareketKok } from "@/components/ana/Hareket";
import { anaYazi } from "@/components/ana/yazi";
import SifreUnuttumForm from "@/components/uyelik/SifreUnuttumForm";
import UyelikUst from "@/components/uyelik/UyelikUst";
import { smsHazirMi } from "@/lib/sms";

export default function SifreUnuttumSayfasi() {
  return (
    <div className={`ana ${anaYazi.variable}`}>
      <HareketKok>
        <div className="uy-kabuk">
          <div className="ana-ic pb-8">
            <UyelikUst geriHref="/giris?giris=1" />
            <div className="ana-gir mt-10">
              <h1 className="text-[1.75rem] font-extrabold tracking-[-0.03em]">Şifremi unuttum</h1>
              <p className="mt-1 text-[15px] text-[#4b5375]">Telefonuna gelen kodla yeni şifre belirle.</p>
            </div>
            <div className="ana-gir mt-6" style={{ animationDelay: "60ms" }}>
              <SifreUnuttumForm smsVar={smsHazirMi()} />
            </div>
          </div>
        </div>
      </HareketKok>
    </div>
  );
}
