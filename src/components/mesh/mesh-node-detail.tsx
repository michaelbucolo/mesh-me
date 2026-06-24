"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";
import {
  X, ChevronRight, Users, Hash, FileText, Heart, Link2,
  Eye, EyeOff, Send, UserPlus, UserMinus, Trash2, Shield,
  Lock, ExternalLink, PenSquare, Search, MessageSquare,
  MessageCircle, ZoomIn, RefreshCw, Repeat2, Pin, PinOff,
  Image as ImageIcon, Video, Music, Copy, Clock, Activity,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toggleFollow, deletePost } from "@/lib/actions";
import { useToast } from "@/components/ui/toast";
import { getPlatformActionCapability, normalizePlatformId } from "@/lib/platform-capabilities";
import type { PlatformContentAction } from "@/lib/api-validation";
import type { MeshNode, MeshEdge } from "./mesh-types";

type ConnectedPlatformAccount = {
  id: string;
  platform: string;
};

interface MeshNodeDetailProps {
  node: MeshNode;
  nodes: MeshNode[];
  edges: MeshEdge[];
  hiddenNodes: Set<string>;
  hiddenBranches: Set<string>;
  likedPosts: Set<string>;
  actionLoading: string | null;
  connectedAccounts: ConnectedPlatformAccount[];
  onClose: () => void;
  onToggleNodeHidden: (nodeId: string) => void;
  onToggleBranchHidden: (branchType: string) => void;
  onToggleLike: (postId: string) => void;
  onSetActionLoading: (id: string | null) => void;
  onZoomToNode: (nodeId: string) => void;
  onRefreshMesh: () => Promise<void> | void;
  onOpenNode: (node: MeshNode) => void;
}

