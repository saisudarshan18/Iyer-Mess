// Renders the brand images used in emails (email clients can't load web fonts or SVG).
// Writes public/email/*.png at 2x.  Run: node scripts/gen-email-assets.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { epitrochoid, markSvg } from "../lib/kolam.ts";

const out = new URL("../public/email/", import.meta.url);
mkdirSync(out, { recursive: true });

const FONTS = `<link href="https://fonts.googleapis.com/css2?family=Literata:ital,opsz,wght@0,7..72,600;1,7..72,400&family=Noto+Serif+Tamil:wght@500&display=block" rel="stylesheet">`;
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });

async function shot(name: string, w: number, h: number, body: string, transparent = true) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<html><head>${FONTS}<style>html,body{margin:0;background:transparent}*{box-sizing:border-box}</style></head><body>${body}</body></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  writeFileSync(new URL(name, out), await page.screenshot({ omitBackground: transparent, clip: { x: 0, y: 0, width: w, height: h } }));
}

// header lockup: seal + "Iyer Mess" + Tamil, exactly like the site header
await shot(
  "lockup.png",
  300,
  64,
  `<div style="display:flex;align-items:center;gap:12px;height:64px;font-family:Literata,serif;color:#2a1a12">
    <div style="width:46px;height:46px;border-radius:12px;overflow:hidden;box-shadow:0 4px 10px rgba(122,31,31,.25)">${markSvg({ size: 46 })}</div>
    <div><div style="font-size:30px;font-weight:600;letter-spacing:-1px;line-height:1;font-variation-settings:'opsz' 72">Iyer <i style="font-weight:400;color:#7a1f1f">Mess</i></div>
    <div style="font-family:'Noto Serif Tamil';font-size:12px;color:#5b4636;margin-top:4px">ஐய்யர் மெஸ் · Sweets &amp; Savories</div></div></div>`,
);

// kolam divider: a row of single-line knots with pulli dots between
const knot = (cx: number) => `<path d="${epitrochoid(cx, 16, 4, 1, 2.2, 1.9, 200)}" fill="none" stroke="#d9a21b" stroke-width="1.4"/><circle cx="${cx}" cy="16" r="1.6" fill="#d9a21b"/>`;
const knots = [70, 175, 280, 385, 490].map(knot).join("");
const dots = Array.from({ length: 24 }, (_, i) => 22 + i * 22).filter((x) => ![70, 175, 280, 385, 490].some((k) => Math.abs(k - x) < 18)).map((x) => `<circle cx="${x}" cy="16" r="1.4" fill="#b08d57" opacity=".6"/>`).join("");
await shot("divider.png", 560, 32, `<svg xmlns="http://www.w3.org/2000/svg" width="560" height="32" viewBox="0 0 560 32">${dots}${knots}</svg>`);

// footer wordmark, like the giant "Iyer Mess" at the bottom of the site
await shot(
  "footer-wordmark.png",
  560,
  136,
  `<div style="font-family:Literata,serif;font-variation-settings:'opsz' 72;font-size:104px;line-height:112px;font-weight:600;letter-spacing:-4px;color:#f4ebdd;white-space:nowrap;padding-left:2px">Iyer <i style="font-weight:400;color:#d9a21b;letter-spacing:-5px">Mess</i></div>`,
);

// a corner kolam watermark for the top of the card
await shot(
  "kolam-corner.png",
  220,
  220,
  `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220" viewBox="0 0 220 220"><g fill="none" stroke="#b08d57" stroke-width="1.1" opacity=".55">
    <path d="${epitrochoid(110, 110, 8, 1, 2.4, 9.2, 700)}"/><circle cx="110" cy="110" r="104" stroke-dasharray="1 7"/></g></svg>`,
);

await browser.close();
console.log("email assets written to public/email/");
