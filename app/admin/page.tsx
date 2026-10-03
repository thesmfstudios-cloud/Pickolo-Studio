"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type Booking = {
  id: string;
  booking_code: string;
  status: string;
  scheduled_start: string;
  duration_minutes: number;
  location_text: string;
  customer_price_paise: number;
  assigned_partner_id: string | null;
  service?: { name?: string | null } | null;
  service_level?: { name?: string | null } | null;
};

type Application = {
  id: string;
  applicant_id: string;
  display_name: string;
  phone: string;
  status: string;
  skills: string[];
  bio?: string | null;
  base_lat?: number | null;
  base_long?: number | null;
  payout_upi_id?: string | null;
  created_at: string;
};

type Partner = {
  id: string;
  partner_code: string;
  verification_status: string;
  bio?: string | null;
  base_lat?: number | null;
  base_long?: number | null;
  payout_upi_id?: string | null;
  service_level?: { name?: string | null } | null;
};

type PartnerDocument = {
  id: string;
  partner_id: string | null;
  applicant_id: string | null;
  document_type: string;
  file_name: string;
  mime_type: string | null;
  status: string;
  rejection_reason: string | null;
  signed_url?: string | null;
  created_at: string;
};

type Dispute = {
  id: string;
  booking_id: string;
  reason_code: string;
  description: string;
  status: string;
  resolution: string | null;
  created_at: string;
};

type Metrics = {
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
};

type PriceConfig = {
  id: string;
  duration_minutes: number;
  amount_paise: number;
  platform_fee_bps: number;
  service_level?: { name?: string | null } | null;
};

