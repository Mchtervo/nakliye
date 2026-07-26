/**
 * FAZ 1 doğrulama — OpenAI çağrısı YOK.
 * DB şeması + env bayraklarını okur.
 */
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

function env(ad, varsayilan) {
  const v = (process.env[ad] || "").trim();
  return v || varsayilan;
}

try {
  const kolonlar = await p.$queryRaw`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'HamMesaj'
      AND column_name = 'denemeSayisi'
  `;

  const tablolar = await p.$queryRaw`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'AiCagri'
  `;

  const [aiCagriAdet, bekleyen, tukenen, butceBayrak, sonCagrilar] =
    await Promise.all([
      p.aiCagri.count(),
      p.hamMesaj.count({ where: { islendi: false } }),
      p.hamMesaj.count({
        where: { islendi: true, hata: { contains: "Max deneme" } },
      }),
      p.ayar.findUnique({ where: { anahtar: "ai_butce_kesildi" } }),
      p.aiCagri.findMany({
        orderBy: { zaman: "desc" },
        take: 5,
        select: {
          zaman: true,
          kaynak: true,
          model: true,
          girdiToken: true,
          ciktiToken: true,
          reasoningToken: true,
          maliyetMikro: true,
          basarili: true,
        },
      }),
    ]);

  const kapali = ["1", "true", "evet", "yes"].includes(
    env("AI_KAPALI", "").toLowerCase()
  );

  console.log(
    JSON.stringify(
      {
        lokalEnv: {
          AI_KAPALI: env("AI_KAPALI", "(yok)"),
          killSwitchAktif: kapali,
          OPENAI_MAX_CIKTI: env("OPENAI_MAX_CIKTI", "1500(default)"),
          OPENAI_TIMEOUT_MS: env("OPENAI_TIMEOUT_MS", "60000(default)"),
          AI_GUNLUK_LIMIT_USD: env("AI_GUNLUK_LIMIT_USD", "1(default)"),
          AI_MAX_DENEME: env("AI_MAX_DENEME", "2(default)"),
          OPENAI_API_KEY_var: Boolean(process.env.OPENAI_API_KEY),
        },
        db: {
          denemeSayisiKolonu: kolonlar.length > 0,
          aiCagriTablosu: tablolar.length > 0,
          aiCagriAdet,
          bekleyenHamMesaj: bekleyen,
          maxDenemeHatalari: tukenen,
          butceKesildiBayrak: butceBayrak?.deger ?? null,
        },
        son5Cagri: sonCagrilar,
        not: "Bu script OpenAI çağrısı yapmaz. 1.2/1.3 canlı çağrı testleri senin onayınla.",
      },
      null,
      2
    )
  );
} finally {
  await p.$disconnect();
}
