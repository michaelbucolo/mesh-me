"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Lock, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageIntro } from "@/components/ui/signature-art";
import { COMMUNITY_SPACE_TYPES } from "@/lib/community-constants";
import { createCommunity } from "@/lib/actions";
import { cn } from "@/lib/utils";

import { SPRING_PANEL } from "@/lib/motion";

const CARD_SPRING = SPRING_PANEL;

export function CommunityCreateForm() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const formRef = useRef<HTMLFormElement>(null);
  const [spaceType, setSpaceType] = useState("creator");
  const [visibility, setVisibility] = useState("public");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      ref={formRef}
      className="social-community-form space-y-5"
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
      <PageIntro className="social-page-intro" heading="h1" eyebrow="Make room for your people" title="Start a community." description="Give your shared interest a home. You choose who comes in." />
      <section className="mesh-surface rounded-[28px] border border-[var(--ds-border)] p-4 shadow-[var(--shadow-soft)] sm:p-6">
        <div className="social-form-heading"><span className="social-step">1</span><h2>Choose your kind of space</h2></div>

        <div className="grid gap-3 sm:grid-cols-2">
          {COMMUNITY_SPACE_TYPES.map((type, index) => {
            const selected = spaceType === type.id;
            return (
              <motion.button
                key={type.id}
                type="button"
                onClick={() => setSpaceType(type.id)}
                aria-pressed={selected}
                data-feedback={selected ? "off" : "select"}
                initial={reduce ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
               
                whileTap={reduce ? undefined : { scale: 0.97 }}
                transition={reduce ? { duration: 0 } : { ...CARD_SPRING, delay: 0.025 * Math.min(index, 4) }}
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
        <div className="social-form-heading"><span className="social-step">2</span><h2>Make it yours</h2></div>
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
              aria-pressed={visibility === "public"}
              data-feedback={visibility === "public" ? "off" : "select"}
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
             
              whileTap={reduce ? undefined : { scale: 0.97 }}
              transition={reduce ? { duration: 0 } : CARD_SPRING}
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
              aria-pressed={visibility === "private"}
              data-feedback={visibility === "private" ? "off" : "select"}
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
             
              whileTap={reduce ? undefined : { scale: 0.97 }}
              transition={reduce ? { duration: 0 } : CARD_SPRING}
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
