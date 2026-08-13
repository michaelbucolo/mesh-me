"use client";

import { useEffect, useState, useTransition } from "react";
import { Gift } from "lucide-react";
import { PaperWait } from "@/components/loading/paper-wait";
import { Button } from "@/components/ui/button";
import {
  MeshiMascot,
  type MeshiAccessory,
  type MeshiBadge,
  type MeshiColor,
  type MeshiEyeStyle,
  type MeshiHair,
  type MeshiHat,
} from "@/components/meshi/meshi-mascot";
import { MESHI_HAIR_IDS } from "@/components/meshi/meshi-hair";
import { getGiftPreviewMeshi } from "@/lib/actions";
import { MESH_PRO_GIFT_MESSAGE_MAX } from "@/lib/mesh-pro";
import {
  GIFTABLE_MESHI_ITEMS,
  MESHI_FIELD_OF_GROUP,
  meshiItemLabel,
  type GiftableMeshiCategory,
} from "@/lib/meshi-wardrobe";

type PreviewMeshi = {
  hatStyle: string;
  faceStyle: string;
  colorTheme: string;
  hairStyle: string;
  hairColor: string;
  accessoryStyle: string;
  eyeStyle: string;
  badgeStyle: string;
};

type Preview = {
  username: string;
  displayName: string;
  isSelf: boolean;
  meshi: PreviewMeshi;
  owned: string[];
};

const CATEGORY_LABELS: Record<GiftableMeshiCategory, string> = {
  hats: "Hats",
  hairs: "Hair",
  hairColors: "Hair color",
  faces: "Faces",
  eyes: "Lashes",
  badges: "Badges",
};

const CATEGORY_ORDER: GiftableMeshiCategory[] = ["hats", "hairs", "hairColors", "faces", "eyes", "badges"];

/* Hair-color tiles need visible hair to color — same trick as the settings
   picker: when the recipient's style is "none", preview on the first real one. */
const HAIR_COLOR_PREVIEW_STYLE = MESHI_HAIR_IDS.find((id) => id !== "none") ?? "none";

function withCandidate(meshi: PreviewMeshi, category: GiftableMeshiCategory, value: string): PreviewMeshi {
  const next = { ...meshi, [MESHI_FIELD_OF_GROUP[category]]: value };
  if (category === "hairColors" && next.hairStyle === "none") next.hairStyle = HAIR_COLOR_PREVIEW_STYLE;
  return next;
}

function MeshiFigure({ meshi, size }: { meshi: PreviewMeshi; size: number }) {
  return (
    <MeshiMascot
      size={size}
      color={meshi.colorTheme as MeshiColor}
      hat={meshi.hatStyle as MeshiHat}
      face={meshi.faceStyle}
      hair={meshi.hairStyle as MeshiHair}
      hairColor={meshi.hairColor}
      accessory={meshi.accessoryStyle as MeshiAccessory}
      eyeStyle={meshi.eyeStyle as MeshiEyeStyle}
      badge={meshi.badgeStyle as MeshiBadge}
      animate={false}
    />
  );
}

/**
 * One wardrobe piece, chosen ON the recipient's actual Meshi — not off a
 * shelf. The server is the fence (catalog membership, founders, blocks,
 * already-owned) exactly as with months; this form relays its answers.
 */
