import type { Metadata } from "next";
import "../admin/admin.css";
import ResetPasswordForm from "./reset-password-form";

export const metadata: Metadata = {
  title: "Reset password | Pickolo",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
