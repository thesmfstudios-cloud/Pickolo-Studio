// Local visual QA uses the real components. This route always returns 404 in a production build.
import "../customer/customer.css";
import { notFound } from "next/navigation";
import CustomerHome from "../customer/page";
import PlanShoot from "../customer/new/page";
import CustomerNav from "@/components/customer-nav";
export default async function Preview({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  if (process.env.NODE_ENV !== "development") notFound();
  const { view } = await searchParams;
  return (
    <div className="customer-app">
      <div
        style={{
          padding: 8,
          textAlign: "center",
          fontSize: 10,
          color: "#757871",
        }}
      >
        Development preview · Booking writes require customer sign-in
      </div>
      <div className="premium-frame">
        {view === "plan" ? <PlanShoot /> : <CustomerHome />}
      </div>
      <CustomerNav />
    </div>
  );
}
