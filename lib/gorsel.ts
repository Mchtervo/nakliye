/**
 * Tarayıcıda çalışır: telefon kamerasından gelen büyük fotoğrafı
 * OCR'a göndermeden önce küçültür (hız ve maliyet için).
 */
export async function gorseliKucult(
  dosya: File,
  maxKenar = 1600,
  kalite = 0.82
): Promise<Blob> {
  if (typeof createImageBitmap !== "function") return dosya;

  try {
    const bitmap = await createImageBitmap(dosya);
    const oran = Math.min(1, maxKenar / Math.max(bitmap.width, bitmap.height));
    const genislik = Math.round(bitmap.width * oran);
    const yukseklik = Math.round(bitmap.height * oran);

    const tuval = document.createElement("canvas");
    tuval.width = genislik;
    tuval.height = yukseklik;
    const ctx = tuval.getContext("2d");
    if (!ctx) return dosya;
    ctx.drawImage(bitmap, 0, 0, genislik, yukseklik);
    bitmap.close();

    const blob = await new Promise<Blob | null>((coz) =>
      tuval.toBlob(coz, "image/jpeg", kalite)
    );
    return blob ?? dosya;
  } catch {
    return dosya;
  }
}
