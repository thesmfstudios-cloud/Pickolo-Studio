"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { customerApi } from "@/lib/customer-api";
import { rupees } from "@/lib/customer";
import Icon from "@/components/customer-icon";
type Booking = {
  id: string;
  booking_code: string;
  status: string;
  scheduled_start: string;
  location_text: string;
  duration_minutes: number;
  customer_price_paise: number;
  service?: { name: string };
  service_level?: { name: string };
};
export default function Bookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("upcoming");
  const past = [
    "COMPLETED",
    "CUSTOMER_CONFIRMED",
    "PAYOUT_RELEASED",
    "CANCELLED",
    "REFUNDED",
  ];
  const shown = bookings.filter(
    (b) =>
      tab === "all" ||
      (tab === "past" ? past.includes(b.status) : !past.includes(b.status)),
  );
  async function load() {
    setLoading(true);
    try {
      const r = await customerApi("/api/bookings");
      setBookings(r.bookings);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load bookings.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  return (
    <main className="customer-main">
      <div className="customer-wrap">
        <Link href="/customer">← Book a shoot</Link>
        <div className="customer-heading">
          <span className="eyebrow">YOUR PICKOLO</span>
          <h1>Your bookings</h1>
          <p>Your upcoming shoots and the memories you’ve made.</p>
        </div>
        <div className="list-tabs" role="group" aria-label="Filter bookings">
          {[
            ["upcoming", "Upcoming"],
            ["past", "Past"],
            ["all", "All"],
          ].map(([v, label]) => (
            <button
              key={v}
              className={tab === v ? "active" : ""}
              aria-pressed={tab === v}
              onClick={() => setTab(v)}
            >
              {label}
            </button>
          ))}
        </div>
        {error && (
          <p className="error-message" role="alert">
            {error}{" "}
            <button className="text-button" onClick={load}>
              Retry
            </button>
          </p>
        )}
        {loading ? (
          <p>Loading your bookings…</p>
        ) : !error && !shown.length ? (
          <section className="booking-card empty-state">
            <Icon name="camera" size={44} />
            <h2>Your first memory starts here.</h2>
            <p className="helper">
              {bookings.length
                ? "No bookings in this view."
                : "Choose your coverage and we’ll take care of the next steps."}
            </p>
            <Link className="customer-primary" href="/customer">
              Plan a shoot →
            </Link>
          </section>
        ) : (
          shown.map((b) => (
            <Link
              className="booking-card booking-link"
              key={b.id}
              href={"/customer/booking?id=" + b.id}
            >
              <span className="status-pill">
                {b.status === "REQUESTED"
                  ? "Payment pending"
                  : b.status.replaceAll("_", " ").toLowerCase()}
              </span>
              <strong>
                {b.service?.name || "Your shoot"} · {b.service_level?.name}
              </strong>
              <div className="booking-meta">
                <Icon name="calendar" size={17} />
                {b.duration_minutes / 60} hours{" "}
                <span
                  style={{
                    marginLeft: "auto",
                    color: "#123c2e",
                    fontWeight: 600,
                  }}
                >
                  {rupees(b.customer_price_paise)}
                </span>
              </div>
              <p className="helper">
                {new Date(b.scheduled_start).toLocaleString("en-IN", {
                  timeZone: "Asia/Kolkata",
                })}{" "}
                IST · {b.location_text}
              </p>
              <small className="helper">
                {b.booking_code} · View booking →
              </small>
            </Link>
          ))
        )}
      </div>
    </main>
  );
}
