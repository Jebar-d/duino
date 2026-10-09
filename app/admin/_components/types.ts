export type User = {
  id: string;
  email?: string | null;
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  is_admin?: boolean;
  role?: string;
};

export type Category = {
  id: string;
  name: string;
  slug: string;
};

export type Promo = {
  id: string;
  code: string;
  discount_percent: number;
  valid_from: string;
  valid_until: string;
  max_uses: number | null;
  used_count: number;
  is_free_shipping: boolean;
  min_order_cents: number;
  description: string | null;
};

export type Product = {
  id: string;
  name: string;
  slug: string;
  price_cents: number;
  stock: number;
  description?: string | null;
  img_url?: string | null;
  model_url?: string | null;
  category_id?: string | null;
  sku?: string | null;
  category_name?: string | null;
};

export type ProductVariant = {
  id?: string;
  product_id?: string;
  variant_name: string;
  option_value: string;
  price_adjustment: number;
  stock: number;
};

export type Order = {
  id: string;
  total_cents: number;
  status: string;
  created_at: string;
  payment_method?: string | null;
  user_id?: string | null;
  customer_email?: string | null;
};

export type DashboardData = {
  product_count: number;
  order_count: number;
  user_count: number;
  promo_count: number;
  revenue_cents: number;
  recent_orders: Order[];
};

export type AnalyticsData = {
  total_revenue_cents: number;
  month_revenue_cents: number;
  total_orders: number;
  paid_orders: number;
  pending_orders: number;
  cancelled_orders: number;
  monthly_revenue: {
    label: string;
    revenue_cents: number;
    order_count: number;
  }[];
  payment_methods: {
    method: string;
    count: number;
  }[];
  order_statuses: {
    status: string;
    count: number;
  }[];
  top_products: {
    name: string;
    img_url?: string | null;
    qty: number;
    revenue_cents: number;
  }[];
};

export type RawAnalytics = Partial<Omit<AnalyticsData, "monthly_revenue" | "top_products">> & {
  monthly_revenue?: {
    month?: string;
    label?: string;
    revenue_cents?: number;
    order_count?: number;
  }[];
  top_products?: {
    name?: string;
    product_name?: string;
    img_url?: string | null;
    qty?: number;
    units_sold?: number;
    revenue_cents?: number;
  }[];
};
export type Tab =
  | "dashboard"
  | "analytics"
  | "products"
  | "categories"
  | "promos"
  | "orders"
  | "users"
  | "messages"
  | "refunds"
  | "admins";


export type OrderItemDetail = {
  id: string;
  product_id: string | null;
  variant_id: string | null;
  qty: number;
  price_cents: number;
  product_name: string | null;
  product_img: string | null;
  subtotal_cents: number;
};

export type ShippingAddress = {
  first_name?: string;
  last_name?: string;
  contact_number?: string;
  address?: string;
  address_line?: string;
  city?: string;
  province?: string;
  postal_code?: string;
};

export type AdminOrder = {
  id: string;
  user_id: string | null;
  customer_email?: string | null;
  total_cents: number;
  payment_status: string;
  promo_code: string | null;
  status: string;
  shipping_address: ShippingAddress | null;
  created_at: string;
  shipping_method: string;
  payment_method: string;
  tracking_status: string;
  expected_delivery: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  notes: string | null;
  email_confirmed: boolean;
  items: OrderItemDetail[];
  item_count: number;
  history: { id?: string; status: string; note: string | null; created_at: string }[];
};

export type AdminOrderSummary = Pick<
  AdminOrder,
  | "id"
  | "total_cents"
  | "status"
  | "created_at"
  | "payment_method"
  | "payment_status"
  | "tracking_status"
  | "expected_delivery"
  | "shipping_method"
  | "customer_email"
  | "item_count"
> & {
  user_id: string | null;
};

export type RefundRequest = {
  id: string;
  order_id: string;
  user_id: string;
  reason: string | null;
  status: string;
  created_at: string;
  resolved_at: string | null;
  customer_email: string | null;
};

export type RefundOrder = {
  id: string;
  user_id: string | null;
  total_cents: number;
  status: string;
  shipping_address: string | null;
  created_at: string;
  shipping_method: string;
  payment_method: string;
  items: OrderItemDetail[];
};


export type AdminUser = {
  id: string;
  email: string;
  role: string;
  email_verified: boolean | number;
  created_at: string;
  is_disabled: boolean | number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  contact_number: string | null;
  order_count: number;
};

export type ContactMessage = {
  id: string;
  user_id: string | null;
  name: string;
  email: string;
  subject: string;
  message: string;
  is_handled: boolean | number;
  created_at: string;
};
