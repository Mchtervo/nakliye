"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { FormSonuc } from "@/app/actions";
import { GORUNUM_COOKIE, gorunumTokeniOlustur } from "@/lib/auth";
import { aktifBaglam } from "@/lib/baglam";
import { prisma } from "@/lib/prisma";
import { anaPrisma } from "@/lib/prismaAna";
import { sifreHashle } from "@/lib/sifre";
import { yoneticiMi } from "@/lib/uyeProfil";
import { uyeSemasiHazirla } from "@/lib/uyeSema";

const metin = (f: FormData, ad: string, uzunluk = 80) => String(f.get(ad) || "").trim().slice(0, uzunluk);

/** Üye: araç + kişisel bilgiler. Araç üyenin kendi şemasına, kişi bilgisi hesabına yazılır. */
export async function profilKaydet(_onceki: FormSonuc, formData: FormData): Promise<FormSonuc> {
  const b = await aktifBaglam();
  if (b.uyeId === null) return { hata: "Bu sayfa üye hesabı içindir." };

  const tip = metin(formData, "aracTipi", 30);
  const kasa = metin(formData, "kasaTipi", 30);
  const plaka = metin(formData, "plaka", 15).toLocaleUpperCase("tr-TR").replace(/\s+/g, " ");
  const ad = metin(formData, "ad");
  const telefon = metin(formData, "telefon", 20);
  const sehir = metin(formData, "sehir", 40);
  if (plaka && !/^\d{2}\s?[A-ZÇĞİÖŞÜ]{1,3}\s?\d{2,5}$/.test(plaka)) return { hata: "Plakayı 06 ABC 123 gibi yaz." };
  if (telefon && telefon.replace(/\D/g, "").length < 10) return { hata: "Telefonu 05xx xxx xx xx gibi yaz." };

  const aracAd = [tip, kasa].filter(Boolean).join(" · ") || "Tır";
  const mevcut = await prisma.arac.findFirst({ orderBy: { id: "asc" } });
  if (mevcut) await prisma.arac.update({ where: { id: mevcut.id }, data: { ad: aracAd, plaka: plaka || null } });
  else await prisma.arac.create({ data: { ad: aracAd, plaka: plaka || null } });
  await anaPrisma.uye.update({ where: { id: b.uyeId }, data: { ad: ad || null, telefon: telefon || null, sehir: sehir || null } });

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
  revalidatePath("/yonetim");
  return null;
}

export async function uyeSifreSifirla(uyeId: number, yeniSifre: string): Promise<void> {
  await yoneticiGerekli();
  if (yeniSifre.length < 4) throw new Error("Şifre en az 4 karakter olmalı.");
  await anaPrisma.uye.update({ where: { id: uyeId }, data: { sifreHash: sifreHashle(yeniSifre) } });
  revalidatePath("/yonetim");
}

export async function uyeAktifDegistir(uyeId: number): Promise<void> {
  await yoneticiGerekli();
  const uye = await anaPrisma.uye.findUnique({ where: { id: uyeId } });
  if (!uye) return;
  await anaPrisma.uye.update({ where: { id: uyeId }, data: { aktif: !uye.aktif } });
  revalidatePath("/yonetim");
}

/** Yönetici üyenin panelini onun gözünden açar (8 saat; "Yönetime dön" ile kapanır). */
export async function uyePanelineGir(uyeId: number): Promise<void> {
  await yoneticiGerekli();
  const uye = await anaPrisma.uye.findUnique({ where: { id: uyeId } });
  if (!uye) throw new Error("Üye bulunamadı.");
  await uyeSemasiHazirla(uyeId);
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
