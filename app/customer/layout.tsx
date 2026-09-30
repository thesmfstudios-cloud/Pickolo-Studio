"use client";
import "./customer.css";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import CustomerNav from "@/components/customer-nav";
import { supabaseBrowser } from "@/lib/supabase-browser";
export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  useEffect(() => {
    supabaseBrowser.auth.getSession().then(({ data }) => {
      if (!data.session)
        router.replace(
          "/auth?next=" +
            encodeURIComponent(
              window.location.pathname + window.location.search,
            ),
        );
    });
    const { data } = supabaseBrowser.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_OUT" && !session) router.replace("/auth");
      },
    );
    return () => data.subscription.unsubscribe();
  }, [router]);
  return (
    <div className="customer-app">
      <div className="premium-frame">{children}</div>
      <CustomerNav />
    </div>
  );
}
