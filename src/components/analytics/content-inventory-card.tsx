import Link from "next/link";
import { FileText, MessageSquare, Video } from "lucide-react";
import type { ContentInventory } from "@/lib/content-inventory";

// A NUMBER THAT TELLS YOU WHAT IT DOES NOT KNOW.
//
// The rest of this page is about the last fourteen days, because that is what
// analytics is normally for. This is the opposite: a lifetime count that does
// not move much and is not supposed to. It answers "how much have I actually
// made?" — a question every platform is happy for you to never ask, because
// the answer is usually startling and it does not sell anything.
//
// It is deliberately a SATISFYING number rather than an engaging one. There is
// nothing to check tomorrow, no streak, no comparison to other people, and no
// reason to open the app again because of it.
//
// ── THE CAVEAT IS THE FEATURE ───────────────────────────────────────────────
//
// Six of the twelve platforms give mesh.me no way to read your content, so
// they contribute zero to this total no matter how long they have been
// connected. Printing "everything you've posted" over that would be a lie told
// with arithmetic — and `unified-claim:check` reads this file, so the honest
// wording is enforced rather than merely intended.
//
// The coverage line is therefore not a disclaimer in small print at the bottom.
// It sits directly under the numbers and names YOUR accounts: the ones that fed
// this, and the ones that could not. For someone whose life is on Instagram,
// that line is the single most useful sentence on the page.

function formatCount(value: number): string {
  return value.toLocaleString();
}

/** "Instagram", "Instagram and Pinterest", "Instagram, Pinterest and LinkedIn" */
function listNames(entries: { name: string }[]): string {
  const names = entries.map((e) => e.name);
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export function ContentInventoryCard({ inventory }: { inventory: ContentInventory }) {
  const { postsAndPhotos, videos, commentsAndReplies, readable, unreadable } = inventory;
  const total = postsAndPhotos + videos + commentsAndReplies;

  const rows = [
    { label: "Posts and photos", value: postsAndPhotos, Icon: FileText },
    { label: "Videos", value: videos, Icon: Video },
    { label: "Comments and replies", value: commentsAndReplies, Icon: MessageSquare },
  ];

  return (
    <section className="rounded-2xl border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] p-5 sm:p-6">
      <h2 className="text-base font-semibold text-[var(--mesh-text)]">Everything you&apos;ve made</h2>
      <p className="mt-1 text-sm text-[var(--mesh-text-secondary)]">
        {total > 0
          ? `${formatCount(total)} things, counted from Mesh.me and the connected accounts we can read.`
          : "Nothing counted yet — this fills in as you post here and as your connected accounts sync."}
      </p>

      <dl className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-3">
        {rows.map(({ label, value, Icon }) => (
          <div
            key={label}
            className="flex items-center gap-3 rounded-xl border border-[var(--mesh-border)] px-4 py-3"
          >
            <Icon size={18} aria-hidden="true" className="shrink-0 text-[var(--mesh-text-secondary)]" />
            <div className="min-w-0">
              <dd className="text-xl font-semibold tabular-nums text-[var(--mesh-text)]">{formatCount(value)}</dd>
              <dt className="truncate text-xs text-[var(--mesh-text-secondary)]">{label}</dt>
            </div>
          </div>
        ))}
      </dl>

      {/* WHERE THE NUMBER CAME FROM, AND WHERE IT COULD NOT. Never collapsed,
          never abbreviated to "some platforms" — the names are the point. */}
      <div className="mt-4 space-y-1.5 border-t border-[var(--mesh-border)] pt-4 text-xs text-[var(--mesh-text-secondary)]">
        {readable.length > 0 ? (
          <p>
            Counted from Mesh.me and {listNames(readable)}.
          </p>
        ) : (
          <p>Counted from your Mesh.me activity only.</p>
        )}

        {unreadable.length > 0 && (
          <p>
            {listNames(unreadable)} {unreadable.length === 1 ? "is connected but adds" : "are connected but add"} nothing
            to this count. {unreadable.length === 1 ? "Its" : "Their"} official API does not let another app read your
            posts, so we have never had them — and never will, unless that changes.{" "}
            <Link
              href="/connected-accounts"
              className="font-semibold text-[var(--accent-text)] underline underline-offset-4"
            >
              See what each account can do
            </Link>
          </p>
        )}
      </div>
    </section>
  );
}
