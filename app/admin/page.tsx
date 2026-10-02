"use client";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  AdminMetrics,
  AdminRecord,
  AdminTab,
  adminTabs,
  dateTime,
  humanize,
  maskUpi,
  money,
  statusOptions,
  tabLabels,
  validMetrics,
} from "@/lib/admin-model";
import { Badge, Empty, Icon, Modal } from "./components";

type Operator = {
  operator: { name: string; email: string };
  payoutsEnabled: boolean;
  safetyReady: boolean;
  readiness: { deliveryReady: boolean } | null;
};
type Queue = { records: AdminRecord[]; total: number; pageSize: number };
type Review = {
  application: AdminRecord;
  documents: AdminRecord[];
  eligibility?: {
    partner: {
      id: string;
      service_level_id: string | null;
      verification_status: string;
    } | null;
    services: { id: string; name: string }[];
    levels: { id: string; name: string }[];
    selected: string[];
  };
};
type Dossier = {
  booking: AdminRecord;
  customer: { full_name?: string; phone?: string };
  partner: { full_name?: string; phone?: string } | null;
  history: {
    id: string;
    from_status?: string;
    to_status: string;
    created_at: string;
  }[];
  assets: AdminRecord[];
  disputes: AdminRecord[];
  payouts: AdminRecord[];
  delivery: { submitted_at?: string; customer_confirmed_at?: string }[];
  limit: number;
};
type Action =
  | "approve"
  | "reject"
  | "suspend"
  | "approveDoc"
  | "rejectDoc"
  | "payout"
  | "complete"
  | "noshow"
  | "assign"
  | "resolve"
  | "reviewCase"
  | "rejectCase"
  | "price";
