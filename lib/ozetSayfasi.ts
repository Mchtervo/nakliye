import { tlYaz } from "@/lib/para";
import type { AylikOzet } from "@/lib/excelRapor";

function kacis(metin: string): string {
  return metin
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function satir(etiket: string, deger: string, kalin = false): string {
  return `<tr${kalin ? ' class="kalin"' : ""}><td>${kacis(etiket)}</td><td class="sag">${kacis(deger)}</td></tr>`;
}

/**
 * Muhasebeciye giden özet sayfası. Tarayıcıda açılıp "Yazdır > PDF olarak kaydet"
 * ile PDF'e çevrilebilir; ek bağımlılık gerektirmez.
 */
export function ozetSayfasiUret(ozet: AylikOzet, ayAdi: string): string {
  const kategoriSatirlari = ozet.kategoriler
    .map(
      (k) =>
        `<tr><td>${kacis(k.ad)} <span class="soluk">${k.adet} kayıt</span></td><td class="sag">${kacis(
          tlYaz(k.toplam)
        )}</td><td class="sag">${kacis(tlYaz(k.kdv))}</td></tr>`
    )
    .join("");

  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<title>${kacis(ayAdi)} muhasebe özeti</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Arial, sans-serif; color: #1c1c1c; margin: 0; padding: 32px; background: #fff; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 15px; margin: 28px 0 8px; text-transform: uppercase; letter-spacing: .08em; color: #8a6a20; }
  .ust { border-bottom: 3px solid #f0a020; padding-bottom: 12px; margin-bottom: 8px; }
  .soluk { color: #777; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  td, th { padding: 7px 4px; border-bottom: 1px solid #e6e6e6; text-align: left; }
  th { font-size: 12px; text-transform: uppercase; letter-spacing: .05em; color: #666; }
  .sag { text-align: right; white-space: nowrap; }
  .kalin td { font-weight: 700; background: #fdf5e6; }
  .not { margin-top: 28px; font-size: 12px; color: #666; line-height: 1.6; border-top: 1px solid #e6e6e6; padding-top: 12px; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <div class="ust">
    <h1>${kacis(ayAdi)} muhasebe özeti</h1>
    <div class="soluk">Nakliye Defteri · ${kacis(ozet.etiket)}</div>
  </div>

  <h2>Gelir</h2>
  <table>
    ${satir("Toplam ciro (KDV dahil)", tlYaz(ozet.gelir))}
    ${satir("Net ciro (KDV hariç)", tlYaz(ozet.gelirNet))}
    ${satir("Hesaplanan KDV", tlYaz(ozet.hesaplananKdv))}
    ${satir("Yük sayısı", String(ozet.yukSayisi))}
  </table>

  <h2>Gider</h2>
  <table>
    ${satir("İşletme gideri (KDV dahil)", tlYaz(ozet.gider))}
    ${satir("İşletme gideri (net)", tlYaz(ozet.giderNet))}
    ${satir("Demirbaş alımı (gider sayılmaz)", tlYaz(ozet.demirbasToplam))}
    ${satir("Demirbaş KDV", tlYaz(ozet.demirbasKdv))}
    ${satir("İndirilecek KDV (tümü)", tlYaz(ozet.indirilecekKdv))}
    ${satir("Gider kaydı sayısı", String(ozet.giderSayisi + ozet.demirbasSayisi))}
  </table>

  <h2>Sonuç</h2>
  <table>
    ${satir("Net kâr (KDV hariç)", tlYaz(ozet.netKar), true)}
    ${satir("Ödenecek KDV", tlYaz(ozet.odenecekKdv), true)}
    ${satir("Sonraki aya devreden KDV", tlYaz(ozet.devredenKdv))}
  </table>

  ${
    ozet.kategoriler.length > 0
      ? `<h2>Gider dökümü</h2>
  <table>
    <tr><th>Tür</th><th class="sag">Toplam</th><th class="sag">KDV</th></tr>
    ${kategoriSatirlari}
  </table>`
      : ""
  }

  <div class="not">
    Fiş görselleri bu paketin <strong>fisler</strong> klasöründe, satır satır döküm
    <strong>giderler.xlsx</strong> dosyasındadır.<br>
    Bu sayfayı PDF yapmak için tarayıcıda açıp Yazdır &gt; PDF olarak kaydet deyin.
  </div>
</body>
</html>`;
}
