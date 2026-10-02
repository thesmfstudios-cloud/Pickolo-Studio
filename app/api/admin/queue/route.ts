import { NextRequest } from "next/server";
import {
  adminAccess,
  adminFailure,
  adminJson,
  AdminError,
} from "@/lib/admin-access";
import { queueParams } from "@/lib/admin-model";

const queues = {
  bookings: {
    table: "bookings",
    select:
      "id,booking_code,status,scheduled_start,duration_minutes,location_text,customer_price_paise,partner_payout_paise,assigned_partner_id,service:services(name),service_level:service_levels(name)",
    order: "scheduled_start",
    search: ["booking_code", "location_text"],
    status: "status",
  },
  applications: {
    table: "partner_applications",
    select:
      "id,applicant_id,display_name,phone,bio,skills,base_lat,base_long,payout_upi_id,status,created_at,rejection_reason",
    order: "created_at",
    search: ["display_name", "phone"],
    status: "status",
  },
  partners: {
    table: "partners",
    select:
      "id,partner_code,verification_status,bio,base_lat,base_long,payout_upi_id,service_level:service_levels(name),profile:profiles!partners_id_fkey(full_name,phone)",
    order: "partner_code",
    search: ["partner_code", "bio"],
    status: "verification_status",
  },
  documents: {
    table: "partner_verification_documents",
    select:
      "id,partner_id,applicant_id,document_type,file_name,mime_type,size_bytes,status,rejection_reason,created_at",
    order: "created_at",
    search: ["file_name", "document_type"],
    status: "status",
  },
  payouts: {
    table: "payouts",
    select:
      "id,booking_id,partner_id,amount_paise,status,provider_payout_id,created_at,released_at",
    order: "created_at",
    search: ["provider_payout_id"],
    status: "status",
  },
  support: {
    table: "booking_disputes",
    select:
      "id,booking_id,reason_code,description,status,resolution,created_at",
    order: "created_at",
    search: ["reason_code", "description"],
    status: "status",
  },
  pricing: {
    table: "service_level_prices",
    select:
      "id,duration_minutes,amount_paise,platform_fee_bps,updated_at,service_level:service_levels(name)",
    order: "duration_minutes",
    search: [],
    status: "active",
  },
  activity: {
    table: "admin_audit_log",
    select: "id,actor_id,action,entity_type,entity_id,created_at",
    order: "created_at",
    search: ["action", "entity_type"],
    status: "action",
  },
} as const;

export async function GET(request: NextRequest) {
  try {
    const { client } = await adminAccess(request);
    let input;
    try {
      input = queueParams(request.nextUrl.searchParams);
    } catch (e) {
      throw new AdminError(e instanceof Error ? e.message : "Invalid filters.");
    }
    const config: {
      table: string;
      select: string;
      order: string;
      search: readonly string[];
      status: string;
    } = queues[input.kind];
    let query = client
      .from(config.table)
      .select(config.select, { count: "exact" });
    if (input.status) query = query.eq(config.status, input.status);
    if (input.search && config.search.length)
      query = query.or(
        config.search
          .map((field) => `${field}.ilike.*${input.search}*`)
          .join(","),
      );
    const start = (input.page - 1) * input.pageSize;
    const { data, count, error } = await query
      .order(config.order, {
        ascending: input.kind === "pricing" || input.kind === "partners",
      })
      .order("id")
      .range(start, start + input.pageSize - 1);
    if (error || !Array.isArray(data) || typeof count !== "number")
      throw new AdminError("Unable to load this queue. Retry shortly.", 503);
    return adminJson({
      records: data,
      total: count,
      page: input.page,
      pageSize: input.pageSize,
    });
  } catch (error) {
    return adminFailure(error);
  }
}
