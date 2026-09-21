"use client";

import Link from "next/link";
import { ArrowUpRight, Home, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

type ConnectionSnappedErrorProps = {
  reset?: () => void;
  resetLabel?: string;
  homeHref?: string;
  supportHref?: string;
  fullScreen?: boolean;
  compact?: boolean;
};

export function ConnectionSnappedError({ reset, resetLabel = "Try again", homeHref = "/", supportHref = "/support", fullScreen, compact }: ConnectionSnappedErrorProps) {
  return (
    <section className={cn("mesh-recovery", fullScreen && "mesh-recovery-full")} data-meshi-zone="server-error">
      <div className={cn("mesh-recovery-card plate", compact && "mesh-recovery-card-compact")}>
        <div className="mesh-recovery-code">Connection interrupted</div>
        <svg className="mesh-recovery-visual" viewBox="0 0 320 168" aria-hidden="true">
          <ellipse cx="160" cy="84" rx="133" ry="58" />
          <ellipse cx="160" cy="84" rx="87" ry="38" />
          <path className="mesh-recovery-path" d="M27 84C69 37 108 133 139 88M181 80C213 35 252 128 293 84" />
          <circle cx="27" cy="84" r="6" /><circle cx="293" cy="84" r="6" />
          <circle cx="160" cy="84" r="25" />
          <circle className="mesh-recovery-node" cx="153" cy="84" r="2.5" /><circle className="mesh-recovery-node" cx="167" cy="84" r="2.5" />
        </svg>
        <h1 className="mesh-recovery-title">Let’s reconnect.</h1>
        <p className="mesh-recovery-description">This page couldn’t finish loading. Try it again, or head back to your world.</p>
        <div className="mesh-recovery-actions">
          {reset ? <button type="button" onClick={reset} className="mesh-recovery-action mesh-recovery-action-primary"><RefreshCw className="h-4 w-4" aria-hidden="true" />{resetLabel}</button> : null}
          <Link href={homeHref} className={cn("mesh-recovery-action", !reset && "mesh-recovery-action-primary")}><Home className="h-4 w-4" aria-hidden="true" />Home</Link>
          <Link href={supportHref} className="mesh-recovery-action">Get help<ArrowUpRight className="h-4 w-4" aria-hidden="true" /></Link>
        </div>
      </div>
    </section>
  );
}
