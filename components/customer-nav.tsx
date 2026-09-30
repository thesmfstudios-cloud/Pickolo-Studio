"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon, { IconName } from "./customer-icon";
export default function CustomerNav() {
  const path = usePathname();
  const tabs: [string, string, IconName][] = [
    ["/customer", "Home", "home"],
    ["/customer/bookings", "Bookings", "calendar"],
    ["/customer/profile", "Profile", "user"],
  ];
  return (
    <nav className="premium-nav" aria-label="Customer navigation">
      {tabs.map(([href, label, icon]) => {
        const active =
          href === "/customer"
            ? path === href ||
              path === "/customer/new" ||
              path === "/design-preview"
            : href === "/customer/bookings"
              ? path === href || path === "/customer/booking"
              : path.startsWith(href) ||
                path === "/customer/help" ||
                path === "/customer/notifications";
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={active ? "active" : ""}
          >
            <Icon name={icon} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
