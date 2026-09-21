"use client";

import { PaperWait } from "@/components/loading/paper-wait";
import { PlatformLogo } from "@/components/platform/platform-logo";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useReducedMotion } from "framer-motion";
import { useRef, useState, useTransition, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createPost } from "@/lib/actions";
import { SHARED_INTAKE_KEY } from "@/app/(app)/share/share-intake";
import { publishMeshiCause } from "@/lib/meshi-bus";
import { feedback } from "@/lib/feedback";
import { celebrate } from "@/lib/celebration";
import socialMotion from "./social-motion.module.css";
import { MAX_POST_MEDIA_FILES, POST_MEDIA_ACCEPT, postMediaSelectionError } from "@/lib/post-media";
import { readPostDraft, type PostAudience } from "@/lib/post-draft";
import { Image as ImageIcon, Hash, Globe, X, Share2, ChevronDown, Info, CheckCircle2, AlertTriangle, Link as LinkIcon, Lock, Users } from "lucide-react";

// THERE IS NO HARDCODED PLATFORM LIST HERE ANY MORE.
//
// It was seven entries — instagram, twitter, facebook, linkedin, threads,
// bluesky, reddit — and both of the composer's derived lists were intersected
// with it. Two things were wrong with that, and the second one is the reason
// this changed:
//
//   1. `bluesky` is not in the roster at all (twelve platforms, no Bluesky), so
//      that entry could never match either array. Dead, but only cosmetic.
//
//   2. THE ROSTER HAS TWELVE PLATFORMS AND THIS LIST HAD SEVEN. discord,
//      twitch, youtube, tiktok, pinterest and snapchat were absent — so
//      `connectedButNotPublishable`, whose entire job is to explain which of
//      your connected accounts cannot receive a post, COULD NOT SEE SIX OF
//      THEM. Connect YouTube and TikTok and the composer said nothing about
//      either: not "these can't", not "these can" — nothing. The same failure
//      as a grid where only the happy states are labelled.
//
// The API already returns every connected account with its real name and its
// capability, so both lists come from there now and cannot fall behind the
// roster. Marks come from PlatformLogo, the same drawn set the connect page and
// the mesh canvas use.
type ComposerPlatform = { id: string; name: string };

interface PostComposerProps {
  user: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
  communityId?: string;
  communityIsPublic?: boolean;
  startExpanded?: boolean;
  onPostPending?: (draft: PostDraft) => string | void;
  onPostCreated?: (post: CreatedFeedPost, optimisticId?: string) => void;
  onPostFailed?: (optimisticId?: string) => void;
}

type PostDraft = {
  content: string;
  tags: string;
  communityId?: string;
  crossPostTo: string[];
  visibility: PostAudience;
  media: { id: string; url: string; type: string }[];
};

type CreatedFeedPost = {
  id: string;
  content: string;
  createdAt: Date | string;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    isVerified: boolean;
  };
  community?: { id: string; name: string; slug: string } | null;
  media: { id: string; url: string; type: string }[];
  tags: { id: string; tag: string }[];
  _count: { comments: number; reactions: number; reposts: number };
  reactions?: { id: string }[];
  savedBy?: { id: string }[];
  isPinned?: boolean;
  platform?: string;
  optimistic?: boolean;
  isNsfw?: boolean;
  contentRating?: string;
  visibility?: string;
};

type LocalMediaPreview = {
  id: string;
  file: File;
  url: string;
  type: "image" | "video";
};

const visibilityOptions = [
  { id: "public", label: "Everyone", icon: Globe, copy: "Anyone on Mesh.me" },
  { id: "friends", label: "Friends", icon: Users, copy: "Mutual follows only" },
  { id: "private", label: "Only me", icon: Lock, copy: "Private to your account" },
] as const;

function inferComposerMediaType(url: string) {
  const clean = url.split("?")[0]?.toLowerCase() || "";
  if (/\.(mp4|webm|mov|m4v)$/.test(clean)) return "video";
  if (/\.(png|jpe?g|gif|webp|avif)$/.test(clean)) return "image";
  return "link";
}

