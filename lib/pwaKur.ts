/** Tarayıcı kurma penceresi — React yüklenmeden yakalanır. */

export type KurPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

declare global {
  interface Window {
    __ndKur?: KurPrompt | null;
    __ndKurDinle?: () => void;
  }
}

export function kurPromptuOku(): KurPrompt | null {
  if (typeof window === "undefined") return null;
  return window.__ndKur ?? null;
}

export function kurPromptunaAbone(fn: () => void): () => void {
  window.__ndKurDinle = () => fn();
  return () => {
    window.__ndKurDinle = undefined;
  };
}

export function kurPromptunuTemizle(): void {
  if (typeof window === "undefined") return;
  window.__ndKur = null;
  window.__ndKurDinle?.();
}
