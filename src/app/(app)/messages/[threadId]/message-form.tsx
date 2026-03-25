"use client";

import { Button } from "@/components/ui/button";
import { sendMessage } from "@/lib/actions";
import { useState, useTransition } from "react";
import { Send } from "lucide-react";

interface MessageFormProps {
  threadId: string;
}

export function MessageForm({ threadId }: MessageFormProps) {
  const [content, setContent] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    const formData = new FormData();
    formData.set("content", content);
    formData.set("threadId", threadId);

    startTransition(async () => {
      await sendMessage(formData);
      setContent("");
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 px-4 py-3 border-t border-zinc-800">
      <input
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Type a message..."
        className="flex-1 bg-zinc-800/50 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
      />
      <Button type="submit" variant="default" size="icon-sm" disabled={isPending || !content.trim()}>
        <Send className="h-4 w-4" />
      </Button>
    </form>
  );
}
