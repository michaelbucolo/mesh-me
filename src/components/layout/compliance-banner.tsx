"use client";

import Link from "next/link";
import { useState } from "react";
import { FileCheck2, ShieldCheck } from "lucide-react";

const CONSENT_VERSION = "2026-04";

interface ComplianceBannerProps {
  username: string;
}

export function ComplianceBanner({ username }: ComplianceBannerProps) {
  const [visible, setVisible] = useState(() => {
    if (typeof window === "undefined") return false;
    const key = `mesh:compliance-consent:${username}`;
    const existing = localStorage.getItem(key);
    return existing !== CONSENT_VERSION;
  });

  if (!visible) return null;

  return (
    <div className="mb-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-3 md:p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-300">
            <ShieldCheck className="h-3.5 w-3.5" />
            Trust & Compliance
          </p>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            mesh.me enforces secure transport and privacy-first policies. Please review our
            {" "}
            <Link href="/trust" className="underline decoration-dotted hover:text-[var(--text-primary)]">Trust Center</Link>,
            {" "}
            <Link href="/privacy" className="underline decoration-dotted hover:text-[var(--text-primary)]">Privacy Policy</Link>,
            {" "}
            and
            {" "}
            <Link href="/terms" className="underline decoration-dotted hover:text-[var(--text-primary)]">Terms of Service</Link>.
          </p>
        </div>
        <button
          onClick={() => {
            const key = `mesh:compliance-consent:${username}`;
            localStorage.setItem(key, CONSENT_VERSION);
            setVisible(false);
          }}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500/20 px-3 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/30 transition"
        >
          <FileCheck2 className="h-3.5 w-3.5" />
          I Understand
        </button>
      </div>
    </div>
  );
}
