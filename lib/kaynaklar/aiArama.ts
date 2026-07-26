import { aiJson } from "@/lib/ai/istemci";
import { MODEL_ANALIZ } from "@/lib/ai/modeller";
import { ILAN_LISTESI_SEMASI, type IlanCikti } from "@/lib/ai/semalar";
import { aracKoduBul } from "@/lib/arac";
import { ilBul } from "@/lib/iller";
import { ilanOzeti } from "@/lib/kaynaklar/web";
import { bosSonuc, type KaynakAdaptoru, type TaramaSonucu } from "@/lib/kaynaklar/tip";

const SISTEM = `Sen Türkiye'de nakliyeci için internetten yük ilanı arayan bir asistansın.
Web arama aracını kullanarak güncel yük/navlun ilanlarını bul.

Kurallar:
- Sadece bugün veya son birkaç güne ait, gerçek ve ulaşılabilir ilanları al.
- Yer adlarını ilanda yazdığı gibi ver; olmayan şehir uydurma.
- Ham ilanda AÇIKÇA geçmeyen yer adı yazma; emin değilsen null.
- Telefon ve ücreti ilanda yazıyorsa al, yoksa null bırak.
- Fiyat ton başı mı komple mi ayırt et (ucretTuru).
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
        maxCikti: 1500,
        zamanAsimiMs: 90000,
        kaynak: "aiArama",
      });

      // Web aramada orijinal ilan metni yok; yer doğrulaması Telegram
      // yolundaki kadar sert yapılamaz. İl eşlemesi yine sunucuda.
      const bulunanlar = (cikti.ilanlar || [])
        .map((i) => {
          const nereden = i.nereden?.trim() || null;
          const nereye = i.nereye?.trim() || null;
          return {
            firmaAdi: i.firmaAdi?.trim() || null,
            ilgiliKisi: i.ilgiliKisi?.trim() || null,
            telefon: i.telefon?.replace(/\D/g, "") || null,
            nereden,
            nereye,
            cikisIl: ilBul(nereden),
            varisIl: ilBul(nereye),
            yuklemeTarihi: null,
            ucret:
              i.ucretTuru !== "TON_BASI" && i.ucretTl && i.ucretTl > 0
                ? Math.round(i.ucretTl * 100)
                : null,
            fiyatTon:
              i.ucretTuru === "TON_BASI" && i.ucretTl && i.ucretTl > 0
                ? Math.round(i.ucretTl * 100)
                : null,
            fiyatBelirsiz: i.ucretTuru === "BELIRSIZ" && Boolean(i.ucretTl),
            tonaj:
              i.tonaj && i.tonaj >= 1 && i.tonaj <= 50
                ? Math.round(i.tonaj)
                : null,
            aracTipi: i.aracTipi?.trim() || null,
            aracTipiKod: aracKoduBul(i.aracTipi),
            yukTipi: i.yukTipi?.trim() || null,
            guvenSkoru: Math.max(
              0,
              Math.min(100, Math.round(i.guvenSkoru ?? 0))
            ),
          };
        })
        .filter(
          (i) =>
            i.guvenSkoru >= 15 && Boolean(i.cikisIl || i.varisIl || i.nereden)
        )
        .map((ilan) => ({ ilan, hamMetin: ilanOzeti(ilan, kaynak.ad) }));

      return { bulunanlar, hata: null };
    } catch (hata) {
      return bosSonuc(
        hata instanceof Error ? hata.message : "AI araması başarısız."
      );
    }
  },
};
