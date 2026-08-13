import { FileText } from "lucide-react";

/**
 * The Mesh Report's shelf: the last three closed months and the last closed
 * year, as plain text links that open the document. Server component, mounted
 * ONLY for MeshPro members (the page holds the explicit isMeshPro condition,
 * and the analytics-report gate pins it) — free accounts see no locked
 * version of this, because a locked verb is a tease and the product bans it.
 */
export function ReportShelf({ accountCreatedAt }: { accountCreatedAt: Date }) {
  const now = new Date();
  const created = accountCreatedAt.getTime();

  const months: { param: string; label: string }[] = [];
  for (let back = 1; back <= 3; back += 1) {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
    // A month the account never saw any of would be an empty document.
    if (end.getTime() <= created) continue;
    months.push({
      param: `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`,
      label: new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" }).format(start),
    });
  }

  const lastClosedYear = now.getUTCFullYear() - 1;
  const yearEnd = Date.UTC(lastClosedYear + 1, 0, 1);
  const year = yearEnd > created ? { param: String(lastClosedYear), label: String(lastClosedYear) } : null;

  if (!months.length && !year) return null;

  const rows = [...months, ...(year ? [{ ...year, label: `The year ${year.label}` }] : [])];

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] p-5">
      <div className="flex items-center gap-2">
        <FileText className="size-4 text-[var(--accent-text)]" aria-hidden />
        <h2 className="text-sm font-semibold text-[var(--mesh-text)]">The Mesh Report</h2>
      </div>
      <p className="text-sm text-[var(--mesh-text-secondary)]">
        A closed period set on one page — totals against the period before, your top posts, what
        worked, honestly caveated. Print it, save it as PDF, or take the card.
      </p>
      <ul className="flex flex-col gap-1.5">
        {rows.map((row) => (
          <li key={row.param} className="text-sm text-[var(--mesh-text-secondary)]">
            <span className="text-[var(--mesh-text)]">{row.label}</span>
            {" — "}
            <a
              href={`/api/analytics/report?period=${row.param}`}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-[var(--accent-text)] underline underline-offset-4"
            >
              open
            </a>
            {" · "}
            <a
              href={`/api/analytics/report/card?period=${row.param}`}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-[var(--accent-text)] underline underline-offset-4"
            >
              card
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
