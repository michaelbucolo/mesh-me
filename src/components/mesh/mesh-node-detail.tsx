"use client";

import { motion } from "framer-motion";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  X, ChevronRight, Users, Hash, FileText, Heart, Link2,
  Eye, EyeOff, Send, UserPlus, UserMinus, Trash2, Shield,
  Lock, ExternalLink, PenSquare, Search, MessageSquare,
  MessageCircle, ZoomIn,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toggleFollow, deletePost } from "@/lib/actions";
import type { MeshNode, MeshEdge } from "./mesh-types";
import { STATUS_COLORS } from "./mesh-types";

interface MeshNodeDetailProps {
  node: MeshNode;
  edges: MeshEdge[];
  hiddenNodes: Set<string>;
  hiddenBranches: Set<string>;
  likedPosts: Set<string>;
  actionLoading: string | null;
  onClose: () => void;
  onToggleNodeHidden: (nodeId: string) => void;
  onToggleBranchHidden: (branchType: string) => void;
  onToggleLike: (postId: string) => void;
  onSetActionLoading: (id: string | null) => void;
  onZoomToNode: (nodeId: string) => void;
}

export function MeshNodeDetail({
  node, edges, hiddenNodes, hiddenBranches, likedPosts, actionLoading,
  onClose, onToggleNodeHidden, onToggleBranchHidden, onToggleLike,
  onSetActionLoading, onZoomToNode,
}: MeshNodeDetailProps) {
  const router = useRouter();

  return (
    <motion.div
      initial={{ opacity: 0, x: 20, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 20, scale: 0.95 }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
      className="absolute top-20 right-2 sm:right-4 z-20 w-[calc(100vw-1rem)] sm:w-80 max-w-80 glass-dropdown rounded-2xl shadow-2xl overflow-hidden max-h-[60vh] overflow-y-auto"
    >
      <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, ${node.color}, ${node.color}60, transparent)` }} />
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            {node.avatarUrl ? (
              <Avatar src={node.avatarUrl} alt={node.label} size="md" />
            ) : (
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-lg" style={{ backgroundColor: node.color }}>
                {node.type === "community" ? <Users className="h-5 w-5" /> :
                 node.type === "tag" ? <Hash className="h-5 w-5" /> :
                 node.type === "post" ? <FileText className="h-5 w-5" /> :
                 node.type === "platform" ? <Link2 className="h-5 w-5" /> :
                 node.label[0]}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{node.label}</p>
              {node.sublabel && <p className="text-xs text-[var(--text-muted)] truncate">{node.sublabel}</p>}
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Type badges */}
        <div className="flex items-center gap-2 mb-3">
          <Badge variant="secondary" className="text-[10px] capitalize">{node.type === "self" ? "You" : node.type}</Badge>
          {node.isMutual && <Badge className="text-[10px]">Mutual</Badge>}
          {node.category && <Badge variant="secondary" className="text-[10px]">{node.category}</Badge>}
          {node.type === "post" && (
            <Badge variant="secondary" className="text-[10px] flex items-center gap-0.5">
              <Lock className="h-2.5 w-2.5" /> Your post
            </Badge>
          )}
        </div>

        {/* Content preview */}
        {node.content && <p className="text-xs text-[var(--text-tertiary)] leading-relaxed mb-3 line-clamp-3">{node.content}</p>}

        {/* Stats */}
        {(node.followerCount !== undefined || node.postCount !== undefined || node.memberCount !== undefined || node.likeCount !== undefined) && (
          <div className="flex items-center gap-3 mb-3 py-2 border-y border-[var(--border-primary)]">
            {node.followerCount !== undefined && <div className="flex items-center gap-1 text-xs text-[var(--text-tertiary)]"><Users className="h-3 w-3" /><span className="text-[var(--text-primary)] font-medium">{node.followerCount}</span></div>}
            {node.postCount !== undefined && <div className="flex items-center gap-1 text-xs text-[var(--text-tertiary)]"><FileText className="h-3 w-3" /><span className="text-[var(--text-primary)] font-medium">{node.postCount}</span></div>}
            {node.memberCount !== undefined && <div className="flex items-center gap-1 text-xs text-[var(--text-tertiary)]"><Users className="h-3 w-3" /><span className="text-[var(--text-primary)] font-medium">{node.memberCount}</span></div>}
            {node.likeCount !== undefined && <div className="flex items-center gap-1 text-xs text-[var(--text-tertiary)]"><Heart className="h-3 w-3" /><span className="text-[var(--text-primary)] font-medium">{node.likeCount}</span></div>}
            {node.commentCount !== undefined && <div className="flex items-center gap-1 text-xs text-[var(--text-tertiary)]"><MessageCircle className="h-3 w-3" /><span className="text-[var(--text-primary)] font-medium">{node.commentCount}</span></div>}
          </div>
        )}

        {/* Shared interests */}
        {node.sharedInterests && node.sharedInterests.length > 0 && (
          <div className="mb-3">
            <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Shared interests</p>
            <div className="flex flex-wrap gap-1">
              {node.sharedInterests.map((stag) => (
                <span key={stag} className="text-[10px] px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">#{stag}</span>
              ))}
            </div>
          </div>
        )}

        {/* Connection count + Zoom to */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
            {edges.filter((e) => e.source === node.id || e.target === node.id).length} connections in mesh
          </p>
          <button
            onClick={() => onZoomToNode(node.id)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-all"
          >
            <ZoomIn className="h-3 w-3" /> Zoom to
          </button>
        </div>

        {/* Privacy control */}
        {node.type !== "self" && (
          <div className="flex items-center justify-between mb-3 py-2 border-b border-[var(--border-primary)]">
            <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Node visibility</span>
            <div className="flex gap-1.5">
              <button
                onClick={() => onToggleNodeHidden(node.id)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-all hover:bg-[var(--bg-tertiary)]"
                style={{ color: hiddenNodes.has(node.id) ? "#ef4444" : "var(--text-secondary)" }}
              >
                <EyeOff className="h-3 w-3" />
                {hiddenNodes.has(node.id) ? "Hidden" : "Hide node"}
              </button>
              <button
                onClick={() => onToggleBranchHidden(node.type)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-all hover:bg-[var(--bg-tertiary)]"
                style={{ color: hiddenBranches.has(node.type) ? "#ef4444" : "var(--text-muted)" }}
              >
                <EyeOff className="h-3 w-3" />
                {hiddenBranches.has(node.type) ? "Branch hidden" : `Hide all ${node.type}s`}
              </button>
            </div>
          </div>
        )}

        {/* Quick actions */}
        <div className="space-y-2">
          {/* User actions */}
          {node.type === "user" && (
            <div className="flex gap-2">
              <button
                onClick={() => router.push("/messages?to=" + node.id.replace("follower-", ""))}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium brand-button text-white transition-all active:scale-95 shadow-lg"
              >
                <Send className="h-3 w-3" /> Message
              </button>
              <button
                onClick={async () => {
                  onSetActionLoading("follow-" + node.id);
                  await toggleFollow(node.id.replace("follower-", ""));
                  onSetActionLoading(null);
                }}
                disabled={actionLoading === "follow-" + node.id}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium glass-surface text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all active:scale-95"
              >
                {actionLoading === "follow-" + node.id ? (
                  <div className="h-3 w-3 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--accent)" }} />
                ) : node.isFollowing ? (
                  <><UserMinus className="h-3 w-3" /> Unfollow</>
                ) : (
                  <><UserPlus className="h-3 w-3" /> Follow</>
                )}
              </button>
            </div>
          )}

          {/* Post actions */}
          {node.type === "post" && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <button
                  onClick={() => onToggleLike(node.id)}
                  className={"flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all active:scale-95 " + (
                    likedPosts.has(node.id)
                      ? "bg-sky-500/20 text-sky-400 border border-sky-500/30"
                      : "glass-surface text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
                  )}
                >
                  <Heart className={"h-3 w-3" + (likedPosts.has(node.id) ? " fill-current" : "")} />
                  {likedPosts.has(node.id) ? "Liked" : "Like"}
                </button>
                <button
                  onClick={() => router.push("/feed")}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium glass-surface text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all active:scale-95"
                >
                  <MessageSquare className="h-3 w-3" /> Comment
                </button>
              </div>
              <div className="flex gap-2">
                {node.href && (
                  <Link href={node.href} className="flex-1">
                    <button className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium brand-button text-white transition-all active:scale-95 shadow-lg">
                      <Eye className="h-3 w-3" /> View Post
                    </button>
                  </Link>
                )}
                <button
                  onClick={async () => {
                    const postId = node.id.replace("post-", "");
                    onSetActionLoading("delete-" + postId);
                    await deletePost(postId);
                    onClose();
                    onSetActionLoading(null);
                    window.location.reload();
                  }}
                  disabled={actionLoading?.startsWith("delete-")}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-red-400 glass-surface hover:bg-red-500/10 transition-all active:scale-95"
                >
                  {actionLoading?.startsWith("delete-") ? (
                    <div className="h-3 w-3 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <><Trash2 className="h-3 w-3" /> Delete</>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Platform actions */}
          {node.type === "platform" && (
            <div className="flex gap-2">
              <Link href="/connected-accounts" className="flex-1">
                <button className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium brand-button text-white transition-all active:scale-95 shadow-lg">
                  <Shield className="h-3 w-3" /> Manage
                </button>
              </Link>
              <Link href="/settings" className="flex-1">
                <button className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium glass-surface text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all active:scale-95">
                  <ExternalLink className="h-3 w-3" /> Settings
                </button>
              </Link>
            </div>
          )}

          {/* Community actions */}
          {node.type === "community" && node.href && (
            <Link href={node.href}>
              <Button variant="gradient" size="sm" className="w-full">
                Visit Community <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </Link>
          )}

          {/* Tag actions */}
          {node.type === "tag" && node.href && (
            <Link href={node.href}>
              <Button variant="gradient" size="sm" className="w-full">
                <Search className="h-3.5 w-3.5 mr-1" /> Search Tag
              </Button>
            </Link>
          )}

          {/* Self actions */}
          {node.type === "self" && (
            <div className="flex gap-2">
              <Link href="/feed?compose=true" className="flex-1">
                <button className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium brand-button text-white transition-all active:scale-95 shadow-lg">
                  <PenSquare className="h-3 w-3" /> New Post
                </button>
              </Link>
              <Link href={node.href || "/settings"} className="flex-1">
                <button className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium glass-surface text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all active:scale-95">
                  <Eye className="h-3 w-3" /> Profile
                </button>
              </Link>
            </div>
          )}

          {/* Generic view */}
          {node.href && !["user", "post", "platform", "community", "tag", "self"].includes(node.type) && (
            <Link href={node.href}>
              <Button variant="gradient" size="sm" className="w-full">
                View <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </Link>
          )}
        </div>
      </div>
    </motion.div>
  );
}
