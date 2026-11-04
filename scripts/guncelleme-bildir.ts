/**
 * Eskiden deploy sonrası bütün abonelere (üyeler dahil) "Güncelleme hazır" push'u atardı
 * ve içine commit mesajı yazardı. KAPALI: üyelere güncelleme / geliştirme bildirimi gitmez.
 * Uygulama kendini sessizce günceller (components/Guncelleme.tsx).
 * deploy.sh ve auto-deploy.sh bu betiği hâlâ çağırır; bilerek hiçbir şey yapmaz.
 */
console.log("[guncelleme-bildir] kapalı — üyelere güncelleme bildirimi gönderilmez");
