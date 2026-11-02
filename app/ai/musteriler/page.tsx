import { redirect } from "next/navigation";

/** Müşteri havuzu yeni sayfada (yönetici ve üye için aynı ekran). */
export default function EskiMusteriHavuzu() {
  redirect("/musteriler");
}