export function GiftMeshiItemForm({ initialUsername = "" }: { initialUsername?: string }) {
  const [username, setUsername] = useState(initialUsername);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [looking, setLooking] = useState(false);
  const [category, setCategory] = useState<GiftableMeshiCategory>("hats");
  const [selected, setSelected] = useState<{ category: GiftableMeshiCategory; value: string } | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const clean = username.trim().toLowerCase().replace(/^@/, "");
    if (!/^[a-z0-9_]{1,30}$/.test(clean)) {
      setPreview(null);
      setLookupError(null);
      setLooking(false);
      return;
    }
    let cancelled = false;
    setLooking(true);
    const timer = setTimeout(async () => {
      try {
        const result = await getGiftPreviewMeshi(clean);
        if (cancelled) return;
        if ("error" in result) {
          setPreview(null);
          setLookupError(result.error ?? "Could not look that up. Try again.");
        } else {
          setPreview(result);
          setLookupError(null);
        }
      } catch {
        if (!cancelled) {
          setPreview(null);
          setLookupError("Could not look that up. Try again.");
        }
      } finally {
        if (!cancelled) setLooking(false);
      }
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [username]);

  // A piece the new recipient already owns cannot stay selected.
  useEffect(() => {
    if (selected && preview?.owned.includes(`${selected.category}:${selected.value}`)) {
      setSelected(null);
    }
  }, [preview, selected]);

  function startItemCheckout() {
    if (!preview || !selected) return;
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch("/api/stripe/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            meshiItem: {
              category: selected.category,
              value: selected.value,
              recipientUsername: preview.username,
              ...(message.trim() && !preview.isSelf ? { message: message.trim() } : {}),
            },
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error || "Could not start the checkout.");
          return;
        }
        if (typeof data.url !== "string") {
          setError("Stripe did not return a checkout URL.");
          return;
        }
        window.location.href = data.url;
      } catch {
        setError("Network error. Try again.");
      }
    });
  }

  const shownMeshi = preview
    ? selected
      ? withCandidate(preview.meshi, selected.category, selected.value)
      : preview.meshi
    : null;

  return (
    <form
      className="grid gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        startItemCheckout();
      }}
    >
      <label className="grid gap-1.5">
        <span className="text-sm font-semibold text-[var(--text-primary)]">Whose Meshi?</span>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--text-muted)]">
            @
          </span>
          <input
            type="text"
            required
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            value={username}
            onChange={(event) => setUsername(event.target.value.replace(/^@/, ""))}
            placeholder="username — yours works too"
            className="simple-input w-full pl-8"
            aria-label="Recipient's username"
          />
        </div>
        {lookupError && <p className="text-xs font-semibold text-[var(--ds-danger)]">{lookupError}</p>}
      </label>

      {looking && !preview && (
        <div className="grid place-items-center py-6">
          <PaperWait size="sm" />
        </div>
      )}

      {preview && shownMeshi && (
        <>
          <div className="grid place-items-center gap-2 rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface)] p-5">
            <MeshiFigure meshi={shownMeshi} size={96} />
            <p className="text-sm font-semibold text-[var(--text-primary)]">{preview.displayName}</p>
            <p className="text-xs leading-5 text-[var(--text-secondary)]">
              {selected
                ? `The ${meshiItemLabel(selected.category, selected.value)} — ${
                    preview.isSelf ? "yours for good." : "theirs for good."
                  }`
                : preview.isSelf
                  ? "Your own Meshi. Pick a piece — it's yours for good."
                  : "Their Meshi, as it is today. Pick a piece to try on."}
            </p>
          </div>

          <div className="grid gap-3">
            <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Wardrobe categories">
              {CATEGORY_ORDER.filter((key) => GIFTABLE_MESHI_ITEMS[key].length > 0).map((key) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={category === key}
                  onClick={() => setCategory(key)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                    category === key
                      ? "border-[var(--accent-muted)] bg-[var(--accent-bg)] text-[var(--text-primary)]"
                      : "border-[var(--ds-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {CATEGORY_LABELS[key]}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
              {GIFTABLE_MESHI_ITEMS[category].map((value) => {
                const owned = preview.owned.includes(`${category}:${value}`);
                const isSelected = selected?.category === category && selected?.value === value;
                const label = meshiItemLabel(category, value);
                return (
                  <button
                    key={value}
                    type="button"
                    disabled={owned}
                    aria-pressed={isSelected}
                    title={owned ? (preview.isSelf ? `${label} — already yours` : `${label} — already theirs`) : label}
                    onClick={() => setSelected(isSelected ? null : { category, value })}
                    className={`mesh-choice grid place-items-center gap-1 rounded-xl p-2 transition ${
                      isSelected ? "border-[var(--accent-muted)] bg-[var(--accent-bg)]" : ""
                    } ${owned ? "opacity-45" : ""}`}
                  >
                    <MeshiFigure meshi={withCandidate(preview.meshi, category, value)} size={44} />
                    {owned && (
                      <span className="text-micro font-semibold text-[var(--text-muted)]">
                        {preview.isSelf ? "Already yours" : "Already theirs"}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {!preview.isSelf && (
            <label className="grid gap-1.5">
              <span className="flex items-baseline justify-between text-sm">
                <span className="font-semibold text-[var(--text-primary)]">A few words (optional)</span>
                <span className="text-xs text-[var(--text-muted)]">
                  {message.length}/{MESH_PRO_GIFT_MESSAGE_MAX}
                </span>
              </span>
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value.slice(0, MESH_PRO_GIFT_MESSAGE_MAX))}
                maxLength={MESH_PRO_GIFT_MESSAGE_MAX}
                rows={3}
                placeholder="They'll see this with the gift."
                className="simple-input w-full resize-none leading-6"
              />
            </label>
          )}
        </>
      )}

      <div className="grid gap-2">
        <Button type="submit" disabled={isPending || !preview || !selected}>
          {isPending ? <PaperWait size="sm" /> : <Gift className="h-4 w-4" aria-hidden="true" />}
          $1.99 — Continue to payment
        </Button>
        {error && <p className="text-xs font-semibold text-[var(--ds-danger)]">{error}</p>}
        <p className="text-xs leading-5 text-[var(--text-muted)]">
          One payment, owned outright — it stays wearable with or without MeshPro, forever.
        </p>
      </div>
    </form>
  );
}
