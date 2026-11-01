"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { GORUNUM_COOKIE, OTURUM_COOKIE, OTURUM_SURE_SN, oturumTokeniOlustur, uyeTokeniOlustur, uygulamaSifresi } from "@/lib/auth";
import { YONETICI_SURUM_ANAHTAR, aktifBaglam, yoneticiOturumSurumu } from "@/lib/baglam";
import { anaPrisma } from "@/lib/prismaAna";
import { sifreDogrula, sifreHashle } from "@/lib/sifre";
import { girisBasarili, girisHatasiYaz, girisKilitliMi, kodDogrula, kodGonder, telefonNormal } from "@/lib/uyelik";
import { uyeSemasiHazirla } from "@/lib/uyeSema";
import type { FormSonuc } from "@/app/actions";

const SIFRE_EN_AZ = 6;

async function kayitliSifre(): Promise<string> {
  // Her zaman ana şemadan: tarayıcıda eski üye çerezi olsa da yönetici şifresi okunur
  const ayar = await anaPrisma.ayar.findUnique({ where: { anahtar: "uygulama_sifre" } });
  return ayar?.deger || uygulamaSifresi();
}

/** Yalnız site içi yol ("//başka-site" açık yönlendirme olmasın). */
function guvenliYol(ham: string, varsayilan = "/"): string {
  return /^\/(?!\/)/.test(ham) && !ham.includes("\\") ? ham : varsayilan;
}

async function oturumYaz(token: string): Promise<void> {
  const jar = await cookies();
  jar.delete(GORUNUM_COOKIE);
  jar.set(OTURUM_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: OTURUM_SURE_SN,
    secure: process.env.NODE_ENV === "production",
  });
}

const bekle = () => new Promise((r) => setTimeout(r, 900));

/**
 * Giriş: telefon (ya da eski üyeler için kullanıcı adı) + şifre → üye;
 * "yönetici" işaretli ve kimlik boşsa yönetici şifresi.
 */
export async function girisYap(_onceki: FormSonuc, formData: FormData): Promise<FormSonuc> {
  const sifre = String(formData.get("sifre") || "");
  const next = guvenliYol(String(formData.get("next") || "/"));
  const kimlik = String(formData.get("kimlik") ?? formData.get("kullaniciAdi") ?? "").trim();
  const yonetici = formData.get("yonetici") === "1";

  if (yonetici && !kimlik) {
    if (girisKilitliMi("yonetici")) return { hata: "Çok fazla hatalı deneme. 15 dakika sonra tekrar dene." };
    if (!sifreDogrula(sifre, await kayitliSifre())) {
      girisHatasiYaz("yonetici");
      await bekle();
      return { hata: "Şifre hatalı." };
    }
    girisBasarili("yonetici");
    await oturumYaz(await oturumTokeniOlustur(await yoneticiOturumSurumu()));
    redirect(next);
  }

  if (!kimlik) return { hata: "Telefon numaranı yaz." };
  const telefon = telefonNormal(kimlik);
  const anahtar = `u:${telefon ?? kimlik.toLocaleLowerCase("tr-TR")}`;
  if (girisKilitliMi(anahtar)) return { hata: "Çok fazla hatalı deneme. 15 dakika sonra tekrar dene." };

  const uye = telefon
    ? await anaPrisma.uye.findFirst({ where: { telefon }, orderBy: { id: "asc" } })
    : await anaPrisma.uye.findUnique({ where: { kullaniciAdi: kimlik.toLocaleLowerCase("tr-TR") } });
  if (!uye || !uye.sifreHash.includes(":") || !sifreDogrula(sifre, uye.sifreHash)) {
    girisHatasiYaz(anahtar);
    await bekle();
    return { hata: "Telefon numarası veya şifre hatalı." };
  }
  if (!uye.aktif) return { hata: "Hesabın kapalı. Yöneticiyle görüş." };
  girisBasarili(anahtar);
  await anaPrisma.uye.update({ where: { id: uye.id }, data: { sonGiris: new Date() } });
  void uyeSemasiHazirla(uye.id).catch((e) => console.error("[giris] şema", e));
  await oturumYaz(await uyeTokeniOlustur(uye.id, uye.oturumSurum));
  // Yarım kalan kurulum kaldığı yerden
  redirect(uye.kurulumBitti ? next : "/kurulum");
}

