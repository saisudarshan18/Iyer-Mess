"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

export function ReceiptControls({ width, auto }: { width: number; auto: boolean }) {
  const router = useRouter();
  const path = usePathname();
  useEffect(() => {
    if (auto) setTimeout(() => window.print(), 400);
  }, [auto]);
  return (
    <div className="no-print flex items-center gap-2">
      {[58, 80].map((w) => (
        <button key={w} className="chip" aria-pressed={width === w} onClick={() => router.replace(`${path}?w=${w}`)}>
          {w} mm
        </button>
      ))}
      <button className="btn" onClick={() => window.print()}>
        Print
      </button>
    </div>
  );
}
