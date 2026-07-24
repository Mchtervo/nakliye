import { test } from "node:test";
import assert from "node:assert/strict";
import { kdvHesapla, tlKurusaCevir, tlYaz } from "../lib/para.ts";

test("KDV dahil 12.000 TL -> net 10.000, KDV 2.000", () => {
  const s = kdvHesapla(1200000, true, true);
  assert.equal(s.netTutar, 1000000);
  assert.equal(s.kdvTutar, 200000);
  assert.equal(s.toplamTutar, 1200000);
});

test("KDV hariç 10.000 TL -> KDV 2.000, toplam 12.000", () => {
  const s = kdvHesapla(1000000, true, false);
  assert.equal(s.netTutar, 1000000);
  assert.equal(s.kdvTutar, 200000);
  assert.equal(s.toplamTutar, 1200000);
});

test("KDV'siz 5.000 TL -> KDV 0, net = toplam = 5.000", () => {
  const s = kdvHesapla(500000, false, true);
  assert.equal(s.netTutar, 500000);
  assert.equal(s.kdvTutar, 0);
  assert.equal(s.toplamTutar, 500000);
});

test("KDV dahil küsuratlı tutar: net + kdv daima toplama eşit", () => {
  for (const toplam of [1, 99, 101, 12345, 999999, 123456789]) {
    const s = kdvHesapla(toplam, true, true);
    assert.equal(s.netTutar + s.kdvTutar, s.toplamTutar, `toplam=${toplam}`);
    assert.equal(s.toplamTutar, toplam);
  }
});

test("KDV hariç küsuratlı tutar: net + kdv daima toplama eşit", () => {
  for (const net of [1, 99, 101, 12345, 999999, 123456789]) {
    const s = kdvHesapla(net, true, false);
    assert.equal(s.netTutar + s.kdvTutar, s.toplamTutar, `net=${net}`);
    assert.equal(s.netTutar, net);
  }
});

test("negatif veya ondalıklı kuruş girilirse hata fırlatır", () => {
  assert.throws(() => kdvHesapla(-100, true, true));
  assert.throws(() => kdvHesapla(10.5, true, true));
});

test("Türkçe tutar girişleri doğru çevrilir", () => {
  assert.equal(tlKurusaCevir("12000"), 1200000);
  assert.equal(tlKurusaCevir("12.000"), 1200000);
  assert.equal(tlKurusaCevir("12.000,50"), 1200050);
  assert.equal(tlKurusaCevir("12000,5"), 1200050);
  assert.equal(tlKurusaCevir("12000.50"), 1200050);
  assert.equal(tlKurusaCevir("1.250.000"), 125000000);
  assert.equal(tlKurusaCevir("12,5"), 1250);
  assert.equal(tlKurusaCevir("12.5"), 1250);
  assert.equal(tlKurusaCevir(" 750 TL "), 75000);
  assert.equal(tlKurusaCevir("0"), 0);
  assert.equal(tlKurusaCevir("0,99"), 99);
});

test("geçersiz tutar girişleri null döner", () => {
  assert.equal(tlKurusaCevir(""), null);
  assert.equal(tlKurusaCevir("abc"), null);
  assert.equal(tlKurusaCevir("12a00"), null);
  assert.equal(tlKurusaCevir("1,2,3"), null);
  assert.equal(tlKurusaCevir("1.23.456"), null);
  assert.equal(tlKurusaCevir("-500"), null);
});

test("para biçimlendirme Türkçe olur", () => {
  const yazi = tlYaz(1200050);
  // "₺12.000,50" veya "12.000,50 ₺" (ortama göre sıra değişebilir)
  assert.ok(yazi.includes("12.000,50"), yazi);
});
