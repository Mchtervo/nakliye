import type { Config } from "@netlify/functions";

function aiKapaliMi(): boolean {
  const v = (process.env.AI_KAPALI || "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "evet" || v === "yes";
}

/** Her sabah (TR 08:00) işletme analizini üretir ve bildirir. */
export default async function handler(): Promise<Response> {
  if (aiKapaliMi()) {
    console.log("[ai-analiz] AI_KAPALI=true — atlandı.");
    return new Response("ai kapali", { status: 200 });
  }

  const kok = (process.env.URL || process.env.DEPLOY_PRIME_URL || "").replace(
    /\/$/,
    ""
  );
  const anahtar = process.env.AI_CRON_SECRET;

  if (!kok || !anahtar) {
    console.warn("[ai-analiz] URL veya AI_CRON_SECRET eksik, atlandı.");
    return new Response("eksik yapilandirma", { status: 200 });
  }

  try {
    const cevap = await fetch(`${kok}/api/ai/gunluk-analiz`, {
      method: "POST",
      headers: { Authorization: `Bearer ${anahtar}` },
    });
    const govde = await cevap.text();
    console.log("[ai-analiz]", cevap.status, govde.slice(0, 500));
  } catch (hata) {
    console.error("[ai-analiz]", hata);
  }

  return new Response("ok", { status: 200 });
}

export const config: Config = {
  schedule: "0 5 * * *",
};
