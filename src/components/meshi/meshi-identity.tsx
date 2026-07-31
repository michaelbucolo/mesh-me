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
        <MeshiBrandMark size={size + 2} className="shrink-0" />
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
