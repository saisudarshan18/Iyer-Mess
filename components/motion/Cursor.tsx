"use client";

import { useEffect, useRef } from "react";

const INTERACTIVE = "a, button, [role=button], [role=switch], [role=radio], input, select, textarea, label, [data-cursor]";

/**
 * A turmeric dot with a lagging ring. The ring swells over links and buttons,
 * shows a label over anything with data-cursor="...", and turns light over
 * sections marked data-cursor-theme="dark" (footer, marquee). It re-checks what
 * is under it while scrolling, not only when the mouse moves. Fine pointers only.
 */
export function Cursor() {
  const dot = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)").matches;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || reduce) return;
    document.documentElement.classList.add("has-cursor");

    let mx = -100, my = -100, rx = -100, ry = -100, scale = 1, targetScale = 1;
    let raf = 0;
    let visible = false;
    let pressed = false;

    /** Restyle for whatever element is under the pointer. */
    const sync = (el: Element | null) => {
      const target = el?.closest<HTMLElement>(INTERACTIVE) ?? null;
      const text = target?.dataset.cursor ?? "";
      targetScale = (text ? 1 : target ? 1.9 : 1) * (pressed ? 0.8 : 1);
      label.current!.textContent = text;
      ring.current!.dataset.label = text ? "true" : "false";
      const theme = el?.closest<HTMLElement>("[data-cursor-theme]")?.dataset.cursorTheme === "dark" ? "dark" : "light";
      ring.current!.dataset.theme = dot.current!.dataset.theme = theme;
    };

    const move = (e: PointerEvent) => {
      mx = e.clientX;
      my = e.clientY;
      if (!visible) {
        visible = true;
        rx = mx;
        ry = my;
        dot.current!.style.opacity = ring.current!.style.opacity = "1";
      }
      sync(e.target as Element);
    };
    // scrolling moves the page under a still mouse: look again at the same point
    let scrollQueued = false;
    const scroll = () => {
      if (!visible || scrollQueued) return;
      scrollQueued = true;
      requestAnimationFrame(() => {
        scrollQueued = false;
        sync(document.elementFromPoint(mx, my));
      });
    };
    const leave = () => {
      visible = false;
      dot.current!.style.opacity = ring.current!.style.opacity = "0";
    };
    const down = () => {
      pressed = true;
      targetScale *= 0.8;
    };
    const up = () => {
      pressed = false;
      targetScale /= 0.8;
    };

    const loop = () => {
      rx += (mx - rx) * 0.16;
      ry += (my - ry) * 0.16;
      scale += (targetScale - scale) * 0.18;
      dot.current!.style.transform = `translate3d(${mx}px, ${my}px, 0) translate(-50%, -50%)`;
      ring.current!.style.transform = `translate3d(${rx}px, ${ry}px, 0) translate(-50%, -50%) scale(${scale})`;
      raf = requestAnimationFrame(loop);
    };

    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("scroll", scroll, { passive: true });
    document.addEventListener("pointerleave", leave);
    window.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up);
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("scroll", scroll);
      document.removeEventListener("pointerleave", leave);
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
      document.documentElement.classList.remove("has-cursor");
    };
  }, []);

  return (
    <>
      <div
        ref={ring}
        aria-hidden
        data-theme="light"
        className="pointer-events-none fixed left-0 top-0 z-[200] grid h-9 w-9 place-items-center rounded-full border border-ink/50 opacity-0 transition-[opacity,background-color,border-color,width,height] duration-300 data-[label=true]:h-20 data-[label=true]:w-20 data-[label=true]:border-transparent data-[label=true]:bg-ink data-[theme=dark]:border-paper/70 data-[theme=dark]:data-[label=true]:bg-turmeric [&[data-theme=dark]>span]:text-ink"
      >
        <span ref={label} className="text-[10px] uppercase tracking-[0.2em] text-paper" />
      </div>
      <div
        ref={dot}
        aria-hidden
        data-theme="light"
        className="pointer-events-none fixed left-0 top-0 z-[201] h-2 w-2 rounded-full bg-turmeric opacity-0 mix-blend-multiply transition-[background-color] duration-300 data-[theme=dark]:bg-turmeric data-[theme=dark]:mix-blend-normal data-[theme=dark]:shadow-[0_0_0_2px_rgba(244,235,221,.35)]"
      />
    </>
  );
}
