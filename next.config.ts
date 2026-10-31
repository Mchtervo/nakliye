import type { NextConfig } from "next";
import { execSync } from "node:child_process";
import path from "node:path";

/** Build sürümü: commit kısa SHA. Uygulama yeni sürümü bununla fark eder. */
function surumBul(): string {
  try {
    return execSync("git rev-parse --short HEAD", { cwd: __dirname }).toString().trim();
  } catch {
    return String(Date.now());
  }
}
const SURUM = surumBul();

const nextConfig: NextConfig = {
  // Sürüm uyuşmazlığında Next sayfa geçişinde kendisi tam yenileme yapar.
  deploymentId: SURUM,
  env: {
    UYGULAMA_SURUM: SURUM,
  },
  turbopack: {
    root: path.join(__dirname),
  },
  // Soft navigasyon: son sayfalar bir süre hafızada kalsın (takılma azalır)
  experimental: {
    serverActions: {
      bodySizeLimit: "12mb",
    },
    staleTimes: {
      dynamic: 90,
      static: 180,
    },
  },
};

export default nextConfig;
