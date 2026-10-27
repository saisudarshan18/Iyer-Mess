"use client";

/**
 * One-shot confetti burst in sweet-shop colours (Magic UI "Confetti" idea,
 * no dependency). Pieces are little discs, diamonds and squiggles.
 */
export function fireConfetti(origin = { x: 0.5, y: 0.35 }) {
  if (typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const canvas = document.createElement("canvas");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  Object.assign(canvas.style, { position: "fixed", inset: "0", width: "100%", height: "100%", pointerEvents: "none", zIndex: "300" });
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);

  const colours = ["#d9a21b", "#c2362b", "#7a1f1f", "#3f5b2e", "#f0d58a", "#b08d57"];
  const pieces = Array.from({ length: 140 }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 6 + Math.random() * 9;
    return {
      x: origin.x * innerWidth,
      y: origin.y * innerHeight,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 6,
      r: 4 + Math.random() * 5,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      shape: Math.floor(Math.random() * 3),
      colour: colours[Math.floor(Math.random() * colours.length)],
    };
  });

  const start = performance.now();
  const frame = (now: number) => {
    const t = now - start;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of pieces) {
      p.vx *= 0.985;
      p.vy = p.vy * 0.985 + 0.32;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - t / 2600);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = ctx.strokeStyle = p.colour;
      if (p.shape === 0) {
        ctx.beginPath();
        ctx.arc(0, 0, p.r * 0.6, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === 1) {
        ctx.beginPath();
        ctx.moveTo(0, -p.r);
        ctx.lineTo(p.r * 0.7, 0);
        ctx.lineTo(0, p.r);
        ctx.lineTo(-p.r * 0.7, 0);
        ctx.fill();
      } else {
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(-p.r, 0);
        ctx.quadraticCurveTo(-p.r / 2, -p.r, 0, 0);
        ctx.quadraticCurveTo(p.r / 2, p.r, p.r, 0);
        ctx.stroke();
      }
      ctx.restore();
    }
    if (t < 2700) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}
