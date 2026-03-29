"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createCommunity } from "@/lib/actions";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

const CATEGORIES = [
  "Art & Design", "Music", "Gaming", "Technology", "Film & Video",
  "Writing", "Photography", "Fashion", "Fitness", "Food & Cooking",
  "Science", "Education", "Business", "Humor", "Sports", "Other",
];

export default function CreateCommunityPage() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [rules, setRules] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError("Community name is required");

    const formData = new FormData();
    formData.set("name", name);
    formData.set("description", description);
    formData.set("category", category);
    formData.set("rules", rules);

    startTransition(async () => {
      const result = await createCommunity(formData);
      if (result.error) {
        setError(result.error);
      } else {
        router.push("/communities");
      }
    });
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-6">
      <Link href="/communities" className="inline-flex items-center gap-2 text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors mb-6">
        <ArrowLeft className="h-4 w-4" />
        Back to communities
      </Link>

      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Create a community</h1>
      <p className="text-sm text-[var(--text-tertiary)] mb-8">Build a space for people who share your interests</p>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3">{error}</div>
        )}

        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="My Awesome Community" maxLength={50} />
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Description</label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this community about?" rows={3} maxLength={300} />
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Category</label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  category === cat
                    ? "bg-[var(--accent-muted)] border-[var(--accent)] text-[var(--accent)]"
                    : "bg-[var(--bg-tertiary)] border-[var(--border-primary)] text-[var(--text-tertiary)] hover:border-[var(--border-secondary)]"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Community rules (optional)</label>
          <Textarea value={rules} onChange={(e) => setRules(e.target.value)} placeholder="Be respectful, no spam..." rows={3} />
        </div>

        <Button type="submit" variant="gradient" size="lg" className="w-full" disabled={isPending}>
          {isPending ? "Creating..." : "Create community"}
        </Button>
      </form>
    </div>
  );
}