/** Yeni üye: ad soyad, telefon, şifre. Yönetici rolü buradan verilemez. */
export async function kayitOl(_onceki: FormSonuc, formData: FormData): Promise<FormSonuc> {
  const ad = String(formData.get("ad") || "").trim().replace(/\s+/g, " ").slice(0, 60);
  const telefon = telefonNormal(String(formData.get("telefon") || ""));
  const sifre = String(formData.get("sifre") || "");
  if (ad.length < 3 || !ad.includes(" ")) return { hata: "Adını ve soyadını yaz." };
  if (!telefon) return { hata: "Telefonu 05XX XXX XX XX biçiminde yaz." };
  if (sifre.length < SIFRE_EN_AZ) return { hata: `Şifre en az ${SIFRE_EN_AZ} karakter olmalı.` };
  if (formData.get("kosullar") !== "1") return { hata: "Devam etmek için koşulları onayla." };

  let uye = await anaPrisma.uye.findFirst({ where: { telefon } });
  if (uye) {
    // Çift dokunma / bağlantı kopması: aynı bilgilerle az önce açılan hesap → oturum aç
    const azOnce = Date.now() - uye.createdAt.getTime() < 10 * 60 * 1000;
    if (!(azOnce && uye.kurulumBitti === null && sifreDogrula(sifre, uye.sifreHash))) {
      return { hata: "Bu telefonla kayıtlı bir hesap var. Giriş yap." };
    }
  } else {
    try {
      uye = await anaPrisma.uye.create({
        data: { kullaniciAdi: `t${telefon}`, telefon, ad, sifreHash: sifreHashle(sifre), sonGiris: new Date() },
      });
    } catch {
      // Eşzamanlı ikinci istek: benzersiz kullanıcı adı çakıştı
      uye = await anaPrisma.uye.findFirst({ where: { telefon } });
      if (!uye || !sifreDogrula(sifre, uye.sifreHash)) return { hata: "Bu telefonla kayıtlı bir hesap var. Giriş yap." };
    }
    // Boş defter arka planda hazırlanır; kurulum adımları beklemeden açılır
    void uyeSemasiHazirla(uye.id).catch((e) => console.error("[kayit] şema", e));
  }
  await oturumYaz(await uyeTokeniOlustur(uye.id, uye.oturumSurum));
  redirect("/kurulum");
}

export async function cikisYap(): Promise<void> {
  const jar = await cookies();
  jar.delete(OTURUM_COOKIE);
  jar.delete(GORUNUM_COOKIE);
  redirect("/giris");
}

/** Bu cihaz dışındaki tüm oturumları kapatır (bu cihaz yeni çerezle açık kalır). */
export async function tumCihazlardanCik(): Promise<FormSonuc> {
  const b = await aktifBaglam();
  if (b.yoneticiGoruyor) return { hata: "Üye görünümünde kullanılamaz." };
  if (b.uyeId !== null) {
    const u = await anaPrisma.uye.update({ where: { id: b.uyeId }, data: { oturumSurum: { increment: 1 } } });
    await oturumYaz(await uyeTokeniOlustur(u.id, u.oturumSurum));
  } else {
    await oturumYaz(await oturumTokeniOlustur(await yoneticiSurumArtir()));
  }
  return null;
}

async function yoneticiSurumArtir(): Promise<number> {
  const yeni = (await yoneticiOturumSurumu()) + 1;
  await anaPrisma.ayar.upsert({
    where: { anahtar: YONETICI_SURUM_ANAHTAR },
    create: { anahtar: YONETICI_SURUM_ANAHTAR, deger: String(yeni) },
    update: { deger: String(yeni) },
  });
  return yeni;
}

export async function sifreDegistir(_onceki: FormSonuc, formData: FormData): Promise<FormSonuc> {
  const mevcut = String(formData.get("mevcut") || "");
  const yeni = String(formData.get("yeni") || "");
  const yeni2 = String(formData.get("yeni2") || "");

  const b = await aktifBaglam();
  const enAz = b.uyeId !== null ? SIFRE_EN_AZ : 4;
  if (yeni.length < enAz) return { hata: `Yeni şifre en az ${enAz} karakter olmalı.` };
  if (yeni !== yeni2) return { hata: "Yeni şifreler eşleşmiyor." };

  // Üye kendi şifresini değiştirir (yöneticinin üye görünümünde kapalı)
  if (b.uyeId !== null) {
    if (b.yoneticiGoruyor) return { hata: "Üye görünümünde şifre değiştirilemez." };
    const uye = await anaPrisma.uye.findUnique({ where: { id: b.uyeId } });
    if (!uye || !sifreDogrula(mevcut, uye.sifreHash)) return { hata: "Mevcut şifre hatalı." };
    // Şifre değişince diğer cihazlardaki oturumlar kapanır
    const u = await anaPrisma.uye.update({
      where: { id: uye.id },
      data: { sifreHash: sifreHashle(yeni), oturumSurum: { increment: 1 } },
    });
    await oturumYaz(await uyeTokeniOlustur(u.id, u.oturumSurum));
    revalidatePath("/profil");
    return null;
  }

  const kayitli = await kayitliSifre();
  if (!sifreDogrula(mevcut, kayitli)) return { hata: "Mevcut şifre hatalı." };

  await anaPrisma.ayar.upsert({
    where: { anahtar: "uygulama_sifre" },
    create: { anahtar: "uygulama_sifre", deger: sifreHashle(yeni) },
    update: { deger: sifreHashle(yeni) },
  });
  await oturumYaz(await oturumTokeniOlustur(await yoneticiSurumArtir()));

  revalidatePath("/ayarlar");
  return null;
}

