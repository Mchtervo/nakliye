import { Plus_Jakarta_Sans } from "next/font/google";

/** Ana sayfa tasarımının yuvarlak, güçlü başlık/tutar yazısı (Türkçe karakterli). */
export const anaYazi = Plus_Jakarta_Sans({
  variable: "--font-ana",
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700", "800"],
  display: "swap",
});
