"use client";

import { Button } from "@/components/ui/button";
import { sendMessage } from "@/lib/actions";
import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { Send } from "lucide-react";

interface MessageFormProps {
  threadId?: string;
  recipientId?: string;
  initialContent?: string;
  initialSource?: {
    messageType?: string;
    sourcePlatform?: string;
    sourceUrl?: string;
    sourcePostId?: string;
    platformPostId?: string;
    platformCommentId?: string;
    metadata?: string;
  };
}

function asActionRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function MessageForm({ threadId, recipientId, initialContent, initialSource }: MessageFormProps) {
  const router = useRouter();
  const [content, setContent] = useState(initialContent || "");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!content.trim()) return;
    if (!threadId && !recipientId) {
      setError("Choose a person before sending.");
      return;
    }

    const formData = new FormData();
    formData.set("content", content);
    if (threadId) formData.set("threadId", threadId);
    if (recipientId) formData.set("recipientId", recipientId);
    if (initialSource?.messageType) formData.set("messageType", initialSource.messageType);
    if (initialSource?.sourcePlatform) formData.set("sourcePlatform", initialSource.sourcePlatform);
    if (initialSource?.sourceUrl) formData.set("sourceUrl", initialSource.sourceUrl);
    if (initialSource?.sourcePostId) formData.set("sourcePostId", initialSource.sourcePostId);
    if (initialSource?.platformPostId) formData.set("platformPostId", initialSource.platformPostId);
    if (initialSource?.platformCommentId) formData.set("platformCommentId", initialSource.platformCommentId);
    if (initialSource?.metadata) formData.set("metadata", initialSource.metadata);

    startTransition(async () => {
      setError("");
      const result = asActionRecord(await sendMessage(formData));
      if (result.error) {
        setError(String(result.error));
        return;
      }

      setContent("");
      const nextThreadId = typeof result.threadId === "string" ? result.threadId : threadId;
      if (nextThreadId && nextThreadId !== threadId) {
        router.replace(`/messages/${nextThreadId}`);
      } else {
        router.refresh();
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="border-t border-[var(--border-primary)] px-4 py-3">
      {error && (
        <p className="mb-2 rounded-lg border border-red-400/25 bg-red-500/10 px-3 py-2 text-xs text-red-100">
          {error}
        </p>
      )}
      {initialSource?.sourcePlatform && initialContent && (
        <p className="mb-2 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)]/70 px-3 py-2 text-xs font-bold text-[var(--text-secondary)]">
          Sharing from {initialSource.sourcePlatform}. Source credit and metadata will stay attached.
        </p>
      )}
      <div className="flex items-center gap-2">
        <input
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder={initialContent ? "Add a note or send the shared post..." : "Type a message..."}
          className="flex-1 glass-surface rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-muted)] transition-all"
        />
        <Button type="submit" variant="default" size="icon-sm" disabled={isPending || !content.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </form>
  );
}