function formatMetric(value: number | undefined): string {
  if (value === undefined) return "0";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

function formatNodeDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function getMediaLabel(node: MeshNode): string {
  if (node.mediaType === "video") return "Video";
  if (node.mediaType === "image") return "Image";
  if (node.mediaType === "audio") return "Audio";
  if (node.mediaType === "link") return "Link";
  return "Post";
}

function PostMediaIcon({ node }: { node: MeshNode }) {
  if (node.mediaType === "video") return <Video className="h-3.5 w-3.5" />;
  if (node.mediaType === "image") return <ImageIcon className="h-3.5 w-3.5" />;
  if (node.mediaType === "audio") return <Music className="h-3.5 w-3.5" />;
  return <FileText className="h-3.5 w-3.5" />;
}

export function MeshNodeDetail({
  node, nodes, edges, hiddenNodes, hiddenBranches, likedPosts, actionLoading,
  connectedAccounts, onClose, onToggleNodeHidden, onToggleBranchHidden, onToggleLike,
  onSetActionLoading, onZoomToNode, onRefreshMesh, onOpenNode,
}: MeshNodeDetailProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const [commentDraft, setCommentDraft] = useState("");
  const connectedNodes = nodes
    .filter((other) => other.id !== node.id && edges.some((edge) =>
      (edge.source === node.id && edge.target === other.id) || (edge.target === node.id && edge.source === other.id)
    ))
    .slice(0, 6);
  const isPlatformPost = node.type === "post" && node.sourceType === "platform" && !!node.sourceId;
  const isNativePost = node.type === "post" && !isPlatformPost;
  const isPlatformPerson = node.type === "user" && node.sourceType === "platform" && !!node.connectedAccountId && !!node.platformUserId;
  const actionSyncLabel = node.sourceType === "platform"
    ? `Source account: ${node.platform || "connected platform"}`
    : node.sourceType === "mesh"
      ? "Mesh.me native"
      : "Mesh-managed";
  const nodeDate = formatNodeDate(node.lastActiveAt);
  const postSourceLabel = node.sourceType === "platform"
    ? node.platform || "Connected platform"
    : node.sourceType === "mesh"
      ? "mesh.me"
      : "External source";
  const sourcePlatformId = normalizePlatformId(node.platform);
  const currentSourceAccount = sourcePlatformId
    ? connectedAccounts.find((account) => normalizePlatformId(account.platform) === sourcePlatformId)
    : undefined;
  const isOwnPlatformSource = Boolean(
    node.connectedAccountId && connectedAccounts.some((account) => account.id === node.connectedAccountId)
  );

  function connectSourcePlatformHref(reason: string) {
    const params = new URLSearchParams({
      next: "/mesh",
      reason,
    });
    if (sourcePlatformId) params.set("platform", sourcePlatformId);
    return `/connected-accounts?${params.toString()}`;
  }

  function requireSourcePlatform(reason: string) {
    if (node.sourceType !== "platform" || !sourcePlatformId || currentSourceAccount) return true;
    router.push(connectSourcePlatformHref(reason));
    addToast(`Connect ${node.platform || "the source platform"} to ${reason} this from Mesh.me.`, "info");
    return false;
  }

  function requireOwnPlatformSource(actionLabel: string) {
    if (isOwnPlatformSource) return true;
    addToast(`Only the owner can ${actionLabel} this source post from Mesh.me.`, "info");
    return false;
  }

  async function copyNodeLink() {
    if (!node.href) {
      addToast("This node does not have a shareable link yet.", "info");
      return;
    }

    const link = /^https?:\/\//i.test(node.href)
      ? node.href
      : `${window.location.origin}${node.href}`;

    try {
      await navigator.clipboard.writeText(link);
      addToast("Link copied.", "success");
    } catch {
      addToast("Copy failed. Open the content and copy from there.", "error");
    }
  }

  function openNodeContent() {
    if (node.href) {
      onOpenNode(node);
      return;
    }

    if (node.sourceType === "platform") {
      router.push("/content-hub");
      return;
    }

    if (node.sourceId) {
      router.push(`/feed/${node.sourceId}`);
      return;
    }

    addToast("This Mesh node does not have content to open yet.", "info");
  }

  async function runPlatformPostAction(action: PlatformContentAction, payload: Record<string, unknown> = {}, successMessage = "Action synced.") {
    if (!node.sourceId) {
      addToast("This Mesh node is missing its source post id.", "error");
      return;
    }

    if (["delete", "edit", "pin", "unpin", "visibility"].includes(action) && !requireOwnPlatformSource(action)) {
      return;
    }

    if (["like", "unlike", "share", "reply"].includes(action) && !requireSourcePlatform(action)) {
      return;
    }

    if (action !== "cross-post" && action !== "delete-comment" && action !== "follow" && action !== "unfollow") {
      const capability = getPlatformActionCapability(node.platform, action);
      if (!capability.supported) {
        addToast(capability.reason, "info");
        return;
      }
    }

    const loadingKey = `${action}-${node.id}`;
    onSetActionLoading(loadingKey);
    try {
      const response = await fetch("/api/platform-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, postId: node.sourceId, ...payload }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.error) {
        addToast(result.error || "The source platform did not accept this action.", "error");
        return;
      }

      addToast(successMessage, "success");
      if (action === "delete") onClose();
      await onRefreshMesh();
    } finally {
      onSetActionLoading(null);
    }
  }

  async function runPlatformUserAction(action: "follow" | "unfollow") {
    if (!node.platformUserId) {
      addToast("This person is missing source platform details.", "error");
      return;
    }
    if (!requireSourcePlatform(action)) return;
    if (!currentSourceAccount) return;

    const loadingKey = `${action}-${node.id}`;
    onSetActionLoading(loadingKey);
    try {
      const response = await fetch("/api/platform-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          connectedAccountId: currentSourceAccount.id,
          platformUserId: node.platformUserId,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.error) {
        addToast(result.error || "The source platform did not accept this action.", "error");
        return;
      }

      addToast(action === "follow" ? "Follow synced to the source platform." : "Unfollow synced to the source platform.", "success");
      await onRefreshMesh();
    } finally {
      onSetActionLoading(null);
    }
  }

  async function syncPlatformAccount() {
    if (!node.connectedAccountId) {
      addToast("This platform node is missing its connected account id.", "error");
      return;
    }

    const loadingKey = `sync-${node.id}`;
    onSetActionLoading(loadingKey);
    try {
      const response = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectedAccountId: node.connectedAccountId, syncType: "full" }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.error) {
        addToast(result.error || "Sync failed.", "error");
        return;
      }

      addToast(`${node.platform || node.label} synced.`, "success");
      await onRefreshMesh();
    } finally {
      onSetActionLoading(null);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 20, scale: 0.95 }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
      className="absolute top-20 right-2 sm:right-4 z-20 w-[calc(100vw-1rem)] max-w-[26rem] glass-dropdown rounded-2xl shadow-2xl overflow-hidden max-h-[calc(100vh-6rem)] overflow-y-auto"
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
                 node.type === "activity" ? <Activity className="h-5 w-5" /> :
                 node.label[0]}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{node.label}</p>
              {node.sublabel && <p className="text-xs text-[var(--text-muted)] truncate">{node.sublabel}</p>}
            </div>
          </div>
        <button type="button" onClick={onClose} aria-label="Close node details" className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors">
          <X className="h-4 w-4" />
        </button>
        </div>

        {/* Type badges */}
        <div className="flex items-center gap-2 mb-3">
          <Badge variant="secondary" className="text-[10px] capitalize">{node.type === "self" ? "You" : node.type}</Badge>
            {node.isMutual && <Badge className="text-[10px]">Mutual</Badge>}
            {node.type === "activity" && node.isUnread && <Badge className="text-[10px]">Unread</Badge>}
            {node.category && <Badge variant="secondary" className="text-[10px]">{node.category}</Badge>}
          {node.type === "post" && (
            <Badge variant="secondary" className="text-[10px] flex items-center gap-0.5">
              <Lock className="h-2.5 w-2.5" /> {node.sourceType === "platform" ? node.platform || "Source" : "Your post"}
            </Badge>
          )}
        </div>

        <div className="mb-3 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)]/72 p-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">Action sync</p>
              <p className="truncate text-xs font-medium text-[var(--text-secondary)]">{actionSyncLabel}</p>
            </div>
            {node.sourceType === "platform" && (
              <span className="shrink-0 rounded-full bg-[var(--accent-subtle)] px-2 py-1 text-[10px] font-bold text-[var(--accent)]">
                Provider-gated
              </span>
            )}
          </div>
        </div>

        {node.type === "post" && (
          <div className="mb-3 overflow-hidden rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-primary)]/78 shadow-[var(--shadow-sm)]">
            <div
              className="relative min-h-[8rem] overflow-hidden bg-[var(--bg-tertiary)]"
              style={{ aspectRatio: String(node.mediaAspectRatio || (node.mediaType === "text" ? 1.7 : 1)) }}
            >
              {node.imageUrl ? (
                <Image
                  src={node.imageUrl}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 94vw, 416px"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full min-h-[8rem] items-center justify-center p-5">
                  <p className="line-clamp-5 text-center text-sm font-semibold leading-6 text-[var(--text-primary)]">
                    {node.content || node.label || "Mesh post"}
                  </p>
                </div>
              )}
              <div className="absolute left-2 top-2 flex flex-wrap items-center gap-1.5">
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-black/58 px-2 py-1 text-[10px] font-bold capitalize text-white backdrop-blur"
                  style={{ border: `1px solid ${node.color}66` }}
                >
                  <PostMediaIcon node={node} />
                  {getMediaLabel(node)}
                </span>
                <span className="rounded-full bg-black/58 px-2 py-1 text-[10px] font-bold text-white backdrop-blur">
                  {postSourceLabel}
                </span>
              </div>
              {node.mediaType === "video" && (
                <span className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/52 text-white backdrop-blur">
                  <Video className="h-5 w-5" />
                </span>
              )}
            </div>
            <div className="space-y-3 p-3">
              <div>
                <p className="line-clamp-2 text-sm font-bold text-[var(--text-primary)]">{node.label}</p>
                {node.content && node.imageUrl && (
                  <p className="mt-1 line-clamp-3 text-xs leading-5 text-[var(--text-secondary)]">{node.content}</p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-semibold text-[var(--text-muted)]">
                  {nodeDate && (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {nodeDate}
                    </span>
                  )}
                  {node.visibility && <span className="capitalize">{node.visibility}</span>}
                  {node.isPinned && <span>Pinned</span>}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-[var(--bg-secondary)]/72 p-1.5">
                <div className="rounded-lg px-2 py-1.5 text-center">
                  <p className="text-xs font-bold text-[var(--text-primary)]">{formatMetric(node.likeCount)}</p>
                  <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--text-muted)]">Likes</p>
                </div>
                <div className="rounded-lg px-2 py-1.5 text-center">
                  <p className="text-xs font-bold text-[var(--text-primary)]">{formatMetric(node.commentCount)}</p>
                  <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--text-muted)]">Replies</p>
                </div>
                <div className="rounded-lg px-2 py-1.5 text-center">
                  <p className="text-xs font-bold text-[var(--text-primary)]">{formatMetric(node.repostCount)}</p>
                  <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--text-muted)]">Shares</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={openNodeContent}
                  className="brand-button col-span-2 flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-bold text-white shadow-lg transition active:scale-95"
                >
                  <Eye className="h-3.5 w-3.5" />
                  {node.sourceType === "platform" ? "View Source" : "View Post"}
                </button>
                <button
                  type="button"
                  onClick={copyNodeLink}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-3 py-2 text-xs font-bold text-[var(--text-primary)] transition hover:bg-[var(--bg-tertiary)] active:scale-95"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </button>
                {node.sourceType === "platform" ? (
                  <Link
                    href="/content-hub"
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-3 py-2 text-xs font-bold text-[var(--text-primary)] transition hover:bg-[var(--bg-tertiary)] active:scale-95"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Hub
                  </Link>
                ) : (
                  <Link
                    href={node.sourceId ? `/feed/${node.sourceId}` : "/feed"}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-3 py-2 text-xs font-bold text-[var(--text-primary)] transition hover:bg-[var(--bg-tertiary)] active:scale-95"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    Feed
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Content preview */}
        {node.type !== "post" && node.content && <p className="text-xs text-[var(--text-tertiary)] leading-relaxed mb-3 line-clamp-3">{node.content}</p>}

        {/* Description */}
        {node.description && <p className="text-xs text-[var(--text-tertiary)] leading-relaxed mb-3 line-clamp-2">{node.description}</p>}

        {/* Stats */}
        {(node.followerCount !== undefined || node.postCount !== undefined || node.memberCount !== undefined || node.likeCount !== undefined) && (
          <div className="flex items-center gap-3 mb-3 py-2 border-y border-[var(--border-primary)]">
            {node.followerCount !== undefined && <div className="flex items-center gap-1 text-xs text-[var(--text-tertiary)]"><Users className="h-3 w-3" /><span className="text-[var(--text-primary)] font-medium">{node.followerCount}</span></div>}
            {node.postCount !== undefined && <div className="flex items-center gap-1 text-xs text-[var(--text-tertiary)]"><FileText className="h-3 w-3" /><span className="text-[var(--text-primary)] font-medium">{node.postCount}</span></div>}
            {node.memberCount !== undefined && <div className="flex items-center gap-1 text-xs text-[var(--text-tertiary)]"><Users className="h-3 w-3" /><span className="text-[var(--text-primary)] font-medium">{node.memberCount}</span></div>}
            {node.likeCount !== undefined && <div className="flex items-center gap-1 text-xs text-[var(--text-tertiary)]"><Heart className="h-3 w-3" /><span className="text-[var(--text-primary)] font-medium">{node.likeCount}</span></div>}
            {node.commentCount !== undefined && <div className="flex items-center gap-1 text-xs text-[var(--text-tertiary)]"><MessageCircle className="h-3 w-3" /><span className="text-[var(--text-primary)] font-medium">{node.commentCount}</span></div>}
            {node.repostCount !== undefined && node.repostCount > 0 && <div className="flex items-center gap-1 text-xs text-[var(--text-tertiary)]"><ExternalLink className="h-3 w-3" /><span className="text-[var(--text-primary)] font-medium">{node.repostCount}</span></div>}
          </div>
        )}

        {/* Engagement score */}
        {node.engagementScore !== undefined && node.engagementScore > 0 && node.type === "user" && (
          <div className="mb-3">
            <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">Engagement</p>
            <div className="h-1.5 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" style={{ width: `${Math.min(node.engagementScore * 2, 100)}%` }} />
            </div>
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

        {/* Shared communities */}
        {node.sharedCommunities && node.sharedCommunities.length > 0 && (
          <div className="mb-3">
            <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Shared communities</p>
            <div className="flex flex-wrap gap-1">
              {node.sharedCommunities.map((comm) => (
                <span key={comm} className="text-[10px] px-2 py-0.5 rounded-md bg-pink-500/10 text-pink-400 border border-pink-500/20">{comm}</span>
              ))}
            </div>
          </div>
        )}

        {/* Last active */}
        {node.lastActiveAt && (node.type === "user" || node.type === "activity") && (
            <div className="mb-3">
              <p className="text-[10px] text-[var(--text-muted)]">
                {node.type === "activity" ? "Activity" : "Last seen"} {new Date(node.lastActiveAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </p>
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

        {connectedNodes.length > 0 && (
          <div className="mb-3 border-y border-[var(--border-primary)] py-3">
            <p className="mb-2 text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Connected nodes</p>
            <div className="grid gap-1.5">
              {connectedNodes.map((connectedNode) => (
                <button
                  key={connectedNode.id}
                  type="button"
                  onClick={() => onZoomToNode(connectedNode.id)}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-[var(--bg-tertiary)] active:scale-[0.99]"
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: connectedNode.color }}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-[var(--text-secondary)]">
                    {connectedNode.label}
                  </span>
                  <span className="shrink-0 text-[9px] capitalize text-[var(--text-muted)]">
                    {connectedNode.type.replace("-", " ")}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

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
          {node.type === "user" && !isPlatformPerson && (
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

          {isPlatformPerson && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => runPlatformUserAction(node.isMutual ? "unfollow" : "follow")}
                  disabled={actionLoading === `follow-${node.id}` || actionLoading === `unfollow-${node.id}`}
                  className="flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium brand-button text-white shadow-lg transition-all active:scale-95 disabled:opacity-60"
                >
                  {actionLoading === `follow-${node.id}` || actionLoading === `unfollow-${node.id}` ? (
                    <RefreshCw className="h-3 w-3 animate-spin" />
                  ) : node.isMutual ? (
                    <><UserMinus className="h-3 w-3" /> Unfollow</>
                  ) : (
                    <><UserPlus className="h-3 w-3" /> Follow</>
                  )}
                </button>
                {node.href ? (
                  <a
                    href={node.href}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium glass-surface text-[var(--text-primary)] transition-all hover:bg-[var(--bg-tertiary)] active:scale-95"
                  >
                    <ExternalLink className="h-3 w-3" /> Source
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => router.push("/connected-accounts")}
                    className="flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium glass-surface text-[var(--text-primary)] transition-all hover:bg-[var(--bg-tertiary)] active:scale-95"
                  >
                    <Shield className="h-3 w-3" /> Account
                  </button>
                )}
              </div>
              <p className="text-[10px] leading-relaxed text-[var(--text-muted)]">
                This follows or unfollows through the connected {node.platform || "platform"} account only when that provider allows it.
              </p>
            </div>
          )}

          {/* Post actions */}
          {isNativePost && (
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
                  onClick={() => router.push(node.sourceId ? `/feed/${node.sourceId}` : "/feed")}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium glass-surface text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all active:scale-95"
                >
                  <MessageSquare className="h-3 w-3" /> Comment
                </button>
              </div>
              <div className="flex gap-2">
                {node.href && (
                  <button
                    type="button"
                    onClick={openNodeContent}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium brand-button text-white transition-all active:scale-95 shadow-lg"
                  >
                      <Eye className="h-3 w-3" /> View Post
                  </button>
                )}
                <button
                  onClick={async () => {
                    const postId = node.sourceId || node.id.replace("post-", "");
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

          {isPlatformPost && (
            <div className="space-y-3">
              {!currentSourceAccount && (
                <Link
                  href={connectSourcePlatformHref("interact")}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[var(--accent-muted)] bg-[var(--accent-subtle)] px-3 py-2.5 text-xs font-bold text-[var(--accent)] transition hover:brightness-110"
                >
                  <span>Connect {node.platform || "source"} to like, comment, and share.</span>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                </Link>
              )}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onToggleLike(node.id)}
                  disabled={actionLoading === "like-" + node.id}
                  className={"flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-all active:scale-95 disabled:opacity-60 " + (
                    likedPosts.has(node.id)
                      ? "border border-sky-500/30 bg-sky-500/20 text-sky-400"
                      : "glass-surface text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
                  )}
                >
                  {actionLoading === "like-" + node.id ? (
                    <RefreshCw className="h-3 w-3 animate-spin" />
                  ) : (
                    <Heart className={"h-3 w-3" + (likedPosts.has(node.id) ? " fill-current" : "")} />
                  )}
                  {likedPosts.has(node.id) ? "Liked" : "Like"}
                </button>
                <button
                  type="button"
                  onClick={() => runPlatformPostAction("share", {}, "Share synced to the source platform.")}
                  disabled={actionLoading === `share-${node.id}`}
                  className="flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium glass-surface text-[var(--text-primary)] transition-all hover:bg-[var(--bg-tertiary)] active:scale-95 disabled:opacity-60"
                >
                  {actionLoading === `share-${node.id}` ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Repeat2 className="h-3 w-3" />}
                  Share
                </button>
                {isOwnPlatformSource ? (
                  <button
                    type="button"
                    onClick={() => runPlatformPostAction(node.isPinned ? "unpin" : "pin", {}, node.isPinned ? "Post unpinned on the source platform." : "Post pinned on the source platform.")}
                    disabled={actionLoading === `pin-${node.id}` || actionLoading === `unpin-${node.id}`}
                    className="flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium glass-surface text-[var(--text-primary)] transition-all hover:bg-[var(--bg-tertiary)] active:scale-95 disabled:opacity-60"
                  >
                    {actionLoading === `pin-${node.id}` || actionLoading === `unpin-${node.id}` ? (
                      <RefreshCw className="h-3 w-3 animate-spin" />
                    ) : node.isPinned ? (
                      <PinOff className="h-3 w-3" />
                    ) : (
                      <Pin className="h-3 w-3" />
                    )}
                    {node.isPinned ? "Unpin" : "Pin"}
                  </button>
                ) : (
                  <Link
                    href={connectSourcePlatformHref("interact")}
                    className="flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium glass-surface text-[var(--text-primary)] transition-all hover:bg-[var(--bg-tertiary)] active:scale-95"
                  >
                    <Link2 className="h-3 w-3" />
                    Connect
                  </Link>
                )}
                {node.href ? (
                  <button
                    type="button"
                    onClick={openNodeContent}
                    className="flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium brand-button text-white shadow-lg transition-all active:scale-95"
                  >
                    <Eye className="h-3 w-3" /> Source
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => router.push("/content-hub")}
                    className="flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium brand-button text-white shadow-lg transition-all active:scale-95"
                  >
                    <Eye className="h-3 w-3" /> Hub
                  </button>
                )}
              </div>

              <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)]/72 p-2">
                <label htmlFor={`mesh-comment-${node.id}`} className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  Comment on source
                </label>
                <div className="flex gap-2">
                  <input
                    id={`mesh-comment-${node.id}`}
                    value={commentDraft}
                    onChange={(event) => setCommentDraft(event.target.value)}
                    placeholder="Write a reply..."
                    className="min-w-0 flex-1 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-input)] px-2.5 py-2 text-xs text-[var(--text-primary)] outline-none transition focus:border-[var(--accent)]"
                  />
                  <button
                    type="button"
                    disabled={!commentDraft.trim() || actionLoading === `reply-${node.id}`}
                    onClick={async () => {
                      const content = commentDraft.trim();
                      if (!content) return;
                      await runPlatformPostAction("reply", { content }, "Comment synced to the source platform.");
                      setCommentDraft("");
                    }}
                    className="rounded-lg px-3 py-2 text-xs font-bold brand-button text-white transition active:scale-95 disabled:opacity-50"
                  >
                    {actionLoading === `reply-${node.id}` ? <RefreshCw className="h-3 w-3 animate-spin" /> : "Send"}
                  </button>
                </div>
              </div>

              {isOwnPlatformSource && (
                <>
                  <div className="grid grid-cols-3 gap-1.5">
                    {["public", "unlisted", "private"].map((visibility) => (
                      <button
                        key={visibility}
                        type="button"
                        onClick={() => runPlatformPostAction("visibility", { visibility }, `Visibility changed to ${visibility}.`)}
                        disabled={actionLoading === `visibility-${node.id}`}
                        className={"rounded-lg border px-2 py-1.5 text-[10px] font-bold capitalize transition active:scale-95 disabled:opacity-60 " + (
                          node.visibility === visibility
                            ? "border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--accent)]"
                            : "border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
                        )}
                      >
                        {visibility}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm("Delete this from your Mesh and the source platform when supported?")) {
                        void runPlatformPostAction("delete", {}, "Delete request completed.");
                      }
                    }}
                    disabled={actionLoading === `delete-${node.id}`}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium text-red-400 glass-surface transition-all hover:bg-red-500/10 active:scale-95 disabled:opacity-60"
                  >
                    {actionLoading === `delete-${node.id}` ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                    Delete from source
                  </button>
                </>
              )}
            </div>
          )}

          {/* Platform actions */}
          {node.type === "platform" && (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={syncPlatformAccount}
                disabled={actionLoading === `sync-${node.id}`}
                className="flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium brand-button text-white shadow-lg transition-all active:scale-95 disabled:opacity-60"
              >
                <RefreshCw className={"h-3 w-3 " + (actionLoading === `sync-${node.id}` ? "animate-spin" : "")} />
                Sync now
              </button>
              <Link href="/connected-accounts" className="flex-1">
                <button className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium brand-button text-white transition-all active:scale-95 shadow-lg">
                  <Shield className="h-3 w-3" /> Manage
                </button>
              </Link>
              <Link href="/content-hub" className="flex-1">
                <button className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium glass-surface text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all active:scale-95">
                  <FileText className="h-3 w-3" /> Content
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

          {node.type === "activity" && (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={openNodeContent}
                className="flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium brand-button text-white shadow-lg transition-all active:scale-95"
              >
                <Eye className="h-3 w-3" /> Open
              </button>
              <Link href="/notifications" className="flex-1">
                <button className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium glass-surface text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all active:scale-95">
                  <Activity className="h-3 w-3" /> Activity
                </button>
              </Link>
            </div>
          )}

          {/* Self actions */}
          {node.type === "self" && (
            <div className="grid grid-cols-2 gap-2">
              <Link href="/feed?compose=true" className="flex-1">
                <button className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium brand-button text-white transition-all active:scale-95 shadow-lg">
                  <PenSquare className="h-3 w-3" /> New Post
                </button>
              </Link>
              <Link href="/connected-accounts" className="flex-1">
                <button className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium brand-button text-white transition-all active:scale-95 shadow-lg">
                  <Link2 className="h-3 w-3" /> Connect
                </button>
              </Link>
              <Link href="/analytics" className="flex-1">
                <button className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium glass-surface text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all active:scale-95">
                  <Search className="h-3 w-3" /> Analytics
                </button>
              </Link>
              <Link href="/settings?tab=privacy" className="flex-1">
                <button className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium glass-surface text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all active:scale-95">
                  <Shield className="h-3 w-3" /> Privacy
                </button>
              </Link>
              <Link href={node.href || "/settings"} className="col-span-2">
                <button className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium glass-surface text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all active:scale-95">
                  <Eye className="h-3 w-3" /> Profile
                </button>
              </Link>
            </div>
          )}

          {/* Generic view */}
          {node.href && !["user", "post", "platform", "community", "tag", "self", "activity"].includes(node.type) && (
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
