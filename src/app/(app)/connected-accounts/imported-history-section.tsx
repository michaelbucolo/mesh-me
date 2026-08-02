import { getImportedHistory } from "@/lib/portability/imported-history";

/**
 * What has actually been imported from an archive, read back.
 *
 * Nothing read SyncedContent before this. The models existed with a writer that
 * was added in the same breath and no reader at all, which is a shape worth
 * naming: an ingest nobody can see the results of is an ingest nobody can tell
 * has worked. So the reader ships with the writer rather than after it.
 *
 * Renders nothing at all when there is no imported history. An empty card
 * inviting somebody to use a feature that has no entry point yet would be a
 * promise the page cannot keep — the file picker and the Worker that reads an
 * archive in the browser are still to come.
 */
export async function ImportedHistorySection({ userId }: { userId: string }) {
  const history = await getImportedHistory(userId);
  if (history.total === 0) return null;

  const platformLabel = history.platforms
    .map((platform) => platform.charAt(0).toUpperCase() + platform.slice(1))
    .join(", ");

  return (
    <section
      aria-labelledby="imported-history-heading"
      className="mx-auto mt-6 w-full max-w-5xl rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface)] p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="imported-history-heading" className="text-base font-semibold text-[var(--ds-text)]">
          Your history, brought with you
        </h2>
        <p className="text-xs text-[var(--ds-text-muted)]">
          {history.total.toLocaleString()} {history.total === 1 ? "post" : "posts"}
          {platformLabel ? ` from ${platformLabel}` : ""}
        </p>
      </div>

      <p className="mt-1 text-xs leading-5 text-[var(--ds-text-muted)]">
        Read out of an archive you downloaded and kept. It stays here whether or not those accounts
        stay connected — and whether or not those platforms still exist.
      </p>

      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {history.posts.slice(0, 12).map((post) => (
          <li
            key={post.id}
            className="rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface-raised)] p-3"
          >
            <div className="flex items-center justify-between gap-2">
              {/* .mesh-eyebrow, not ad-hoc uppercase + tracking. The type
                  contract treats small caps as one shared device so it reads
                  the same everywhere; spelling it by hand here would be a
                  second, slightly different version of the same idea. */}
              <span className="text-micro mesh-eyebrow text-[var(--ds-text-muted)]">
                {post.platform}
              </span>
              {post.postedAt ? (
                <time
                  dateTime={post.postedAt.toISOString()}
                  className="text-[0.6875rem] text-[var(--ds-text-muted)]"
                >
                  {post.postedAt.toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </time>
              ) : null}
            </div>

            {post.textContent ? (
              <p className="mt-1.5 line-clamp-3 text-sm leading-5 text-[var(--ds-text)]">
                {post.textContent}
              </p>
            ) : (
              // An empty caption is a real thing, not missing data, and saying
              // so is more honest than leaving a blank space that reads as a
              // rendering failure.
              <p className="mt-1.5 text-sm italic text-[var(--ds-text-muted)]">No caption</p>
            )}

            {post.mediaPaths.length > 0 ? (
              <p className="mt-1.5 text-[0.6875rem] text-[var(--ds-text-muted)]">
                {post.mediaPaths.length} {post.mediaPaths.length === 1 ? "file" : "files"} in the archive
              </p>
            ) : null}
          </li>
        ))}
      </ul>

      {history.total > 12 ? (
        <p className="mt-3 text-xs text-[var(--ds-text-muted)]">
          Showing the 12 most recent of {history.total.toLocaleString()}.
        </p>
      ) : null}
    </section>
  );
}
