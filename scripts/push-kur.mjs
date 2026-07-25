/**
 * Web Push (tarayıcı bildirimi) için VAPID anahtar çifti üretir.
 *
 * Kullanım:
 *   npm run push:kur
 *
 * Çıkan üç satırı .env dosyasına ve Netlify ortam değişkenlerine yapıştır.
 */

import webpush from "web-push";

const { publicKey, privateKey } = webpush.generateVAPIDKeys();

console.log("\n  Aşağıdaki satırları .env dosyana ekle:\n");
console.log(`VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
console.log("VAPID_SUBJECT=mailto:seninmailin@ornek.com");
console.log(
  "\n  Aynı üç değeri Netlify > Site settings > Environment variables'a da gir.\n"
);
