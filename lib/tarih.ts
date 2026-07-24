export function bugunTarihStr(): string {
  // Sunucu tarafında hesaplanır; client'a prop olarak verilir (hydration uyumu için).
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function ayBasiStr(yil: number, ay: number): string {
  // ay: 1-12
  return `${yil}-${String(ay).padStart(2, "0")}-01`;
}

export function sonrakiAyBasi(yil: number, ay: number): Date {
  return new Date(yil, ay, 1); // ay: 1-12 → Date ay indeksi = ay (sonraki ay)
}

export function ayAraligi(yil: number, ay: number): { bas: Date; son: Date } {
  return {
    bas: new Date(yil, ay - 1, 1),
    son: new Date(yil, ay, 1),
  };
}
