<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Yük Avcısı — agent kuralları

## Model / prompt / filtre değişiklikleri (ZORUNLU)

Şunlardan herhangi birini değiştirirken kullanıcıya **açıkça, ayrı madde** olarak söyle; "maliyet düzeltmesi", "küçük fix" vb. başlık altında gizleme:

- Varsayılan veya env model adı (`MODEL_HIZLI`, `MODEL_ANALIZ`, `OPENAI_MODEL_*`)
- AI sistem prompt'u veya şema alanları (`ilanCozumle`, `semalar`)
- Ön filtre / bölge / koridor / araç / dedup kuralları (hangi mesaj veya rota AI'ye gider / kayda düşer)

Gerekçe + beklenen kalite etkisi + mümkünse ölçüm (A/B veya örnek) yaz.
Kullanıcı ölçmeden kabul etmiyorsa varsayılanı geri al veya onay bekle.

## Koridor filtresi

İlan kaydı ve AI prompt: `ai_koridor_iller` (Ayarlar). HEM çıkış HEM varış listede.
Varsayılan: Ankara, Kırıkkale, Çankırı, Bolu, Düzce, Sakarya, Kocaeli, İstanbul.
