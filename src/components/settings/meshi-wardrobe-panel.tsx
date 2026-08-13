"use client";

// The studio's two quiet shelves, under the pickers:
//
//   SAVED LOOKS — named snapshots of a whole Meshi. Apply fills the pickers
//   and the user presses the existing Save Meshi: this panel never writes a
//   preference itself, so `updateMeshiPreference` stays the platform's one
//   user-initiated wardrobe gate.
//
//   IN YOUR WARDROBE — the owner's own history: which pieces were gifts,
//   from whom, when, with the note if one came along. This is the RICHEST
//   ring of the provenance design — names and notes render here and only
//   here, never on the mesh or a profile. The per-piece switch quiets the
//   public gift mark; the history below it is the owner's either way.
//
// House law, load-bearing: no links, no prices, no locked teases anywhere in
// this file — the wardrobe already unlocked everything it lists, and a shelf
// is not a storefront (meshi-provenance-check + meshi-recipe-check pin this).

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { BookMarked, Shirt } from "lucide-react";
import {
  MeshiMascot,
  type MeshiAccessory,
  type MeshiBadge,
  type MeshiColor,
  type MeshiEyeStyle,
  type MeshiHair,
  type MeshiHat,
} from "@/components/meshi/meshi-mascot";
import {
  deleteMeshiRecipe,
  removeMeshiGiftNote,
  renameMeshiRecipe,
  saveMeshiRecipe,
  setMeshiGiftLabelQuiet,
} from "@/lib/actions";
import {
  buildOwnedMeshiSets,
  resolveRecipeApplication,
  type MeshiRecipeSnapshot,
} from "@/lib/meshi-wardrobe";

export type MeshiWardrobeRow = {
  id: string;
  label: string;
  isGift: boolean;
  purchaserDisplayName: string | null;
  receivedAt: Date | string;
  message: string | null;
  quieted: boolean;
};

export type MeshiRecipeRow = MeshiRecipeSnapshot & { id: string; name: string };

