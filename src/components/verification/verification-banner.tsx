"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Phone, Shield, X, Check, Loader2 } from "lucide-react";

interface VerificationBannerProps {
  needsEmailVerification: boolean;
  needsPhoneVerification: boolean;
  userEmail: string;
}

export function VerificationBanner({ needsEmailVerification, needsPhoneVerification, userEmail }: VerificationBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [verifyingEmail, setVerifyingEmail] = useState(false);
  const [verifyingPhone, setVerifyingPhone] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [phoneStep, setPhoneStep] = useState<"idle" | "input" | "code" | "verified">("idle");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneCode, setPhoneCode] = useState("");

  if (dismissed || (!needsEmailVerification && !needsPhoneVerification)) return null;

  const handleSendEmailVerification = () => {
    setVerifyingEmail(true);
    // In production, this would call a server action to send verification email
    setTimeout(() => {
      setEmailSent(true);
      setVerifyingEmail(false);
    }, 1500);
  };

  const handleSendPhoneCode = () => {
    if (phoneNumber.length >= 10) {
      setVerifyingPhone(true);
      setTimeout(() => {
        setPhoneStep("code");
        setVerifyingPhone(false);
      }, 1500);
    }
  };

  const handleVerifyPhoneCode = () => {
    if (phoneCode.length === 6) {
      setVerifyingPhone(true);
      setTimeout(() => {
        setPhoneStep("verified");
        setVerifyingPhone(false);
      }, 1500);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="mx-auto max-w-5xl mb-4"
      >
        <div className="rounded-2xl p-4 sm:p-5" style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.08), rgba(59,130,246,0.06))", border: "1px solid rgba(99,102,241,0.15)" }}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent-subtle)] flex-shrink-0">
                <Shield className="h-4.5 w-4.5" style={{ color: "var(--accent)" }} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">Verify your account</h3>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Secure your account by verifying your email and phone number
                </p>
              </div>
            </div>
            <button onClick={() => setDismissed(true)} className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] transition-colors flex-shrink-0">
              <X className="h-3.5 w-3.5 text-[var(--text-muted)]" />
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {/* Email verification */}
            {needsEmailVerification && (
              <div className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-xl" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-primary)" }}>
                <div className="flex items-center gap-2.5">
                  <Mail className="h-4 w-4 text-[var(--text-muted)]" />
                  <div>
                    <p className="text-sm text-[var(--text-primary)] font-medium">Email</p>
                    <p className="text-xs text-[var(--text-muted)]">{userEmail}</p>
                  </div>
                </div>
                {emailSent ? (
                  <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                    <Check className="h-3.5 w-3.5" /> Sent
                  </span>
                ) : (
                  <button
                    onClick={handleSendEmailVerification}
                    disabled={verifyingEmail}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                    style={{ background: "var(--accent-subtle)", color: "var(--accent)" }}
                  >
                    {verifyingEmail ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Verify"}
                  </button>
                )}
              </div>
            )}

            {/* Phone verification */}
            {needsPhoneVerification && (
              <div className="rounded-xl" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-primary)" }}>
                <div className="flex items-center justify-between gap-3 py-2.5 px-3">
                  <div className="flex items-center gap-2.5">
                    <Phone className="h-4 w-4 text-[var(--text-muted)]" />
                    <div>
                      <p className="text-sm text-[var(--text-primary)] font-medium">Phone</p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {phoneStep === "verified" ? "Verified" : "Add a phone number"}
                      </p>
                    </div>
                  </div>
                  {phoneStep === "idle" && (
                    <button
                      onClick={() => setPhoneStep("input")}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                      style={{ background: "var(--accent-subtle)", color: "var(--accent)" }}
                    >
                      Add
                    </button>
                  )}
                  {phoneStep === "verified" && (
                    <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                      <Check className="h-3.5 w-3.5" /> Verified
                    </span>
                  )}
                </div>
                {phoneStep === "input" && (
                  <div className="px-3 pb-3 flex gap-2">
                    <input
                      type="tel" value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="+1 (555) 000-0000"
                      className="flex-1 px-3 py-2 rounded-lg text-sm bg-transparent outline-none"
                      style={{ border: "1px solid var(--border-primary)", color: "var(--text-primary)" }}
                    />
                    <button
                      onClick={handleSendPhoneCode}
                      disabled={verifyingPhone || phoneNumber.length < 10}
                      className="text-xs font-medium px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
                      style={{ background: "var(--accent-subtle)", color: "var(--accent)" }}
                    >
                      {verifyingPhone ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Send code"}
                    </button>
                  </div>
                )}
                {phoneStep === "code" && (
                  <div className="px-3 pb-3 flex gap-2">
                    <input
                      value={phoneCode}
                      onChange={(e) => setPhoneCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="000000"
                      className="flex-1 px-3 py-2 rounded-lg text-sm bg-transparent outline-none text-center tracking-[0.2em] font-mono"
                      style={{ border: "1px solid var(--border-primary)", color: "var(--text-primary)" }}
                      maxLength={6}
                    />
                    <button
                      onClick={handleVerifyPhoneCode}
                      disabled={verifyingPhone || phoneCode.length !== 6}
                      className="text-xs font-medium px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
                      style={{ background: "var(--accent-subtle)", color: "var(--accent)" }}
                    >
                      {verifyingPhone ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Verify"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
