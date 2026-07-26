import { aiKapaliMi, aiKullanilabilir } from "@/lib/ai/istemci";
import { fisOku } from "@/lib/ai/fisOku";

export const dynamic = "force-dynamic";

const IZINLI_TURLER = ["image/jpeg", "image/png", "image/webp"];
const MAX_BOYUT = 6 * 1024 * 1024;

export async function POST(request: Request) {
  if (aiKapaliMi()) {
    return Response.json(
      { hata: "AI kapalı — fişi elle doldur, kayıt yine çalışır." },
      { status: 503 }
    );
  }
  if (!aiKullanilabilir()) {
    return Response.json(
      { hata: "OPENAI_API_KEY tanımlı değil." },
      { status: 503 }
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ hata: "Görsel alınamadı." }, { status: 400 });
  }

  const dosya = form.get("fis");
  if (!(dosya instanceof File) || dosya.size === 0) {
    return Response.json({ hata: "Görsel bulunamadı." }, { status: 400 });
  }
  if (dosya.size > MAX_BOYUT) {
    return Response.json(
      { hata: "Görsel çok büyük (en fazla 6 MB)." },
      { status: 400 }
    );
  }

  const tur = IZINLI_TURLER.includes(dosya.type) ? dosya.type : "image/jpeg";
  const base64 = Buffer.from(await dosya.arrayBuffer()).toString("base64");

  try {
    const sonuc = await fisOku(`data:${tur};base64,${base64}`);
    return Response.json({ sonuc });
  } catch (hata) {
    const mesaj = hata instanceof Error ? hata.message : "Fiş okunamadı.";
    console.error("[fis-oku]", mesaj);
    return Response.json({ hata: mesaj }, { status: 502 });
  }
}
