"use client";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/lib/utils";
import { createComment } from "@/lib/actions";
import { useState, useTransition } from "react";
import Link from "next/link";

interface Comment {
  id: string;
  content: string;
  createdAt: Date | string;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
  replies?: Comment[];
}

interface CommentSectionProps {
  postId: string;
  comments: Comment[];
  currentUser?: { displayName: string; avatarUrl: string | null } | null;
}

export function CommentSection({ postId, comments, currentUser }: CommentSectionProps) {
  const [content, setContent] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleSubmit = () => {
    if (!content.trim()) return;
    const formData = new FormData();
    formData.set("content", content);
    formData.set("postId", postId);

    startTransition(async () => {
      const result = await createComment(formData);
      if (result?.success) {
        setContent("");
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Comment composer */}
      {currentUser && (
        <div className="flex gap-3">
          <Avatar src={currentUser.avatarUrl} alt={currentUser.displayName} size="sm" />
          <div className="flex-1 flex gap-2">
            <input
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write a comment..."
              className="flex-1 glass-surface rounded-xl px-4 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none transition-colors"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
            />
            <Button size="sm" onClick={handleSubmit} disabled={!content.trim() || isPending}>
              {isPending ? "..." : "Reply"}
            </Button>
          </div>
        </div>
      )}

      {/* Comments list */}
      <div className="space-y-3">
        {comments.map((comment) => (
          <CommentItem key={comment.id} comment={comment} />
        ))}
      </div>
    </div>
  );
}

function CommentItem({ comment }: { comment: Comment }) {
  return (
    <div className="flex gap-3">
      <Link href={`/profile/${comment.author.username}`}>
        <Avatar src={comment.author.avatarUrl} alt={comment.author.displayName} size="sm" />
      </Link>
      <div className="flex-1">
        <div className="glass-surface rounded-xl px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <Link href={`/profile/${comment.author.username}`} className="text-sm font-semibold text-[var(--text-primary)] hover:underline">
              {comment.author.displayName}
            </Link>
            <span className="text-xs text-[var(--text-muted)]">{formatRelativeTime(comment.createdAt)}</span>
          </div>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{comment.content}</p>
        </div>

        {/* Replies */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="ml-4 mt-2 space-y-2">
            {comment.replies.map((reply) => (
              <CommentItem key={reply.id} comment={reply} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
