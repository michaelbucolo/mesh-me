"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, Lock, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { COMMUNITY_SPACE_TYPES } from "@/lib/community-constants";
import { createCommunity } from "@/lib/actions";
import { cn } from "@/lib/utils";

const CARD_SPRING = { type: "spring" as const, stiffness: 420, damping: 26 };

export function CommunityCreateForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [spaceType, setSpaceType] = useState("creator");
  const [visibility, setVisibility] = useState("public");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      ref={formRef}
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        const form = formRef.current;
        if (!form) return;
        setError(null);

        startTransition(async () => {
          const formData = new FormData(form);
          formData.set("spaceType", spaceType);
          formData.set("isPublic", visibility === "public" ? "true" : "false");
          const result = await createCommunity(formData);

          if ("error" in result && result.error) {
            setError(result.error);
            return;
          }

          if ("slug" in result && result.slug) {
            router.push(`/communities/${result.slug}`);
            router.refresh();
            return;
          }

          router.push("/communities");
          router.refresh();
        });
      }}
    >
      <section className="mesh-surface rounded-[28px] border border-[var(--ds-border)] p-4 shadow-[var(--shadow-soft)] sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[var(--accent-text)]">New space</p>
            <h1 className="text-2xl font-semibold tracking-[0] text-[var(--text-primary)]">Create a community</h1>
          </div>
          <Badge variant="accent">Private by design</Badge>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {COMMUNITY_SPACE_TYPES.map((type, index) => {
            const selected = spaceType === type.id;
            return (
              <motion.button
                key={type.id}
                type="button"
                onClick={() => setSpaceType(type.id)}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0, scale: selected ? 1.02 : 1 }}
               
                whileTap={{ scale: 0.97 }}
                transition={{ ...CARD_SPRING, delay: 0.04 * index }}
                className={cn(
                  "rounded-[22px] border p-4 text-left transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent-subtle)]",
                  selected
                    ? "border-[var(--accent)] bg-[var(--accent-subtle)] shadow-[var(--shadow-soft)]"
                    : "border-[var(--ds-border)] bg-[var(--ds-surface)]"
                )}
              >
                <span className="text-sm font-semibold text-[var(--text-primary)]">{type.label}</span>
                <span className="mt-1 block text-xs leading-5 text-[var(--text-secondary)]">{type.description}</span>
              </motion.button>
            );
          })}
        </div>
      </section>

      <section className="mesh-surface rounded-[28px] border border-[var(--ds-border)] p-4 shadow-[var(--shadow-soft)] sm:p-6">
        <div className="grid gap-4">
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-[var(--text-primary)]">Name</span>
            <input
              name="name"
              required
              maxLength={64}
              autoComplete="off"
              placeholder="Family photos, creator circle, weekend crew..."
              className="simple-input"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-semibold text-[var(--text-primary)]">Description</span>
            <textarea
              name="description"
              rows={4}
              maxLength={240}
              placeholder="Tell people what belongs in this space."
              className="simple-input min-h-28 resize-y"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-[var(--text-primary)]">Category</span>
              <input name="category" maxLength={40} placeholder={spaceType} className="simple-input" />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-[var(--text-primary)]">Icon URL</span>
              <input name="iconUrl" type="url" placeholder="Optional image link" className="simple-input" />
            </label>
          </div>

          <label className="grid gap-2">
            <span className="text-sm font-semibold text-[var(--text-primary)]">Rules</span>
            <textarea
              name="rules"
              rows={4}
              maxLength={600}
              placeholder="Be kind. Credit creators. Keep private posts private."
              className="simple-input min-h-28 resize-y"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <motion.button
              type="button"
              onClick={() => setVisibility("public")}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0, scale: visibility === "public" ? 1.02 : 1 }}
             
              whileTap={{ scale: 0.97 }}
              transition={{ ...CARD_SPRING, delay: 0.08 }}
              className={cn(
                "rounded-[22px] border p-4 text-left transition-colors hover:border-[var(--accent)]",
                visibility === "public"
                  ? "border-[var(--accent)] bg-[var(--accent-subtle)]"
                  : "border-[var(--ds-border)] bg-[var(--ds-surface)]"
              )}
            >
              <Users className="mb-3 h-5 w-5 text-[var(--accent-text)]" />
              <span className="block text-sm font-semibold text-[var(--text-primary)]">Public discovery</span>
              <span className="mt-1 block text-xs text-[var(--text-secondary)]">Anyone can find and join.</span>
            </motion.button>
            <motion.button
              type="button"
              onClick={() => setVisibility("private")}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0, scale: visibility === "private" ? 1.02 : 1 }}
             
              whileTap={{ scale: 0.97 }}
              transition={{ ...CARD_SPRING, delay: 0.12 }}
              className={cn(
                "rounded-[22px] border p-4 text-left transition-colors hover:border-[var(--accent)]",
                visibility === "private"
                  ? "border-[var(--accent)] bg-[var(--accent-subtle)]"
                  : "border-[var(--ds-border)] bg-[var(--ds-surface)]"
              )}
            >
              <Lock className="mb-3 h-5 w-5 text-[var(--accent-text)]" />
              <span className="block text-sm font-semibold text-[var(--text-primary)]">Private space</span>
              <span className="mt-1 block text-xs text-[var(--text-secondary)]">Only members can open it.</span>
            </motion.button>
          </div>

          {error ? (
            <div className="rounded-2xl border border-[var(--ds-danger-border)] bg-[var(--ds-danger-bg)] p-3 text-sm text-[var(--ds-danger)]">
              {error}
            </div>
          ) : null}

          <Button
            type="submit"
            size="lg"
            loading={isPending}
            rightIcon={<ArrowRight className="h-4 w-4" />}
            className="w-full"
          >
            Create community
          </Button>
        </div>
      </section>
    </form>
  );
}
