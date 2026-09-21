import { PaperWait } from "./paper-wait";

/** The companion remains mounted at the app root; this adds only a long-wait caption, never a second Meshi. */
export function MeshiWait({ headline, detail, className = "" }: { headline: string; /** Only a real, counted amount. Omit when unknown. */ detail?: string; className?: string }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className={`meshi-wait ${className}`.trim()}>
      <div className="meshi-wait-body">
        <span className="meshi-wait-thread"><PaperWait /></span>
        <p className="meshi-wait-headline">{headline}</p>
        {detail ? <p className="meshi-wait-detail">{detail}</p> : null}
      </div>
    </div>
  );
}
