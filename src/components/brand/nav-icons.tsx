import type { ComponentType, SVGProps } from "react";

export type BrandIcon = ComponentType<SVGProps<SVGSVGElement>>;

function base(props: SVGProps<SVGSVGElement>) {
  return {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...props,
  };
}

export function MeshIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M12 12 5.2 6.8M12 12l7-2.4M12 12l-5.6 6.4M12 12l4.8 6.2M5.2 6.8l13.8 2.8M6.4 18.4l10.4-.2" opacity="0.55" />
      <circle cx="12" cy="12" r="2.1" fill="currentColor" stroke="none" />
      <circle cx="5.2" cy="6.8" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="19" cy="9.6" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="6.4" cy="18.4" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="16.8" cy="18.2" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function FlowIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M4 6.5c3.2-2.4 6-2.4 8 0s4.8 2.4 8 0" />
      <path d="M4 12c3.2-2.4 6-2.4 8 0s4.8 2.4 8 0" />
      <path d="M4 17.5c3.2-2.4 6-2.4 8 0s4.8 2.4 8 0" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function MeChatIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M12 3.5c-4.9 0-8.5 3.2-8.5 7.5 0 2.4 1.2 4.5 3.1 5.9L6 20.7l3.6-1.6c.8.2 1.6.3 2.4.3 4.9 0 8.5-3.2 8.5-7.4S16.9 3.5 12 3.5Z" />
      <circle cx="9.4" cy="11" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="14.6" cy="11" r="1.15" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function ProfileIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="8.4" r="3.6" />
      <path d="M5 20c.9-3.4 3.7-5.2 7-5.2s6.1 1.8 7 5.2" />
      <circle cx="18.6" cy="5.2" r="1.3" fill="currentColor" stroke="none" />
      <path d="M15.9 6.9c.7-.5 1.3-1 1.8-1.4" opacity="0.55" />
    </svg>
  );
}

export function ExploreIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M12 3.4c.9 3.7 2.3 5.7 8.6 8.6-6.3 2.9-7.7 4.9-8.6 8.6-.9-3.7-2.3-5.7-8.6-8.6 6.3-2.9 7.7-4.9 8.6-8.6Z" />
      <circle cx="19.4" cy="4.6" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="4.8" cy="19.2" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}
