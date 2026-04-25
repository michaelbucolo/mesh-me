"use client";

import { useEffect, useState } from "react";
import { PremiumTopbar } from "@/components/layout/premium-topbar";
import { PremiumCommandCenter } from "@/components/layout/premium-command-center";
import { AppContentShell } from "@/components/layout/app-content-shell";
import { MobileTopbar } from "@/components/layout/mobile-topbar";
import { VerificationBanner } from "@/components/verification/verification-banner";
import { ComplianceBanner } from "@/components/layout/compliance-banner";

interface AppChromeProps {
  children: React.ReactNode;
  unreadNotifications: number;
  unreadMessages: number;
  username: string;
  needsEmailVerification: boolean;
  needsPhoneVerification: boolean;
  userEmail: string;
}

export function AppChrome({
  children,
  unreadNotifications,
  unreadMessages,
  username,
  needsEmailVerification,
  needsPhoneVerification,
  userEmail,
}: AppChromeProps) {
  const [commandOpen, setCommandOpen] = useState(false);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <>
      <PremiumTopbar
        unreadNotifications={unreadNotifications}
        unreadMessages={unreadMessages}
        onOpenCommandCenter={() => setCommandOpen(true)}
      />
      <MobileTopbar username={username} />

      <main className="mobile-app-chrome relative flex-1 overflow-y-auto overflow-x-hidden px-3 pb-36 pt-3 sm:px-4 md:px-5 md:pt-4 lg:px-6 lg:pb-8 lg:pt-5 xl:px-8">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-[radial-gradient(ellipse_at_top,rgba(92,168,255,0.14),transparent_70%)]" />
        <div className="mx-auto w-full max-w-[112rem] space-y-3 lg:space-y-4">
          {(needsEmailVerification || needsPhoneVerification) && (
            <VerificationBanner
              needsEmailVerification={needsEmailVerification}
              needsPhoneVerification={needsPhoneVerification}
              userEmail={userEmail}
            />
          )}
          <ComplianceBanner username={username} />
          <AppContentShell>{children}</AppContentShell>
        </div>
      </main>

      <PremiumCommandCenter open={commandOpen} onClose={() => setCommandOpen(false)} username={username} />
    </>
  );
}
