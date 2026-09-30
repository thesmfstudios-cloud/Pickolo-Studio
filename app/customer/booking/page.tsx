"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { customerApi } from "@/lib/customer-api";
import { elapsedSeconds, rupees, timerText } from "@/lib/customer";
import Icon from "@/components/customer-icon";
type Booking = {
  id: string;
  booking_code: string;
  status: string;
  scheduled_start: string;
  duration_minutes: number;
  location_text: string;
  customer_price_paise: number;
  payment_timing?: "upfront" | "after_shoot";
  customer_review?: { rating: number; comment?: string };
  dispute?: { status: string; resolution?: string };
  shoot_started_at?: string;
  shoot_completed_at?: string;
  booking_otp?: string;
  assigned_partner?: {
    name: string;
    bio?: string;
    avatar_url?: string;
    verified?: boolean;
    rating?: number;
    completed_jobs?: number;
    portfolio?: { id: string; image_url: string; caption?: string }[];
  };
  service?: { name: string };
  service_level?: { name: string };
  payment?: {
    status: string;
    provider_payment_id?: string;
    captured_at?: string;
  };
};
type Asset = { id: string; file_name: string; signed_url: string };
declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, handler: () => void) => void;
    };
  }
}
const stages = [
  ["REQUESTED", "Payment pending"],
  ["SEARCHING_PARTNER", "Finding your professional"],
  ["PARTNER_ASSIGNED", "Professional assigned"],
  ["ON_THE_WAY", "On the way"],
  ["SHOOT_STARTED", "Shoot in progress"],
  ["SHOOT_COMPLETED", "Shoot complete"],
  ["DATA_SUBMITTED", "Your files are ready"],
  ["COMPLETED", "All wrapped up"],
];
const stageOf = (s: string) =>
  ({
    PAYMENT_CONFIRMED: 1,
    DATA_PENDING: 5,
    CUSTOMER_CONFIRMED: 7,
    PAYOUT_RELEASED: 7,
  })[s] ?? stages.findIndex(([key]) => key === s);
