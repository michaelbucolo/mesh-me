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
      <path d="M6.3 7.6 12 5m5.7 2.6L12 5M6.3 7.6v6.8m11.4-6.8v6.8M6.3 14.4 12 19m5.7-4.6L12 19" opacity="0.55" />
      <circle cx="12" cy="4.7" r="1.9" fill="currentColor" stroke="none" />
      <circle cx="5.8" cy="7.8" r="1.9" fill="currentColor" stroke="none" />
      <circle cx="18.2" cy="7.8" r="1.9" fill="currentColor" stroke="none" />
      <circle cx="5.8" cy="14.6" r="1.9" fill="currentColor" stroke="none" />
      <circle cx="18.2" cy="14.6" r="1.9" fill="currentColor" stroke="none" />
      <circle cx="12" cy="18.9" r="1.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function FlowIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="3.2" />
      <path d="M10.2 9.1c0-.5.55-.83.99-.57l4.16 2.9c.43.29.43.85 0 1.14l-4.16 2.9c-.44.26-.99-.07-.99-.57V9.1Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function MeChatIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M4 6.4A2.4 2.4 0 0 1 6.4 4h11.2A2.4 2.4 0 0 1 20 6.4v7.2a2.4 2.4 0 0 1-2.4 2.4H9.2L4.8 19.8A0.6 0.6 0 0 1 4 19.3V6.4Z" />
      <path d="M8.4 10h7.2M8.4 12.8h4.4" />
    </svg>
  );
}

export function ProfileIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="8.2" r="3.8" />
      <path d="M4.8 20c.7-3.9 3.6-6 7.2-6s6.5 2.1 7.2 6" />
    </svg>
  );
}

export function NotificationsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M6.5 15.4c-.55.5-.2 1.4.55 1.4h9.9c.75 0 1.1-.9.55-1.4-.9-.85-1.7-1.95-1.7-4.7 0-3.05-1.7-5.3-3.8-5.3s-3.8 2.25-3.8 5.3c0 2.75-.8 3.85-1.7 4.7Z" />
      <path d="M10.1 19.2a2.1 2.1 0 0 0 3.8 0" />
      <circle cx="12" cy="4.4" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

