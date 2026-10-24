/** Tarayıcı kurma penceresi — React yüklenmeden yakalanır. */

export type KurPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

declare global {
  interface Window {
    __ndKur?: KurPrompt | null;
    __ndKurDinle?: (e: KurPrompt | null) => void;
  }
}

export function kurPromptuOku(): KurPrompt | null {
  if (typeof window === "undefined") return null;
  return window.__ndKur ?? null;
}

export function kurPromptunaAbone(fn: (e: KurPrompt | null) => void): () => void {
  window.__ndKurDinle = fn;
  if (window.__ndKur) fn(window.__ndKur);
  return () => {
    if (window.__ndKurDinle === fn) window.__ndKurDinle = undefined;
  };
}
