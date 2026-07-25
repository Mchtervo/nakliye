import type { Config } from "@netlify/functions";

/**
 * Yük kaynaklarını periyodik tarar.
 * Netlify fonksiyon süresi kısıtlı olduğu için her koşuda az sayıda
 * kaynak işlenir; sıralama en eski taramaya göre döner.
 */
function aiKapaliMi(): boolean {
  const v = (process.env.AI_KAPALI || "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "evet" || v === "yes";
}

export default async function handler(): Promise<Response> {
  if (aiKapaliMi()) {
    console.log("[ai-tarama] AI_KAPALI=true — atlandı.");
    return new Response("ai kapali", { status: 200 });
  }

  const kok = (process.env.URL || process.env.DEPLOY_PRIME_URL || "").replace(
    /\/$/,
    ""
  );
  const anahtar = process.env.AI_CRON_SECRET;

  if (!kok || !anahtar) {
    console.warn("[ai-tarama] URL veya AI_CRON_SECRET eksik, atlandı.");
    return new Response("eksik yapilandirma", { status: 200 });
  }

  try {
    const cevap = await fetch(`${kok}/api/ai/tara?limit=3`, {
      method: "POST",
      headers: { Authorization: `Bearer ${anahtar}` },
    });
    const govde = await cevap.text();
    console.log("[ai-tarama]", cevap.status, govde.slice(0, 500));
  } catch (hata) {
    console.error("[ai-tarama]", hata);
  }

  return new Response("ok", { status: 200 });
}

export const config: Config = {
  schedule: "*/15 * * * *",
};
