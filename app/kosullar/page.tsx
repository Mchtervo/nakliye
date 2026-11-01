import { HareketKok } from "@/components/ana/Hareket";
import { anaYazi } from "@/components/ana/yazi";
import UyelikUst from "@/components/uyelik/UyelikUst";

/** Kullanım koşulları ve kişisel veriler hakkında kısa bilgi. */
export default function KosullarSayfasi() {
  return (
    <div className={`ana ${anaYazi.variable}`}>
      <HareketKok>
        <div className="uy-kabuk">
          <div className="ana-ic space-y-4 pb-10 text-[14.5px] leading-relaxed text-[#3b4262]">
            <UyelikUst geriHref="/kayit" />
            <h1 className="mt-6 text-[1.6rem] font-extrabold text-[var(--a-murekkep)]">Koşullar</h1>
            <p>
              Nakliye Defteri / Yük Avcısı; sefer, gider, kasa ve yük ilanlarını kendi defterinde tutman için bir araçtır. Gösterilen
              hesaplar senin girdiğin kayıtlara dayanır; vergi beyanı, ödeme veya hukuki işlem yerine geçmez.
            </p>
            <p>
              <b>Kaydedilen bilgiler:</b> ad soyad, telefon, şifrenin geri çevrilemez özeti, araç bilgileri ve uygulamaya girdiğin kayıtlar
              (sefer, gider, fiş fotoğrafı vb.). Kayıtların yalnız senin hesabında durur; diğer üyeler göremez.
            </p>
            <p>
              <b>Yönetici erişimi:</b> Uygulama yöneticisi, destek ve hizmetin işletilmesi amacıyla hesabını ve kayıtlarını görüntüleyebilir.
            </p>
            <p>
              <b>Yük ilanları:</b> Herkese açık kaynaklardan toplanır; doğruluğu ilan sahibine aittir. İlan sahibine sen ulaşırsın; uygulama
              senin adına mesaj göndermez.
            </p>
            <p>Hesabının silinmesini veya kayıtlarının dışa aktarılmasını yöneticiden isteyebilirsin.</p>
          </div>
        </div>
      </HareketKok>
    </div>
  );
}
