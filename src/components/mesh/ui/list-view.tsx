// The whole mesh as a structured, keyboard-navigable list — the accessible
// twin of the canvas. Same organizing logic, stated in words: people sorted
// by real closeness, everyone's work newest-first under its maker. Extracted
// from the old mesh-scene.tsx; ownership language now comes from meshCopy so
// a visited/Global mesh no longer reads "Your people".

"use client";

import { X } from "lucide-react";
import { PlatformLogo } from "@/components/platform/platform-logo";
import { getDisplayNameForAnyPlatform } from "@/lib/platform-capabilities";
import { inkForFill } from "@/lib/palette";
import { byNewest } from "../sim/layout";
import type { SceneModel, SceneNode } from "../scene/scene-model";
import type { MeshCopy } from "./copy";

export function MeshListView({
  model,
  copy,
  onClose,
  onOpen,
}: {
  model: SceneModel | null;
  copy: MeshCopy;
  onClose: () => void;
  onOpen: (node: SceneNode) => void;
}) {
  if (!model) return null;
  const all = Array.from(model.nodes.values());
  // Sorted with the canvas layout's shared byNewest (sim/layout.ts): the id
  // tiebreak keeps equal-timestamp rows in the same order on every client,
  // and keeps the list agreeing with the constellation it mirrors.
  const people = all
    .filter((n) => n.kind === "person")
    .sort((a, b) => (b.closeness ?? 0) - (a.closeness ?? 0));
  const nativePosts = all
    .filter((n) => n.kind === "post" && n.parentId === model.selfId)
    .sort(byNewest);
  const platforms = all.filter((n) => n.kind === "platform");
  const postsOf = (source: SceneNode) =>
    source.childIds
      .map((id) => model.nodes.get(id))
      .filter((n): n is SceneNode => Boolean(n && n.kind === "post"))
      .sort(byNewest);

  const timeOf = (node: SceneNode) => node.meta?.find((m) => m.label === "Time")?.value;

  // A platform post's `sublabel` is `acct.platform` — the same raw storage key
  // the hub above it carries (scene-model.ts:286). Under a platform hub this
  // row is the ONLY sublabel in the list that is not an "@username", and it was
  // reaching the screen unspelled: a hub correctly reading "TikTok" with its
  // own posts reading "tiktok" one line below it. Same one table, same reason
  // as the hub — a name is never reconstructed from an id, not even by leaving
  // it as-is.
  const PostRow = ({
    node,
    indent,
    sublabelIsPlatformId,
  }: {
    node: SceneNode;
    indent?: boolean;
    sublabelIsPlatformId?: boolean;
  }) => (
    <li>
      <button
        type="button"
        onClick={() => onOpen(node)}
        className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-[var(--paper-hover)] ${indent ? "pl-8" : ""}`}
      >
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: node.color }} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm text-[var(--text-primary)]">{node.label}</span>
            {node.isNew && (
              // The SAME mark the dock's unseen badge wears (.mesh-new-mark).
              // Press the badge, read this list — one gesture, and this row
              // once drew the far end of it in `bg-cyan-400/15 text-cyan-200`
              // while the badge was amber. Two colours for one idea, on two
              // surfaces a person moves between in a single motion.
              //
              // The class was created for exactly this row (globals.css:7547
              // names the mesh list in its comment), then the canvas restore
              // brought the pre-fix cyan back and left .mesh-new-mark with no
              // callers at all. Amber is the notifications domain plastic and
              // it arrives here as a moulded pair — --mould-amber fill over
              // --mould-amber-ink, contrast-verified at 8.69 — which is the
              // sanctioned way to put pigment on this system. A raw Tailwind
              // palette utility is not.
              <span className="mesh-new-mark mesh-eyebrow shrink-0 px-1.5 py-px text-micro font-semibold">
                New
              </span>
            )}
          </span>
          <span className="block truncate text-micro text-[var(--text-tertiary)]">
            {[
              timeOf(node),
              sublabelIsPlatformId && node.sublabel
                ? getDisplayNameForAnyPlatform(node.sublabel) || node.sublabel
                : node.sublabel,
            ]
              .filter(Boolean)
              .join(" · ") || "Post"}
          </span>
        </span>
      </button>
    </li>
  );

  return (
    <div
      className="absolute inset-0 z-50 flex animate-[fadeIn_.18s_ease] justify-end bg-black/50 backdrop-blur-sm"
      onPointerDown={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-label={copy.listAria}
        className="mesh-panel flex h-full w-full max-w-md animate-[sheetIn_.32s_cubic-bezier(0.22,1,0.36,1)] flex-col pt-16 shadow-2xl"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-[var(--rule)] px-4 py-3.5">
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">The same world, as a list</p>
            <p className="text-micro text-[var(--text-tertiary)]">Closest people first · newest work first</p>
          </div>
          <button
            type="button"
            aria-label="Close list"
            onClick={onClose}
            className="rounded-md p-1 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--paper-hover)] hover:text-[var(--text-primary)]"
          >
            <X size={16} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-6 pt-1">
          {people.length > 0 && (
            <>
              <p className="px-2.5 pb-1 pt-3 text-micro font-semibold mesh-eyebrow text-[var(--text-tertiary)]">
                {copy.listPeopleHeading}
              </p>
              <ul>
                {people.map((node) => (
                  <li key={node.id}>
                    <button
                      type="button"
                      onClick={() => onOpen(node)}
                      className="flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-[var(--paper-hover)]"
                    >
                      {node.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={node.avatarUrl} alt="" className="mt-0.5 h-7 w-7 shrink-0 rounded-full object-cover" />
                      ) : (
                        <span
                          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-micro font-semibold"
                          style={{ background: node.color, color: inkForFill(node.color) }}
                        >
                          {node.label.slice(0, 1).toUpperCase()}
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-sm text-[var(--text-primary)]">{node.label}</span>
                          {node.status === "online" && (
                            <span className="flex items-center gap-1 text-micro font-semibold text-[var(--text-secondary)]">
                              {/* `.mesh-live-dot` (globals.css:2326) already
                                  existed and already pulses, on --mould-jade,
                                  the plastic that means live everywhere else in
                                  the product. This row had hand-rolled a second
                                  one out of `bg-emerald-400 animate-pulse` and
                                  then tinted the WORDS emerald too — two
                                  definitions of one signal, and the label
                                  spending its contrast on a colour the dot was
                                  already carrying.

                                  The dot is the signal; the words are ink. So
                                  the label drops its second green and gets its
                                  contrast back, and there is one live dot in
                                  the codebase again. The class also has a
                                  reduced-motion/de-glassing override at
                                  globals.css:4132 that the hand-rolled span
                                  silently opted out of. */}
                              <span className="mesh-live-dot shrink-0" />
                              here now
                            </span>
                          )}
                        </span>
                        {node.sublabel && <span className="block truncate text-micro text-[var(--text-tertiary)]">{node.sublabel}</span>}
                        {node.placeReason && <span className="block text-micro leading-snug text-[var(--text-tertiary)]">{node.placeReason}</span>}
                      </span>
                    </button>
                    {postsOf(node).length > 0 && <ul>{postsOf(node).map((p) => <PostRow key={p.id} node={p} indent />)}</ul>}
                  </li>
                ))}
              </ul>
            </>
          )}

          {nativePosts.length > 0 && (
            <>
              <p className="px-2.5 pb-1 pt-4 text-micro font-semibold mesh-eyebrow text-[var(--text-tertiary)]">
                {copy.listMadeByHeading}
              </p>
              <ul>
                {nativePosts.map((node) => (
                  <PostRow key={node.id} node={node} />
                ))}
              </ul>
            </>
          )}

          {platforms.length > 0 && (
            <>
              <p className="px-2.5 pb-1 pt-4 text-micro font-semibold mesh-eyebrow text-[var(--text-tertiary)]">
                {copy.listPlatformsHeading}
              </p>
              <ul>
                {platforms.map((node) => (
                  <li key={node.id}>
                    <button
                      type="button"
                      onClick={() => onOpen(node)}
                      className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-[var(--paper-hover)]"
                    >
                      {/* A platform node's `label` is the raw storage key —
                          scene-model.ts sets `label: acct.platform`, so it is
                          "tiktok", "linkedin", "twitter". PlatformLogo wants
                          exactly that (it normalizes the id itself), but a
                          PERSON must never be shown it.

                          This row used to render `{node.label}` under a CSS
                          `capitalize`, which is the precise mistake
                          scripts/platform-name-check.ts exists to prevent:
                          `capitalize` has no way to know TikTok has a capital
                          T in the middle, so it spelled "Tiktok", "Linkedin",
                          "Youtube" — and "Twitter" for a platform this product
                          calls X on every other screen. Four real brands,
                          misspelled, one of them contradicting the app's own
                          list. That was fixed product-wide long before the
                          canvas came back; the verbatim restore reintroduced
                          it here, on the accessible twin of the mesh — the
                          surface a screen reader user gets INSTEAD of the
                          canvas, so it is the last place a name should be
                          guessed at.

                          getDisplayNameForAnyPlatform is the one table. It
                          also covers retired platforms (Spotify, GitHub,
                          SoundCloud), whose ConnectedAccount rows still exist
                          and still reach this list. */}
                      <PlatformLogo platform={node.label} size={18} className="shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-[var(--text-primary)]">
                          {getDisplayNameForAnyPlatform(node.label) || node.label}
                        </span>
                        {node.sublabel && <span className="block truncate text-micro text-[var(--text-tertiary)]">{node.sublabel}</span>}
                      </span>
                    </button>
                    {postsOf(node).length > 0 && (
                      <ul>
                        {postsOf(node).map((p) => (
                          <PostRow key={p.id} node={p} indent sublabelIsPlatformId />
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}

          {people.length === 0 && nativePosts.length === 0 && platforms.length === 0 && (
            <p className="px-3 py-6 text-center text-xs text-[var(--text-tertiary)]">This mesh is just its owner for now.</p>
          )}
        </div>
      </div>
    </div>
  );
}
