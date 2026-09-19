import './globals.css';
import Link from 'next/link';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <header className="topbar">
        <div className="container topbar-inner">
          <Link href="/" className="brand">PICKOLO</Link>
          <nav className="nav">
            <Link href="/customer">Customer</Link>
            <Link href="/partner">Partner</Link>
            <Link href="/admin">Admin</Link>
          </nav>
        </div>
      </header>
      {children}
      <footer className="footer"><div className="container">Pickolo App by SMF Studios · MVP Foundation</div></footer>
    </div>
  );
}