type Decision = { action: Action; record: AdminRecord };
const titles: Record<Action, string> = {
  approve: "Approve this partner?",
  reject: "Request application corrections",
  suspend: "Suspend partner access",
  approveDoc: "Approve identity document?",
  rejectDoc: "Request a document correction",
  payout: "Request / reconcile payout",
  complete: "Complete this booking?",
  noshow: "Record partner no-show?",
  assign: "Assign a partner",
  resolve: "Resolve this support case",
  reviewCase: "Move case to review?",
  rejectCase: "Reject this support case",
  price: "Update shoot pricing",
};
const descriptions: Record<AdminTab, string> = {
  overview:
    "A calm view of your Bhopal operations. Real records, clear next steps.",
  bookings: "Track every shoot from partner search to delivery and completion.",
  applications:
    "Review genuine creators. Keep enrollment simple and decisions clear.",
  partners: "Your creator network, verification status and payout readiness.",
  documents:
    "Private identity files. Review carefully before approving a partner.",
  payouts:
    "Provider status, transfer references and reconciliation—not estimated earnings.",
  support: "Follow customer cases from open to review and a clear resolution.",
  pricing: "Manage customer prices and platform fees for new bookings.",
  activity: "A traceable record of operator decisions.",
};
const searches: Partial<Record<AdminTab, string>> = {
  bookings: "Search booking code or location",
  applications: "Search name or phone",
  partners: "Search partner code or bio",
  documents: "Search filename or document type",
  payouts: "Search provider reference",
  support: "Search reason or description",
  activity: "Search action or entity",
};
export default function AdminPage() {
  const [operator, setOperator] = useState<Operator | null>(null),
    [accessError, setAccessError] = useState(""),
    [booting, setBooting] = useState(true);
  const [tab, setTab] = useState<AdminTab>("overview"),
    [query, setQuery] = useState(""),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [page, setPage] = useState(1),
    [revision, setRevision] = useState(0);
  const [queue, setQueue] = useState<Queue | null>(null),
    [metrics, setMetrics] = useState<AdminMetrics | null>(null),
    [loading, setLoading] = useState(false),
    [loadError, setLoadError] = useState(""),
    [notice, setNotice] = useState("");
  const [review, setReview] = useState<Review | null>(null),
    [decision, setDecision] = useState<Decision | null>(null),
    [detail, setDetail] = useState<
      (AdminRecord & { dossier?: Dossier }) | null
    >(null),
    [busy, setBusy] = useState(false),
    [actionError, setActionError] = useState("");
  const [reason, setReason] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [partnerId, setPartnerId] = useState(""),
    [candidates, setCandidates] = useState<AdminRecord[]>([]),
    [candidateQuery, setCandidateQuery] = useState(""),
    [candidateError, setCandidateError] = useState(""),
    [candidateLoading, setCandidateLoading] = useState(false),
    [price, setPrice] = useState(""),
    [fee, setFee] = useState("");
  const mutation = useRef(false),
    sessionEpoch = useRef(0),
    reviewEpoch = useRef(0);
  const [eligibilityServices, setEligibilityServices] = useState<string[]>([]),
    [eligibilityLevel, setEligibilityLevel] = useState(""),
    [eligibilityConfirmed, setEligibilityConfirmed] = useState(false);

  const api = useCallback(async (path: string, options: RequestInit = {}) => {
    if (!supabase) throw new Error("Admin connection is not configured.");
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) {
      window.location.assign("/admin/login");
      throw new Error("Sign in again to continue.");
    }
    const response = await fetch(path, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: "Bearer " + data.session.access_token,
      },
      cache: "no-store",
      signal: options.signal || AbortSignal.timeout(25000),
    });
    const value = await response.json().catch(() => null);
    if (response.status === 401 || response.status === 403) {
      reviewEpoch.current++;
      setOperator(null);
      setQueue(null);
      setMetrics(null);
      setReview(null);
      setDetail(null);
      setDecision(null);
      throw new Error(
        response.status === 403
          ? "Your operator access is unavailable. Contact the owner."
          : "Your session expired. Sign in again.",
      );
    }
    if (!response.ok)
      throw new Error(value?.error || "Unable to complete this request.");
    if (!value || typeof value !== "object")
      throw new Error("Unexpected server response. Please retry.");
    return value;
  }, []);
  const boot = useCallback(async () => {
    const epoch = ++sessionEpoch.current;
    setBooting(true);
    setAccessError("");
    try {
      const data = await api("/api/admin/session");
      if (epoch === sessionEpoch.current) setOperator(data);
    } catch (e) {
      if (epoch === sessionEpoch.current)
        setAccessError(
          e instanceof Error ? e.message : "Unable to verify access.",
        );
    } finally {
      if (epoch === sessionEpoch.current) setBooting(false);
    }
  }, [api]);
  useEffect(() => {
    void boot();
    const subscription = supabase?.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        reviewEpoch.current++;
        sessionEpoch.current++;
        setOperator(null);
        setQueue(null);
        setReview(null);
        setDetail(null);
        setMetrics(null);
        setDecision(null);
        window.location.assign("/admin/login");
      }
    });
    return () => {
      sessionEpoch.current++;
      subscription?.data.subscription.unsubscribe();
    };
  }, [boot]);
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(query);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    if (!operator) return;
    const controller = new AbortController();
    setLoading(true);
    setLoadError("");
    setQueue(null);
    setMetrics(null);
    const url =
      tab === "overview"
        ? "/api/admin/metrics"
        : "/api/admin/queue?" +
          new URLSearchParams({
            kind: tab,
            q: search,
            status,
            page: String(page),
          });
    void api(url, {
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]),
    })
      .then((data) => {
        if (controller.signal.aborted) return;
        if (tab === "overview") {
          if (!validMetrics(data))
            throw new Error("Metrics are unavailable. Retry shortly.");
          setMetrics(data);
        } else {
          if (
            !Array.isArray(data.records) ||
            !Number.isSafeInteger(data.total) ||
            data.total < 0 ||
            data.pageSize !== 20
          )
            throw new Error("Queue data is unavailable.");
          setQueue(data);
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setLoadError(e instanceof Error ? e.message : "Unable to load data.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [api, operator, tab, search, status, page, revision]);
  useEffect(() => {
    if (decision?.action !== "assign") return;
    const controller = new AbortController();
    setCandidateLoading(true);
    setCandidateError("");
    setPartnerId("");
    setCandidates([]);
    const timer = setTimeout(() => {
      void api(
        "/api/admin/queue?" +
          new URLSearchParams({
            kind: "partners",
            status: "approved",
            q: candidateQuery,
          }),
        {
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(20000),
          ]),
        },
      )
        .then((data) => {
          if (!controller.signal.aborted) setCandidates(data.records);
        })
        .catch((e) => {
          if (!controller.signal.aborted)
            setCandidateError(
              e instanceof Error ? e.message : "Unable to load partners.",
            );
        })
        .finally(() => {
          if (!controller.signal.aborted) setCandidateLoading(false);
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [api, decision, candidateQuery]);

  function navigate(next: AdminTab, filter = "") {
    if (busy) return;
    reviewEpoch.current++;
    setTab(next);
    setStatus(filter);
    setPage(1);
    setQuery("");
    setSearch("");
    setQueue(null);
    setMetrics(null);
    setLoadError("");
    setReview(null);
    setDetail(null);
    setDecision(null);
  }
  function choose(action: Action, record: AdminRecord) {
    if (busy) return;
    setReview(null);
    setDetail(null);
    setDecision({ action, record });
    setActionError("");
    setReason("");
    setConfirmed(false);
    setPartnerId("");
    setCandidateQuery("");
    setPrice(String((record.amount_paise || 0) / 100));
    setFee(String((record.platform_fee_bps || 0) / 100));
  }
  async function openReview(record: AdminRecord, fromPartner = false) {
    if (mutation.current) return;
    const epoch = ++reviewEpoch.current;
    setActionError("");
    setNotice("Loading partner review…");
    try {
      const data = await api(
        "/api/admin/review?" +
          new URLSearchParams({
            [fromPartner ? "partner_id" : "application_id"]: record.id,
          }),
      );
      if (epoch === reviewEpoch.current) {
        setReview(data);
        setEligibilityServices(
          Array.from(
            new Set([
              ...(data.eligibility?.selected || []),
              ...(data.eligibility?.services || [])
                .filter((s: { name: string }) => s.name === "Photography")
                .map((s: { id: string }) => s.id),
            ]),
          ),
        );
        setEligibilityLevel(data.eligibility?.partner?.service_level_id || "");
        setEligibilityConfirmed(false);
        setNotice("");
      }
    } catch (e) {
      if (epoch === reviewEpoch.current)
        setNotice(e instanceof Error ? e.message : "Unable to load review.");
    }
  }
  async function saveEligibility(event: FormEvent) {
    event.preventDefault();
    const eligibility = review?.eligibility;
    if (
      mutation.current ||
      !eligibility?.partner ||
      !eligibilityConfirmed ||
      !operator?.safetyReady
    )
      return;
    mutation.current = true;
    setBusy(true);
    setActionError("");
    try {
      const result = await api("/api/admin/partner-eligibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partner_id: eligibility.partner.id,
          service_level_id: eligibilityLevel,
          service_ids: eligibilityServices,
          expected_level_id: eligibility.partner.service_level_id,
          expected_service_ids: eligibility.selected,
        }),
      });
      setReview(null);
      setNotice(result.message);
      setRevision((x) => x + 1);
    } catch (e) {
      setActionError(
        e instanceof Error ? e.message : "Could not save eligibility.",
      );
    } finally {
      mutation.current = false;
      setBusy(false);
    }
  }
  async function openDetails(record: AdminRecord, fromCase = false) {
    if (mutation.current) return;
    const epoch = ++reviewEpoch.current;
    setNotice("Loading booking details…");
    try {
      const data: Dossier = await api(
        "/api/admin/booking?id=" +
          encodeURIComponent(fromCase ? record.booking_id || "" : record.id),
      );
      if (epoch === reviewEpoch.current) {
        setDetail({ ...record, ...data.booking, dossier: data });
        setNotice("");
      }
    } catch (e) {
      if (epoch === reviewEpoch.current)
        setNotice(
          e instanceof Error ? e.message : "Unable to load booking details.",
        );
    }
  }
  async function openFile(record: AdminRecord, asset = false) {
    if (mutation.current) return;
    const preview = window.open("about:blank", "_blank");
    if (preview) preview.opener = null;
    try {
      const data = await api(
        "/api/admin/" +
          (asset ? "asset-link" : "document-link") +
          "?id=" +
          encodeURIComponent(record.id),
      );
      const url = new URL(data.url);
      if (url.protocol !== "https:") throw new Error("Invalid preview link.");
      if (preview) preview.location.href = url.href;
      else
        setNotice(
          "Your browser blocked the file window. Allow popups for this site and try again.",
        );
    } catch (e) {
      preview?.close();
      setNotice(e instanceof Error ? e.message : "Unable to open file.");
    }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!decision || mutation.current || !confirmed) return;
    mutation.current = true;
    setBusy(true);
    setActionError("");
    const { action, record } = decision;
    let path = "",
      method = "POST",
      body: Record<string, unknown> = {};
    const expected = { expected_status: record.status };
    if (["approve", "reject", "suspend"].includes(action)) {
      path = "/api/admin/partners/" + record.id + "/verify";
      body = { action, rejection_reason: reason, ...expected };
    }
    if (action === "approveDoc" || action === "rejectDoc") {
      path = "/api/admin/partner-documents";
      body = {
        id: record.id,
        status: action === "approveDoc" ? "approved" : "rejected",
        rejection_reason: reason,
        ...expected,
      };
    }
    if (action === "assign") {
      path = "/api/admin/assignments";
      body = { booking_id: record.id, partner_id: partnerId };
    }
    if (action === "noshow") {
      path = "/api/admin/no-show/" + record.id;
      body = { reason, ...expected };
    }
    if (action === "payout")
      path =
        "/api/admin/payouts/" +
        (tab === "payouts" ? record.booking_id : record.id) +
        "/release";
    if (action === "complete") {
      path = "/api/bookings/" + record.id + "/transition";
      body = { to_status: "COMPLETED" };
    }
    if (["resolve", "reviewCase", "rejectCase"].includes(action)) {
      path = "/api/admin/disputes";
      body = {
        id: record.id,
        status:
          action === "resolve"
            ? "resolved"
            : action === "rejectCase"
              ? "rejected"
              : "under_review",
        resolution: reason,
        ...expected,
      };
    }
    if (action === "price") {
      const amount = Number(price),
        percentage = Number(fee);
      if (
        !Number.isFinite(amount) ||
        amount <= 0 ||
        !Number.isFinite(percentage) ||
        percentage < 0 ||
        percentage > 100
      ) {
        setActionError(
          "Enter a valid price and a platform fee from 0 to 100%.",
        );
        mutation.current = false;
        setBusy(false);
        return;
      }
      path = "/api/admin/pricing";
      method = "PATCH";
      body = {
        id: record.id,
        amount_paise: Math.round(amount * 100),
        platform_fee_bps: Math.round(percentage * 100),
        expected_updated_at: record.updated_at,
      };
    }
    try {
      const result = await api(path, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setDecision(null);
      setNotice(result.message || "Saved. The queue has been refreshed.");
      setRevision((x) => x + 1);
    } catch (e) {
      setActionError(
        (e instanceof Error ? e.message : "Unable to save.") +
          " If the connection was interrupted, refresh the record before retrying.",
      );
    } finally {
      mutation.current = false;
      setBusy(false);
    }
  }
  async function logout() {
    if (busy) return;
    try {
      const result = await supabase?.auth.signOut();
      if (result?.error) throw result.error;
      window.location.assign("/admin/login");
    } catch {
      setNotice("Could not sign out. Please retry.");
    }
  }
  const button = (
    label: string,
    action: Action,
    r: AdminRecord,
    danger = false,
  ) => (
    <button
      className={"admin-button " + (danger ? "danger" : "")}
      disabled={
        busy ||
        !operator?.safetyReady ||
        (action === "payout" && !operator.payoutsEnabled)
      }
      onClick={() => choose(action, r)}
    >
      {label}
    </button>
  );
  if (booting)
    return (
      <main className="admin-content" aria-busy="true">
        <section className="admin-panel">
          <h1>Opening your workspace…</h1>
          <div className="admin-skeleton" />
          <div className="admin-skeleton" />
        </section>
      </main>
    );
  if (!operator)
    return (
      <main className="admin-content">
        <section className="admin-panel">
          <h1>Operator access</h1>
          <p role="alert" className="admin-banner error">
            {accessError || "Sign in with an authorized operator account."}
          </p>
          <button className="admin-button" onClick={boot}>
            Retry connection
          </button>{" "}
          <a className="admin-button primary" href="/admin/login">
            Sign in
          </a>
        </section>
      </main>
    );
  const reviewReady = review?.documents.some(
    (d) => d.document_type === "identity" && d.status === "approved",
  );
  const needsReason =
    decision &&
    [
      "reject",
      "suspend",
      "rejectDoc",
      "noshow",
      "resolve",
      "rejectCase",
    ].includes(decision.action);
  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <div>
          <div className="admin-brand">
            <span>P</span> Pickolo
          </div>
          <div className="admin-eyebrow">OPERATIONS WORKSPACE</div>
        </div>
        <nav className="admin-nav" aria-label="Operations">
          {adminTabs.map((item) => (
            <button
              key={item}
              aria-current={item === tab ? "page" : undefined}
              onClick={() => navigate(item)}
              disabled={busy}
            >
              <Icon name={item} />
              {tabLabels[item]}
            </button>
          ))}
        </nav>
        <div className="admin-sidebar-note">
          <strong>Bhopal pilot</strong>
          <br />
          Photography & videography.
          <br />
          Camera and phone creators.
          <br />
          Manual review. Thoughtful decisions.
        </div>
      </aside>
      <div className="admin-content">
        <header className="admin-toolbar">
          <div>
            <span className="admin-eyebrow">
              PICKOLO / {tabLabels[tab].toUpperCase()}
            </span>
            <div className="admin-muted">All times in India Standard Time</div>
          </div>
          <div className="admin-operator">
            <span className="admin-avatar">
              {operator.operator.name.charAt(0).toUpperCase()}
            </span>
            <div>
              <strong>{operator.operator.name}</strong>
              <br />
              <small className="admin-muted">{operator.operator.email}</small>
            </div>
            <button className="admin-button" disabled={busy} onClick={logout}>
              Sign out
            </button>
          </div>
        </header>
        <div className="admin-title-row">
          <div>
            <h1>
              {tab === "overview"
                ? "Good operations. Great moments."
                : tabLabels[tab]}
            </h1>
            <div className="admin-muted">{descriptions[tab]}</div>
          </div>
          <button
            className="admin-button"
            disabled={loading || busy}
            onClick={() => {
              setNotice("");
              setRevision((x) => x + 1);
            }}
          >
            <Icon name="refresh" />
            Refresh
          </button>
        </div>
        {!operator.safetyReady ? (
          <div className="admin-banner" role="status">
            <strong>Database setup pending.</strong> Admin safety migration must
            be installed before changing records. You can browse available
            queues.
          </div>
        ) : null}
        {operator.safetyReady && !operator.readiness?.deliveryReady ? (
          <div className="admin-banner">
            Partner delivery finalization is not installed. Complete database
            rollout before testing booking-to-payout.
          </div>
        ) : null}
        {!operator.payoutsEnabled ? (
          <div className="admin-banner">
            <strong>Real payouts are disabled.</strong> No transfer can be
            requested from this workspace until the owner configures the
            provider.
          </div>
        ) : null}
        {notice ? (
          <div role="status" className="admin-banner">
            {notice}
            <button
              className="admin-inline-link"
              onClick={() => setNotice("")}
              style={{ marginLeft: 12 }}
            >
              Dismiss
            </button>
          </div>
        ) : null}
        {loadError ? (
          <section className="admin-panel">
            <div className="admin-banner error" role="alert">
              {loadError}
            </div>
            <button
              className="admin-button"
              onClick={() => setRevision((x) => x + 1)}
            >
              Retry this screen
            </button>
          </section>
        ) : null}
        {tab === "overview" && !loadError ? (
          <>
            <div className="admin-stats">
              {[
                [
                  "Active shoots",
                  metrics?.bookings.active,
                  "Bookings in progress",
                ],
                [
                  "Completed shoots",
                  metrics?.bookings.completed,
                  "All-time completed bookings",
                ],
                [
                  "Paid booking value",
                  metrics ? money(metrics.money.gmvPaise) : undefined,
                  "Excludes requested / cancelled / refunded",
                ],
                [
                  "Processed payouts",
                  metrics
                    ? money(metrics.money.payoutsReleasedPaise)
                    : undefined,
                  "Provider-confirmed transfers only",
                ],
              ].map(([label, value, caption]) => (
                <section className="admin-stat" key={label}>
                  <span className="admin-muted">{label}</span>
                  {loading ? (
                    <div className="admin-skeleton" />
                  ) : (
                    <strong>{value ?? "—"}</strong>
                  )}
                  <small>{caption}</small>
                </section>
              ))}
            </div>
            <section className="admin-panel">
              <div className="admin-panel-heading">
                <div>
                  <h2>Your next best actions</h2>
                  <span className="admin-muted">
                    Open a queue to review the details.
                  </span>
                </div>
                <Badge value="Bhopal pilot" />
              </div>
              <div className="admin-grid">
                {(
                  [
                    [
                      "applications",
                      "Partner applications",
                      metrics?.queues.applications,
                      "Review identity and creator preferences",
                      "pending",
                    ],
                    [
                      "documents",
                      "Identity documents",
                      metrics?.queues.documents,
                      "Check private uploaded files",
                      "pending",
                    ],
                    [
                      "support",
                      "Customer support",
                      metrics?.queues.support,
                      "Includes open and under-review cases",
                      "",
                    ],
                    [
                      "bookings",
                      "Find a partner",
                      metrics?.queues.searching,
                      "Open bookings and choose a search status",
                      "",
                    ],
                  ] as const
                ).map(([destination, label, count, caption, filter]) => (
                  <button
                    className="admin-queue-card"
                    key={destination}
                    onClick={() => navigate(destination, filter)}
                  >
                    <div>
                      <strong>{label}</strong>
                      <small className="admin-muted">{caption}</small>
                    </div>
                    <b>{count ?? "—"} →</b>
                  </button>
                ))}
              </div>
              <p className="admin-note">
                Completed-booking platform fees:{" "}
                {metrics ? money(metrics.money.platformRevenuePaise) : "—"} ·
                Completion rate:{" "}
                {metrics
                  ? Math.round(metrics.bookings.completionRate * 100) + "%"
                  : "—"}
                . Operational totals are not an accounting or bank-settlement
                statement.
              </p>
              <p className="admin-note">
                Updated{" "}
                {metrics ? dateTime(metrics.generatedAt) : "when connected"} ·
                Refresh for the latest records.
              </p>
            </section>
          </>
        ) : null}
        {tab !== "overview" ? (
          <section className="admin-panel">
            <div className="admin-panel-heading">
              <div>
                <h2>{tabLabels[tab]} queue</h2>
                <span className="admin-muted">
                  {queue
                    ? queue.total + " matching records"
                    : "Load records to continue"}
                </span>
              </div>
            </div>
            <div className="admin-filter-row">
              {searches[tab] ? (
                <input
                  aria-label={searches[tab]}
                  className="admin-field admin-search"
                  placeholder={searches[tab]}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  disabled={busy}
                />
              ) : null}
              {statusOptions[tab] ? (
                <select
                  aria-label="Status filter"
                  className="admin-field admin-filter"
                  value={status}
                  disabled={busy}
                  onChange={(e) => {
                    setStatus(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All statuses</option>
                  {statusOptions[tab]?.map((value) => (
                    <option key={value} value={value}>
                      {humanize(value)}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>
            {loading ? (
              <div aria-busy="true" aria-label="Loading queue">
                {[1, 2, 3, 4].map((n) => (
                  <div className="admin-skeleton" key={n} />
                ))}
              </div>
            ) : !loadError && queue?.records.length ? (
              <div className="admin-table-wrap">
                <table className={"admin-table admin-table-" + tab}>
                  <thead>
                    <tr>
                      {(tab === "activity"
                        ? ["Action", "Record", "Operator", "Recorded"]
                        : tab === "pricing"
                          ? [
                              "Shoot level",
                              "Duration",
                              "Customer price",
                              "Platform fee",
                              "Actions",
                            ]
                          : ["Details", "Status", "Information", "Actions"]
                      ).map((col) => (
                        <th key={col} scope="col">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {queue.records.map((r) => (
                      <tr key={r.id}>
                        {tab === "activity" ? (
                          <>
                            <td>
                              <strong>{humanize(r.action || "")}</strong>
                            </td>
                            <td>
                              {humanize(r.entity_type || "")}
                              <div className="admin-muted">{r.entity_id}</div>
                            </td>
                            <td className="admin-muted">{r.actor_id}</td>
                            <td>{dateTime(r.created_at)}</td>
                          </>
                        ) : tab === "pricing" ? (
                          <>
                            <td>
                              <strong>{r.service_level?.name}</strong>
                            </td>
                            <td>{r.duration_minutes} minutes</td>
                            <td>{money(r.amount_paise)}</td>
                            <td>{(r.platform_fee_bps || 0) / 100}%</td>
                            <td>{button("Edit pricing", "price", r)}</td>
                          </>
                        ) : (
                          <>
                            <td>
                              <strong>
                                {r.booking_code ||
                                  r.display_name ||
                                  r.profile?.full_name ||
                                  r.partner_code ||
                                  r.file_name ||
                                  r.reason_code ||
                                  money(r.amount_paise)}
                              </strong>
                              <div className="admin-muted">
                                {r.location_text ||
                                  r.phone ||
                                  r.partner_code ||
                                  r.provider_payout_id ||
                                  r.document_type ||
                                  dateTime(r.created_at)}
                              </div>
                            </td>
                            <td>
                              <Badge
                                value={r.status || r.verification_status}
                              />
                            </td>
                            <td className="admin-muted">
                              {tab === "bookings" ? (
                                <>
                                  {dateTime(r.scheduled_start)}
                                  <br />
                                  {r.service?.name} · {r.duration_minutes} min
                                  <br />
                                  {money(r.customer_price_paise)}
                                </>
                              ) : tab === "applications" ? (
                                <>
                                  {r.skills?.join(" · ") ||
                                    "Preferences not supplied"}
                                  <br />
                                  UPI: {maskUpi(r.payout_upi_id)}
                                </>
                              ) : tab === "partners" ? (
                                <>
                                  {r.service_level?.name || "Level not set"}
                                  <br />
                                  {maskUpi(r.payout_upi_id)}
                                </>
                              ) : tab === "documents" ? (
                                <>
                                  {r.mime_type}
                                  <br />
                                  {r.size_bytes
                                    ? Math.ceil(r.size_bytes / 1024) + " KB"
                                    : "Size not recorded"}
                                </>
                              ) : tab === "payouts" ? (
                                <>
                                  Booking {r.booking_id}
                                  <br />
                                  {r.provider_payout_id
                                    ? "Provider reference saved"
                                    : "No provider reference"}
                                  <br />
                                  {dateTime(r.released_at)}
                                </>
                              ) : (
                                <>{r.description?.slice(0, 120)}</>
                              )}
                            </td>
                            <td>
                              <div className="admin-actions">
                                {tab === "applications" ? (
                                  <button
                                    className="admin-button"
                                    onClick={() => openReview(r)}
                                  >
                                    Review application
                                  </button>
                                ) : tab === "partners" ? (
                                  <button
                                    className="admin-button"
                                    onClick={() => openReview(r, true)}
                                  >
                                    View partner
                                  </button>
                                ) : tab === "documents" ? (
                                  <>
                                    <button
                                      className="admin-button"
                                      onClick={() => openFile(r)}
                                    >
                                      View file
                                    </button>
                                    {r.status !== "approved"
                                      ? button("Approve", "approveDoc", r)
                                      : null}
                                    {r.status !== "rejected"
                                      ? button("Reject", "rejectDoc", r, true)
                                      : null}
                                  </>
                                ) : tab === "bookings" ? (
                                  <>
                                    <button
                                      className="admin-button"
                                      onClick={() => openDetails(r)}
                                    >
                                      Details
                                    </button>
                                    {[
                                      "PAYMENT_CONFIRMED",
                                      "SEARCHING_PARTNER",
                                    ].includes(r.status || "")
                                      ? button("Assign partner", "assign", r)
                                      : null}
                                    {r.assigned_partner_id &&
                                    ["PARTNER_ASSIGNED", "ON_THE_WAY"].includes(
                                      r.status || "",
                                    )
                                      ? button("No-show", "noshow", r, true)
                                      : null}
                                    {[
                                      "DATA_SUBMITTED",
                                      "CUSTOMER_CONFIRMED",
                                    ].includes(r.status || "")
                                      ? button("Request payout", "payout", r)
                                      : null}
                                    {r.status === "PAYOUT_RELEASED"
                                      ? button("Complete", "complete", r)
                                      : null}
                                  </>
                                ) : tab === "payouts" ? (
                                  r.provider_payout_id &&
                                  ["pending", "queued", "processing"].includes(
                                    r.status || "",
                                  ) ? (
                                    button("Reconcile", "payout", r)
                                  ) : (
                                    <span className="admin-muted">
                                      Owner review for exceptions
                                    </span>
                                  )
                                ) : tab === "support" ? (
                                  <>
                                    <button
                                      className="admin-button"
                                      onClick={() => openDetails(r, true)}
                                    >
                                      Details
                                    </button>
                                    {r.status === "open"
                                      ? button("Review", "reviewCase", r)
                                      : null}
                                    {["open", "under_review"].includes(
                                      r.status || "",
                                    ) ? (
                                      <>
                                        {button("Resolve", "resolve", r)}
                                        {button(
                                          "Reject",
                                          "rejectCase",
                                          r,
                                          true,
                                        )}
                                      </>
                                    ) : null}
                                  </>
                                ) : null}
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : !loadError ? (
              <Empty
                title={
                  search || status
                    ? "No matching records"
                    : "Your queue is clear"
                }
                detail={
                  search || status
                    ? "Try a different search or status filter."
                    : "New records will appear here as your pilot grows."
                }
              />
            ) : null}
            {queue && !loading && !loadError ? (
              <div className="admin-pagination">
                <span>
                  Page {page} of{" "}
                  {Math.max(1, Math.ceil(queue.total / queue.pageSize))} · 20
                  records per page
                </span>
                <div className="admin-actions">
                  <button
                    className="admin-button"
                    disabled={page <= 1 || busy}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    ← Previous
                  </button>
                  <button
                    className="admin-button"
                    disabled={page * queue.pageSize >= queue.total || busy}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next →
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
      {review ? (
        <Modal
          key="review"
          title="Partner review"
          busy={busy}
          onClose={() => setReview(null)}
        >
          <Badge value={review.application.status} />
          <h3>{review.application.display_name}</h3>
          <dl className="admin-detail-list">
            <dt>Phone</dt>
            <dd>{review.application.phone}</dd>
            <dt>Preferences</dt>
            <dd>{review.application.skills?.join(" · ") || "Not supplied"}</dd>
            <dt>About</dt>
            <dd>{review.application.bio || "Not supplied"}</dd>
            <dt>Base location</dt>
            <dd>
              {review.application.base_lat != null &&
              review.application.base_long != null
                ? review.application.base_lat +
                  ", " +
                  review.application.base_long
                : "Not supplied"}
            </dd>
            <dt>Payout UPI</dt>
            <dd>{maskUpi(review.application.payout_upi_id)}</dd>
            <dt>Applied</dt>
            <dd>{dateTime(review.application.created_at)}</dd>
          </dl>
          <h3>Identity review</h3>
          <p className="admin-muted">
            Review the original uploaded file. Approval is a manual identity
            check—not an automated KYC or skill guarantee.
          </p>
          {review.documents.length ? (
            review.documents.map((d) => (
              <div className="admin-doc-row" key={d.id}>
                <strong>{d.file_name}</strong> <Badge value={d.status} />
                <div className="admin-actions">
                  <button className="admin-button" onClick={() => openFile(d)}>
                    View private file
                  </button>
                  {d.status !== "approved"
                    ? button("Approve document", "approveDoc", d)
                    : null}
                  {d.status !== "rejected"
                    ? button("Request correction", "rejectDoc", d, true)
                    : null}
                </div>
              </div>
            ))
          ) : (
            <div className="admin-banner">
              No identity document uploaded. Ask the partner to add one; extra
              equipment documents are not required.
            </div>
          )}
          {review.application.rejection_reason ? (
            <p className="admin-banner">
              {review.application.rejection_reason}
            </p>
          ) : null}
          <div className="admin-actions">
            {review.application.status !== "approved" ? (
              <button
                className="admin-button primary"
                disabled={busy || !reviewReady || !operator.safetyReady}
                onClick={() => choose("approve", review.application)}
              >
                Approve partner
              </button>
            ) : (
              button("Suspend access", "suspend", review.application, true)
            )}
            {review.application.status !== "rejected"
              ? button(
                  "Request corrections",
                  "reject",
                  review.application,
                  true,
                )
              : null}
          </div>
          {review.eligibility?.partner?.verification_status === "approved" ? (
            <form onSubmit={saveEligibility} className="admin-eligibility">
              <h3>Job eligibility</h3>
              <p className="admin-muted">
                Manually approve shoot services and job level after reviewing
                skills. Creator preferences alone do not unlock video jobs.
                Photography remains the existing default.
              </p>
              <label htmlFor="eligibility-level">Approved job level</label>
              <select
                id="eligibility-level"
                className="admin-field"
                required
                value={eligibilityLevel}
                disabled={busy}
                onChange={(e) => setEligibilityLevel(e.target.value)}
              >
                <option value="">Choose a level</option>
                {review.eligibility.levels.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
              <fieldset disabled={busy}>
                <legend>Approved shoot services</legend>
                {review.eligibility.services.map((s) => (
                  <label key={s.id} className="admin-check">
                    <input
                      type="checkbox"
                      checked={eligibilityServices.includes(s.id)}
                      disabled={s.name === "Photography"}
                      onChange={(e) =>
                        setEligibilityServices((ids) =>
                          e.target.checked
                            ? [...ids, s.id]
                            : ids.filter((id) => id !== s.id),
                        )
                      }
                    />
                    {s.name}
                    {s.name === "Photography" ? " (default)" : ""}
                  </label>
                ))}
              </fieldset>
              <label className="admin-check">
                <input
                  type="checkbox"
                  checked={eligibilityConfirmed}
                  onChange={(e) => setEligibilityConfirmed(e.target.checked)}
                  disabled={busy}
                />
                <span>
                  I verified the skills and approve this job eligibility.
                </span>
              </label>
              {actionError ? (
                <div className="admin-banner error" role="alert">
                  {actionError}
                </div>
              ) : null}
              <button
                className="admin-button primary"
                type="submit"
                disabled={
                  busy ||
                  !operator.safetyReady ||
                  !eligibilityConfirmed ||
                  !eligibilityLevel
                }
              >
                {busy ? "Saving safely…" : "Save job eligibility"}
              </button>
              <p className="admin-note">
                This is an operator decision, not an XP award. Existing booking
                prices are unchanged.
              </p>
            </form>
          ) : null}
          <p className="admin-note">
            After reviewing a document, reopen the application to load its
            updated status. Server checks always run before approval.
          </p>
        </Modal>
      ) : null}
      {detail ? (
        <Modal
          key="detail"
          title={tab === "support" ? "Support case details" : "Booking details"}
          onClose={() => setDetail(null)}
        >
          <Badge value={detail.status} />
          <dl className="admin-detail-list">
            {Object.entries({
              Booking: detail.booking_code || detail.booking_id,
              Location: detail.location_text,
              Schedule: detail.scheduled_start
                ? dateTime(detail.scheduled_start)
                : null,
              Service: detail.service?.name,
              Level: detail.service_level?.name,
              "Customer price":
                detail.customer_price_paise != null
                  ? money(detail.customer_price_paise)
                  : null,
              "Partner payout":
                detail.partner_payout_paise != null
                  ? money(detail.partner_payout_paise)
                  : null,
              "Assigned partner": detail.assigned_partner_id,
              Reason: detail.reason_code,
              Description: detail.description,
              Resolution: detail.resolution,
            })
              .filter(([, v]) => v != null)
              .map(([label, value]) => (
                <div style={{ display: "contents" }} key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
          </dl>
          {detail.dossier ? (
            <>
              <h3>People & delivery</h3>
              <dl className="admin-detail-list">
                <dt>Customer</dt>
                <dd>
                  {detail.dossier.customer.full_name || "Name not saved"} ·{" "}
                  {detail.dossier.customer.phone || "Phone not saved"}
                </dd>
                <dt>Creator</dt>
                <dd>
                  {detail.dossier.partner
                    ? detail.dossier.partner.full_name +
                      " · " +
                      (detail.dossier.partner.phone || "Phone not saved")
                    : "Not assigned"}
                </dd>
                <dt>Studio backup</dt>
                <dd>
                  {detail.dossier.delivery[0]?.submitted_at
                    ? dateTime(detail.dossier.delivery[0].submitted_at)
                    : "Not submitted"}
                </dd>
                <dt>Customer confirmation</dt>
                <dd>
                  {detail.dossier.delivery[0]?.customer_confirmed_at
                    ? dateTime(detail.dossier.delivery[0].customer_confirmed_at)
                    : "Not recorded"}
                </dd>
              </dl>
              <h3>Lifecycle timeline</h3>
              {detail.dossier.history.length ? (
                <ol className="admin-timeline">
                  {detail.dossier.history.map((h) => (
                    <li key={h.id}>
                      <strong>{humanize(h.to_status)}</strong>
                      <small className="admin-muted">
                        {dateTime(h.created_at)}
                        {h.from_status
                          ? " · from " + humanize(h.from_status)
                          : ""}
                      </small>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="admin-muted">No lifecycle events recorded.</p>
              )}
              <h3>Private studio backup</h3>
              {detail.dossier.assets.length ? (
                detail.dossier.assets.map((a) => (
                  <div className="admin-doc-row" key={a.id}>
                    <strong>{a.file_name}</strong>
                    <div className="admin-muted">
                      {a.mime_type} ·{" "}
                      {a.size_bytes
                        ? Math.ceil(a.size_bytes / 1024) + " KB"
                        : "Size not recorded"}
                    </div>
                    <button
                      className="admin-button"
                      onClick={() => openFile(a, true)}
                    >
                      Open private backup
                    </button>
                  </div>
                ))
              ) : (
                <p className="admin-muted">No studio backup files uploaded.</p>
              )}
              <h3>Payout & support</h3>
              {detail.dossier.payouts.length ? (
                detail.dossier.payouts.map((p) => (
                  <p key={p.id}>
                    <Badge value={p.status} /> {money(p.amount_paise)} ·{" "}
                    {p.provider_payout_id || "No confirmed provider reference"}
                  </p>
                ))
              ) : (
                <p className="admin-muted">No payout requested.</p>
              )}
              {detail.dossier.disputes.map((c) => (
                <div className="admin-doc-row" key={c.id}>
                  <Badge value={c.status} /> <strong>{c.reason_code}</strong>
                  <p>{c.description}</p>
                  {c.resolution ? <p>{c.resolution}</p> : null}
                </div>
              ))}
              <p className="admin-note">
                Latest {detail.dossier.limit} events, assets and support cases.
                Private file links expire after five minutes.
              </p>
            </>
          ) : null}
          <p className="admin-note">
            Lifecycle changes are restricted by the backend. Payout requests
            require backup, recorded handoff and dispute checks.
          </p>
        </Modal>
      ) : null}
      {decision ? (
        <Modal
          key={decision.action + decision.record.id}
          title={titles[decision.action]}
          busy={busy}
          onClose={() => setDecision(null)}
        >
          <form onSubmit={submit}>
            <p className="admin-muted">
              {decision.record.display_name ||
                decision.record.booking_code ||
                decision.record.file_name ||
                decision.record.reason_code ||
                decision.record.partner_code ||
                decision.record.booking_id}
            </p>
            {decision.action === "payout" ? (
              <div className="admin-banner">
                This may send real money. Only provider-confirmed processing
                marks the booking paid. Queued transfers remain pending;
                reconcile the same booking rather than sending a new payment.
              </div>
            ) : decision.action === "approve" ? (
              <div className="admin-banner">
                Confirm identity, creator preferences and profile details.
                Camera/phone and photography/videography choices do not
                automatically determine job eligibility.
              </div>
            ) : decision.action === "noshow" ? (
              <div className="admin-banner">
                Record this only after checking attendance. The assignment will
                be cleared and backup matching attempted.
              </div>
            ) : null}
            {decision.action === "assign" ? (
              <>
                <label htmlFor="candidate-search">
                  Find an approved partner
                </label>
                <input
                  id="candidate-search"
                  className="admin-field"
                  placeholder="Partner code or bio"
                  value={candidateQuery}
                  disabled={busy}
                  onChange={(e) => setCandidateQuery(e.target.value)}
                />
                {candidateError ? (
                  <p role="alert" className="admin-banner error">
                    {candidateError}
                  </p>
                ) : null}
                <label htmlFor="candidate">Partner</label>
                <select
                  id="candidate"
                  className="admin-field"
                  required
                  disabled={busy || candidateLoading}
                  value={partnerId}
                  onChange={(e) => setPartnerId(e.target.value)}
                >
                  <option value="">
                    {candidateLoading
                      ? "Loading partners…"
                      : "Choose a partner"}
                  </option>
                  {candidates.map((p) => (
                    <option value={p.id} key={p.id}>
                      {p.partner_code} ·{" "}
                      {p.profile?.full_name ||
                        p.service_level?.name ||
                        "Approved"}
                    </option>
                  ))}
                </select>
                <p className="admin-note">
                  Shows up to 20 matches. Search for a code to narrow the list.
                  Availability, level and pilot distance are checked by the
                  server.
                </p>
              </>
            ) : null}
            {decision.action === "price" ? (
              <>
                <label htmlFor="price">Customer price (₹)</label>
                <input
                  id="price"
                  className="admin-field"
                  type="number"
                  min="1"
                  step="0.01"
                  required
                  disabled={busy}
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
                <label htmlFor="fee">Platform fee (%)</label>
                <input
                  id="fee"
                  className="admin-field"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  required
                  disabled={busy}
                  value={fee}
                  onChange={(e) => setFee(e.target.value)}
                />
                <p className="admin-note">
                  Applies to new booking quotes. Existing bookings keep their
                  recorded price.
                </p>
              </>
            ) : null}
            {needsReason ? (
              <>
                <label htmlFor="decision-reason">
                  {decision.action === "resolve"
                    ? "Resolution for the customer"
                    : "Clear reason / correction instructions"}
                </label>
                <textarea
                  id="decision-reason"
                  className="admin-field"
                  required
                  minLength={5}
                  maxLength={500}
                  disabled={busy}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain what happened and what to do next."
                />
              </>
            ) : null}
            <label
              style={{ display: "flex", gap: 10, alignItems: "flex-start" }}
            >
              <input
                type="checkbox"
                required
                checked={confirmed}
                disabled={busy}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              <span>I have reviewed this record and confirm this action.</span>
            </label>
            {actionError ? (
              <div role="alert" className="admin-banner error">
                {actionError}
              </div>
            ) : null}
            <div className="admin-actions">
              <button
                className="admin-button"
                type="button"
                disabled={busy}
                onClick={() => setDecision(null)}
              >
                Cancel
              </button>
              <button
                className="admin-button primary"
                type="submit"
                disabled={
                  busy ||
                  !confirmed ||
                  (needsReason && reason.trim().length < 5) ||
                  (decision.action === "assign" && !partnerId)
                }
              >
                {busy ? "Saving safely…" : "Confirm action"}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </main>
  );
}
