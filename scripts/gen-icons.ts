// Writes the favicon set from lib/kolam.ts markSvg(): app/icon.svg, app/apple-icon.png,
// app/favicon.ico (16/32/48 PNG-in-ICO), public/icon-512.png and the social card.  Run: node scripts/gen-icons.ts
import { writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { markSvg } from "../lib/kolam.ts";

const out = (p: string) => new URL(`../${p}`, import.meta.url);
writeFileSync(out("app/icon.svg"), markSvg({ size: 64 }));

const browser = await chromium.launch();
const page = await browser.newPage();

async function png(size: number, rounded = true) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${markSvg({ size, rounded })}</body></html>`);
  return page.locator("svg").screenshot({ omitBackground: true });
}

writeFileSync(out("app/apple-icon.png"), await png(180, false)); // iOS rounds the corners itself
writeFileSync(out("public/icon-512.png"), await png(512));

// ICO container holding PNG images (supported by every current browser)
const sizes = [16, 32, 48];
const images = await Promise.all(sizes.map((s) => png(s)));
const header = Buffer.alloc(6 + 16 * sizes.length);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
sizes.forEach((s, i) => {
  const e = 6 + i * 16;
  header.writeUInt8(s, e);
  header.writeUInt8(s, e + 1);
  header.writeUInt16LE(1, e + 4);
  header.writeUInt16LE(32, e + 6);
  header.writeUInt32LE(images[i].length, e + 8);
  header.writeUInt32LE(offset, e + 12);
  offset += images[i].length;
});
writeFileSync(out("app/favicon.ico"), Buffer.concat([header, ...images]));

// 1200×630 share card: seal + wordmark on paper
await page.setViewportSize({ width: 1200, height: 630 });
await page.setContent(`<html><head><link href="https://fonts.googleapis.com/css2?family=Literata:ital,opsz,wght@0,7..72,600;1,7..72,400&family=Noto+Serif+Tamil:wght@500&display=block" rel="stylesheet"></head>
<body style="margin:0;width:1200px;height:630px;background:#f4ebdd;display:flex;align-items:center;gap:56px;padding:0 96px;box-sizing:border-box;font-family:Literata,serif;color:#2a1a12">
${markSvg({ size: 260 })}
<div><div style="font-size:150px;font-weight:600;letter-spacing:-5px;line-height:.9">Iyer <i style="font-weight:400;color:#7a1f1f">Mess</i></div>
<div style="font-family:'Noto Serif Tamil';font-size:40px;color:#5b4636;margin-top:18px">ஐய்யர் மெஸ் · Sweets &amp; Savories</div></div></body></html>`);
await page.waitForTimeout(1500);
writeFileSync(out("app/opengraph-image.png"), await page.screenshot());

await browser.close();
console.log("icons written");
