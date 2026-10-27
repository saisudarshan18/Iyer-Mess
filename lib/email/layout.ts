/**
 * Branded email shell, styled like the website: cream paper, the seal + wordmark
 * lockup, small-caps "folio" labels, kolam ornaments and the dark footer with the big
 * "Iyer Mess" wordmark. Tables + inline styles only so Gmail, Outlook and Apple Mail
 * agree; brand type is pre-rendered PNG (public/email/, made by scripts/gen-email-assets.ts)
 * because email clients can't load web fonts or SVG.
 */

export const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export const C = {
  paper: "#f4ebdd",
  paper2: "#ece0cc",
  card: "#fbf6ec",
  ink: "#2a1a12",
  soft: "#5b4636",
  mute: "#8a7462",
  maroon: "#7a1f1f",
  turmeric: "#d9a21b",
  rule: "#e2d2b8",
  leaf: "#3f5b2e",
};

export const SERIF = "Literata, Georgia, 'Times New Roman', serif";
const MONO = "'SFMono-Regular', Menlo, Consolas, 'Courier New', monospace";

export type Shop = { name: string; address: string | null; phone: string | null; whatsapp: string | null; site: string };

/** Small-caps label, like the "CHAPTER II ───" folios on the site. */
export function folio(text: string) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px"><tr>
<td style="white-space:nowrap;padding-right:12px;font-family:${SERIF};font-size:11px;letter-spacing:3px;text-transform:uppercase;color:${C.soft}">${esc(text)}</td>
<td width="100%" style="border-bottom:1px solid ${C.rule};font-size:0;line-height:0">&nbsp;</td></tr></table>`;
}

export function button(href: string, label: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 6px"><tr>
<td style="border-radius:999px;background:${C.ink}">
<a href="${esc(href)}" style="display:inline-block;padding:15px 30px;font-family:${SERIF};font-size:16px;font-weight:600;color:${C.paper};text-decoration:none;border-radius:999px">${esc(label)} &nbsp;&rarr;</a>
</td></tr></table>`;
}

export function divider(site: string) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 18px"><tr><td align="center">
<img src="${site}/email/divider.png" width="420" height="24" alt="" style="display:block;width:100%;max-width:420px;height:auto;border:0">
</td></tr></table>`;
}

/**
 * The one-time code as six boxes, like the code inputs on the site, with the
 * plain number underneath so it can be selected and copied.
 */
export function codeBlock(code: string) {
  const cells = code
    .split("")
    .map(
      (d) =>
        `<td align="center" valign="middle" width="46" height="58" style="width:46px;height:58px;background:#ffffff;border:1px solid ${C.rule};border-bottom:3px solid ${C.turmeric};border-radius:12px;font-family:${MONO};font-size:28px;font-weight:700;color:${C.ink}">${esc(d)}</td>`,
    )
    .join(`<td width="8" style="width:8px;font-size:0">&nbsp;</td>`);
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 6px"><tr><td align="center" style="background:${C.paper};border-radius:20px;padding:22px 10px 16px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>${cells}</tr></table>
<div style="margin-top:12px;font-family:${SERIF};font-size:13px;color:${C.mute}">or copy &nbsp;<span style="font-family:${MONO};font-size:15px;letter-spacing:3px;color:${C.ink};-webkit-user-select:all;user-select:all">${esc(code)}</span></div>
</td></tr></table>`;
}

export function layout({ preheader, kicker, title, body, shop }: { preheader: string; kicker?: string; title: string; body: string; shop: Shop }) {
  const wa = shop.whatsapp ? `https://wa.me/91${shop.whatsapp.replace(/\D/g, "").slice(-10)}` : null;
  const tel = shop.phone ? `tel:+91${shop.phone.replace(/\D/g, "").slice(-10)}` : null;
  const link = (href: string, label: string) => `<a href="${esc(href)}" style="color:${C.paper};text-decoration:none;border-bottom:1px solid rgba(244,235,221,.35)">${esc(label)}</a>`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light">
<title>${esc(title)}</title>
<style>@media (max-width:480px){.px{padding-left:22px!important;padding-right:22px!important}.h1{font-size:28px!important}}</style>
</head>
<body style="margin:0;padding:0;background:${C.paper};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.paper}" style="background:${C.paper}"><tr><td align="center" style="padding:26px 12px 30px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:580px">

<!-- header: the site's lockup on paper -->
<tr><td class="px" style="padding:4px 30px 20px">
<a href="${shop.site}" style="text-decoration:none"><img src="${shop.site}/email/lockup.png" width="240" height="51" alt="Iyer Mess · ஐய்யர் மெஸ்" style="display:block;border:0;width:240px;height:auto;font-family:${SERIF};font-size:24px;color:${C.ink}"></a>
</td></tr>

<!-- card -->
<tr><td class="px" bgcolor="${C.card}" style="background:${C.card};border:1px solid ${C.rule};border-radius:28px;padding:34px 34px 30px;font-family:${SERIF};color:${C.ink};font-size:16px;line-height:1.65">
${kicker ? folio(kicker) : ""}
<h1 class="h1" style="margin:0 0 4px;font-family:${SERIF};font-size:34px;line-height:1.08;font-weight:600;letter-spacing:-0.8px;color:${C.ink}">${esc(title)}</h1>
${body}
</td></tr>

<!-- footer: dark band with the big wordmark, like the site -->
<tr><td style="padding-top:18px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.ink}" style="background:${C.ink};border-radius:28px"><tr><td class="px" style="padding:28px 30px 8px;font-family:${SERIF};color:${C.paper}">
<div style="font-size:24px;line-height:1.3;color:${C.turmeric}">மீண்டும் வருக</div>
<div style="margin-top:4px;font-size:13px;color:rgba(244,235,221,.65)">Made by hand, with care.</div>
<div style="margin-top:16px;font-size:13px;line-height:1.7;color:rgba(244,235,221,.8)">
${shop.address ? `${esc(shop.address)}<br>` : ""}
${[tel && shop.phone ? link(tel, shop.phone) : "", wa ? link(wa, "WhatsApp") : "", link(`${shop.site}/menu`, "Menu"), link(`${shop.site}/orders`, "My orders")].filter(Boolean).join(" &nbsp;·&nbsp; ")}
</div>
<img src="${shop.site}/email/footer-wordmark.png" width="420" height="102" alt="" style="display:block;border:0;width:100%;max-width:420px;height:auto;margin-top:18px">
</td></tr></table>
</td></tr>

<tr><td style="padding:16px 30px 0;font-family:${SERIF};font-size:11px;line-height:1.6;color:${C.mute};text-align:center">
You're receiving this because of your account or an order at ${esc(shop.site.replace(/^https?:\/\//, ""))}.
</td></tr>

</table></td></tr></table></body></html>`;
}
