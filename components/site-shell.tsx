"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
export default function SiteShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  if (
    path.startsWith("/customer") ||
    path.startsWith("/auth") ||
    path === "/design-preview" ||
    path === "/help" ||
    path === "/choose-location"
  )
    return <>{children}</>;
  return (
    <div className="shell">
      <header className="topbar">
        <div className="container topbar-inner">
          <Link href="/" className="brand">
            PICKOLO
          </Link>
          <nav className="nav">
            <Link href="/customer">Customer</Link>
            <Link href="/partner">Partner</Link>
            <Link href="/admin">Admin</Link>
          </nav>
        </div>
      </header>
      {children}
      <footer className="footer">
        <div className="container">
          Pickolo by SMF Studios · Bhopal
          <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/refund-policy">Refunds</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
