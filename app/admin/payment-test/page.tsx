"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Script from "next/script";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import styles from "./test.module.css";

type Result = {
  error?: string;
  ticket?: string;
  keyId?: string;
  orderId?: string;
  payoutId?: string;
  status?: string;
  paid?: boolean;
  message?: string;
};
type Readiness = { paymentReady: boolean; payoutReady: boolean };
const storageKey = "pickolo.admin.sandbox.payout.v1";
export default function PaymentTestPage() {
  const [ready, setReady] = useState<Readiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [scriptReady, setScriptReady] = useState(false);
  const [payment, setPayment] = useState<Result | null>(null);
  const [payout, setPayout] = useState<Result | null>(null);
  const payoutTicket = useRef("");
  const lock = useRef(false);
  const checkoutRef = useRef<{ close: () => void } | null>(null);
  const api = useCallback(
    async (body?: Record<string, unknown>, signal?: AbortSignal) => {
      const session = await supabase?.auth.getSession();
      const token = session?.data.session?.access_token;
      if (!token)
        throw new Error("Sign in to your admin account to use payment tests.");
      const response = await fetch("/api/admin/payment-test", {
        method: body ? "POST" : "GET",
        cache: "no-store",
        signal,
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error || "Test could not complete. Please retry.",
        );
      return result;
    },
    [],
  );
  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError("");
      try {
        setReady(await api(undefined, signal));
      } catch (e) {
        if (!signal?.aborted) {
          setReady(null);
          setError(
            e instanceof Error ? e.message : "Configuration unavailable.",
          );
        }
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [api],
  );
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    try {
      payoutTicket.current = sessionStorage.getItem(storageKey) || "";
      if (payoutTicket.current)
        setPayout({
          message:
            "Previous payout test restored. Retry the same session to recover its provider status.",
        });
    } catch {
      /* Storage may be unavailable. */
    }
    return () => {
      controller.abort();
      checkoutRef.current?.close();
    };
  }, [load]);
  function finish() {
    lock.current = false;
    setBusy("");
  }
  async function testPayment() {
    if (lock.current) return;
    lock.current = true;
    setBusy("payment");
    setError("");
    setPayment(null);
    try {
      if (!window.Razorpay || !scriptReady)
        throw new Error("Secure checkout is still loading. Please retry.");
      const prepared = await api({ kind: "payment", action: "prepare" });
      const order: Result = await api({
        kind: "payment",
        action: "create",
        ticket: prepared.ticket,
      });
      const checkout = new window.Razorpay({
        key: order.keyId,
        order_id: order.orderId,
        amount: 100,
        currency: "INR",
        name: "Pickolo · TEST ONLY",
        description: "₹1 sandbox payment. No real booking.",
        theme: { color: "#087443" },
        handler: async (result: {
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          try {
            setPayment(
              await api({
                kind: "payment",
                action: "verify",
                ticket: order.ticket,
                paymentId: result.razorpay_payment_id,
                signature: result.razorpay_signature,
              }),
            );
          } catch (e) {
            setError(e instanceof Error ? e.message : "Verification failed.");
          } finally {
            finish();
          }
        },
        modal: {
          ondismiss: () => {
            setPayment({
              message: "Checkout closed. No booking or earnings changed.",
            });
            finish();
          },
        },
      });
      checkout.on("payment.failed", () => {
        setPayment({
          status: "failed",
          paid: false,
          message: "Sandbox payment failed. No booking or earnings changed.",
        });
        finish();
      });
      checkoutRef.current = checkout;
      checkout.open();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment test failed.");
      finish();
    }
  }
  async function testPayout() {
    if (lock.current) return;
    lock.current = true;
    setBusy("payout");
    setError("");
    try {
      if (!payoutTicket.current) {
        const prepared = await api({ kind: "payout", action: "prepare" });
        // Persist BEFORE the provider request; a timeout/reload reuses the same key.
        sessionStorage.setItem(storageKey, prepared.ticket);
        payoutTicket.current = prepared.ticket;
      }
      const result: Result = await api({
        kind: "payout",
        action: "create",
        ticket: payoutTicket.current,
      });
      if (result.ticket) {
        payoutTicket.current = result.ticket;
        sessionStorage.setItem(storageKey, result.ticket);
      }
      setPayout(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payout test failed.");
    } finally {
      finish();
    }
  }
  return (
    <main className={styles.page}>
      <div className={styles.wrap}>
        <Link href="/admin" className={styles.back}>
          ← Admin workspace
        </Link>
        <div className={styles.tag}>PICKOLO OPERATIONS · SANDBOX</div>
        <h1>
          Try payments.
          <br />
          Keep real money safe.
        </h1>
        <p className={styles.intro}>
          A separate test space for checkout and partner payouts. Real bookings,
          customer payments and partner earnings stay untouched.
        </p>
        <div className={styles.notice}>
          TEST MODE ONLY · Live partner payouts are paused
        </div>
        {error ? (
          <div className={styles.error} role="alert">
            {error} <Link href="/admin/login">Admin sign in</Link>
          </div>
        ) : null}
        <div className={styles.tools}>
          <span aria-live="polite">
            {loading
              ? "Checking test configuration…"
              : "Test configuration checked"}
          </span>
          <button onClick={() => void load()} disabled={loading || !!busy}>
            Check again
          </button>
        </div>
        <div className={styles.grid}>
          <section className={styles.card}>
            <span className={styles.icon}>↗</span>
            <h2>Customer payment</h2>
            <p>
              Open a ₹1 Razorpay test checkout, then verify its signature and
              captured status on the server.
            </p>
            <span className={styles.chip}>
              {ready?.paymentReady
                ? "Test keys ready"
                : loading
                  ? "Checking…"
                  : "Test keys needed"}
            </span>
            <button
              className={styles.primary}
              onClick={() => void testPayment()}
              disabled={!ready?.paymentReady || !scriptReady || !!busy}
            >
              {busy === "payment"
                ? "Test checkout in progress…"
                : "Open ₹1 test checkout"}
            </button>
            {payment ? (
              <div className={styles.result} role="status">
                <strong>
                  {payment.paid
                    ? "Test captured"
                    : payment.status || "Checkout update"}
                </strong>
                <p>{payment.message}</p>
              </div>
            ) : null}
          </section>
          <section className={styles.card}>
            <span className={styles.icon}>⇄</span>
            <h2>Partner payout</h2>
            <p>
              Use a synthetic test partner and dummy UPI. Queued or processing
              does not mean paid.
            </p>
            <span className={styles.chip}>
              {ready?.payoutReady
                ? "Test keys ready"
                : loading
                  ? "Checking…"
                  : "Test keys + test account needed"}
            </span>
            <button
              className={styles.primary}
              onClick={() => void testPayout()}
              disabled={!ready?.payoutReady || !!busy}
            >
              {busy === "payout"
                ? "Checking sandbox payout…"
                : payoutTicket.current
                  ? "Retry / check same test payout"
                  : "Create ₹1 test payout"}
            </button>
            {payout ? (
              <div className={styles.result} role="status">
                <strong>
                  {payout.paid
                    ? "Test processed"
                    : payout.status || "Test session saved"}
                </strong>
                <p>{payout.message}</p>
                {payout.payoutId ? <code>{payout.payoutId}</code> : null}
              </div>
            ) : null}
          </section>
        </div>
        <section className={styles.guide}>
          <h2>Before your first test</h2>
          <ol>
            <li>
              Add separate Razorpay and RazorpayX <strong>test</strong>{" "}
              credentials securely in Vercel. Never paste secret keys in chat.
            </li>
            <li>
              For checkout, use the provider’s test details—not a real card or
              UPI payment.
            </li>
            <li>
              For payouts, add dummy test balance in RazorpayX. Move the test
              payout state there and check the same session here.
            </li>
          </ol>
          <p>
            Keys missing? Tests stay disabled. There is no automatic switch to
            live mode.
          </p>
          <a
            href="https://razorpay.com/docs/x/dashboard/test-mode/"
            target="_blank"
            rel="noreferrer"
          >
            RazorpayX test-mode guide ↗
          </a>
        </section>
      </div>
      {ready?.paymentReady ? (
        <Script
          src="https://checkout.razorpay.com/v1/checkout.js"
          strategy="afterInteractive"
          onReady={() => setScriptReady(true)}
          onError={() =>
            setError(
              "Secure checkout could not load. Check your internet connection and reload.",
            )
          }
        />
      ) : null}
    </main>
  );
}
