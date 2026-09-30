"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase-browser";
import Icon from "@/components/customer-icon";
type Notice = {
  id: string;
  title: string;
  body: string;
  booking_id?: string;
  created_at: string;
};
export default function Notifications() {
  const [items, setItems] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  async function load() {
    setLoading(true);
    setError("");
    try {
      const {
        data: { user },
      } = await supabaseBrowser.auth.getUser();
      if (!user) throw new Error("Please sign in again.");
      const { data, error } = await supabaseBrowser
        .from("notifications")
        .select("id,title,body,booking_id,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      setItems(data || []);
    } catch {
      setError("Updates could not load. Please retry.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  return (
    <main className="customer-main">
      <Link href="/customer/profile">← Profile</Link>
      <div className="customer-heading">
        <h1>Your updates</h1>
        <p>Everything about your shoots, in one place.</p>
      </div>
      {loading ? (
        <p className="helper">Loading updates…</p>
      ) : error ? (
        <p className="error-message">
          {error}{" "}
          <button className="text-button" onClick={load}>
            Retry
          </button>
        </p>
      ) : items.length ? (
        items.map((n) => (
          <section key={n.id} className="premium-card">
            <h2 style={{ fontSize: 21 }}>{n.title}</h2>
            <p className="helper">{n.body}</p>
            <small className="helper">
              {new Date(n.created_at).toLocaleString("en-IN", {
                timeZone: "Asia/Kolkata",
              })}{" "}
              IST
            </small>
            {n.booking_id && (
              <Link
                className="text-button"
                style={{ display: "block" }}
                href={"/customer/booking?id=" + n.booking_id}
              >
                View booking →
              </Link>
            )}
          </section>
        ))
      ) : (
        <section className="premium-card empty-state">
          <Icon name="bell" size={40} />
          <h2>You’re all caught up.</h2>
          <p className="helper">Booking updates will appear here.</p>
        </section>
      )}
    </main>
  );
}