function formatOwnerDate(value: Date | string) {
  return new Date(value).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export function MeshiWardrobePanel({
  wardrobe,
  recipes,
  current,
  ownedOptions,
  isPro,
  charterHolder,
  patronRecord,
  onApply,
}: {
  wardrobe: MeshiWardrobeRow[];
  recipes: MeshiRecipeRow[];
  /** The live picker state — Apply fills it, the user saves it. */
  current: MeshiRecipeSnapshot;
  /** Live "category:value" receipts, for the apply clamp. */
  ownedOptions: string[];
  isPro: boolean;
  charterHolder: boolean;
  patronRecord: boolean;
  onApply: (next: MeshiRecipeSnapshot) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [saveName, setSaveName] = useState("");
  const [notice, setNotice] = useState<{ tone: "quiet" | "error"; text: string } | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [openNoteId, setOpenNoteId] = useState<string | null>(null);
  const [confirmNoteId, setConfirmNoteId] = useState<string | null>(null);

  function run(task: () => Promise<{ error?: string } | { success: boolean }>, after?: () => void) {
    startTransition(async () => {
      const result = await task();
      if (result && "error" in result && result.error) {
        setNotice({ tone: "error", text: result.error });
        return;
      }
      after?.();
      router.refresh();
    });
  }

  function applyRecipe(recipe: MeshiRecipeRow) {
    const owned = buildOwnedMeshiSets(
      ownedOptions.map((entry) => {
        const [category, ...rest] = entry.split(":");
        return { category, value: rest.join(":") };
      }),
    );
    const { next, fallbacks } = resolveRecipeApplication(recipe, current, owned, {
      isPro,
      hasCharterSeat: charterHolder,
      hasPatronRecord: patronRecord,
    });
    onApply(next);
    if (fallbacks.length > 0) {
      setNotice({
        tone: "quiet",
        text: `${fallbacks.length} piece${fallbacks.length === 1 ? " from this look isn't" : "s from this look aren't"} in your wardrobe right now, so your Meshi kept what it was wearing there.`,
      });
    } else {
      setNotice({ tone: "quiet", text: `Wearing “${recipe.name}” — press Save Meshi to keep it.` });
    }
  }

  const gifts = wardrobe.filter((row) => row.isGift);
  const ownPieces = wardrobe.filter((row) => !row.isGift);

  return (
    <div className="mt-4 space-y-4">
      {/* ── Saved looks ─────────────────────────────────────── */}
      <section className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-elevated)] p-4">
        <div className="flex items-center gap-2">
          <BookMarked size={15} aria-hidden="true" className="text-[var(--text-muted)]" />
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Saved looks</h3>
        </div>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          Bottle the look your Meshi is wearing right now and put it back on any time.
        </p>

        {recipes.length > 0 && (
          <ul className="mt-3 space-y-2">
            {recipes.map((recipe) => (
              <li key={recipe.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-[var(--bg-tertiary)] px-2.5 py-2">
                <MeshiMascot
                  size={32}
                  color={recipe.colorTheme as MeshiColor}
                  hat={recipe.hatStyle as MeshiHat}
                  face={recipe.faceStyle}
                  hair={recipe.hairStyle as MeshiHair}
                  hairColor={recipe.hairColor}
                  accessory={recipe.accessoryStyle as MeshiAccessory}
                  eyeStyle={recipe.eyeStyle as MeshiEyeStyle}
                  badge={recipe.badgeStyle as MeshiBadge}
                  animate={false}
                  showGlow={false}
                />
                {renamingId === recipe.id ? (
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    <input
                      value={renameValue}
                      onChange={(event) => setRenameValue(event.target.value)}
                      onKeyDown={(event) => {
                        // The panel sits inside the studio form — Enter must
                        // rename, not fire Save Meshi.
                        if (event.key === "Enter") {
                          event.preventDefault();
                          run(() => renameMeshiRecipe(recipe.id, renameValue), () => setRenamingId(null));
                        }
                      }}
                      maxLength={40}
                      aria-label="New name for this look"
                      className="min-w-0 flex-1 rounded-md border border-[var(--border-primary)] bg-[var(--bg-primary)] px-2 py-1 text-xs text-[var(--text-primary)]"
                    />
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => run(() => renameMeshiRecipe(recipe.id, renameValue), () => setRenamingId(null))}
                      className="rounded-md bg-[var(--bg-hover)] px-2 py-1 text-micro font-semibold text-[var(--text-primary)]"
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      onClick={() => setRenamingId(null)}
                      className="rounded-md px-2 py-1 text-micro text-[var(--text-muted)]"
                    >
                      Cancel
                    </button>
                  </span>
                ) : (
                  <>
                    <span className="min-w-0 flex-1 truncate text-xs font-semibold text-[var(--text-primary)]">{recipe.name}</span>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => applyRecipe(recipe)}
                      className="rounded-md bg-[var(--bg-hover)] px-2.5 py-1 text-micro font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-primary)]"
                    >
                      Apply
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRenamingId(recipe.id);
                        setRenameValue(recipe.name);
                        setConfirmDeleteId(null);
                      }}
                      className="rounded-md px-2 py-1 text-micro text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)]"
                    >
                      Rename
                    </button>
                    {confirmDeleteId === recipe.id ? (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => run(() => deleteMeshiRecipe(recipe.id), () => setConfirmDeleteId(null))}
                        className="rounded-md px-2 py-1 text-micro font-semibold text-[var(--danger,#dc2626)]"
                      >
                        Really delete?
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(recipe.id)}
                        className="rounded-md px-2 py-1 text-micro text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)]"
                      >
                        Delete
                      </button>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3 flex items-center gap-2">
          <input
            value={saveName}
            onChange={(event) => setSaveName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                if (saveName.trim()) run(() => saveMeshiRecipe(saveName), () => setSaveName(""));
              }
            }}
            maxLength={40}
            placeholder="Name this look"
            aria-label="Name this look"
            className="min-w-0 flex-1 rounded-md border border-[var(--border-primary)] bg-[var(--bg-primary)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
          />
          <button
            type="button"
            disabled={isPending || !saveName.trim()}
            onClick={() => run(() => saveMeshiRecipe(saveName), () => setSaveName(""))}
            className="rounded-md bg-[var(--bg-tertiary)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)] disabled:opacity-55"
          >
            Save look
          </button>
        </div>

        {notice && (
          <p className={`mt-2 text-micro leading-snug ${notice.tone === "error" ? "text-[var(--danger,#dc2626)]" : "text-[var(--text-muted)]"}`}>
            {notice.text}
          </p>
        )}
      </section>

      {/* ── In your wardrobe ────────────────────────────────── */}
      {wardrobe.length > 0 && (
        <section className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-elevated)] p-4">
          <div className="flex items-center gap-2">
            <Shirt size={15} aria-hidden="true" className="text-[var(--text-muted)]" />
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">In your wardrobe</h3>
          </div>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Every piece your Meshi owns, and where it came from. Only you see the names and notes.
          </p>
          <ul className="mt-3 space-y-2">
            {[...gifts, ...ownPieces].map((row) => (
              <li key={row.id} className="rounded-lg bg-[var(--bg-tertiary)] px-3 py-2">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-xs font-semibold text-[var(--text-primary)]">{row.label}</span>
                  <span className="text-micro text-[var(--text-muted)]">
                    {row.isGift
                      ? row.purchaserDisplayName
                        ? `From ${row.purchaserDisplayName}, ${formatOwnerDate(row.receivedAt)}`
                        : `A gift, ${formatOwnerDate(row.receivedAt)}`
                      : `Yours since ${formatOwnerDate(row.receivedAt)}`}
                  </span>
                  {row.isGift && row.message && (
                    <button
                      type="button"
                      onClick={() => {
                        setOpenNoteId(openNoteId === row.id ? null : row.id);
                        setConfirmNoteId(null);
                      }}
                      className="text-micro text-[var(--text-secondary)] underline decoration-[var(--border-primary)] underline-offset-2 transition-colors hover:text-[var(--text-primary)]"
                    >
                      {openNoteId === row.id ? "Close the note" : "Read the note"}
                    </button>
                  )}
                  {row.isGift && (
                    <span className="ml-auto flex items-center gap-1.5">
                      <span className="text-micro text-[var(--text-muted)]">Shown when people look</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={!row.quieted}
                        aria-label={`Show the gift mark on ${row.label} when people look`}
                        disabled={isPending}
                        onClick={() => run(() => setMeshiGiftLabelQuiet(row.id, !row.quieted))}
                        className={`relative h-5 w-9 rounded-full transition-colors ${row.quieted ? "bg-[var(--bg-hover)]" : "bg-[var(--accent-primary,#3b82f6)]"}`}
                      >
                        <span
                          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${row.quieted ? "translate-x-0.5" : "translate-x-[18px]"}`}
                        />
                      </button>
                    </span>
                  )}
                </div>
                {row.isGift && row.quieted && (
                  <p className="mt-1 text-micro leading-snug text-[var(--text-muted)]">
                    Others see no gift mark on this piece. You always see this history.
                  </p>
                )}
                {row.isGift && row.message && openNoteId === row.id && (
                  <div className="mt-2 rounded-md bg-[var(--bg-primary)] px-2.5 py-2">
                    <p className="text-xs leading-relaxed text-[var(--text-secondary)]">{row.message}</p>
                    {confirmNoteId === row.id ? (
                      <p className="mt-1.5 flex items-center gap-2 text-micro text-[var(--text-muted)]">
                        This removes the note for good. The gift stays.
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => run(() => removeMeshiGiftNote(row.id), () => {
                            setConfirmNoteId(null);
                            setOpenNoteId(null);
                          })}
                          className="font-semibold text-[var(--danger,#dc2626)]"
                        >
                          Remove
                        </button>
                        <button type="button" onClick={() => setConfirmNoteId(null)} className="text-[var(--text-secondary)]">
                          Keep
                        </button>
                      </p>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmNoteId(row.id)}
                        className="mt-1.5 text-micro text-[var(--text-muted)] transition-colors hover:text-[var(--text-secondary)]"
                      >
                        Remove note
                      </button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
