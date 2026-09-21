import { cn } from "@/lib/utils";

/** Connected worlds, drawn without animation loops or image requests. */
export function SignatureArt({ className }: { className?: string }) {
  return (
    <div className={cn("mesh-signature-art", className)} aria-hidden="true">
      <svg viewBox="0 0 480 320" fill="none" focusable="false">
        <g className="mesh-orbit-lines" stroke="currentColor" strokeWidth="0.8">
          <ellipse cx="244" cy="160" rx="174" ry="68" transform="rotate(-30 244 160)" />
          <ellipse cx="244" cy="160" rx="174" ry="68" transform="rotate(30 244 160)" />
          <ellipse cx="244" cy="160" rx="72" ry="144" transform="rotate(-20 244 160)" />
          <circle cx="244" cy="160" r="107" strokeDasharray="2 9" />
          <path d="M28 251C130 315 167 36 270 72S331 267 451 73" />
        </g>
        <g className="mesh-orbit-nodes" fill="currentColor">
          <circle cx="113" cy="103" r="5" /><circle cx="386" cy="229" r="4" />
          <circle cx="313" cy="42" r="3" /><circle cx="154" cy="238" r="3" />
          <circle cx="422" cy="113" r="2" /><circle cx="76" cy="243" r="2" />
        </g>
        <g className="mesh-orbit-center" stroke="currentColor">
          <circle cx="244" cy="160" r="29" fill="var(--paper-1)" strokeWidth="1.2" />
          <circle cx="244" cy="160" r="38" strokeDasharray="2 7" strokeWidth=".8" opacity=".45" />
          <path d="M235 155v9m18-9v9" strokeWidth="4" strokeLinecap="round" />
        </g>
        <path className="mesh-orbit-star" d="M367 73v12m-6-6h12M99 178v8m-4-4h8M290 273v8m-4-4h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </div>
  );
}

export function PageIntro({ title, description, eyebrow, action, heading = "h2", className }: {
  title: React.ReactNode;
  description: string;
  eyebrow?: string;
  action?: React.ReactNode;
  heading?: "h1" | "h2";
  className?: string;
}) {
  const Heading = heading;
  return (
    <header className={cn("mesh-page-intro", className)}>
      <SignatureArt />
      <div className="mesh-page-intro-copy">
        {eyebrow && <p className="mesh-page-eyebrow"><span aria-hidden="true" />{eyebrow}</p>}
        <Heading className="mesh-page-title">{title}</Heading>
        <p className="mesh-page-description">{description}</p>
        {action && <div className="mesh-page-intro-action">{action}</div>}
      </div>
    </header>
  );
}
