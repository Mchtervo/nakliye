"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { FormSonuc } from "@/app/actions";
import { GORUNUM_COOKIE, gorunumTokeniOlustur } from "@/lib/auth";
import { aktifBaglam } from "@/lib/baglam";
import { fisKaydet, fisSil } from "@/lib/fis";
import { anaPrisma } from "@/lib/prismaAna";
import { sifreHashle } from "@/lib/sifre";
import { telefonNormal, yonetimKaydiYaz } from "@/lib/uyelik";
import { yoneticiMi } from "@/lib/uyeProfil";
import { uyeSemasiHazirla } from "@/lib/uyeSema";

const metin = (f: FormData, ad: string, uzunluk = 80) => String(f.get(ad) || "").trim().slice(0, uzunluk);

/** Üye: kişisel bilgiler (araçlar Araç sayfasında; burada araç kaydına dokunulmaz). */
export async function profilKaydet(_onceki: FormSonuc, formData: FormData): Promise<FormSonuc> {
  const b = await aktifBaglam();
  if (b.uyeId === null) return { hata: "Bu sayfa üye hesabı içindir." };

  const ad = metin(formData, "ad", 60);
  const sehir = metin(formData, "sehir", 40);
  const telefon = telefonNormal(metin(formData, "telefon", 20));
  if (!ad) return { hata: "Adını yaz." };
  if (!telefon) return { hata: "Telefonu 05xx xxx xx xx gibi yaz." };
  const uye = await anaPrisma.uye.findUnique({ where: { id: b.uyeId } });
  if (!uye) return { hata: "Hesap bulunamadı." };
  if (telefon !== uye.telefon && (await anaPrisma.uye.findFirst({ where: { telefon, id: { not: uye.id } } }))) {
    return { hata: "Bu telefon başka bir hesapta kayıtlı." };
  }
  await anaPrisma.uye.update({
    where: { id: b.uyeId },
    // Numara değişince doğrulama baştan
    data: { ad, sehir: sehir || null, telefon, ...(telefon !== uye.telefon ? { telefonDogrulandi: null } : {}) },
  });

  revalidatePath("/", "layout");
  return null;
}

/** Üye: profil fotoğrafı yükle / değiştir / kaldır (aynı üyeye özel klasör, fiş gibi). */
export async function profilFotografiKaydet(_onceki: FormSonuc, formData: FormData): Promise<FormSonuc> {
  const b = await aktifBaglam();
  if (b.uyeId === null) return { hata: "Bu sayfa üye hesabı içindir." };
  const uye = await anaPrisma.uye.findUnique({ where: { id: b.uyeId }, select: { fotograf: true } });
  if (!uye) return { hata: "Hesap bulunamadı." };

  if (formData.get("kaldir")) {
    await fisSil(uye.fotograf);
    await anaPrisma.uye.update({ where: { id: b.uyeId }, data: { fotograf: null } });
    revalidatePath("/", "layout");
    return null;
  }

  const dosya = formData.get("fotograf");
  if (!(dosya instanceof File) || dosya.size === 0) return { hata: "Bir fotoğraf seç." };
  if (dosya.size > 6 * 1024 * 1024) return { hata: "Fotoğraf en fazla 6 MB olabilir." };
  const sonuc = await fisKaydet(dosya);
  if (!sonuc || "hata" in sonuc) return { hata: sonuc?.hata ?? "Fotoğraf yüklenemedi." };
  await anaPrisma.uye.update({ where: { id: b.uyeId }, data: { fotograf: sonuc.yol } });
  await fisSil(uye.fotograf);
  revalidatePath("/", "layout");
  return null;
}

async function yoneticiGerekli() {
  if (!(await yoneticiMi())) throw new Error("Yetki yok.");
}

/** Yönetici: yeni üye (boş şemayla başlar). */
export async function uyeOlustur(_onceki: FormSonuc, formData: FormData): Promise<FormSonuc> {
  await yoneticiGerekli();
  const kullaniciAdi = metin(formData, "kullaniciAdi", 30).toLocaleLowerCase("tr-TR");
  const sifre = String(formData.get("sifre") || "");
  if (!/^[a-z0-9._-]{3,30}$/.test(kullaniciAdi)) return { hata: "Kullanıcı adı 3–30 harf/rakam olmalı (Türkçe harf ve boşluk yok)." };
  if (sifre.length < 4) return { hata: "Şifre en az 4 karakter olmalı." };
  if (await anaPrisma.uye.findUnique({ where: { kullaniciAdi } })) return { hata: "Bu kullanıcı adı alınmış." };
  const uye = await anaPrisma.uye.create({ data: { kullaniciAdi, sifreHash: sifreHashle(sifre), ad: metin(formData, "ad") || null } });
  // Boş defter arka planda kurulur (ilk kurulum birkaç dakika sürebilir); üye ilk girişte hazır olanı kullanır
  void uyeSemasiHazirla(uye.id).catch((e) => console.error("[uyeOlustur] şema", e));
  await yonetimKaydiYaz("UYE_OLUSTUR", uye.id, kullaniciAdi);
  revalidatePath("/yonetim");
  return null;
}

export async function uyeSifreSifirla(uyeId: number, yeniSifre: string): Promise<void> {
  await yoneticiGerekli();
  if (yeniSifre.length < 4) throw new Error("Şifre en az 4 karakter olmalı.");
  // Yeni şifreyle eski oturumların hepsi kapanır
  await anaPrisma.uye.update({ where: { id: uyeId }, data: { sifreHash: sifreHashle(yeniSifre), oturumSurum: { increment: 1 } } });
  await yonetimKaydiYaz("SIFRE_SIFIRLA", uyeId);
  revalidatePath("/yonetim");
}