async function checkoutScript() {
  if (window.Razorpay) return;
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve();
    s.onerror = () => {
      s.remove();
      reject(
        new Error(
          "Payment could not load. Please check your connection and retry.",
        ),
      );
    };
    document.body.appendChild(s);
  });
  if (!window.Razorpay) throw new Error("Payment could not load.");
}
export default function BookingPage() {
  const [id, setId] = useState("");
  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [assets, setAssets] = useState<Asset[]>([]);
  const [verificationPending, setVerificationPending] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [reason, setReason] = useState("missing_files");
  const [issue, setIssue] = useState("");
  useEffect(() => {
    const key = new URLSearchParams(window.location.search).get("id");
    if (key) {
      setId(key);
      setVerificationPending(
        !!sessionStorage.getItem("pickolo-payment-" + key),
      );
    } else setError("No booking selected. Open My bookings.");
  }, []);
  const load = useCallback(async () => {
    if (!id) return;
    try {
      const r = await customerApi("/api/bookings/" + encodeURIComponent(id));
      setBooking(r.booking);
      if (r.booking.customer_review) setReviewed(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load booking.");
    }
  }, [id]);
  useEffect(() => {
    load();
    const interval = setInterval(() => {
      if (!document.hidden) load();
    }, 15000);
    return () => clearInterval(interval);
  }, [load]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  async function pay() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (verificationPending) {
        await retryVerification();
        return;
      }
      const order = await customerApi("/api/payments/order/" + id, {});
      if (order.alreadyPaid) {
        sessionStorage.removeItem("pickolo-payment-" + id);
        setVerificationPending(false);
        setNotice("Your previous payment has been verified.");
        await load();
        setBusy(false);
        return;
      }
      await checkoutScript();
      const checkout = new window.Razorpay!({
        key: order.keyId,
        amount: order.amountPaise,
        currency: order.currency,
        order_id: order.orderId,
        name: "Pickolo Studio",
        description: "Your local creative, booked.",
        theme: { color: "#294f3b" },
        modal: {
          ondismiss: () => {
            setBusy(false);
            setNotice(
              "Payment was closed. You can safely retry from this booking.",
            );
            load();
          },
        },
        handler: async (result: unknown) => {
          try {
            sessionStorage.setItem(
              "pickolo-payment-" + id,
              JSON.stringify(result),
            );
            setVerificationPending(true);
            await customerApi("/api/payments/verify/" + id, result);
            sessionStorage.removeItem("pickolo-payment-" + id);
            setVerificationPending(false);
            setNotice("Payment received. Your booking is confirmed.");
            await load();
          } catch (e) {
            setError(
              e instanceof Error
                ? e.message
                : "Verification is pending. Refresh this booking before retrying payment.",
            );
          } finally {
            setBusy(false);
          }
        },
      });
      checkout.on("payment.failed", () => {
        setBusy(false);
        setError("Payment failed. You can retry securely.");
      });
      checkout.open();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment unavailable.");
      setBusy(false);
    }
  }
  async function retryVerification() {
    setBusy(true);
    setError("");
    try {
      const saved = sessionStorage.getItem("pickolo-payment-" + id);
      if (!saved)
        throw new Error(
          "Payment result is unavailable. Contact support with your payment receipt.",
        );
      await customerApi("/api/payments/verify/" + id, JSON.parse(saved));
      sessionStorage.removeItem("pickolo-payment-" + id);
      setVerificationPending(false);
      setNotice("Payment received and verified.");
      await load();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Verification is pending. Please retry verification.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function payAfterShoot() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await customerApi("/api/bookings/" + id + "/pay-after-shoot", {});
      setNotice("Pay-after-shoot selected. We are finding your professional.");
      await load();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to select pay after shoot.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function action(path: string, body: unknown = {}) {
    setBusy(true);
    setError("");
    try {
      await customerApi("/api/" + path, body);
      setNotice("Your booking has been updated.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  async function delivery() {
    setBusy(true);
    try {
      const r = await customerApi("/api/bookings/" + id + "/delivery");
      setAssets(r.assets);
      if (!r.assets.length)
        setNotice("Your files are being prepared. Please check again shortly.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load files.");
    } finally {
      setBusy(false);
    }
  }
  const stage = booking ? stageOf(booking.status) : -1;
  return (
    <main className="customer-main">
      <div className="customer-wrap">
        <div className="customer-top">
          <Link href="/customer/bookings">← My bookings</Link>
          <Link href="/customer">New shoot ↗</Link>
        </div>
        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="notice" role="status">
            {notice}
          </p>
        )}
        {!booking ? (
          <section className="booking-card" style={{ marginTop: 30 }}>
            <h1>{error ? "Booking unavailable" : "Loading your booking…"}</h1>
            <button className="text-button" onClick={load}>
              Retry
            </button>
          </section>
        ) : (
          <>
            <div className="customer-heading">
              <span className="eyebrow">{booking.booking_code}</span>
              <h1>
                {stage === 0
                  ? "One last step."
                  : stage < 0
                    ? "Your booking update."
                    : stage < 4
                      ? "You’re on the list."
                      : stage === 4
                        ? "Enjoy your moment."
                        : "Memories, made."}
              </h1>
              <span className="status-pill">
                {stage >= 0
                  ? stages[stage][1]
                  : booking.status.replaceAll("_", " ").toLowerCase()}
              </span>
            </div>
            <div className="track-grid">
              <div className="booking-sections">
                {stage === 0 ? (
                  <section className="booking-card">
                    <h2>
                      {verificationPending
                        ? "Verify your payment."
                        : "Choose when to pay."}
                    </h2>
                    <p className="helper">
                      We’ll start finding your professional after your payment
                      is verified.
                    </p>
                    <div className="total-price">
                      {rupees(booking.customer_price_paise)}
                    </div>
                    <p className="helper">
                      UPI, cards and supported payment methods via Razorpay.
                    </p>
                    <button
                      className="customer-primary"
                      disabled={busy}
                      onClick={pay}
                    >
                      {busy
                        ? "Processing…"
                        : verificationPending
                          ? "Retry payment verification"
                          : "Pay " +
                            rupees(booking.customer_price_paise) +
                            " →"}
                    </button>
                    <button
                      className="text-button"
                      disabled={busy || verificationPending}
                      onClick={payAfterShoot}
                    >
                      Pay after shoot →
                    </button>
                    <p className="helper">
                      Choose this to pay after your shoot is complete.
                    </p>
                    <p className="helper">
                      See our{" "}
                      <Link href="/refund-policy">
                        cancellation and refund policy
                      </Link>
                      .
                    </p>
                  </section>
                ) : stage > 0 && stage < 4 ? (
                  <section className="booking-card">
                    <h2>
                      {booking.assigned_partner
                        ? "Meet your professional."
                        : "Finding your perfect match."}
                    </h2>
                    {booking.assigned_partner ? (
                      <>
                        <h3>{booking.assigned_partner.name}</h3>
                        {booking.assigned_partner.avatar_url && (
                          <img
                            src={booking.assigned_partner.avatar_url}
                            alt="Your creator"
                            style={{
                              width: 64,
                              height: 64,
                              borderRadius: 32,
                              objectFit: "cover",
                            }}
                          />
                        )}
                        <p className="helper">
                          {booking.assigned_partner.bio ||
                            "Your local Pickolo professional."}
                        </p>
                        <span className="status-pill">Assignment accepted</span>
                        <p className="helper">
                          {booking.assigned_partner.verified
                            ? "Verified creator"
                            : ""}
                          {booking.assigned_partner.rating
                            ? " · " + booking.assigned_partner.rating + " ★"
                            : ""}
                          {booking.assigned_partner.completed_jobs
                            ? " · " +
                              booking.assigned_partner.completed_jobs +
                              " completed shoots"
                            : ""}
                        </p>
                        <div
                          style={{ display: "flex", gap: 8, overflowX: "auto" }}
                        >
                          {booking.assigned_partner.portfolio?.map((p) => (
                            <img
                              key={p.id}
                              src={p.image_url}
                              alt={p.caption || "Creator portfolio"}
                              style={{
                                width: 100,
                                height: 90,
                                borderRadius: 12,
                                objectFit: "cover",
                              }}
                            />
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="helper">
                        We’re checking local availability. Your professional’s
                        profile appears here once they accept. This screen
                        updates automatically.
                      </p>
                    )}
                    {booking.booking_otp && (
                      <>
                        <hr />
                        <p className="helper">SHOOT START CODE</p>
                        <div
                          className="shoot-timer"
                          aria-label={"Booking OTP " + booking.booking_otp}
                        >
                          {booking.booking_otp}
                        </div>
                        <p className="helper">
                          Share this code only when your professional arrives
                          and you’re ready to start. Your timer starts after
                          they verify it.
                        </p>
                      </>
                    )}
                  </section>
                ) : null}
                {booking.payment_timing === "after_shoot" &&
                  booking.payment?.status !== "captured" &&
                  stage > 0 && (
                    <section className="booking-card">
                      <span className="status-pill">Pay after shoot</span>
                      <h2 style={{ marginTop: 16 }}>
                        {stage >= 5
                          ? "Your payment is due."
                          : "You’re booked. Pay after your shoot."}
                      </h2>
                      <p className="helper">
                        {stage >= 5
                          ? "Complete payment to download your original files."
                          : "We’ll show your payment button here after the shoot ends."}
                      </p>
                      <div className="total-price">
                        {rupees(booking.customer_price_paise)}
                      </div>
                      {stage >= 5 && (
                        <button
                          className="customer-primary"
                          disabled={busy}
                          onClick={pay}
                        >
                          {busy
                            ? "Processing…"
                            : verificationPending
                              ? "Retry payment verification"
                              : "Pay securely →"}
                        </button>
                      )}
                    </section>
                  )}
                {booking.payment?.status === "captured" && (
                  <section className="booking-card">
                    <span className="status-pill">
                      <Icon name="check" size={12} /> Payment received
                    </span>
                    <h2 style={{ marginTop: 16 }}>
                      {rupees(booking.customer_price_paise)}
                    </h2>
                    <p className="helper">
                      {booking.payment.provider_payment_id}
                    </p>
                    {booking.payment.captured_at && (
                      <p className="helper">
                        {new Date(booking.payment.captured_at).toLocaleString(
                          "en-IN",
                          { timeZone: "Asia/Kolkata" },
                        )}{" "}
                        IST
                      </p>
                    )}
                  </section>
                )}
                {booking.shoot_started_at && (
                  <section className="booking-card">
                    <h2>
                      {booking.shoot_completed_at
                        ? "Your shoot is complete."
                        : "Your shoot is in progress."}
                    </h2>
                    <div className="shoot-timer">
                      {timerText(
                        elapsedSeconds(
                          booking.shoot_started_at,
                          booking.shoot_completed_at,
                          now,
                        ),
                      )}
                    </div>
                    <p className="helper">
                      {booking.duration_minutes / 60} hours booked ·{" "}
                      {booking.shoot_completed_at
                        ? "Final shoot time"
                        : "Elapsed shoot time"}
                    </p>
                    {!booking.shoot_completed_at &&
                      elapsedSeconds(booking.shoot_started_at, null, now) >=
                        booking.duration_minutes * 60 && (
                        <p className="notice">
                          Your booked time is complete. Please coordinate
                          wrapping up with your professional.
                        </p>
                      )}
                  </section>
                )}
                {stage >= 5 && (
                  <section className="booking-card">
                    <h2>
                      {stage >= 6
                        ? "Your originals, all together."
                        : "Your files are on their way."}
                    </h2>
                    <p className="helper">
                      Your partner hands over the originals on site. Download
                      the secure Pickolo backup and keep a copy.
                    </p>
                    {stage >= 6 && (
                      <button
                        className="customer-primary"
                        disabled={
                          busy || booking.payment?.status !== "captured"
                        }
                        onClick={delivery}
                      >
                        View delivered files
                      </button>
                    )}
                    {assets.map((a) => (
                      <a
                        className="booking-link text-button"
                        href={a.signed_url}
                        target="_blank"
                        rel="noreferrer"
                        key={a.id}
                      >
                        {a.file_name} ↗
                      </a>
                    ))}
                    {booking.status === "DATA_SUBMITTED" && (
                      <button
                        className="text-button"
                        disabled={
                          busy ||
                          !assets.length ||
                          booking.payment?.status !== "captured"
                        }
                        onClick={() => {
                          if (
                            window.confirm(
                              "Have you checked and received all delivered files?",
                            )
                          )
                            action("bookings/" + id + "/confirm-delivery");
                        }}
                      >
                        I’ve received all my files
                      </button>
                    )}
                  </section>
                )}
                {booking.status === "CANCELLED" &&
                  booking.payment?.status === "captured" && (
                    <section className="booking-card">
                      <h2>Payment received for this cancelled booking.</h2>
                      <button
                        className="customer-primary"
                        disabled={busy}
                        onClick={() => action("payments/refund/" + id)}
                      >
                        Request refund
                      </button>
                    </section>
                  )}
                <section className="booking-card">
                  <h2>Your booking</h2>
                  <dl className="summary-list">
                    <dt>Coverage</dt>
                    <dd>
                      {booking.service?.name} · {booking.service_level?.name}
                    </dd>
                    <dt>When</dt>
                    <dd>
                      {new Date(booking.scheduled_start).toLocaleString(
                        "en-IN",
                        {
                          timeZone: "Asia/Kolkata",
                          dateStyle: "medium",
                          timeStyle: "short",
                        },
                      )}{" "}
                      IST
                    </dd>
                    <dt>Duration</dt>
                    <dd>{booking.duration_minutes / 60} hours</dd>
                    <dt>Where</dt>
                    <dd>{booking.location_text}</dd>
                    <dt>Total</dt>
                    <dd>{rupees(booking.customer_price_paise)}</dd>
                  </dl>
                  {[
                    "REQUESTED",
                    "PAYMENT_CONFIRMED",
                    "SEARCHING_PARTNER",
                    "PARTNER_ASSIGNED",
                  ].includes(booking.status) && (
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() => {
                        if (
                          window.confirm(
                            "Cancel this booking? Refunds follow the cancellation policy.",
                          )
                        )
                          action("bookings/" + id + "/cancel", {
                            reason: "Customer requested cancellation.",
                          });
                      }}
                    >
                      Cancel booking
                    </button>
                  )}
                </section>
                {booking.status === "COMPLETED" && (
                  <section className="booking-card">
                    <h2>
                      {reviewed
                        ? "Thank you for sharing."
                        : "How was your shoot?"}
                    </h2>
                    {!reviewed && (
                      <>
                        <div
                          className="duration-row"
                          role="group"
                          aria-label="Rate your shoot"
                        >
                          {[1, 2, 3, 4, 5].map((n) => (
                            <button
                              key={n}
                              className={rating === n ? "selected" : ""}
                              aria-pressed={rating === n}
                              onClick={() => setRating(n)}
                            >
                              {n} ★
                            </button>
                          ))}
                        </div>
                        <textarea
                          className="input"
                          aria-label="Review comment"
                          maxLength={1000}
                          rows={3}
                          value={comment}
                          onChange={(e) => setComment(e.target.value)}
                          placeholder="Tell us about your experience"
                        />
                        <button
                          className="customer-primary"
                          disabled={busy}
                          onClick={async () => {
                            setBusy(true);
                            try {
                              await customerApi(
                                "/api/bookings/" + id + "/review",
                                { rating, comment },
                              );
                              setReviewed(true);
                              setNotice("Review submitted. Thank you!");
                            } catch (e) {
                              setError(
                                e instanceof Error
                                  ? e.message
                                  : "Review could not submit.",
                              );
                            } finally {
                              setBusy(false);
                            }
                          }}
                        >
                          Share review
                        </button>
                      </>
                    )}
                  </section>
                )}
                {[
                  "DATA_SUBMITTED",
                  "CUSTOMER_CONFIRMED",
                  "PAYOUT_RELEASED",
                  "COMPLETED",
                ].includes(booking.status) && (
                  <section className="booking-card">
                    <h2>
                      {booking.dispute
                        ? "Your support request"
                        : "Something isn’t right?"}
                    </h2>
                    {booking.dispute ? (
                      <>
                        <span className="status-pill">
                          {booking.dispute.status.replaceAll("_", " ")}
                        </span>
                        <p className="helper">
                          {booking.dispute.resolution ||
                            "SMF Studios will review your request."}
                        </p>
                      </>
                    ) : (
                      <details>
                        <summary>Report an issue with this shoot</summary>
                        <label className="field-label">
                          What happened?
                          <select
                            className="input"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                          >
                            <option value="missing_files">Missing files</option>
                            <option value="quality_concern">
                              Coverage concern
                            </option>
                            <option value="payment_issue">Payment issue</option>
                            <option value="other">Something else</option>
                          </select>
                        </label>
                        <textarea
                          className="input"
                          aria-label="Describe the issue"
                          rows={3}
                          maxLength={2000}
                          value={issue}
                          onChange={(e) => setIssue(e.target.value)}
                          placeholder="Tell us what happened"
                        />
                        <button
                          className="customer-primary"
                          disabled={busy || issue.trim().length < 3}
                          onClick={() =>
                            action("disputes", {
                              booking_id: id,
                              reason_code: reason,
                              description: issue,
                            })
                          }
                        >
                          Send support request
                        </button>
                      </details>
                    )}
                  </section>
                )}
                <Link className="text-button" href="/customer/help">
                  Need help with this booking? →
                </Link>
              </div>
              <section className="booking-card">
                <h2>From booking to memories.</h2>
                <ol className="tracking-list">
                  {stages.map(([key, label], i) => (
                    <li key={key} className={i <= stage ? "done" : ""}>
                      {i < stage ? "✓" : i === stage ? "●" : "○"} &nbsp; {label}
                    </li>
                  ))}
                </ol>
                <button className="text-button" onClick={load}>
                  Refresh status
                </button>
                <p className="helper">
                  Your professional confirms shoot start and completion. We keep
                  you updated here.
                </p>
              </section>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
