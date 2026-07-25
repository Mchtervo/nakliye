import { aiJson } from "@/lib/ai/istemci";
import { MODEL_ANALIZ } from "@/lib/ai/modeller";
import { ILAN_LISTESI_SEMASI, type IlanCikti } from "@/lib/ai/semalar";
import { ilBul } from "@/lib/iller";
import { ilanOzeti } from "@/lib/kaynaklar/web";
import { bosSonuc, type KaynakAdaptoru, type TaramaSonucu } from "@/lib/kaynaklar/tip";

const SISTEM = `Sen Türkiye'de nakliyeci için internetten yük ilanı arayan bir asistansın.
Web arama aracını kullanarak güncel yük/navlun ilanlarını bul.

Kurallar:
- Sadece bugün veya son birkaç güne ait, gerçek ve ulaşılabilir ilanları al.
- Şehirleri 81 ilden birine normalize et.
- Telefon ve ücreti ilanda yazıyorsa al, yoksa null bırak.
- Bilgi uydurma. Emin olmadığın ilanı listeye ekleme.
- En fazla 10 ilan döndür.`;

export const aiAramaAdaptoru: KaynakAdaptoru = {
  tur: "AI_ARAMA",
  async tara(kaynak): Promise<TaramaSonucu> {
    const sorgu = kaynak.hedef.trim();
    if (!sorgu) return bosSonuc("Arama sorgusu boş.");

    try {
      const cikti = await aiJson<IlanCikti>({
        model: MODEL_ANALIZ,
        sistem: SISTEM,
        metin: `Bugünün tarihi: ${new Date().toISOString().slice(0, 10)}\n\nAranacak: ${sorgu}`,
        semaAdi: "yuk_ilanlari",
        sema: ILAN_LISTESI_SEMASI,
        caba: "low",
        webArama: true,
        maxCikti: 4000,
        zamanAsimiMs: 90000,
      });

      const bulunanlar = (cikti.ilanlar || [])
        .map((i) => ({
          firmaAdi: i.firmaAdi?.trim() || null,
          telefon: i.telefon?.replace(/\D/g, "") || null,
          nereden: i.nereden?.trim() || null,
          nereye: i.nereye?.trim() || null,
          cikisIl: ilBul(i.cikisIl) || ilBul(i.nereden),
          varisIl: ilBul(i.varisIl) || ilBul(i.nereye),
          yuklemeTarihi: null,
          ucret:
            i.ucretTl && i.ucretTl > 0 ? Math.round(i.ucretTl * 100) : null,
          aracTipi: i.aracTipi?.trim() || null,
          yukTipi: i.yukTipi?.trim() || null,
          guvenSkoru: Math.max(0, Math.min(100, Math.round(i.guvenSkoru ?? 0))),
        }))
        .filter((i) => i.guvenSkoru >= 50 && i.cikisIl && i.varisIl)
        .map((ilan) => ({ ilan, hamMetin: ilanOzeti(ilan, kaynak.ad) }));

      return { bulunanlar, hata: null };
    } catch (hata) {
      return bosSonuc(
        hata instanceof Error ? hata.message : "AI araması başarısız."
      );
    }
  },
};
