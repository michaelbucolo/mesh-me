import Link from "next/link";
import { ArrowUpRight, Home, Search } from "lucide-react";
import { cn } from "@/lib/utils";

type LostMeshNotFoundProps = {
  homeHref?: string;
  searchHref?: string;
  supportHref?: string;
  fullScreen?: boolean;
};

export function LostMeshNotFound({ homeHref = "/", searchHref = "/search", supportHref = "/support", fullScreen }: LostMeshNotFoundProps) {
  return (
    <section className={cn("mesh-recovery", fullScreen && "mesh-recovery-full")} data-meshi-zone="not-found">
      <div className="mesh-recovery-card plate">
        <div className="mesh-recovery-code">404 · Beyond this mesh</div>
        <svg className="mesh-recovery-visual" viewBox="0 0 320 168" aria-hidden="true">
          <ellipse cx="160" cy="84" rx="127" ry="61" />
          <ellipse cx="160" cy="84" rx="79" ry="38" />
          <path className="mesh-recovery-path" d="M33 84C90 155 121 5 183 65S262 112 291 48" />
          <circle cx="33" cy="84" r="5" /><circle cx="183" cy="65" r="5" />
          <circle cx="291" cy="48" r="21" />
          <circle className="mesh-recovery-node" cx="285" cy="48" r="2.5" /><circle className="mesh-recovery-node" cx="297" cy="48" r="2.5" />
        </svg>
        <h1 className="mesh-recovery-title">A little off the map.</h1>
        <p className="mesh-recovery-description">This page may have moved, or the link may be incomplete. There’s plenty more to explore.</p>
        <div className="mesh-recovery-actions">
          <Link href={homeHref} className="mesh-recovery-action mesh-recovery-action-primary"><Home className="h-4 w-4" aria-hidden="true" />Home</Link>
          <Link href={searchHref} className="mesh-recovery-action"><Search className="h-4 w-4" aria-hidden="true" />Search Mesh.me</Link>
          <Link href={supportHref} className="mesh-recovery-action">Get help<ArrowUpRight className="h-4 w-4" aria-hidden="true" /></Link>
        </div>
      </div>
    </section>
  );
}
