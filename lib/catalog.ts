/**
 * Seed catalog. This is the single source for supabase/seed.sql
 * (regenerate with `node scripts/gen-seed.ts`) and the fallback the
 * storefront renders when no database is connected yet.
 *
 * Prices are per kg. Ids are fixed so combos can reference products.
 */
import type { Category, Combo, Product, Settings } from "./types";

// n is fixed per product (it becomes the uuid), so reordering the lists never changes ids
type SeedProduct = [n: number, slug: string, en: string, ta: string, category: Category, perKg: number];

const SWEETS: SeedProduct[] = [
  [1, "laddu", "Laddu", "லட்டு", "sweet", 600],
  [2, "jangiri", "Jangiri", "ஜாங்கிரி", "sweet", 650],
  [3, "oil-mysore-pak", "Oil Mysore Pak", "எண்ணெய் மைசூர் பாக்", "sweet", 600],
  [4, "badhusha", "Badhusha", "பாதுஷா", "sweet", 600],
  [5, "cashewnut-cake", "Cashewnut Cake", "முந்திரி கேக்", "sweet", 1200],
  [6, "makanbeda", "Makanbeda", "மக்கன் பேடா", "sweet", 650],
  [7, "adhirasam", "Adhirasam", "அதிரசம்", "sweet", 600],
  [8, "bombay-kaju", "Bombay Kaju", "பாம்பே காஜு", "sweet", 600],
  [9, "ghee-mysore-pak", "Ghee Mysore Pak", "நெய் மைசூர் பாக்", "sweet", 800],
  [10, "legiyam", "Legiyam", "லேகியம்", "sweet", 1500],
  [19, "ravaladdu", "Rava Laddu", "ரவா லட்டு", "sweet", 650],
  [20, "somas", "Somas", "சோமாஸ்", "sweet", 650],
];

const SAVORIES: SeedProduct[] = [
  [11, "mullu-murukku", "Mullu Murukku", "முள்ளு முறுக்கு", "savory", 650],
  [12, "thenkuzhal", "Thenkuzhal", "தேன்குழல்", "savory", 650],
  [13, "kai-murukku", "Kai Murukku", "கை முறுக்கு", "savory", 650],
  [14, "thattai", "Thattai", "தட்டை", "savory", 650],
  [15, "ribbon", "Ribbon Pakoda", "ரிப்பன் பக்கோடா", "savory", 650],
  [16, "mixer", "Mixture", "மிக்சர்", "savory", 650],
  [17, "spl-mixer", "Special Mixture", "ஸ்பெஷல் மிக்சர்", "savory", 800],
  [18, "omapodi", "Omapodi", "ஓமப்பொடி", "savory", 650],
];

// Deterministic uuids: products 0000…01xx, combos 0000…02xx
const pid = (n: number) => `00000000-0000-4000-8000-0000000001${String(n).padStart(2, "0")}`;
const cid = (n: number) => `00000000-0000-4000-8000-0000000002${String(n).padStart(2, "0")}`;

export const SEED_PRODUCTS: Product[] = [...SWEETS, ...SAVORIES].map(([n, slug, en, ta, category, perKg], i) => ({
  id: pid(n),
  slug,
  name_en: en,
  name_ta: ta,
  category,
  price_per_kg: perKg,
  image: null,
  description_en: null,
  description_ta: null,
  sell_sizes: [250, 500, 1000],
  low_stock_g: 2000,
  active: true,
  sort: i + 1,
}));

const bySlug = (slug: string) => {
  const p = SEED_PRODUCTS.find((x) => x.slug === slug);
  if (!p) throw new Error(`unknown product ${slug}`);
  return p.id;
};

const combo = (n: number, price: number, items: [string, number][]): Combo => ({
  id: cid(n),
  slug: `combo-${n}`,
  name_en: `Combo ${n}`,
  name_ta: `காம்போ ${n}`,
  price,
  packing_charge: 20,
  image: null,
  boxed_stock: 0,
  low_stock_boxes: 5,
  active: true,
  sort: n,
  offer_label: null,
  offer_label_ta: null,
  items: items.map(([slug, grams]) => ({ product_id: bySlug(slug), grams })),
});

export const SEED_COMBOS: Combo[] = [
  combo(1, 630, [
    ["badhusha", 250],
    ["mixer", 250],
    ["thenkuzhal", 250],
    ["ghee-mysore-pak", 100],
    ["legiyam", 50],
  ]),
  combo(2, 1075, [
    ["legiyam", 50],
    ["badhusha", 250],
    ["mixer", 250],
    ["thenkuzhal", 250],
    ["ghee-mysore-pak", 100],
    ["cashewnut-cake", 100],
    ["ribbon", 200],
    ["thattai", 200],
    ["jangiri", 100],
  ]),
  combo(3, 1270, [
    ["legiyam", 50],
    ["badhusha", 250],
    ["mixer", 250],
    ["thenkuzhal", 250],
    ["ghee-mysore-pak", 100],
    ["cashewnut-cake", 100],
    ["ribbon", 250],
    ["thattai", 250],
    ["jangiri", 100],
    ["kai-murukku", 200],
  ]),
  {
    ...combo(4, 250, [
      ["bombay-kaju", 50],
      ["ghee-mysore-pak", 50],
      ["laddu", 50],
      ["badhusha", 50],
      ["jangiri", 50],
      ["spl-mixer", 250],
    ]),
    slug: "offer-sweets-mixture",
    name_en: "Assorted Sweets + Special Mixture",
    name_ta: "அசார்ட்டட் ஸ்வீட்ஸ் + ஸ்பெஷல் மிக்சர்",
    packing_charge: 0,
    sort: 0,
    offer_label: "Special offer",
    offer_label_ta: "சிறப்பு சலுகை",
  },
];

export const SEED_SETTINGS: Settings = {
  orders_open: true,
  closed_message_en: "We are not taking orders right now. Please check back soon.",
  closed_message_ta: "தற்போது ஆர்டர்கள் ஏற்கப்படவில்லை. விரைவில் மீண்டும் பார்க்கவும்.",
  shop_name: "Iyer Mess",
  shop_address: null,
  shop_phone: null,
  shop_lat: null,
  shop_lng: null,
  local_radius_km: 7,
  allowed_state: "Tamil Nadu",
  hold_minutes: 15,
  booking_days_ahead: 7,
  whatsapp_number: null,
  support_email: null,
  support_hours: null,
  socials: {},
  legal: {},
  process_media: {},
};
