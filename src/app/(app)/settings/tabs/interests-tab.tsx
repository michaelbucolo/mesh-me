"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateUserInterests, updateUserLinks } from "@/lib/actions";
import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import { Plus, X } from "lucide-react";
import { INTEREST_TAGS } from "@/lib/utils";

interface InterestsTabProps {
  selectedInterests: string[];
  setSelectedInterests: React.Dispatch<React.SetStateAction<string[]>>;
  links: { label: string; url: string }[];
  setLinks: React.Dispatch<React.SetStateAction<{ label: string; url: string }[]>>;
  showSuccess: (msg: string) => void;
}

export function InterestsTab({ selectedInterests, setSelectedInterests, links, setLinks, showSuccess }: InterestsTabProps) {
  const [isPending, startTransition] = useTransition();

  const toggleInterest = (tag: string) => {
    setSelectedInterests((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
  };

  const addLink = () => setLinks([...links, { label: "", url: "" }]);
  const removeLink = (index: number) => setLinks(links.filter((_, i) => i !== index));
  const updateLinkField = (index: number, field: "label" | "url", value: string) => {
    setLinks(links.map((l, i) => (i === index ? { ...l, [field]: value } : l)));
  };

  const handleSave = () => {
    startTransition(async () => {
      await updateUserInterests(selectedInterests);
      await updateUserLinks(links);
      showSuccess("Interests and links updated");
    });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Interests</h2>
        <p className="text-sm text-[var(--text-muted)] mb-4">Select topics you&apos;re interested in to personalize your experience</p>
        <div className="flex flex-wrap gap-2">
          {INTEREST_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleInterest(tag)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                selectedInterests.includes(tag)
                  ? "brand-button text-white"
                  : "bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Social links</h2>
          <button type="button" onClick={addLink} className="flex items-center gap-1 text-sm transition-colors" style={{ color: "var(--accent)" }}>
            <Plus className="h-4 w-4" /> Add link
          </button>
        </div>
        <div className="space-y-3">
          {links.map((link, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="flex-1 flex gap-2">
                <Input value={link.label} onChange={(e) => updateLinkField(i, "label", e.target.value)} placeholder="Label (e.g. YouTube)" className="w-1/3" />
                <Input value={link.url} onChange={(e) => updateLinkField(i, "url", e.target.value)} placeholder="https://..." className="flex-1" />
              </div>
              <button type="button" onClick={() => removeLink(i)} className="p-2 text-[var(--text-muted)] hover:text-red-400 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          {links.length === 0 && (
            <p className="text-sm text-[var(--text-muted)]">No links added yet. Add your social profiles, website, or other links.</p>
          )}
        </div>
      </div>

      <Button onClick={handleSave} variant="gradient" disabled={isPending}>
        {isPending ? "Saving..." : "Save interests & links"}
      </Button>
    </motion.div>
  );
}
