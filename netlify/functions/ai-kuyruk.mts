import type { Config } from "@netlify/functions";

/**
 * Telegram gruplarından toplanan ham mesajları AI ile çözümler.
 * Okuma işinden ayrı çalışır; biri yavaşlarsa diğeri etkilenmez.
 */
export default async function handler(): Promise<Response> {
  const kok = (process.env.URL || process.env.DEPLOY_PRIME_URL || "").replace(
    /\/$/,
    ""
  );
  const anahtar = process.env.AI_CRON_SECRET;

  if (!kok || !anahtar) {
    console.warn("[ai-kuyruk] URL veya AI_CRON_SECRET eksik, atlandı.");
    return new Response("eksik yapilandirma", { status: 200 });
  }

  try {
    // Yoğun saatlerde gruplardan gelen mesaj 12'yi aşıyor; parti bu yüzden
    // geniş tutuluyor, yoksa kuyruk hiç erimiyor.
    const cevap = await fetch(`${kok}/api/ai/kuyruk?limit=22`, {
      method: "POST",
      headers: { Authorization: `Bearer ${anahtar}` },
    });
    const govde = await cevap.text();
    console.log("[ai-kuyruk]", cevap.status, govde.slice(0, 500));
  } catch (hata) {
    console.error("[ai-kuyruk]", hata);
  }

  return new Response("ok", { status: 200 });
}

export const config: Config = {
  schedule: "*/5 * * * *",
};
