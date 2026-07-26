"use client";

import { useState, useTransition } from "react";
import { Link as LinkIcon, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { saveProfileLinks } from "@/lib/actions";
import { MAX_LABEL_LENGTH, MAX_LINKS, type ProfileLink } from "@/lib/profile-links";

/**
 * The missing half of "links in bio".
 *
 * `UserLink` has been in the schema from the start, `getUserProfile` has always
 * selected it, and the profile has always had a "Creator Links" tab that maps
 * over the rows. There was simply never a way to CREATE one — no action, no
 * form, nothing that wrote the table anywhere in src/ — so that tab could only
 * ever render its empty state, for everybody, forever. This is the form.
 *
 * Validation is not duplicated here on purpose. `saveProfileLinks` runs every
 * row through `normalizeProfileLinks`, which is the one place a URL's safety is
 * decided; this shows whatever that returns. A second copy of the rules in the
 * client would be a second thing to keep in sync, and the client copy is the one
 * an attacker skips anyway.
 */
export function ProfileLinksEditor({ initial }: { initial: ProfileLink[] }) {
  const [rows, setRows] = useState<ProfileLink[]>(
    initial.length ? initial : [{ label: "", url: "" }],
  );
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function update(index: number, patch: Partial<ProfileLink>) {
    setSaved(false);
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await saveProfileLinks({ links: rows });
      if (result && "error" in result && result.error) {
        setError(result.error);
        return;
      }
      // Show back exactly what the server stored — a bare `example.com` comes
      // back as `https://example.com/`, and seeing that is how you learn the
      // field accepted what you meant.
      if (result && "links" in result && result.links) {
        setRows(result.links.length ? result.links : [{ label: "", url: "" }]);
      }
      setSaved(true);
    });
  }

  return (
    <section className="plate p-5">
      <div className="mb-1 flex items-center gap-2">
        <LinkIcon size={16} aria-hidden="true" className="text-[var(--text-tertiary)]" />
        <h2 className="text-base font-semibold text-[var(--text-primary)]">Your links</h2>
      </div>
      <p className="mb-4 text-sm text-[var(--text-secondary)]">
        Up to {MAX_LINKS}. They show on your profile to anyone who can see it.
      </p>

      <ul className="space-y-2">
        {rows.map((row, i) => (
          <li key={i} className="flex flex-wrap items-center gap-2">
            <input
              value={row.label}
              onChange={(e) => update(i, { label: e.target.value })}
              maxLength={MAX_LABEL_LENGTH}
              placeholder="Label"
              aria-label={`Link ${i + 1} label`}
              className="tray min-w-0 flex-1 rounded-md px-3 py-2 text-sm text-[var(--text-primary)]"
            />
            <input
              value={row.url}
              onChange={(e) => update(i, { url: e.target.value })}
              inputMode="url"
              placeholder="example.com"
              aria-label={`Link ${i + 1} address`}
              className="tray min-w-0 flex-[2] rounded-md px-3 py-2 text-sm text-[var(--text-primary)]"
            />
            <button
              type="button"
              onClick={() => {
                setSaved(false);
                setRows((prev) => (prev.length === 1 ? [{ label: "", url: "" }] : prev.filter((_, j) => j !== i)));
              }}
              aria-label={`Remove link ${i + 1}`}
              className="key ds-focus-ring rounded-md p-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            >
              <Trash2 size={15} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {rows.length < MAX_LINKS && (
          <button
            type="button"
            onClick={() => setRows((prev) => [...prev, { label: "", url: "" }])}
            className="key ds-focus-ring inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-[var(--text-primary)]"
          >
            <Plus size={15} aria-hidden="true" />
            Add link
          </button>
        )}
        <Button onClick={save} disabled={isPending}>
          {isPending ? "Saving…" : "Save links"}
        </Button>
        {/* aria-live so the outcome reaches a screen reader; the error text is
            whatever the server said, which is the only copy of the rules. */}
        <span aria-live="polite" className="text-sm">
          {error ? (
            <span className="text-[var(--danger)]">{error}</span>
          ) : saved ? (
            <span className="text-[var(--text-tertiary)]">Saved</span>
          ) : null}
        </span>
      </div>
    </section>
  );
}
