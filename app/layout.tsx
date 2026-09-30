import "./globals.css";
import type { Metadata, Viewport } from "next";
import SiteShell from "@/components/site-shell";
export const metadata: Metadata = {
  title: "Pickolo · Your moments, beautifully captured",
  description:
    "Book photography and videography in Bhopal. Plan your shoot, meet your creator and receive your original files.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Pickolo" },
  icons: { icon: "/icon.svg" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#faf7f1",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  );
}
