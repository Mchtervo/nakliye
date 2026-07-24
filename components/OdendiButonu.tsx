"use client";

import { useTransition } from "react";

export default function OdendiButonu({
  isaretle,
}: {
  isaretle: () => Promise<void>;
}) {
  const [bekliyor, baslat] = useTransition();

  return (
    <button
      type="button"
      disabled={bekliyor}
      onClick={() =>
        baslat(async () => {
          await isaretle();
        })
      }
      className="btn btn-teal !px-3 !py-1.5 text-sm"
    >
      {bekliyor ? "..." : "Kalanı Kapat"}
    </button>
  );
}
