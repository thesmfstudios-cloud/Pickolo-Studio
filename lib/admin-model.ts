export const adminTabs = [
  "overview",
  "bookings",
  "applications",
  "partners",
  "documents",
  "payouts",
  "support",
  "pricing",
  "activity",
] as const;
export type AdminTab = (typeof adminTabs)[number];
export const tabLabels: Record<AdminTab, string> = {
  overview: "Overview",
  bookings: "Bookings",
  applications: "Applications",
  partners: "Partners",
  documents: "Documents",
  payouts: "Payouts",
  support: "Support",
  pricing: "Pricing",
  activity: "Activity log",
};
export const statusOptions: Partial<Record<AdminTab, string[]>> = {
  bookings: [
    "REQUESTED",
    "PAYMENT_CONFIRMED",
    "SEARCHING_PARTNER",
    "PARTNER_ASSIGNED",
    "ON_THE_WAY",
    "SHOOT_STARTED",
    "SHOOT_COMPLETED",
    "DATA_PENDING",
    "DATA_SUBMITTED",
    "CUSTOMER_CONFIRMED",
    "PAYOUT_RELEASED",
    "COMPLETED",
    "CANCELLED",
    "REFUNDED",
    "DISPUTED",
  ],
  applications: ["pending", "approved", "rejected", "suspended"],
  partners: ["approved", "pending", "rejected", "suspended"],
  documents: ["pending", "approved", "rejected"],
  support: ["open", "under_review", "resolved", "rejected"],
  payouts: [
    "requesting",
    "pending",
    "queued",
    "processing",
    "processed",
    "released",
    "failed",
    "reversed",
    "rejected",
    "cancelled",
  ],
};
export function humanize(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (c) => c.toUpperCase());
}
export function money(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
      }).format(value / 100)
    : "—";
}
export function dateTime(value: unknown) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)))
    return "Not recorded";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}
export function maskUpi(value: unknown) {
  if (typeof value !== "string" || !value.includes("@")) return "Not saved";
  const [local, handle] = value.split("@");
  return `${local.slice(0, 2)}***@${handle}`;
}
export function queueParams(params: URLSearchParams) {
  const kind = params.get("kind") as AdminTab;
  if (!adminTabs.includes(kind) || kind === "overview")
    throw new Error("Invalid queue.");
  const rawPage = params.get("page") || "1";
  if (!/^\d+$/.test(rawPage) || Number(rawPage) < 1 || Number(rawPage) > 10000)
    throw new Error("Invalid page.");
  const status = params.get("status") || "";
  if (status && !statusOptions[kind]?.includes(status))
    throw new Error("Invalid status filter.");
  const search = (params.get("q") || "")
    .replace(/[^\p{L}\p{N}\s@._+-]/gu, "")
    .trim()
    .slice(0, 80);
  return { kind, page: Number(rawPage), status, search, pageSize: 20 };
}
export type AdminRecord = {
  id: string;
  status?: string;
  verification_status?: string;
  display_name?: string;
  phone?: string;
  applicant_id?: string;
  partner_id?: string;
  partner_code?: string;
  bio?: string;
  skills?: string[];
  payout_upi_id?: string;
  base_lat?: number;
  base_long?: number;
  created_at?: string;
  rejection_reason?: string;
  booking_id?: string;
  booking_code?: string;
  location_text?: string;
  scheduled_start?: string;
  duration_minutes?: number;
  assigned_partner_id?: string;
  customer_price_paise?: number;
  partner_payout_paise?: number;
  service?: { name?: string };
  service_level?: { name?: string };
  profile?: { full_name?: string; phone?: string };
  file_name?: string;
  document_type?: string;
  mime_type?: string;
  size_bytes?: number;
  signed_url?: string;
  reason_code?: string;
  description?: string;
  resolution?: string;
  amount_paise?: number;
  platform_fee_bps?: number;
  provider_payout_id?: string;
  released_at?: string;
  updated_at?: string;
  action?: string;
  entity_type?: string;
  entity_id?: string;
  actor_id?: string;
};
export type AdminMetrics = {
  bookings: {
    total: number;
    paid: number;
    active: number;
    completed: number;
    cancelled: number;
    completionRate: number;
  };
  money: {
    gmvPaise: number;
    platformRevenuePaise: number;
    partnerPayoutsPaise: number;
    payoutsReleasedPaise: number;
  };
  queues: {
    applications: number;
    documents: number;
    support: number;
    searching: number;
    payoutReady: number;
  };
  generatedAt: string;
};
export function validMetrics(value: unknown): value is AdminMetrics {
  if (!value || typeof value !== "object") return false;
  const v = value as AdminMetrics;
  const finite = (section: unknown, keys: string[]) =>
    !!section &&
    typeof section === "object" &&
    keys.every((key) => {
      const n = (section as Record<string, unknown>)[key];
      return typeof n === "number" && Number.isFinite(n) && n >= 0;
    });
  return (
    finite(v.bookings, [
      "total",
      "paid",
      "active",
      "completed",
      "cancelled",
      "completionRate",
    ]) &&
    finite(v.money, [
      "gmvPaise",
      "platformRevenuePaise",
      "partnerPayoutsPaise",
      "payoutsReleasedPaise",
    ]) &&
    finite(v.queues, [
      "applications",
      "documents",
      "support",
      "searching",
      "payoutReady",
    ]) &&
    typeof v.generatedAt === "string" &&
    Number.isFinite(Date.parse(v.generatedAt)) &&
    v.bookings.completionRate <= 1
  );
}
