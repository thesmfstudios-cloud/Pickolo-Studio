"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import Icon from "@/components/customer-icon";
export default function Profile() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [avatar, setAvatar] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    supabaseBrowser.auth.getUser().then(({ data }) => {
      setName(
        data.user?.user_metadata?.full_name ||
          data.user?.user_metadata?.name ||
          "Your Pickolo account",
      );
      setEmail(data.user?.email || "");
      setAvatar(data.user?.user_metadata?.avatar_url || "");
    });
  }, []);
  async function logout() {
    setBusy(true);
    const { error } = await supabaseBrowser.auth.signOut();
    if (error) {
      setError("Could not sign out. Please retry.");
      setBusy(false);
      return;
    }
    sessionStorage.removeItem("pickolo-draft");
    router.replace("/auth");
  }
  return (
    <main className="customer-main">
      <div className="customer-heading">
        <span className="eyebrow">YOUR PICKOLO</span>
        <h1>Profile</h1>
        <p>A little space for you and your memories.</p>
      </div>
      <section className="premium-card center">
        <div className="profile-avatar">
          {avatar ? (
            <img src={avatar} alt="" referrerPolicy="no-referrer" />
          ) : (
            <Icon name="user" size={30} />
          )}
        </div>
        <h2>{name || "Loading your profile…"}</h2>
        <p className="helper">{email}</p>
        <span className="status-pill">Google account</span>
      </section>
      <section className="premium-card">
        <h2>Your account</h2>
        <div className="profile-links">
          <Link href="/customer/bookings">
            <Icon name="calendar" />
            My bookings <span style={{ marginLeft: "auto" }}>→</span>
          </Link>
          <Link href="/customer/notifications">
            <Icon name="bell" />
            Updates & notifications{" "}
            <span style={{ marginLeft: "auto" }}>→</span>
          </Link>
          <Link href="/customer/help">
            <Icon name="shield" />
            Help & support <span style={{ marginLeft: "auto" }}>→</span>
          </Link>
          <Link href="/privacy">Privacy policy</Link>
          <Link href="/terms">Terms of service</Link>
          <Link href="/refund-policy">Cancellation & refunds</Link>
          <button disabled={busy} onClick={logout}>
            {busy ? "Signing out…" : "Sign out"}
          </button>
        </div>
        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}
      </section>
      <p className="home-note">Pickolo by SMF Studios · Bhopal</p>
    </main>
  );
}