export function PostComposer({ user, communityId, communityIsPublic = true, startExpanded = false, onPostPending, onPostCreated, onPostFailed }: PostComposerProps) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const publishButtonRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaFilesRef = useRef<LocalMediaPreview[]>([]);
  const submittingRef = useRef(false);
  const draftKey = `mesh.post-draft.v1:${user.id}:${communityId || "home"}`;
  const [loadedDraftKey, setLoadedDraftKey] = useState<string | null>(null);
  const [draftSaved, setDraftSaved] = useState(false);
  const audienceOptions = communityId
    ? [...visibilityOptions.filter((option) => communityIsPublic || option.id !== "public"), { id: "community" as const, label: "Members", icon: Users, copy: "This community only" }]
    : visibilityOptions;
  const shouldFocusComposer = searchParams.get("compose") === "true" || startExpanded;
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [visibility, setVisibility] = useState<PostAudience>(communityId && !communityIsPublic ? "community" : "public");
  const [mediaFiles, setMediaFiles] = useState<LocalMediaPreview[]>([]);
  const [mediaUrl, setMediaUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [showTags, setShowTags] = useState(false);
  const [showLinkTools, setShowLinkTools] = useState(false);
  const [showVisibility, setShowVisibility] = useState(false);
  const [showCrossPost, setShowCrossPost] = useState(false);
  // Per-platform cross-post outcomes from the last publish: the permalink to
  // what was actually created ("your words, over there"), plus any honest
  // shortfall note. Shown under the success line, cleared with it.
  const [crossPostOutcomes, setCrossPostOutcomes] = useState<
    Array<{ target: string; url?: string; note?: string; error?: string }>
  >([]);

  // A selection armed while the post was Public must not ride along when the
  // audience narrows — cross-posts are public everywhere they land.
  useEffect(() => {
    if (visibility !== "public") setSelectedPlatforms(new Set());
  }, [visibility]);

  // Shared INTO mesh.me (see /share, the manifest's share_target receiver):
  // another app's share sheet stashed its text one redirect ago. Pick it up
  // exactly once, open pre-filled, and never overwrite something the person
  // was already writing.
  useEffect(() => {
    try {
      const shared = sessionStorage.getItem(SHARED_INTAKE_KEY);
      if (!shared) return;
      sessionStorage.removeItem(SHARED_INTAKE_KEY);
      setContent((current) => current || shared.slice(0, 500));
      setExpanded(true);
    } catch {
      // Storage unavailable — nothing to pick up.
    }
  }, []);
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<string>>(new Set());
  const [connectedAccounts, setConnectedAccounts] = useState<ComposerPlatform[]>([]);
  const [publishableAccounts, setPublishableAccounts] = useState<ComposerPlatform[]>([]);
  const [accountsLoaded, setAccountsLoaded] = useState(false);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [expanded, setExpanded] = useState(shouldFocusComposer);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [isPending, startTransition] = useTransition();
  const hasAttachment = mediaFiles.length > 0 || mediaUrl.trim().length > 0 || linkUrl.trim().length > 0;
  const isExpanded = expanded || shouldFocusComposer || content.length > 0 || hasAttachment || showTags || showLinkTools || showVisibility || showCrossPost || selectedPlatforms.size > 0 || Boolean(errorMessage);

  useEffect(() => {
    try {
      const draft = readPostDraft(sessionStorage.getItem(draftKey), Boolean(communityId));
      if (draft) {
        setContent((current) => current || draft.content);
        setTags(draft.tags);
        setMediaUrl(draft.mediaUrl);
        setLinkUrl(draft.linkUrl);
        setVisibility(draft.visibility === "public" && communityId && !communityIsPublic ? "community" : draft.visibility);
        setShowTags(Boolean(draft.tags));
        setShowLinkTools(Boolean(draft.mediaUrl || draft.linkUrl));
      }
    } catch { /* The composer works without storage. */ }
    setLoadedDraftKey(draftKey);
  }, [draftKey, communityId, communityIsPublic]);

  useEffect(() => {
    if (loadedDraftKey !== draftKey) return;
    const hasText = Boolean(content || tags || mediaUrl || linkUrl);
    try {
      if (hasText) sessionStorage.setItem(draftKey, JSON.stringify({ version: 1, savedAt: Date.now(), content, tags, mediaUrl, linkUrl, visibility }));
      else sessionStorage.removeItem(draftKey);
      setDraftSaved(hasText);
    } catch { setDraftSaved(false); }
  }, [loadedDraftKey, draftKey, content, tags, mediaUrl, linkUrl, visibility]);

  useEffect(() => {
    if (!showCrossPost || accountsLoaded) return;
    const controller = new AbortController();

    async function loadAccounts() {
      setAccountsLoading(true);
      try {
        const res = await fetch("/api/connected-accounts", {
          credentials: "same-origin",
          signal: controller.signal,
        });
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          type ApiAccount = {
            platform: string;
            platformName?: string;
            isActive?: boolean;
            capability?: { crossPost?: boolean };
          };
          // One account per PLATFORM: two X accounts are one chip, not two.
          const byPlatform = (accounts: ApiAccount[]): ComposerPlatform[] => {
            const seen = new Map<string, ComposerPlatform>();
            for (const a of accounts) {
              if (!seen.has(a.platform)) {
                seen.set(a.platform, { id: a.platform, name: a.platformName || a.platform });
              }
            }
            return [...seen.values()].sort((x, y) => x.name.localeCompare(y.name));
          };
          const active = (data.accounts || []).filter((a: ApiAccount) => a.isActive !== false);
          setConnectedAccounts(byPlatform(active));
          setPublishableAccounts(byPlatform(active.filter((a: ApiAccount) => a.capability?.crossPost)));
        }
      } catch {
        /* ignore */
      } finally {
        if (!controller.signal.aborted) {
          setAccountsLoaded(true);
          setAccountsLoading(false);
        }
      }
    }
    void loadAccounts();

    return () => controller.abort();
  }, [accountsLoaded, showCrossPost]);

  useEffect(() => {
    if (!shouldFocusComposer) return;
    setExpanded(true);
    const focusComposer = () => {
      textareaRef.current?.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
      textareaRef.current?.focus({ preventScroll: true });
    };
    const firstTimeout = window.setTimeout(focusComposer, 100);
    const secondTimeout = window.setTimeout(focusComposer, 350);
    return () => {
      window.clearTimeout(firstTimeout);
      window.clearTimeout(secondTimeout);
    };
  }, [shouldFocusComposer, reduce]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea || !isExpanded) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, 112), 280)}px`;
  }, [content, isExpanded]);

  useEffect(() => {
    if (!successMessage || submitting) return;
    // Permalinks and delivery notes need reading-and-clicking time; a plain
    // "Post created" doesn't.
    const timeout = window.setTimeout(() => {
      setSuccessMessage("");
      setCrossPostOutcomes([]);
    }, crossPostOutcomes.length > 0 ? 10000 : 3000);
    return () => window.clearTimeout(timeout);
  }, [successMessage, submitting, crossPostOutcomes.length]);

  useEffect(() => {
    mediaFilesRef.current = mediaFiles;
  }, [mediaFiles]);

  useEffect(() => {
    return () => {
      mediaFilesRef.current.forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, []);

  const togglePlatform = (id: string) => {
    setSelectedPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openComposer = () => {
    setExpanded(true);
    window.setTimeout(() => textareaRef.current?.focus(), 70);
  };

  const handleMediaFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const validationError = postMediaSelectionError([...mediaFiles.map((item) => item.file), ...Array.from(files)]);
    if (validationError) {
      setSuccessMessage("");
      setErrorMessage(validationError);
      return;
    }
    setErrorMessage("");
    const next = Array.from(files)
      .map((file) => ({
        id: crypto.randomUUID(),
        file,
        url: URL.createObjectURL(file),
        type: file.type.startsWith("video/") ? "video" as const : "image" as const,
      }));
    setMediaFiles((current) => [...current, ...next]);
  };

  const removeMediaFile = (id: string) => {
    setMediaFiles((current) => {
      const match = current.find((item) => item.id === id);
      if (match) URL.revokeObjectURL(match.url);
      return current.filter((item) => item.id !== id);
    });
  };

  const handleSubmit = () => {
    if (submittingRef.current || isPending || content.length > 500) return;
    if (!content.trim() && !hasAttachment) return;
    const attachmentCount = mediaFiles.length + Number(Boolean(mediaUrl.trim())) + Number(Boolean(linkUrl.trim() && linkUrl.trim() !== mediaUrl.trim()));
    const selectionError = postMediaSelectionError(mediaFiles.map((item) => item.file));
    const invalidUrl = [mediaUrl, linkUrl].filter((url) => url.trim()).some((url) => {
      try { return !["https:", "http:"].includes(new URL(url.trim()).protocol); } catch { return true; }
    });
    const validationError = selectionError || (attachmentCount > MAX_POST_MEDIA_FILES ? "Attach up to 4 files or links in total." : invalidUrl ? "Use a complete link starting with https:// or http://." : null);
    if (validationError) {
      setSuccessMessage("");
      setErrorMessage(validationError);
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    const contentValue = content.trim();
    const tagsValue = tags;
    const selectedPlatformIds = [...selectedPlatforms];
    const mediaUrlValue = mediaUrl.trim();
    const linkUrlValue = linkUrl.trim();
    const optimisticMedia = [
      ...mediaFiles.map((item) => ({ id: item.id, url: item.url, type: item.type })),
      ...(mediaUrlValue ? [{ id: `media-url-${Date.now()}`, url: mediaUrlValue, type: inferComposerMediaType(mediaUrlValue) }] : []),
      ...(linkUrlValue ? [{ id: `link-url-${Date.now()}`, url: linkUrlValue, type: "link" }] : []),
    ].slice(0, 4);
    const optimisticId = onPostPending?.({
      content: contentValue,
      tags: tagsValue,
      communityId: communityId || undefined,
      crossPostTo: selectedPlatformIds,
      visibility,
      media: optimisticMedia,
    });
    const formData = new FormData();
    formData.set("content", contentValue);
    if (tagsValue) formData.set("tags", tagsValue);
    if (communityId) formData.set("communityId", communityId);
    formData.set("visibility", visibility);
    mediaFiles.forEach((item) => formData.append("mediaFiles", item.file));
    if (mediaUrlValue) formData.append("mediaUrls", mediaUrlValue);
    if (linkUrlValue) formData.set("linkUrl", linkUrlValue);
    // Cross-post platforms (mesh.me is always the origin)
    if (selectedPlatformIds.length > 0) {
      formData.set("crossPostTo", JSON.stringify(selectedPlatformIds));
    }

    startTransition(async () => {
      setSubmitting(true);
      setSuccessMessage("Posting now...");
      setErrorMessage("");
      try {
        const result = await createPost(formData);
        if (result?.success) {
          feedback("success");
          celebrate({ kind: "success", anchor: publishButtonRef.current });
          // Meshi celebrates AFTER the server confirmed it — publishing on
          // submit would have Meshi cheering for posts that failed.
          publishMeshiCause({ kind: "post:published" });
          const crossPostResults = result.crossPostResults ? Object.entries(result.crossPostResults) : [];
          const failedCrossPosts = crossPostResults.filter(([, value]) => !value.success);
          setCrossPostOutcomes(
            crossPostResults.map(([target, value]) => ({
              target,
              url: value.url,
              note: value.note,
              error: value.success ? undefined : value.error || "Failed",
            })),
          );
          if (result.post) {
            onPostCreated?.(result.post, optimisticId || undefined);
            window.dispatchEvent(new CustomEvent("mesh:post-created", { detail: result.post }));
          } else {
            onPostFailed?.(optimisticId || undefined);
          }
          setContent("");
          setTags("");
          setMediaUrl("");
          setLinkUrl("");
          setMediaFiles((current) => {
            current.forEach((item) => URL.revokeObjectURL(item.url));
            return [];
          });
          setShowTags(false);
          setShowLinkTools(false);
          setShowVisibility(false);
          setSelectedPlatforms(new Set());
          setShowCrossPost(false);
          setExpanded(false);
          setSuccessMessage(
            selectedPlatformIds.length > 0
              ? failedCrossPosts.length > 0
                ? "Post created. Some platform actions need permissions."
                : "Post created and synced where supported."
              : "Post created"
          );
          if (shouldFocusComposer) {
            const nextParams = new URLSearchParams(searchParams.toString());
            nextParams.delete("compose");
            const nextQuery = nextParams.toString();
            router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
          }
          window.setTimeout(() => router.refresh(), 350);
        } else {
          onPostFailed?.(optimisticId || undefined);
          setSuccessMessage("");
          setErrorMessage(result?.error || "Could not create post");
          // Meshi represents the user, and the user is not delighted that it
          // failed. A mascot that only ever reacts to success is decoration.
          publishMeshiCause({ kind: "action:failed" });
        }
      } catch {
        onPostFailed?.(optimisticId || undefined);
        setSuccessMessage("");
        setErrorMessage("Could not create post");
        publishMeshiCause({ kind: "action:failed" });
      } finally {
        submittingRef.current = false;
        setSubmitting(false);
      }
    });
  };

  const availablePlatforms = publishableAccounts;
  const publishableIds = new Set(publishableAccounts.map((p) => p.id));
  const connectedButNotPublishable = connectedAccounts.filter((p) => !publishableIds.has(p.id));
  const selectedAudience = audienceOptions.find((option) => option.id === visibility) ?? audienceOptions[0];
  const AudienceIcon = selectedAudience.icon;

  return (
    // `rounded-2xl glass-card` is gone. The composer is a TRAY — the recess its
    // colour already claimed it was — and `glass-card` only pulled it into the
    // `.feed-x-layout .glass-card !important` block at globals.css:4031, which
    // is what forced the outward shadow onto a well in the first place.
    <fieldset disabled={submitting || isPending} className={`social-composer feed-composer-card min-w-0 p-3 sm:p-4 ${socialMotion.composer}`} aria-busy={submitting || isPending}>
      <legend className="sr-only">Create a post</legend>
      {(successMessage || errorMessage) && (
        <div className={`tray mb-3 px-3 py-2 text-xs font-semibold ${successMessage ? "text-[var(--success)]" : "text-[var(--danger)]"}`} role={errorMessage ? "alert" : "status"}>
          <div className="flex items-center gap-2">
            {successMessage ? (
              isPending ? <PaperWait size="sm" /> : <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5" />
            )}
            {successMessage || errorMessage}
          </div>
          {/* Where the cross-post actually landed: the permalink is the
              receipt, and any shortfall (media that couldn't travel, a
              text-only platform) is said out loud instead of dropped. */}
          {crossPostOutcomes.length > 0 && (
            <ul className="mt-1.5 grid gap-0.5 pl-5 text-micro font-medium text-[var(--text-secondary)]">
              {crossPostOutcomes.map((outcome) => (
                <li key={outcome.target} className="flex flex-wrap items-center gap-1.5">
                  <span className="font-semibold">{outcome.target}</span>
                  {outcome.error ? (
                    <span className="text-[var(--danger)]">{outcome.error}</span>
                  ) : (
                    <>
                      {outcome.url && (
                        <a
                          href={outcome.url}
                          target="_blank"
                          rel="noreferrer"
                          className="underline underline-offset-2 hover:text-[var(--text-primary)]"
                        >
                          View post ↗
                        </a>
                      )}
                      {outcome.note && <span className="text-[var(--text-muted)]">{outcome.note}</span>}
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!isExpanded ? (
        <div className="flex min-w-0 items-center gap-3">
          <Avatar src={user.avatarUrl} alt={user.displayName} size="md" />
          <button
            type="button"
            onClick={openComposer}
            className="feed-composer-trigger key flex min-h-11 min-w-0 flex-1 items-center px-4 text-left text-sm font-semibold text-[var(--text-muted)]"
          >
            What&apos;s happening?
          </button>
          <Button onClick={openComposer} size="sm">
            Post
          </Button>
        </div>
      ) : (
        <div className="min-w-0">
          <div className="mesh-composer-header mb-4 flex min-w-0 items-center gap-3">
            <div className="shrink-0" aria-hidden="true"><Avatar src={user.avatarUrl} alt={user.displayName} size="sm" /></div>
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--text-primary)]">{user.displayName}</span>
            <button type="button" onClick={() => setShowVisibility(!showVisibility)} aria-expanded={showVisibility} aria-label={`Audience: ${selectedAudience.label}. Change audience`} className="key explore-chip inline-flex min-h-10 shrink-0 items-center gap-1.5 px-3 text-xs font-medium text-[var(--text-secondary)]">
              <AudienceIcon size={13} aria-hidden="true" />{selectedAudience.label}<ChevronDown size={12} aria-hidden="true" />
            </button>
          </div>
          <div className="min-w-0">

          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What's happening?"
            aria-label="Post text"
            maxLength={500}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && !event.nativeEvent.isComposing) {
                event.preventDefault();
                handleSubmit();
              }
            }}
            className="w-full min-h-28 resize-none bg-transparent text-base leading-relaxed text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
            rows={3}
          />

          <input
            ref={fileInputRef}
            type="file"
            accept={POST_MEDIA_ACCEPT}
            aria-label="Attach images or videos"
            multiple
            className="hidden"
            onChange={(event) => {
              handleMediaFiles(event.target.files);
              event.target.value = "";
            }}
          />

          {mediaFiles.length > 0 && (
            <div className="feed-composer-media-grid mt-3">
              {mediaFiles.map((item) => (
                <div key={item.id} className="feed-composer-media-preview">
                  {item.type === "video" ? (
                    <video src={item.url} className="h-full w-full object-cover" controls muted playsInline preload="metadata" aria-label={`Preview ${item.file.name}`} />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.url} alt={`Preview of ${item.file.name}`} className="h-full w-full object-cover" />
                  )}
                  <button type="button" onClick={() => removeMediaFile(item.id)} aria-label="Remove media" className="feed-composer-remove-media">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {showLinkTools && (
            <div className="tray mt-3 grid gap-2 p-3">
              <label className="grid gap-1 text-micro font-semibold text-[var(--text-secondary)]">
                Link preview
                <input
                  value={linkUrl}
                  type="url"
                  inputMode="url"
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="theme-input min-h-10 rounded-lg px-3 text-sm"
                />
              </label>
              <label className="grid gap-1 text-micro font-semibold text-[var(--text-secondary)]">
                Image or video URL
                <input
                  value={mediaUrl}
                  type="url"
                  inputMode="url"
                  onChange={(e) => setMediaUrl(e.target.value)}
                  placeholder="https://example.com/photo.jpg"
                  className="theme-input min-h-10 rounded-lg px-3 text-sm"
                />
              </label>
            </div>
          )}

          {/* Who can see this post was conveyed by the cobalt mould and nothing
              else. A screen reader heard three buttons, each reading out its own
              label and description, with no way to tell which one was chosen —
              an audience decision announced to no one. */}
          {showVisibility && (
            <div className="tray mt-3 grid gap-2 p-2 sm:grid-cols-3" role="group" aria-label="Who can see this post">
              {audienceOptions.map((option) => {
                const Icon = option.icon;
                const active = visibility === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setVisibility(option.id)}
                    className={`key px-3 py-2 text-left ${active ? "key-lit [--mould:var(--mould-cobalt)] [--mould-ink:var(--mould-cobalt-ink)] [--mould-plinth:var(--mould-cobalt-plinth)]" : "text-[var(--text-secondary)]"}`}
                  >
                    <span className="flex items-center gap-2 text-xs font-semibold">
                      <Icon className="h-3.5 w-3.5" />
                      {option.label}
                    </span>
                    {/* On the lit key the copy has to ride --mould-cobalt-ink,
                        not --text-muted: --ink-3 over cobalt is not a ratio
                        anyone has measured, and the pinned ink is. */}
                    <span className={`mt-1 block text-micro ${active ? "opacity-90" : "text-[var(--text-muted)]"}`}>{option.copy}</span>
                  </button>
                );
              })}
            </div>
          )}

          {showTags && (
            <div className="flex items-center gap-2 mt-2">
              <Hash className="h-4 w-4 text-[var(--text-muted)]" />
              <input
                value={tags}
                aria-label="Post tags, separated by commas"
                onChange={(e) => setTags(e.target.value)}
                placeholder="Add tags (comma separated)"
                className="flex-1 bg-transparent text-sm text-[var(--text-secondary)] placeholder:text-[var(--text-muted)] outline-none"
              />
              <button type="button" aria-label="Remove tags" onClick={() => { setShowTags(false); setTags(""); }} className="flex h-11 w-11 items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Cross-post platform selector */}
          {showCrossPost && (
            <div className="tray mt-3 p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-micro font-medium text-[var(--text-secondary)] flex items-center gap-1.5">
                  <Share2 className="h-3 w-3" />
                  Also post to connected platforms
                </p>
                <button type="button" aria-label="Close cross-post options" onClick={() => setShowCrossPost(false)} className="flex h-11 w-11 shrink-0 items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
                  <X className="h-3 w-3" />
                </button>
              </div>
              {visibility !== "public" ? (
                // A cross-post is public everywhere it lands. Saying so HERE,
                // where the checkboxes would be, beats a server rejection
                // after the person already hit Post.
                <p className="text-micro text-[var(--text-muted)] flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  Cross-posting is for Public posts — this post&apos;s audience is{" "}
                  {visibility === "friends" ? "Friends" : visibility === "community" ? "Community members" : "Only me"}.
                </p>
              ) : availablePlatforms.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {availablePlatforms.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => togglePlatform(p.id)}
                      className={"key flex min-h-11 items-center gap-1.5 px-2.5 py-1.5 text-micro font-semibold " + (
                        selectedPlatforms.has(p.id)
                          ? "key-lit [--mould:var(--mould-cobalt)] [--mould-ink:var(--mould-cobalt-ink)] [--mould-plinth:var(--mould-cobalt-plinth)]"
                          : "text-[var(--text-secondary)]"
                      )}
                      aria-pressed={selectedPlatforms.has(p.id)}
                    >
                      {/* The brand hex was the button's whole fill when selected,
                          with `text-white` on top of it — #0085FF and #000000 in
                          the same list, one ink assumed for both. Then it became
                          a bare colour swatch. It is the platform's real mark
                          now, the same drawn set the connect page and the mesh
                          canvas use, so a chip is identifiable without reading
                          it. SELECTED stays the cobalt plastic every other
                          selected thing on this surface wears: the mark says
                          which platform, the plastic says which are on. */}
                      <PlatformLogo platform={p.id} size={16} className="shrink-0" />
                      {p.name}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-micro text-[var(--text-muted)] flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  {/* NAME THEM. "Connected platforms are read-only" left you to
                      guess which, and the list it was computed from could not
                      see half your accounts anyway. */}
                  {accountsLoading
                    ? "Checking connected platforms..."
                    : connectedButNotPublishable.length > 0
                      ? `${connectedButNotPublishable.map((p) => p.name).join(", ")} ` +
                        `${connectedButNotPublishable.length === 1 ? "does" : "do"} not offer an API mesh.me can post through, so ` +
                        `${connectedButNotPublishable.length === 1 ? "it is" : "they are"} read-only here.`
                      : "Connect a platform that allows publishing to cross-post."}
                </p>
              )}
              <p className="text-micro text-[var(--text-muted)] mt-2 flex items-center gap-1">
                <Info className="h-2.5 w-2.5" />
                Mesh.me only posts to source platforms through official APIs with granted publishing scopes.
              </p>
            </div>
          )}

          {/* Selected platforms indicator */}
          {selectedPlatforms.size > 0 && !showCrossPost && (
            <button
              onClick={() => setShowCrossPost(true)}
              className="mt-2 flex items-center gap-1.5 text-micro text-[var(--accent-text)] hover:underline"
            >
              <Share2 className="h-3 w-3" />
              Cross-posting to {selectedPlatforms.size} platform{selectedPlatforms.size !== 1 ? "s" : ""}
              <ChevronDown className="h-2.5 w-2.5" />
            </button>
          )}

          <div className="mesh-composer-toolbar mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-[var(--border-primary)] pt-3">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="key inline-flex h-11 w-11 items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                title="Add photos or videos"
                aria-label="Add photos or videos"
              >
                <ImageIcon className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setShowLinkTools(!showLinkTools)}
                className={"key inline-flex h-11 w-11 items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] " + (
                  showLinkTools || linkUrl || mediaUrl
                    ? "key-lit [--mould:var(--mould-cobalt)] [--mould-ink:var(--mould-cobalt-ink)] [--mould-plinth:var(--mould-cobalt-plinth)]"
                    : ""
                )}
                aria-expanded={showLinkTools}
                aria-label="Add link"
                title="Add link"
              >
                <LinkIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setShowTags(!showTags)}
                className="key inline-flex h-11 w-11 items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                aria-expanded={showTags}
                aria-label="Add tags"
                title="Add tags"
              >
                <Hash className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setShowCrossPost(!showCrossPost)}
                className={"key inline-flex h-11 w-11 items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] " + (
                  showCrossPost || selectedPlatforms.size > 0
                    ? "key-lit [--mould:var(--mould-cobalt)] [--mould-ink:var(--mould-cobalt-ink)] [--mould-plinth:var(--mould-cobalt-plinth)]"
                    : ""
                )}
                aria-expanded={showCrossPost}
                aria-label="Cross-post to connected platforms"
                title="Cross-post to connected platforms"
              >
                <Globe className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3">
              {content.length > 0 && (
                <span className={`tabular-nums text-xs ${content.length >= 480 ? "font-semibold text-[var(--warning)]" : "text-[var(--text-muted)]"}`} aria-label={`${500 - content.length} characters remaining`} title={`${500 - content.length} characters remaining`}>
                  {content.length}/500
                </span>
              )}
              <Button
                ref={publishButtonRef}
                data-feedback="off"
                onClick={handleSubmit}
                disabled={(!content.trim() && !hasAttachment) || content.length > 500 || isPending || submitting}
                size="sm"
              >
                {isPending || submitting ? "Posting..." : selectedPlatforms.size > 0 ? `Post to ${selectedPlatforms.size + 1}` : "Post"}
              </Button>
            </div>
          </div>
          {(mediaFiles.length > 0 || showLinkTools) && <p className="mt-3 text-micro leading-relaxed text-[var(--text-muted)]">Up to 4 attachments · 4 MB total. Use a link for larger videos.</p>}
          {draftSaved && (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-micro text-[var(--text-muted)]">
              <span className="inline-flex items-center gap-1.5" title="Text and links are saved in this tab. Reattach files after leaving."><CheckCircle2 size={12} aria-hidden="true" />Draft saved in this tab{mediaFiles.length > 0 ? " · files not saved" : ""}</span>
              <button type="button" className="min-h-11 underline decoration-[var(--rule)] underline-offset-4" onClick={() => {
                setContent(""); setTags(""); setMediaUrl(""); setLinkUrl("");
                mediaFiles.forEach((item) => URL.revokeObjectURL(item.url));
                setMediaFiles([]); setErrorMessage(""); setSelectedPlatforms(new Set());
              }}>Discard draft</button>
            </div>
          )}
        </div>
        </div>
      )}
    </fieldset>
  );
}