export type KodSonuc = { hata: string | null; tamam: boolean; smsYok?: boolean };

/** Üye: telefon doğrulama kodu iste. */
export async function telefonKoduGonder(): Promise<KodSonuc> {
  const b = await aktifBaglam();
  if (b.uyeId === null || b.yoneticiGoruyor) return { hata: "Yalnız üye hesabında.", tamam: false };
  const uye = await anaPrisma.uye.findUnique({ where: { id: b.uyeId } });
  if (!uye?.telefon) return { hata: "Önce telefon numaranı kaydet.", tamam: false };
  if (uye.telefonDogrulandi) return { hata: null, tamam: true };
  const r = await kodGonder(uye.id, uye.telefon, "DOGRULAMA");
  return r.tamam ? { hata: null, tamam: true } : { hata: r.hata, tamam: false, smsYok: r.smsYok };
}

export async function telefonDogrula(_onceki: KodSonuc, formData: FormData): Promise<KodSonuc> {
  const b = await aktifBaglam();
  if (b.uyeId === null || b.yoneticiGoruyor) return { hata: "Yalnız üye hesabında.", tamam: false };
  const r = await kodDogrula(b.uyeId, "DOGRULAMA", String(formData.get("kod") || ""));
  if (!r.tamam) return { hata: r.hata, tamam: false };
  await anaPrisma.uye.update({ where: { id: b.uyeId }, data: { telefonDogrulandi: new Date() } });
  revalidatePath("/", "layout");
  return { hata: null, tamam: true };
}

/** Şifremi unuttum 1: telefona kod (hesap var mı yok mu belli edilmez). */
export async function sifreKoduIste(_onceki: KodSonuc, formData: FormData): Promise<KodSonuc> {
  const telefon = telefonNormal(String(formData.get("telefon") || ""));
  if (!telefon) return { hata: "Telefonu 05XX XXX XX XX biçiminde yaz.", tamam: false };
  const uye = await anaPrisma.uye.findFirst({ where: { telefon, aktif: true } });
  if (!uye) {
    await bekle();
    const { smsHazirMi } = await import("@/lib/sms");
    if (!smsHazirMi()) return { hata: "SMS hizmeti henüz kurulu değil; kod gönderilemiyor.", tamam: false, smsYok: true };
    return { hata: null, tamam: true };
  }
  const r = await kodGonder(uye.id, telefon, "SIFRE");
  return r.tamam ? { hata: null, tamam: true } : { hata: r.hata, tamam: false, smsYok: r.smsYok };
}

/** Şifremi unuttum 2: kod + yeni şifre → tüm eski oturumlar kapanır. */
export async function sifreSifirla(_onceki: KodSonuc, formData: FormData): Promise<KodSonuc> {
  const telefon = telefonNormal(String(formData.get("telefon") || ""));
  const yeni = String(formData.get("yeni") || "");
  if (!telefon) return { hata: "Telefon geçersiz.", tamam: false };
  if (yeni.length < SIFRE_EN_AZ) return { hata: `Şifre en az ${SIFRE_EN_AZ} karakter olmalı.`, tamam: false };
  const uye = await anaPrisma.uye.findFirst({ where: { telefon, aktif: true } });
  if (!uye) return { hata: "Kod hatalı.", tamam: false };
  const r = await kodDogrula(uye.id, "SIFRE", String(formData.get("kod") || ""));
  if (!r.tamam) return { hata: r.hata, tamam: false };
  await anaPrisma.uye.update({
    where: { id: uye.id },
    // Kodu alan telefon doğrulanmış sayılır
    data: { sifreHash: sifreHashle(yeni), oturumSurum: { increment: 1 }, telefonDogrulandi: uye.telefonDogrulandi ?? new Date() },
  });
  return { hata: null, tamam: true };
}
