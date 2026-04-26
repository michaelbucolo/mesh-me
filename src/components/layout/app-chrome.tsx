"use client";

import { useEffect, useState } from "react";
import { PremiumTopbar } from "@/components/layout/premium-topbar";
import { PremiumCommandCenter } from "@/components/layout/premium-command-center";
import { AppContentShell } from "@/components/layout/app-content-shell";
import { MobileTopbar } from "@/components/layout/mobile-topbar";

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
  needsEmailVerification: _needsEmailVerification,
  needsPhoneVerification: _needsPhoneVerification,
  userEmail: _userEmail,
}: AppChromeProps) {
  const [commandOpen, setCommandOpen] = useState(false);
  void _needsEmailVerification;
  void _needsPhoneVerification;
  void _userEmail;

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

      <main className="mobile-app-chrome relative flex-1 overflow-y-auto overflow-x-hidden px-3 pb-32 pt-2 sm:px-4 md:px-5 md:pt-3 lg:px-6 lg:pb-8 lg:pt-4 xl:px-8">
        <div className="mx-auto w-full max-w-[112rem]">
          <AppContentShell>{children}</AppContentShell>
        </div>
      </main>

      <PremiumCommandCenter open={commandOpen} onClose={() => setCommandOpen(false)} username={username} />
    </>
  );
}
