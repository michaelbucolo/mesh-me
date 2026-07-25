"use client";

import { useState, useTransition } from "react";
import { Globe, Lock, Pencil, Users } from "lucide-react";
import { PaperWait } from "@/components/loading/paper-wait";
import { Button } from "@/components/ui/button";
import { updateProfileInfo } from "@/lib/actions";
import {
  ABOUT_FIELDS,
  ABOUT_FIELD_META,
  ABOUT_GROUPS,
  ABOUT_PRIVACY_LEVELS,
  aboutFieldMaxLen,
  type AboutField,
  type AboutPrivacyLevel,
} from "@/lib/profile-info";

type Fields = Record<AboutField, string>;
type Privacy = Partial<Record<AboutField, AboutPrivacyLevel>>;

const PRIVACY_META: Record<AboutPrivacyLevel, { label: string; icon: typeof Globe }> = {
  public: { label: "Anyone", icon: Globe },
  friends: { label: "Connections", icon: Users },
  personal: { label: "Only me", icon: Lock },
};

// The owner's own "About" section: a Facebook-style grouped read view that
// flips into an inline editor. Non-owners never mount this — they get a
// server-rendered, already-gated read-only list.
export function ProfileAboutEditor({ initial }: { initial: { fields: Fields; privacy: Privacy } }) {
  const [fields, setFields] = useState<Fields>(initial.fields);
  const [privacy, setPrivacy] = useState<Privacy>(initial.privacy);
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const hasAny = ABOUT_FIELDS.some((f) => fields[f]?.trim());

  function save() {
    startTransition(async () => {
      setError(null);
      const result = await updateProfileInfo({ fields, privacy });
      if (result && "error" in result) {
        setError(String(result.error));
        return;
      }
      setEditing(false);
    });
  }

  if (!editing) {
    return (
      <section className="rounded-2xl border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-[var(--mesh-text)]">About</h2>
          <Button type="button" variant="secondary" size="sm" onClick={() => setEditing(true)} leftIcon={<Pencil className="h-4 w-4" aria-hidden="true" />}>
            Edit details
          </Button>
        </div>
        {!hasAny ? (
          <p className="mt-3 text-sm text-[var(--mesh-text-secondary)]">
            Add your work, education, where you live, and more — you choose who can see each detail.
          </p>
        ) : (
          <div className="mt-4 grid gap-5">
            {ABOUT_GROUPS.map((group) => {
              const groupFields = ABOUT_FIELDS.filter((f) => ABOUT_FIELD_META[f].group === group.key && fields[f]?.trim());
              if (!groupFields.length) return null;
              return (
                <div key={group.key}>
                  <h3 className="text-xs font-semibold mesh-eyebrow text-[var(--mesh-text-muted)]">{group.label}</h3>
                  <dl className="mt-2 grid gap-2">
                    {groupFields.map((f) => {
                      const level = privacy[f] ?? "friends";
                      const Icon = PRIVACY_META[level].icon;
                      return (
                        <div key={f} className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <dt className="text-xs font-semibold text-[var(--mesh-text-muted)]">{ABOUT_FIELD_META[f].label}</dt>
                            <dd className="text-sm text-[var(--mesh-text)] whitespace-pre-wrap break-words">{fields[f]}</dd>
                          </div>
                          <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold text-[var(--mesh-text-muted)]" title={`Visible to: ${PRIVACY_META[level].label}`}>
                            <Icon className="h-3 w-3" aria-hidden="true" />
                            {PRIVACY_META[level].label}
                          </span>
                        </div>
                      );
                    })}
                  </dl>
                </div>
              );
            })}
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-[var(--mesh-text)]">Edit About</h2>
      </div>
      {error && (
        <p className="mt-3 rounded-md border border-[var(--ds-danger-border)] bg-[var(--bg-primary)]/60 px-3 py-2 text-xs font-semibold text-[var(--mesh-text)]">{error}</p>
      )}
      <div className="mt-4 grid gap-5">
        {ABOUT_GROUPS.map((group) => {
          const groupFields = ABOUT_FIELDS.filter((f) => ABOUT_FIELD_META[f].group === group.key);
          return (
            <div key={group.key}>
              <h3 className="text-xs font-semibold mesh-eyebrow text-[var(--mesh-text-muted)]">{group.label}</h3>
              <div className="mt-2 grid gap-3">
                {groupFields.map((f) => {
                  const meta = ABOUT_FIELD_META[f];
                  return (
                    <div key={f} className="grid gap-1.5">
                      <label className="text-xs font-semibold text-[var(--mesh-text-secondary)]" htmlFor={`about-${f}`}>{meta.label}</label>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                        {meta.multiline ? (
                          <textarea
                            id={`about-${f}`}
                            value={fields[f]}
                            maxLength={aboutFieldMaxLen(f)}
                            onChange={(e) => setFields((cur) => ({ ...cur, [f]: e.target.value }))}
                            placeholder={meta.placeholder}
                            rows={3}
                            className="simple-input min-h-[4.5rem] flex-1 resize-y px-3 py-2 text-sm"
                          />
                        ) : (
                          <input
                            id={`about-${f}`}
                            value={fields[f]}
                            maxLength={aboutFieldMaxLen(f)}
                            onChange={(e) => setFields((cur) => ({ ...cur, [f]: e.target.value }))}
                            placeholder={meta.placeholder}
                            className="simple-input h-11 flex-1 px-3 text-sm"
                          />
                        )}
                        <select
                          aria-label={`Who can see ${meta.label}`}
                          value={privacy[f] ?? "friends"}
                          onChange={(e) => setPrivacy((cur) => ({ ...cur, [f]: e.target.value as AboutPrivacyLevel }))}
                          className="simple-input h-11 px-2 text-xs sm:w-36"
                        >
                          {ABOUT_PRIVACY_LEVELS.map((level) => (
                            <option key={level} value={level}>{PRIVACY_META[level].label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-5 flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => { setFields(initial.fields); setPrivacy(initial.privacy); setEditing(false); setError(null); }} disabled={isPending}>
          Cancel
        </Button>
        <Button type="button" onClick={save} disabled={isPending}>
          {isPending && <PaperWait size="sm" />}
          Save
        </Button>
      </div>
    </section>
  );
}