export async function uyeAktifDegistir(uyeId: number): Promise<void> {
  await yoneticiGerekli();
  const uye = await anaPrisma.uye.findUnique({ where: { id: uyeId } });
  if (!uye) return;
  await anaPrisma.uye.update({ where: { id: uyeId }, data: { aktif: !uye.aktif } });
  await yonetimKaydiYaz(uye.aktif ? "HESAP_KAPAT" : "HESAP_AC", uyeId);
  revalidatePath("/yonetim");
}

/** Yönetici üyenin panelini onun gözünden açar (8 saat; "Yönetime dön" ile kapanır). */
export async function uyePanelineGir(uyeId: number): Promise<void> {
  await yoneticiGerekli();
  const uye = await anaPrisma.uye.findUnique({ where: { id: uyeId } });
  if (!uye) throw new Error("Üye bulunamadı.");
  await uyeSemasiHazirla(uyeId);
  // Yalnız yönetim kaydına yazılır (üyeye bildirim gitmez)
  await yonetimKaydiYaz("PANELE_GIRIS", uyeId);
  const jar = await cookies();
  jar.set(GORUNUM_COOKIE, await gorunumTokeniOlustur(uyeId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
    secure: process.env.NODE_ENV === "production",
  });
  redirect("/");
}

export async function yoneticiyeDon(): Promise<void> {
  const jar = await cookies();
  jar.delete(GORUNUM_COOKIE);
  redirect("/yonetim");
}

/** Yönetici: üyenin tüm cihazlardaki oturumlarını kapatır. */
export async function uyeOturumlariniKapat(uyeId: number): Promise<void> {
  await yoneticiGerekli();
  await anaPrisma.uye.update({ where: { id: uyeId }, data: { oturumSurum: { increment: 1 } } });
  await yonetimKaydiYaz("OTURUM_KAPAT", uyeId);
  revalidatePath(`/yonetim/uyeler/${uyeId}`);
}

/** Yönetici: şikâyeti sonuçlandır. KALDIR → ilan herkesin listesinden düşer (ELENDI). */
export async function sikayetSonuclandir(id: number, islem: "KALDIR" | "YOKSAY"): Promise<void> {
  await yoneticiGerekli();
  const s = await anaPrisma.ilanSikayet.findUnique({ where: { id } });
  if (!s || s.durum !== "ACIK") return;
  if (islem === "KALDIR") {
    await anaPrisma.yukIlani.updateMany({ where: { id: s.ilanId }, data: { durum: "ELENDI" } });
    // Aynı ilana gelen diğer açık şikâyetler de kapanır
    await anaPrisma.ilanSikayet.updateMany({ where: { ilanId: s.ilanId, durum: "ACIK" }, data: { durum: "KALDIRILDI", kapandi: new Date() } });
  } else {
    await anaPrisma.ilanSikayet.update({ where: { id }, data: { durum: "YOKSAYILDI", kapandi: new Date() } });
  }
  await yonetimKaydiYaz(islem === "KALDIR" ? "SIKAYET_KALDIR" : "SIKAYET_YOKSAY", s.uyeId, `ilan #${s.ilanId}`);
  revalidatePath("/yonetim/ilanlar");
  revalidatePath("/yonetim");
}

/** Yönetici: ortak ilanı herkesin listesinden kaldırır (silmez; durum ELENDI). */
export async function ilanKaldir(ilanId: number): Promise<void> {
  await yoneticiGerekli();
  if (!Number.isInteger(ilanId) || ilanId <= 0) return;
  await anaPrisma.yukIlani.updateMany({ where: { id: ilanId }, data: { durum: "ELENDI" } });
  await yonetimKaydiYaz("ILAN_KALDIR", null, `ilan #${ilanId}`);
  revalidatePath("/yonetim/ilanlar");
}

export type TercihSonuc = { hata: string | null; tamam: boolean };

/** Üye: ana üs, aracın konumu ve telefona bildirim (kendi defterindeki ayarlar). */
export async function kisiselTercihKaydet(_o: TercihSonuc, f: FormData): Promise<TercihSonuc> {
  const b = await aktifBaglam();
  if (b.uyeId === null) return { hata: "Bu ayarlar üye hesabı içindir.", tamam: false };
  const { ilBul } = await import("@/lib/iller");
  const { aracKonumuYaz } = await import("@/lib/konum");
  const { prisma } = await import("@/lib/prisma");
  const anaUs = ilBul(String(f.get("anaUs") || ""));
  const konum = ilBul(String(f.get("konumIl") || ""));
  if (!anaUs || !konum) return { hata: "Şehirleri seç.", tamam: false };
  const push = f.get("push") === "1" ? "1" : "0";
  const yukler = f.get("yukler") === "0" ? "0" : "1";
  const yukBildirim = f.get("yukBildirim") === "0" ? "0" : "1";
  for (const [anahtar, deger] of [
    ["ai_ana_us", anaUs],
    ["bildirim_push", push],
    ["uye_yukler_acik", yukler],
    ["uye_yuk_bildirim", yukBildirim],
  ] as const) {
    await prisma.ayar.upsert({ where: { anahtar }, update: { deger }, create: { anahtar, deger } });
  }
  await aracKonumuYaz(konum);
  await anaPrisma.uye.update({ where: { id: b.uyeId }, data: { sehir: anaUs } });
  revalidatePath("/", "layout");
  return { hata: null, tamam: true };
}
