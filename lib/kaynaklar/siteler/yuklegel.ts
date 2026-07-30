/**
 * yuklegel.com — SiteTarayici sarmalayıcı.
 * Asıl parse/seçiciler: lib/kaynaklar/yuklegel.ts + yuklegelSeciciler.ts
 */
import { yuklegelTara } from "@/lib/kaynaklar/yuklegel";
import type { SiteTarayici } from "@/lib/kaynaklar/siteler/tip";

export const yuklegelSite: SiteTarayici = {
  slug: "yuklegel",
  ad: "yuklegel.com",
  hedef: "https://yuklegel.com/",
  aciklama: "Ücretsiz ilanlardan firma + numara (Firecrawl).",
  varsayilanAktif: true,
  async tara() {
    const r = await yuklegelTara();
    return {
      kayit: r.kayit,
      hatalar: r.hatalar,
      sayfa: r.sayfa,
      kart: r.kart,
      yeniFirma: r.yeniFirma,
      guncellenenFirma: r.guncellenenFirma,
      kotaAtlandi: r.kotaAtlandi,
      aylikSayfa: r.aylikSayfa,
      aiFallback: r.aiFallback,
      aiAtlandi: r.aiAtlandi,
    };
  },
};