function maskUpi(value: string | null | undefined) {
  if (!value) return "UPI missing";
  const [name, handle] = value.split("@");
  if (!handle) return "UPI saved";
  const visible = name.length > 2 ? name.slice(0, 2) : name.slice(0, 1);
  return `${visible}***@${handle}`;
}

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [pricing, setPricing] = useState<PriceConfig[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [documents, setDocuments] = useState<PartnerDocument[]>([]);
  const [message, setMessage] = useState("");
  const [savingPriceId, setSavingPriceId] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [reviews, setReviews] = useState<
    Record<string, { busy: boolean; error: boolean; text: string }>
  >({});
  const reviewLocks = useRef(new Set<string>());
  const [applicationNotice, setApplicationNotice] = useState("");
  const [documentNotice, setDocumentNotice] = useState("");
  const [applicationLoadError, setApplicationLoadError] = useState("");
  const [documentLoadError, setDocumentLoadError] = useState("");

  const token = useCallback(async () => {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }, []);

  const load = useCallback(async () => {
    const accessToken = await token();
    if (!accessToken) {
      window.location.href = "/admin/login";
      return;
    }

    const profile = await supabase!
      .from("profiles")
      .select("role")
      .eq("id", (await supabase!.auth.getUser()).data.user?.id ?? "")
      .single();
    if (profile.data?.role !== "admin") {
      window.location.href = "/admin/login";
      return;
    }

    setAuthorized(true);

    const headers = { Authorization: "Bearer " + accessToken };
    const [
      bookingRes,
      appRes,
      partnerRes,
      pricingRes,
      disputeRes,
      documentRes,
      metricsRes,
    ] = await Promise.all([
      fetch("/api/admin/bookings", { headers }),
      fetch("/api/admin/partners?status=pending", { headers }),
      fetch("/api/admin/partner-directory", { headers }),
      fetch("/api/admin/pricing", { headers }),
      fetch("/api/admin/disputes?status=open", { headers }),
      fetch("/api/admin/partner-documents", { headers, cache: "no-store" }),
      fetch("/api/admin/metrics", { headers }),
    ]);

    const [
      bookingData,
      appData,
      partnerData,
      pricingData,
      disputeData,
      documentData,
      metricsData,
    ] = await Promise.all([
      bookingRes.json().catch(() => ({})),
      appRes.json().catch(() => ({})),
      partnerRes.json().catch(() => ({})),
      pricingRes.json().catch(() => ({})),
      disputeRes.json().catch(() => ({})),
      documentRes.json().catch(() => ({})),
      metricsRes.json().catch(() => ({})),
    ]);

    if (!bookingRes.ok)
      setMessage(bookingData.error || "Unable to load bookings.");
    setApplicationLoadError(
      appRes.ok
        ? ""
        : appData.error || "Unable to load applications. Retry below.",
    );
    setDocumentLoadError(
      documentRes.ok
        ? ""
        : documentData.error || "Unable to load documents. Retry below.",
    );
    setBookings(bookingData.bookings || []);
    setApplications(appData.applications || []);
    setPartners(partnerData.partners || []);
    setPricing(pricingData.pricing || []);
    setDisputes(disputeData.disputes || []);
    setDocuments(documentData.documents || []);
    setMetrics(
      metricsRes.ok && metricsData.money && metricsData.bookings
        ? metricsData
        : null,
    );
    setLoading(false);
  }, [token]);

  useEffect(() => {
    load().catch(() => {
      setMessage(
        "Unable to load operations. Check your connection and refresh.",
      );
      setLoading(false);
    });
  }, [load]);

  async function verifyApplication(id: string, action: "approve" | "reject") {
    await saveReview("application", id, action);
  }

  async function saveReview(
    kind: "application" | "document",
    id: string,
    action: string,
  ) {
    const key = kind + ":" + id;
    if (reviewLocks.current.has(key)) return;
    reviewLocks.current.add(key);
    setReviews((items) => ({
      ...items,
      [key]: { busy: true, error: false, text: "Saving review…" },
    }));
    try {
      const accessToken = await token();
      if (!accessToken)
        throw new Error("Session expired. Sign in again to save this review.");
      const expected =
        kind === "application"
          ? applications.find((a) => a.id === id)?.status
          : documents.find((d) => d.id === id)?.status;
      const response = await fetch(
        kind === "application"
          ? "/api/admin/partners/" + id + "/verify"
          : "/api/admin/partner-documents",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + accessToken,
          },
          body: JSON.stringify({
            id,
            ...(kind === "application" ? { action } : { status: action }),
            expected_status: expected,
          }),
        },
      );
      const result = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          result.error || "Review could not be saved. Try again.",
        );
      if (!result[kind]?.status)
        throw new Error(
          "Review result could not be verified. Refresh before trying again.",
        );
      const label =
        kind === "application"
          ? applications.find((a) => a.id === id)?.display_name ||
            "Partner application"
          : documents.find((d) => d.id === id)?.file_name || "Document";
      const notice =
        label + ": " + result[kind].status + ". Saved successfully.";
      setReviews((items) => ({
        ...items,
        [key]: { busy: false, error: false, text: notice },
      }));
      if (kind === "application") {
        setApplicationNotice(notice);
        setApplications((items) => items.filter((a) => a.id !== id));
      } else {
        setDocumentNotice(notice);
        setDocuments((items) =>
          items.map((d) =>
            d.id === id ? { ...d, status: result.document.status } : d,
          ),
        );
      }
      try {
        await load();
      } catch {
        setMessage(
          "Review saved, but the list could not refresh. Refresh the page to see the latest status.",
        );
      }
    } catch (error) {
      setReviews((items) => ({
        ...items,
        [key]: {
          busy: false,
          error: true,
          text:
            error instanceof Error
              ? error.message
              : "Check your connection and try again.",
        },
      }));
    } finally {
      reviewLocks.current.delete(key);
    }
  }

  function reviewFeedback(kind: string, id: string) {
    const result = reviews[kind + ":" + id];
    return result ? (
      <p
        role={result.error ? "alert" : "status"}
        aria-live="polite"
        style={{
          color: result.error ? "#b42318" : "#126044",
          margin: "12px 0 0",
          overflowWrap: "anywhere",
        }}
      >
        {result.text}
      </p>
    ) : null;
  }

  async function savePrice(
    id: string,
    amountPaise: number,
    platformFeeBps: number,
  ) {
    const accessToken = await token();
    if (!accessToken) return;

    setSavingPriceId(id);
    const response = await fetch("/api/admin/pricing", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + accessToken,
      },
      body: JSON.stringify({
        id,
        amount_paise: amountPaise,
        platform_fee_bps: platformFeeBps,
      }),
    });

    const result = await response.json().catch(() => ({}));
    setSavingPriceId(null);

    if (!response.ok) {
      setMessage(result.error || "Unable to save pricing.");
      return;
    }

    await load();
  }

  async function assign(bookingId: string, partnerId: string) {
    const accessToken = await token();
    if (!accessToken || !partnerId) return;

    const response = await fetch("/api/admin/assignments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + accessToken,
      },
      body: JSON.stringify({ booking_id: bookingId, partner_id: partnerId }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(result.error || "Assignment failed.");
      return;
    }
    await load();
  }

  async function postAdmin(path: string, body?: Record<string, unknown>) {
    const accessToken = await token();
    if (!accessToken) return false;

    const response = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + accessToken,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(result.error || "Operation failed.");
      return false;
    }

    await load();
    return true;
  }

  async function logout() {
    await supabase?.auth.signOut();
    window.location.href = "/admin/login";
  }

  if (loading)
    return (
      <main className="main">
        <div className="container">
          <p className="muted">Loading operations...</p>
        </div>
      </main>
    );
  if (!authorized) return null;

  const pendingBookings = bookings.filter((item) =>
    ["REQUESTED", "PAYMENT_CONFIRMED", "SEARCHING_PARTNER"].includes(
      item.status,
    ),
  );
  const payoutReadyBookings = bookings.filter(
    (item) => item.status === "DATA_SUBMITTED",
  );

  return (
    <main className="main">
      <div className="container">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "end",
            gap: 20,
          }}
        >
          <div>
            <div className="kicker">Admin control room</div>
            <h1 style={{ fontSize: 48, margin: "8px 0 10px" }}>
              Pickolo operations
            </h1>
            <p className="muted">
              Bookings, partner verification, delivery and payout operations.
            </p>
          </div>
          <button className="button secondary" onClick={logout}>
            Logout
          </button>
        </div>

        <section className="card section">
          <strong>Payments · test mode only</strong>
          <p className="muted">Live partner payouts are paused. Sandbox tests never change bookings or earnings.</p>
          <a className="button secondary" href="/admin/payment-test">Open payment test</a>
        </section>

        {message && (
          <div className="card section">
            <strong>Attention</strong>
            <p className="muted">{message}</p>
          </div>
        )}

        <section className="grid section">
          <div className="card">
            <div className="stat">{pendingBookings.length}</div>
            <div className="muted">Needs operations</div>
          </div>
          <div className="card">
            <div className="stat">{applications.length}</div>
            <div className="muted">Pending partner applications</div>
          </div>
          <div className="card">
            <div className="stat">
              {
                partners.filter((p) => p.verification_status === "approved")
                  .length
              }
            </div>
            <div className="muted">Approved partners</div>
          </div>
          <div className="card">
            <div className="stat">{payoutReadyBookings.length}</div>
            <div className="muted">Payouts ready after backup</div>
          </div>
        </section>

        <section className="grid section">
          <div className="card">
            <div className="stat">
              ₹{((metrics?.money.gmvPaise ?? 0) / 100).toLocaleString()}
            </div>
            <div className="muted">GMV</div>
          </div>
          <div className="card">
            <div className="stat">
              ₹
              {(
                (metrics?.money.platformRevenuePaise ?? 0) / 100
              ).toLocaleString()}
            </div>
            <div className="muted">Platform revenue</div>
          </div>
          <div className="card">
            <div className="stat">
              {Math.round((metrics?.bookings.completionRate ?? 0) * 100)}%
            </div>
            <div className="muted">Completion rate</div>
          </div>
        </section>

        <section className="card section">
          <h2>Partner applications</h2>
          <p className="muted">
            Review the uploaded identity document first, then approve the
            application.
          </p>
          {applicationNotice && (
            <p role="status" style={{ color: "#126044" }}>
              {applicationNotice}
            </p>
          )}
          {applicationLoadError && (
            <p role="alert">
              {applicationLoadError}{" "}
              <button
                className="button secondary"
                onClick={() =>
                  load().catch(() =>
                    setApplicationLoadError(
                      "Unable to refresh. Check your connection.",
                    ),
                  )
                }
              >
                Retry
              </button>
            </p>
          )}
          {applications.length === 0 ? (
            <p className="muted">No pending applications.</p>
          ) : (
            applications.map((app) => (
              <div
                key={app.id}
                style={{
                  padding: "16px 0",
                  borderBottom: "1px solid var(--line)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 20,
                    alignItems: "start",
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <strong>{app.display_name}</strong>
                    <div className="muted">{app.phone}</div>
                    <div className="muted">
                      {app.skills?.join(", ") || "No skills listed"}
                    </div>
                    {app.bio && (
                      <div className="muted" style={{ marginTop: 6 }}>
                        {app.bio}
                      </div>
                    )}
                    {app.base_lat != null && app.base_long != null && (
                      <div className="muted" style={{ marginTop: 6 }}>
                        Base location: {Number(app.base_lat).toFixed(5)},{" "}
                        {Number(app.base_long).toFixed(5)}
                      </div>
                    )}
                    <div className="muted" style={{ marginTop: 6 }}>
                      Payout UPI: {maskUpi(app.payout_upi_id)}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      className="button"
                      disabled={reviews["application:" + app.id]?.busy}
                      onClick={() => verifyApplication(app.id, "approve")}
                    >
                      {reviews["application:" + app.id]?.busy
                        ? "Saving…"
                        : "Approve"}
                    </button>
                    <button
                      className="button secondary"
                      disabled={reviews["application:" + app.id]?.busy}
                      onClick={() => verifyApplication(app.id, "reject")}
                    >
                      Reject
                    </button>
                  </div>
                </div>
                {reviewFeedback("application", app.id)}
              </div>
            ))
          )}
        </section>

        <section className="card section">
          <h2>Approved partner directory</h2>
          <p className="muted">
            Use this list for assignment decisions and launch-radius checks.
          </p>
          {partners.filter(
            (partner) => partner.verification_status === "approved",
          ).length === 0 ? (
            <p className="muted">No approved partners yet.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Partner</th>
                  <th>Level</th>
                  <th>Status</th>
                  <th>UPI payout</th>
                  <th>Base location</th>
                </tr>
              </thead>
              <tbody>
                {partners
                  .filter(
                    (partner) => partner.verification_status === "approved",
                  )
                  .map((partner) => (
                    <tr key={partner.id}>
                      <td>
                        <strong>{partner.partner_code}</strong>
                        <div className="muted">
                          {partner.bio || "Profile details pending"}
                        </div>
                      </td>
                      <td>{partner.service_level?.name || "Standard"}</td>
                      <td>
                        <span className="badge">APPROVED</span>
                      </td>
                      <td>{maskUpi(partner.payout_upi_id)}</td>
                      <td>
                        {partner.base_lat != null && partner.base_long != null
                          ? `${Number(partner.base_lat).toFixed(5)}, ${Number(partner.base_long).toFixed(5)}`
                          : "Not set"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="card section">
          <h2>Verification documents</h2>
          {documentNotice && (
            <p role="status" style={{ color: "#126044" }}>
              {documentNotice}
            </p>
          )}
          {documentLoadError && (
            <p role="alert">
              {documentLoadError}{" "}
              <button
                className="button secondary"
                onClick={() =>
                  load().catch(() =>
                    setDocumentLoadError(
                      "Unable to refresh. Check your connection.",
                    ),
                  )
                }
              >
                Retry
              </button>
            </p>
          )}
          {documents.length === 0 ? (
            <p className="muted">No verification documents yet.</p>
          ) : (
            documents.map((doc) => (
              <div
                key={doc.id}
                style={{
                  padding: "16px 0",
                  borderBottom: "1px solid var(--line)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 20,
                    alignItems: "start",
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <strong>{doc.file_name}</strong>
                    <div className="muted">
                      {applications.find(
                        (a) =>
                          a.applicant_id ===
                          (doc.applicant_id || doc.partner_id),
                      )?.display_name || "Applicant"}{" "}
                      · {(doc.applicant_id || doc.partner_id)?.slice(0, 8)}
                    </div>
                    <span className="badge">{doc.status.toUpperCase()}</span>
                    <div className="muted">
                      {doc.document_type} · {doc.mime_type || "file"}
                    </div>
                    <div className="muted">
                      Submitted {new Date(doc.created_at).toLocaleString()}
                    </div>
                    {doc.signed_url && (
                      <a
                        className="button secondary"
                        style={{ marginTop: 8 }}
                        href={doc.signed_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Review file
                      </a>
                    )}
                    {!doc.signed_url && (
                      <p className="muted">
                        File unavailable. Ask the partner to upload again.
                      </p>
                    )}
                  </div>
                  {doc.status === "pending" && (
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        className="button"
                        disabled={
                          reviews["document:" + doc.id]?.busy || !doc.signed_url
                        }
                        onClick={() =>
                          saveReview("document", doc.id, "approved")
                        }
                      >
                        {reviews["document:" + doc.id]?.busy
                          ? "Saving…"
                          : "Approve"}
                      </button>
                      <button
                        className="button secondary"
                        disabled={reviews["document:" + doc.id]?.busy}
                        onClick={() =>
                          saveReview("document", doc.id, "rejected")
                        }
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
                {doc.rejection_reason && (
                  <p className="muted">{doc.rejection_reason}</p>
                )}
                {reviewFeedback("document", doc.id)}
              </div>
            ))
          )}
        </section>

        <section className="card section">
          <h2>Pricing configuration</h2>
          <p className="muted">
            Server-side prices used by new bookings. Values are in INR.
          </p>
          <table className="table">
            <thead>
              <tr>
                <th>Level</th>
                <th>Duration</th>
                <th>Customer price</th>
                <th>Platform fee</th>
              </tr>
            </thead>
            <tbody>
              {pricing.map((item) => (
                <tr key={item.id}>
                  <td>{item.service_level?.name || "—"}</td>
                  <td>{item.duration_minutes} min</td>
                  <td>
                    <div
                      style={{ display: "flex", gap: 8, alignItems: "center" }}
                    >
                      <input
                        className="input"
                        style={{ width: 110 }}
                        type="number"
                        min="100"
                        defaultValue={(item.amount_paise / 100).toFixed(0)}
                        id={"price-" + item.id}
                      />
                      <button
                        className="button secondary"
                        disabled={savingPriceId === item.id}
                        onClick={() => {
                          const el = document.getElementById(
                            "price-" + item.id,
                          ) as HTMLInputElement | null;
                          const rupees = Number(el?.value || 0);
                          savePrice(
                            item.id,
                            Math.round(rupees * 100),
                            item.platform_fee_bps,
                          );
                        }}
                      >
                        {savingPriceId === item.id ? "Saving..." : "Save"}
                      </button>
                    </div>
                  </td>
                  <td>
                    <input
                      className="input"
                      style={{ width: 90 }}
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      defaultValue={(item.platform_fee_bps / 100).toFixed(1)}
                      id={"fee-" + item.id}
                      onBlur={(e) => {
                        const fee = Number(e.target.value);
                        const el = document.getElementById(
                          "price-" + item.id,
                        ) as HTMLInputElement | null;
                        const rupees = Number(
                          el?.value || item.amount_paise / 100,
                        );
                        if (
                          Number.isFinite(fee) &&
                          Number.isFinite(rupees) &&
                          fee >= 0 &&
                          fee <= 100
                        ) {
                          savePrice(
                            item.id,
                            Math.round(rupees * 100),
                            Math.round(fee * 100),
                          );
                        }
                      }}
                    />
                    <span className="muted">%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="card section">
          <h2>Open support cases</h2>
          {disputes.length === 0 ? (
            <p className="muted">No open disputes.</p>
          ) : (
            disputes.map((dispute) => (
              <div
                key={dispute.id}
                style={{
                  padding: "16px 0",
                  borderBottom: "1px solid var(--line)",
                }}
              >
                <strong>{dispute.reason_code}</strong>
                <div className="muted">Booking {dispute.booking_id}</div>
                <p>{dispute.description}</p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    className="button secondary"
                    onClick={() =>
                      postAdmin("/api/admin/disputes", {
                        id: dispute.id,
                        status: "under_review",
                      })
                    }
                  >
                    Review
                  </button>
                  <button
                    className="button"
                    onClick={() =>
                      postAdmin("/api/admin/disputes", {
                        id: dispute.id,
                        status: "resolved",
                        resolution:
                          "Issue reviewed and resolved by Pickolo operations.",
                      })
                    }
                  >
                    Resolve
                  </button>
                  <button
                    className="button secondary"
                    onClick={() =>
                      postAdmin("/api/admin/disputes", {
                        id: dispute.id,
                        status: "rejected",
                        resolution:
                          "Case reviewed and rejected by Pickolo operations.",
                      })
                    }
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))
          )}
        </section>

        <section className="card section">
          <h2>Booking queue</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Booking</th>
                <th>Status</th>
                <th>Schedule</th>
                <th>Level</th>
                <th>Assignment</th>
                <th>Operations</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking) => (
                <tr key={booking.id}>
                  <td>
                    <strong>{booking.booking_code}</strong>
                    <div className="muted">{booking.location_text}</div>
                  </td>
                  <td>{booking.status}</td>
                  <td>{new Date(booking.scheduled_start).toLocaleString()}</td>
                  <td>{booking.service_level?.name || "—"}</td>
                  <td>
                    {booking.assigned_partner_id ? (
                      <span className="badge">ASSIGNED</span>
                    ) : (
                      <select
                        className="input"
                        style={{ minWidth: 220 }}
                        defaultValue=""
                        onChange={(e) => assign(booking.id, e.target.value)}
                      >
                        <option value="" disabled>
                          Assign partner...
                        </option>
                        {partners
                          .filter((p) => p.verification_status === "approved")
                          .map((partner) => (
                            <option key={partner.id} value={partner.id}>
                              {partner.partner_code} ·{" "}
                              {partner.service_level?.name || "Standard"}
                            </option>
                          ))}
                      </select>
                    )}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {booking.assigned_partner_id &&
                        ["PARTNER_ASSIGNED", "ON_THE_WAY"].includes(
                          booking.status,
                        ) && (
                          <button
                            className="button secondary"
                            onClick={() =>
                              postAdmin("/api/admin/no-show/" + booking.id, {
                                reason: "Partner no-show recorded by admin.",
                              })
                            }
                          >
                            No-show
                          </button>
                        )}
                      {["DATA_SUBMITTED", "CUSTOMER_CONFIRMED"].includes(
                        booking.status,
                      ) && (
                        <button
                          className="button"
                          disabled
                          title="Live payouts paused during testing. Use Payment test."
                        >
                          Live payout paused
                        </button>
                      )}
                      {booking.status === "PAYOUT_RELEASED" && (
                        <button
                          className="button"
                          onClick={() =>
                            postAdmin(
                              "/api/bookings/" + booking.id + "/transition",
                              { to_status: "COMPLETED" },
                            )
                          }
                        >
                          Complete booking
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
