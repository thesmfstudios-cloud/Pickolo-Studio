"use client";
import { useEffect, useRef } from "react";
import { humanize } from "@/lib/admin-model";
export function Icon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    overview: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
    bookings: "M4 5h16v16H4z M8 3v4 M16 3v4 M4 11h16",
    applications: "M4 4h12v16H4z M8 8h5 M8 12h4 M16 16l2 2 4-5",
    partners:
      "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M17 4a4 4 0 0 1 0 7",
    documents: "M6 3h9l5 5v13H6z M14 3v6h6 M9 14h8 M9 17h6",
    payouts: "M3 5h18v14H3z M3 9h18 M15 14h3",
    support: "M4 17V9a8 8 0 0 1 16 0v8 M4 11H2v6h4v-6 M20 11h2v6h-4v-6",
    pricing: "M4 4h8l9 9-8 8-9-9z M8 8h.01",
    activity: "M12 3a9 9 0 1 1-8 5 M3 3v5h5 M12 7v5l3 2",
    refresh:
      "M20 8a8 8 0 0 0-14-3L3 8 M3 3v5h5 M4 16a8 8 0 0 0 14 3l3-3 M21 21v-5h-5",
    empty: "M3 7l4-4h10l4 4v14H3z M3 7h18 M8 12h8 M9 16h6",
  };
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] || paths.overview} />
    </svg>
  );
}
export function Badge({ value = "unknown" }: { value?: string }) {
  const good = ["approved", "COMPLETED", "released", "processed", "resolved"],
    bad = [
      "rejected",
      "suspended",
      "CANCELLED",
      "failed",
      "reversed",
      "DISPUTED",
    ];
  return (
    <span
      className={`admin-badge ${good.includes(value) ? "good" : bad.includes(value) ? "bad" : "warn"}`}
    >
      {humanize(value)}
    </span>
  );
}
export function Empty({
  title = "Nothing here yet",
  detail = "New records will appear here when available.",
}: {
  title?: string;
  detail?: string;
}) {
  return (
    <div className="admin-empty">
      <Icon name="empty" />
      <h2>{title}</h2>
      <p>{detail}</p>
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  busy = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const prior = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
      prior?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="admin-dialog"
      aria-labelledby="admin-dialog-title"
      onCancel={(e) => {
        if (busy) e.preventDefault();
        else onClose();
      }}
    >
      <div className="admin-panel-heading">
        <h2 id="admin-dialog-title">{title}</h2>
        <button
          className="admin-button"
          aria-label="Close dialog"
          disabled={busy}
          onClick={onClose}
        >
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
