"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { MeshiCommand } from "@/components/meshi/meshi-command";
import { MeshiFloat } from "@/components/meshi/meshi-float";

interface AppShellProps {
  children: React.ReactNode;
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    isAdmin: boolean;
  };
  unreadNotifications: number;
}

export function AppShell({ children, user, unreadNotifications }: AppShellProps) {
  const [meshiOpen, setMeshiOpen] = useState(false);

  // Global Cmd+K shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setMeshiOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      <div className="relative z-10 flex">
        <Sidebar
          user={user}
          unreadNotifications={unreadNotifications}
          onOpenMeshi={() => setMeshiOpen(true)}
        />
        <main className="flex-1 min-h-screen pb-20 lg:pb-0">
          {children}
        </main>
      </div>
      <MobileNav
        unreadNotifications={unreadNotifications}
        username={user.username}
        onOpenMeshi={() => setMeshiOpen(true)}
      />
      <MeshiFloat />
      <MeshiCommand
        isOpen={meshiOpen}
        onClose={() => setMeshiOpen(false)}
        username={user.username}
      />
    </>
  );
}
