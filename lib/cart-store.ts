"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartLine } from "./types";

type AddInput = { type: "product"; id: string; grams: number; qty?: number } | { type: "combo"; id: string; qty?: number };

type CartState = {
  lines: CartLine[];
  open: boolean;
  /** increments on every add, so the cart button can bounce */
  bump: number;
  add: (item: AddInput) => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  setOpen: (open: boolean) => void;
};

const keyOf = (i: AddInput) => (i.type === "product" ? `p:${i.id}:${i.grams}` : `c:${i.id}`);

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      open: false,
      bump: 0,
      add: (item) =>
        set((s) => {
          const key = keyOf(item);
          const qty = item.qty ?? 1;
          const existing = s.lines.find((l) => l.key === key);
          const lines = existing
            ? s.lines.map((l) => (l.key === key ? { ...l, qty: l.qty + qty } : l))
            : [...s.lines, item.type === "product" ? { key, type: "product" as const, id: item.id, grams: item.grams, qty } : { key, type: "combo" as const, id: item.id, qty }];
          return { lines, bump: s.bump + 1 };
        }),
      setQty: (key, qty) =>
        set((s) => ({ lines: qty <= 0 ? s.lines.filter((l) => l.key !== key) : s.lines.map((l) => (l.key === key ? { ...l, qty } : l)) })),
      remove: (key) => set((s) => ({ lines: s.lines.filter((l) => l.key !== key) })),
      clear: () => set({ lines: [] }),
      setOpen: (open) => set({ open }),
    }),
    { name: "iyer-cart", partialize: (s) => ({ lines: s.lines }) },
  ),
);

export const cartCount = (lines: CartLine[]) => lines.reduce((n, l) => n + l.qty, 0);

/**
 * Flies a small token from the clicked element into the cart button along a
 * curve, then the cart bumps. Pure DOM + WAAPI so it works from any component.
 */
export function flyToCart(from: HTMLElement | null, colour = "#d9a21b") {
  const target = document.querySelector<HTMLElement>("[data-cart-target]");
  if (!from || !target || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const a = from.getBoundingClientRect();
  const b = target.getBoundingClientRect();
  const token = document.createElement("div");
  Object.assign(token.style, {
    position: "fixed",
    left: `${a.left + a.width / 2 - 9}px`,
    top: `${a.top + a.height / 2 - 9}px`,
    width: "18px",
    height: "18px",
    borderRadius: "50%",
    background: colour,
    boxShadow: "inset -3px -3px 0 rgba(0,0,0,.18), 0 0 0 2px #2a1a12",
    zIndex: "250",
    pointerEvents: "none",
  });
  document.body.appendChild(token);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  // x moves linearly, y overshoots upward first: a thrown arc
  const frames = Array.from({ length: 21 }, (_, i) => {
    const t = i / 20;
    const arc = -Math.sin(t * Math.PI) * Math.min(180, Math.abs(dx) * 0.35 + 60);
    return { transform: `translate(${dx * t}px, ${dy * t * t + arc}px) scale(${1 - t * 0.55})`, opacity: t > 0.92 ? 0 : 1 };
  });
  token.animate(frames, { duration: 760, easing: "cubic-bezier(.45,.05,.55,.95)" }).finished.then(() => token.remove());
}
