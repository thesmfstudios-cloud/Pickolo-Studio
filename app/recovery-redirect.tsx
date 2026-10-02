"use client";
import { useEffect } from "react";
import { recoveryRedirect } from "@/lib/recovery-link";

export default function RecoveryRedirect() {
  useEffect(() => {
    const destination = recoveryRedirect(window.location.hash);
    if (destination) window.location.replace(destination);
  }, []);
  return null;
}
