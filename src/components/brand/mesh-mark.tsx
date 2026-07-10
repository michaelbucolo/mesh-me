import type { SVGProps } from "react";

/**
 * The mesh.me logo mark: an angular "M" (two peaks) in a rounded square with
 * the brand gradient, matching the reference designs. Appears in the sidebar,
 * the auth entry, and anywhere the brand lockup is shown.
 */
export function MeshMark({
  size = 32,
  className,
  ...props
}: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <defs>
        <linearGradient id="mesh-mark-fill" x1="4" y1="4" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5B8DEF" />
          <stop offset="0.52" stopColor="#8B5CF6" />
          <stop offset="1" stopColor="#EC4899" />
        </linearGradient>
        <linearGradient id="mesh-mark-sheen" x1="8" y1="6" x2="20" y2="24" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" stopOpacity="0.28" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="1.5" y="1.5" width="37" height="37" rx="11" fill="url(#mesh-mark-fill)" />
      <rect x="1.5" y="1.5" width="37" height="37" rx="11" fill="url(#mesh-mark-sheen)" />
      <rect
        x="1.5"
        y="1.5"
        width="37"
        height="37"
        rx="11"
        stroke="#ffffff"
        strokeOpacity="0.16"
      />
      {/* Angular M: two peaks meeting at a center valley. */}
      <path
        d="M10 28.5V13.2c0-.9 1.1-1.3 1.7-.6L20 22l8.3-9.4c.6-.7 1.7-.3 1.7.6v15.3"
        stroke="#ffffff"
        strokeWidth="3.1"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="20" cy="24.4" r="1.7" fill="#ffffff" />
    </svg>
  );
}
