"use client";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useState, useTransition } from "react";
import { createPost } from "@/lib/actions";
import { Image, Hash, Globe, X } from "lucide-react";

interface PostComposerProps {
  user: {
    displayName: string;
    avatarUrl: string | null;
  };
  communityId?: string;
}

export function PostComposer({ user, communityId }: PostComposerProps) {
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [showTags, setShowTags] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = () => {
    if (!content.trim()) return;
    const formData = new FormData();
    formData.set("content", content);
    if (tags) formData.set("tags", tags);
    if (communityId) formData.set("communityId", communityId);

    startTransition(async () => {
      const result = await createPost(formData);
      if (result?.success) {
        setContent("");
        setTags("");
        setShowTags(false);
      }
    });
  };

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 backdrop-blur-sm p-5">
      <div className="flex gap-3">
        <Avatar src={user.avatarUrl} alt={user.displayName} size="md" />
        <div className="flex-1">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Share what's on your mind..."
            className="w-full bg-transparent text-zinc-100 text-sm placeholder:text-zinc-500 resize-none outline-none min-h-[80px]"
            rows={3}
          />

          {showTags && (
            <div className="flex items-center gap-2 mt-2">
              <Hash className="h-4 w-4 text-zinc-500" />
              <input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="Add tags (comma separated)"
                className="flex-1 bg-transparent text-sm text-zinc-300 placeholder:text-zinc-600 outline-none"
              />
              <button onClick={() => { setShowTags(false); setTags(""); }} className="text-zinc-500 hover:text-zinc-300">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-800/50">
            <div className="flex items-center gap-1">
              <button className="p-2 rounded-lg text-zinc-500 hover:text-blue-400 hover:bg-zinc-800/50 transition-colors">
                <Image className="h-4 w-4" />
              </button>
              <button
                onClick={() => setShowTags(!showTags)}
                className="p-2 rounded-lg text-zinc-500 hover:text-blue-400 hover:bg-zinc-800/50 transition-colors"
              >
                <Hash className="h-4 w-4" />
              </button>
              <button className="p-2 rounded-lg text-zinc-500 hover:text-blue-400 hover:bg-zinc-800/50 transition-colors">
                <Globe className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center gap-3">
              {content.length > 0 && (
                <span className={`text-xs ${content.length > 500 ? "text-red-400" : "text-zinc-500"}`}>
                  {content.length}/500
                </span>
              )}
              <Button
                onClick={handleSubmit}
                disabled={!content.trim() || content.length > 500 || isPending}
                size="sm"
                variant="gradient"
              >
                {isPending ? "Posting..." : "Post"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
