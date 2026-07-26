"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { UserMeshi } from "@/components/meshi/user-meshi";
import { MeshiBrandMark } from "@/components/brand/meshi-brand-mark";

interface MeshiBrandLockupProps {
  href?: string;
  size?: number;
  label?: string;
  subtitle?: string;
  className?: string;
  useUserMeshi?: boolean;
  showWordmark?: boolean;
}

function BrandContents({
  size = 32,
  label = "Mesh.me",
  subtitle,
  showWordmark = true,
  useUserMeshi = false,
}: MeshiBrandLockupProps) {
  return (
    <>
      {useUserMeshi ? (
        <UserMeshi size={size} animate={false} className="shrink-0" />
      ) : (
        <MeshiBrandMark size={size + 2} className="shrink-0 transition-transform duration-200 group-hover:scale-105" />
      )}
      {showWordmark && (
        <span className="mesh-brand-wordmark-wrap min-w-0">
          <span className="brand-wordmark block truncate text-[var(--text-primary)]">{label}</span>
          {subtitle && <span className="block truncate text-xs font-medium text-[var(--text-muted)]">{subtitle}</span>}
        </span>
      )}
    </>
  );
}

export function MeshiBrandLockup({ href, className, ...props }: MeshiBrandLockupProps) {
  const classes = cn("mesh-brand-lockup mesh-pressable inline-flex items-center gap-3 rounded-md text-left font-semibold", className);

  if (href) {
    return (
      <Link href={href} className={classes}>
        <BrandContents {...props} />
      </Link>
    );
  }

  return (
    <div className={classes}>
      <BrandContents {...props} />
    </div>
  );
}

interface UserMeshiBadgeProps {
  displayName?: string | null;
  username?: string | null;
  size?: number;
  compact?: boolean;
  className?: string;
}

export function UserMeshiBadge({
  displayName,
  username,
  size = 36,
  compact = false,
  className,
}: UserMeshiBadgeProps) {
  const name = displayName || "Mesh user";
  const handle = username ? `@${username}` : "Your World, Your Way";
  const meshiLabel = username ? `${handle} uses the same Meshi companion` : `Single Meshi for ${name}`;

  return (
    <div
      className={cn("inline-flex min-w-0 items-center gap-3", className)}
      aria-label={`Meshi represents ${name} on Mesh.me`}
    >
      <span className="relative inline-flex shrink-0">
        {/* An identity badge is a picture of you, not a second you. Motion is
            reserved for the one companion — see user-meshi.tsx. */}
        <UserMeshi size={size} />
        <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border border-[var(--bg-primary)] bg-emerald-400" />
      </span>
      {!compact && (
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-[var(--text-primary)]">Your Meshi</span>
          <span className="block truncate text-xs text-[var(--text-muted)]">{meshiLabel}</span>
        </span>
      )}
    </div>
  );
}
