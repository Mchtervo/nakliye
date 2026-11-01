/**
 * SMS gönderimi. Şu an gerçek sağlayıcı bağlı DEĞİL: kod üretilmez,
 * ekranda "SMS hizmeti kurulu değil" yazılır, telefon doğrulanmış sayılmaz.
 *
 * Sağlayıcı eklemek: SMS_SAGLAYICI=<ad> ve kimlik bilgileri .env'e, aşağıdaki
 * `gonder` içine ilgili API çağrısı. "test" yalnız yerel geliştirmede çalışır
 * (kodu sunucu günlüğüne yazar; gerçek mesaj gitmez).
 */
export type SmsSonuc = { gonderildi: true } | { gonderildi: false; neden: string };

function saglayici(): string | null {
  const s = process.env.SMS_SAGLAYICI?.trim().toLowerCase();
  if (!s) return null;
  if (s === "test") return process.env.NODE_ENV === "production" ? null : "test";
  return null; // bilinmeyen sağlayıcı: kurulu sayılmaz
}

export function smsHazirMi(): boolean {
  return saglayici() !== null;
}

/** Yerel testler için son gönderilen mesajlar (yalnız "test" sağlayıcısı). */
export const testGelenKutusu: { telefon: string; metin: string }[] = [];

export async function smsGonder(telefon: string, metin: string): Promise<SmsSonuc> {
  const s = saglayici();
  if (!s) return { gonderildi: false, neden: "SMS hizmeti henüz kurulu değil." };
  if (s === "test") {
    testGelenKutusu.push({ telefon, metin });
    console.log(`[sms:test] ${telefon}: ${metin}`);
    return { gonderildi: true };
  }
  return { gonderildi: false, neden: "SMS hizmeti henüz kurulu değil." };
}
