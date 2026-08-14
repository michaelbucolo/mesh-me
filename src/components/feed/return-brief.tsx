import Link from "next/link";
import { CalendarCheck2, Check, Inbox, Newspaper, UserPlus } from "lucide-react";
import { markCaughtUp } from "@/lib/actions";
import { readReturnBrief } from "@/lib/return-brief";

// Server component: the read happens where the feed page already reads, and
// the strip arrives in the HTML. Each row is a deep link to where acting on
// the fact goes; "Caught up" is a server action that moves the cursor. When
// nothing happened, this renders NOTHING — never an empty cheer.
export async function ReturnBrief({ user }: { user: { id: string; caughtUpAt: Date | null } }) {
  const brief = await readReturnBrief(user);
  if (!brief) return null;

  const rows = [
    brief.needsYou > 0 && {
      key: "needs-you",
      icon: Inbox,
      href: "/inbox?filter=needs-you",
      label:
        brief.needsYou === 1
          ? "1 thing started waiting on you"
          : `${brief.needsYou} things started waiting on you`,
    },
    brief.newFromFollowed > 0 && {
      key: "following",
      icon: Newspaper,
      href: "/feed?source=following",
      label:
        brief.newFromFollowed === 1
          ? "1 new post from people you follow"
          : `${brief.newFromFollowed} new posts from people you follow`,
    },
    brief.newFollowers > 0 && {
      key: "followers",
      icon: UserPlus,
      href: "/notifications",
      label: brief.newFollowers === 1 ? "1 new follower" : `${brief.newFollowers} new followers`,
    },
    brief.publishedWhileAway > 0 && {
      key: "published",
      icon: CalendarCheck2,
      href: "/compose/queue",
      label:
        brief.publishedWhileAway === 1
          ? "1 scheduled post went out while you were away"
          : `${brief.publishedWhileAway} scheduled posts went out while you were away`,
    },
  ].filter((row): row is Exclude<typeof row, false> => Boolean(row));

  return (
    <section
      aria-label="Since you left"
      data-testid="return-brief"
      className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Since you left</h2>
        <form action={markCaughtUp}>
          <button
            type="submit"
            className="flex min-h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
          >
            <Check size={13} aria-hidden="true" />
            Caught up
          </button>
        </form>
      </div>
      <ul className="mt-2 grid gap-1">
        {rows.map((row) => {
          const Icon = row.icon;
          return (
            <li key={row.key}>
              <Link
                href={row.href}
                className="flex min-h-9 items-center gap-2.5 rounded-lg px-2 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
              >
                <Icon size={15} aria-hidden="true" className="shrink-0 text-[var(--accent-text)]" />
                {row.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
