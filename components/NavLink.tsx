"use client";

import Link from "next/link";
import { useLinkStatus } from "next/link";
import type { ReactNode } from "react";

function BeklemeIsareti() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span
      className="absolute right-2 top-1/2 h-1.5 w-1.5 -translate-y-1/2 animate-pulse rounded-full bg-amber md:right-3"
      aria-hidden
    />
  );
}

/** Tıklanınca hemen “yükleniyor” hissi verir. */
export default function NavLink({
  href,
  className,
  children,
  prefetch = true,
}: {
  href: string;
  className?: string;
  children: ReactNode;
  prefetch?: boolean;
}) {
  return (
    <Link href={href} prefetch={prefetch} className={`relative ${className || ""}`}>
      {children}
      <BeklemeIsareti />
    </Link>
  );
}
