import Link from "next/link";
import { ArrowLeft, BadgeCheck, Bookmark, ExternalLink, Heart, MessageCircle, Repeat2, Send } from "lucide-react";
import { AutoplayVideo } from "@/components/feed/autoplay-video";
import { Avatar } from "@/components/ui/avatar";
import type { FeedCardPost } from "@/lib/feed-data";
import { formatCount, formatRelativeTime } from "@/lib/utils";
import { getVideoEmbedUrl } from "@/lib/video-embed";

const PLATFORM_LABEL: Record<string, string> = {
  youtube: "YouTube",
  instagram: "Instagram",
  tiktok: "TikTok",
  twitter: "X",
  x: "X",
  reddit: "Reddit",
  facebook: "Facebook",
  snapchat: "Snapchat",
  twitch: "Twitch",
  github: "GitHub",
};

function platformLabel(platform?: string) {
  if (!platform) return "its source";
  return PLATFORM_LABEL[platform.toLowerCase()] ?? platform.charAt(0).toUpperCase() + platform.slice(1);
}

/**
 * In-app home for a connected-platform post. Everything is watchable right
 * here (file player or embed player); source stats are labeled as the
 * source's numbers; the external link is provenance, never a requirement.
 */
export function ExternalPostDetail({ post }: { post: FeedCardPost }) {
  const video = post.media.find((m) => m.type.toLowerCase() === "video");
  const image = post.media.find((m) => m.type.toLowerCase() !== "video");
  const embedUrl = !video ? getVideoEmbedUrl(post.externalUrl, { autoplay: true, muted: true, loop: false }) : null;
  const source = platformLabel(post.platform);
  const author = post.externalAuthor
    ? { name: post.externalAuthor.name, handle: post.externalAuthor.username, avatarUrl: post.externalAuthor.avatarUrl }
    : { name: post.author.displayName, handle: post.author.username, avatarUrl: post.author.avatarUrl };

  const shareHref = post.sourceId && post.id.startsWith("platform-")
    ? `/messages?sharePlatformPostId=${encodeURIComponent(post.sourceId)}&sourcePlatform=${encodeURIComponent(post.platform || "platform")}${post.externalUrl ? `&shareUrl=${encodeURIComponent(post.externalUrl)}` : ""}`
    : `/messages?${new URLSearchParams({
        ...(post.externalUrl ? { shareUrl: post.externalUrl } : {}),
        sourcePlatform: post.platform || "platform",
      }).toString()}`;

  return (
    <div className="mx-auto w-full max-w-2xl px-3 py-4 text-[var(--mesh-text)] animate-page-enter sm:px-5 sm:py-6">
      <Link
        href="/feed"
        className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--mesh-border)] bg-[var(--mesh-panel)] px-3.5 py-1.5 text-sm font-semibold text-[var(--mesh-text-secondary)] transition hover:text-[var(--mesh-text)]"
      >
        <ArrowLeft size={15} aria-hidden="true" />
        Feed
      </Link>

      <article className="mesh-surface overflow-hidden rounded-3xl border border-[var(--mesh-border)]">
        {/* Media stage — plays right here */}
        {video ? (
          <AutoplayVideo src={video.url} poster={video.posterUrl} className="aspect-video w-full bg-black object-contain" />
        ) : embedUrl ? (
          <div className="aspect-video w-full bg-black">
            <iframe
              src={embedUrl}
              title="Video player"
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
              className="h-full w-full border-0"
            />
          </div>
        ) : image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image.url} alt="" className="max-h-[60vh] w-full bg-black object-contain" />
        ) : null}

        <div className="flex flex-col gap-4 p-5">
          <header className="flex items-center gap-3">
            <Avatar src={author.avatarUrl ?? null} alt={author.name} size="md" className="h-11 w-11" />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 truncate text-sm font-bold">
                {author.name}
                {!post.externalAuthor && post.author.isVerified && (
                  <BadgeCheck size={14} className="shrink-0 text-[var(--mesh-blue)]" aria-hidden="true" />
                )}
              </p>
              <p className="truncate text-xs text-[var(--mesh-text-secondary)]">
                {author.handle ? `@${author.handle} · ` : ""}
                {formatRelativeTime(String(post.createdAt))}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-[var(--mesh-blue)]/12 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--mesh-blue)]">
              {source}
            </span>
            {post.visibility && post.visibility !== "public" && (
              <span className="shrink-0 rounded-full border border-[var(--mesh-border)] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--mesh-text-muted)]">
                {post.visibility}
              </span>
            )}
          </header>

          {post.content && (
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-[var(--mesh-text)]">{post.content}</p>
          )}

          {/* Source engagement — honest about whose numbers these are */}
          <div className="flex flex-wrap items-center gap-4 border-t border-[var(--mesh-border)] pt-4 text-sm text-[var(--mesh-text-secondary)]">
            <span className="inline-flex items-center gap-1.5">
              <Heart size={16} aria-hidden="true" /> {formatCount(post._count.reactions)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MessageCircle size={16} aria-hidden="true" /> {formatCount(post._count.comments)}
            </span>
            {post._count.reposts > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <Repeat2 size={16} aria-hidden="true" /> {formatCount(post._count.reposts)}
              </span>
            )}
            <span className="ml-auto text-xs text-[var(--mesh-text-muted)]">on {source}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={shareHref}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--mesh-blue)] px-4 py-2 text-sm font-bold text-white transition hover:brightness-110"
            >
              <Send size={15} aria-hidden="true" />
              Share in MeChat
            </Link>
            <Link
              href={`/flow?from=${encodeURIComponent(post.id)}`}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--mesh-border)] bg-[var(--mesh-panel)] px-4 py-2 text-sm font-semibold transition hover:bg-[var(--mesh-panel-hover)]"
            >
              <Bookmark size={15} aria-hidden="true" />
              Watch in Flow
            </Link>
            {post.externalUrl && (
              <a
                href={post.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-[var(--mesh-text-muted)] transition hover:text-[var(--mesh-text)]"
              >
                <ExternalLink size={12} aria-hidden="true" />
                {source}
              </a>
            )}
          </div>

          <p className="rounded-2xl bg-[var(--mesh-bg-elevated)] px-4 py-3 text-xs leading-relaxed text-[var(--mesh-text-secondary)]">
            Comments on this post live on {source}. Share it in MeChat to talk about it with your people on mesh.me.
          </p>
        </div>
      </article>
    </div>
  );
}
