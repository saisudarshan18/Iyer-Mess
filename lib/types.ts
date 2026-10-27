export type Category = "sweet" | "savory";
export type Locale = "en" | "ta";

export type Product = {
  id: string;
  slug: string;
  name_en: string;
  name_ta: string;
  category: Category;
  price_per_kg: number;
  image: string | null;
  description_en: string | null;
  description_ta: string | null;
  sell_sizes: number[];
  low_stock_g: number;
  active: boolean;
  sort: number;
};

export type ComboItem = { product_id: string; grams: number };

export type Combo = {
  id: string;
  slug: string;
  name_en: string;
  name_ta: string;
  price: number;
  packing_charge: number;
  image: string | null;
  boxed_stock: number;
  low_stock_boxes: number;
  active: boolean;
  sort: number;
  /** Set when the combo is a promotional offer; it's then showcased on its own. */
  offer_label: string | null;
  offer_label_ta: string | null;
  items: ComboItem[];
};

export type Settings = {
  orders_open: boolean;
  closed_message_en: string | null;
  closed_message_ta: string | null;
  shop_name: string;
  shop_address: string | null;
  shop_phone: string | null;
  shop_lat: number | null;
  shop_lng: number | null;
  local_radius_km: number;
  allowed_state: string;
  hold_minutes: number;
  booking_days_ahead: number;
  whatsapp_number: string | null;
  support_email: string | null;
  support_hours: string | null;
  socials: Partial<Record<SocialKey, string>>;
  legal: Partial<Record<"legal_name" | "fssai" | "grievance_name" | "grievance_email" | "refund_policy" | "jurisdiction", string>>;
  process_media: Partial<Record<"1" | "2" | "3" | "4", { type: "image" | "video"; url: string }>>;
};

export type SocialKey = "instagram" | "facebook" | "youtube" | "google" | "x";

export type AddressLabel = "home" | "work" | "other";
export type SavedAddress = {
  id: string;
  label: AddressLabel;
  line: string;
  landmark: string | null;
  lat: number;
  lng: number;
  place_id: string | null;
  is_default: boolean;
};

export type DeliverySlab = {
  id: string;
  from_km: number;
  to_km: number | null;
  fee: number;
  eta_label_en: string;
  eta_label_ta: string | null;
  active: boolean;
};

export type TimeSlot = {
  id: string;
  label: string;
  start_time: string;
  end_time: string;
  capacity: number;
  days_of_week: number[];
  applies_to: ("takeaway" | "delivery_local")[];
  active: boolean;
};

/** product_id → grams in stock; combo_id → boxes available (boxed + buildable) */
export type StockMap = {
  products: Record<string, number>;
  combos: Record<string, { boxed: number; buildable: number }>;
};

export type Storefront = {
  products: Product[];
  combos: Combo[];
  settings: Settings;
  stock: StockMap | null; // null when no database is connected
  live: boolean;
};

export type PaymentMode = "cash" | "upi_online" | "upi_on_delivery" | "upi_counter";
export type Fulfilment = "delivery_local" | "courier" | "takeaway" | "counter";
export type OrderStatus =
  | "pending_payment"
  | "confirmed"
  | "preparing"
  | "ready"
  | "out_for_delivery"
  | "shipped"
  | "completed"
  | "cancelled";

export type Order = {
  id: string;
  short_code: string;
  channel: "online" | "walkin";
  fulfilment: Fulfilment;
  user_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  address: { line?: string; landmark?: string; lat?: number; lng?: number; pincode?: string; district?: string; state?: string } | null;
  distance_km: number | null;
  delivery_fee: number;
  slot_date: string | null;
  slot_id: string | null;
  slot_label: string | null;
  subtotal: number;
  packing: number;
  total: number;
  payment_mode: PaymentMode;
  payment_status: "unpaid" | "paid" | "refunded" | "failed";
  razorpay_order_id: string | null;
  status: OrderStatus;
  hold_expires_at: string | null;
  tracking_no: string | null;
  courier_name: string | null;
  needs_attention: boolean;
  notes: string | null;
  created_at: string;
};

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string | null;
  combo_id: string | null;
  name_en: string;
  name_ta: string | null;
  grams: number | null;
  qty: number;
  unit_price: number;
  line_total: number;
};

export type CourierRequestStatus = "requested" | "quoted" | "accepted" | "declined" | "rejected";

/** A delivery beyond the local radius, waiting for (or holding) the shop's courier charge. */
export type CourierRequest = {
  id: string;
  short_code: string;
  user_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  items: ({ type: "product"; id: string; grams: number; qty: number } | { type: "combo"; id: string; qty: number })[];
  address: { line: string; landmark?: string; lat: number; lng: number; place_id?: string; pincode?: string | null; district?: string | null; state?: string | null };
  distance_km: number | null;
  weight_g: number;
  subtotal: number;
  packing: number;
  notes: string | null;
  status: CourierRequestStatus;
  courier_fee: number | null;
  courier_name: string | null;
  shop_note: string | null;
  quoted_at: string | null;
  order_id: string | null;
  created_at: string;
};

export type CartLine =
  | { key: string; type: "product"; id: string; grams: number; qty: number }
  | { key: string; type: "combo"; id: string; qty: number };
