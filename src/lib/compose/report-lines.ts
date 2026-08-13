// THE ONE RENDERER OF A PUBLISH REPORT'S LINES.
//
// The composer showed these after a live publish; the queue shows the same
// after a scheduled one. Extracted so the honesty contract cannot fork — a
// second mapping would eventually round "failed" up to something softer on
// one surface, and the report's whole value is that it reads the same
// everywhere.

import { ruleFor } from "./plan";
import type { PublishReport } from "./publish";

export function reportLines(report: PublishReport): string[] {
  return report.outcomes.map((o) =>
    o.state === "posted"
      ? `${labelFor(o.platform)} — posted`
      : o.state === "skipped"
        ? `${labelFor(o.platform)} — skipped: ${o.reason}`
        : `${labelFor(o.platform)} — failed: ${o.message}`,
  );
}

function labelFor(platform: string): string {
  return ruleFor(platform)?.label ?? platform;
}
