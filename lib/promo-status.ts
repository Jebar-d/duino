export type PromoStatus = "active" | "scheduled" | "expired" | "used_up" | "unknown";

export type PromoStatusFields = {
  status?: string | null;
  is_expired?: boolean | null;
};

export function getPromoStatus(promo: PromoStatusFields): PromoStatus {
  if (promo.is_expired || promo.status === "expired") {
    return "expired";
  }

  switch (promo.status) {
    case "active":
    case "scheduled":
    case "used_up":
      return promo.status;
    default:
      return "unknown";
  }
}
