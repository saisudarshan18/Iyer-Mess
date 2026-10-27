import type { Metadata } from "next";

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const SITE_NAME = "Iyer Mess";
/** app/opengraph-image.png. Set explicitly: a page's own openGraph object would otherwise drop it. */
const DEFAULT_IMAGE = { url: "/opengraph-image.png", width: 1200, height: 630, alt: "Iyer Mess · Sweets & Savories", type: "image/png" };

const DEFAULT_DESC = "Traditional South Indian sweets, savories and gift boxes from Iyer Mess, Vellore. Local delivery within a day, courier across Tamil Nadu, or takeaway.";

/**
 * Title, description, canonical URL and the matching Open Graph / Twitter tags.
 * Pages with their own opengraph-image file (items, gift boxes) pass ownImage so that file is used instead.
 */
export function pageMeta({
  title,
  description = DEFAULT_DESC,
  path,
  ownImage = false,
}: { title?: string; description?: string; path?: string; ownImage?: boolean } = {}): Metadata {
  const full = title ? `${title} · ${SITE_NAME}` : `${SITE_NAME} · Sweets & Savories`;
  return {
    ...(title ? { title } : {}),
    description,
    ...(path ? { alternates: { canonical: path } } : {}),
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: "en_IN",
      alternateLocale: ["ta_IN"],
      ...(path ? { url: path } : {}),
      title: full,
      description,
      ...(ownImage ? {} : { images: [DEFAULT_IMAGE] }),
    },
    twitter: { card: "summary_large_image", title: full, description, ...(ownImage ? {} : { images: [DEFAULT_IMAGE.url] }) },
  };
}
