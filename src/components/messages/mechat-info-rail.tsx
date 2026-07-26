import { BadgeCheck, FileText, Image as ImageIcon, LockKeyhole, ShieldCheck, Users } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { formatRelativeTime } from "@/lib/utils";

type Person = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  isVerified?: boolean;
};

type ThreadMember = {
  userId: string;
  role: string;
  notificationsMuted: boolean;
  lastRead: string;
  user: Person;
};

type SourceSummary = {
  platform: string;
  label: string;
  count: number;
};

type MeChatInfoRailProps = {
  title: string;
  subtitle: string;
  avatarUrl?: string | null;
  isGroupThread: boolean;
  isVerified?: boolean;
  createdAt: string;
  createdBy?: string | null;
  description: string;
  members: ThreadMember[];
  sourceSummaries: SourceSummary[];
  mediaCount: number;
  fileCount: number;
};

function platformColor(platform: string) {
  const value = platform.toLowerCase();
  if (value === "twitter" || value === "x") return "text-sky-300";
  if (value === "instagram") return "text-pink-300";
  if (value === "youtube") return "text-red-300";
  if (value === "discord") return "text-indigo-300";
  if (value === "whatsapp") return "text-emerald-300";
  return "text-[var(--accent)]";
}

export function MeChatInfoRail({
  title,
  subtitle,
  avatarUrl,
  isGroupThread,
  isVerified,
  createdAt,
  createdBy,
  description,
  members,
  sourceSummaries,
  mediaCount,
  fileCount,
}: MeChatInfoRailProps) {
  const memberPreview = members.slice(0, 5);

  return (
    <aside className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto bg-[var(--mesh-bg)] px-4 py-4 lg:px-5">
      <section className="mesh-surface mesh-pop-in rounded-[28px] border border-[var(--mesh-border)] p-5 shadow-[var(--shadow-lg)]">
        <div className="flex flex-col items-center text-center">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,_color-mix(in_srgb,var(--accent)_28%,transparent)_0%,_color-mix(in_srgb,var(--accent)_8%,transparent)_45%,_transparent_72%)] blur-2xl" />
            {isGroupThread ? (
              <div className="relative flex h-24 w-24 items-center justify-center rounded-full border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] shadow-[0_0_36px_var(--accent-glow)]">
                <div className="relative h-12 w-12">
                  {memberPreview.length > 0 ? (
                    memberPreview.slice(0, 4).map((member, index) => (
                      <Avatar
                        key={member.userId}
                        src={member.user.avatarUrl}
                        alt={member.user.displayName}
                        size="xs"
                        className={`absolute h-7 w-7 border-2 border-[var(--mesh-bg)] ${
                          index === 0 ? "left-0 top-3" : index === 1 ? "right-0 top-0" : index === 2 ? "bottom-0 left-0" : "bottom-0 right-0"
                        }`}
                      />
                    ))
                  ) : (
                    <Users size={26} className="text-[var(--mesh-text-secondary)]" />
                  )}
                </div>
              </div>
            ) : (
              <Avatar
                src={avatarUrl ?? null}
                alt={title}
                size="lg"
                className="relative h-24 w-24 ring-2 ring-[var(--accent)]/30 shadow-[0_0_36px_var(--accent-glow)]"
              />
            )}
          </div>

          <div className="mt-4 flex items-center gap-1.5">
            <h2 className="truncate text-2xl font-semibold text-[var(--mesh-text)]">{title}</h2>
            {isVerified && <BadgeCheck size={18} className="shrink-0 text-[var(--accent)]" />}
          </div>
          <p className="mt-1 text-sm text-[var(--mesh-text-secondary)]">{subtitle}</p>

          {/* Stat tiles, not buttons — nothing here pretends to be tappable
              until the capability behind it actually exists. */}
          <div className="mt-4 grid w-full grid-cols-3 gap-2">
            {[
              { icon: Users, label: "Members", value: members.length },
              { icon: ImageIcon, label: "Media", value: mediaCount },
              { icon: FileText, label: "Files", value: fileCount },
            ].map((item) => (
              <div
                key={item.label}
                className="flex flex-col items-center gap-1 rounded-2xl border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] px-2 py-3 text-center"
              >
                <item.icon size={15} className="text-[var(--mesh-text-secondary)]" />
                <span className="text-micro font-semibold text-[var(--mesh-text-secondary)]">{item.label}</span>
                <span className="text-xs font-semibold text-[var(--mesh-text)]">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mesh-surface rounded-[24px] border border-[var(--mesh-border)] p-5">
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck size={16} className="text-[var(--accent)]" />
          <h3 className="text-sm font-semibold text-[var(--mesh-text)]">About</h3>
        </div>
        <p className="text-sm leading-6 text-[var(--mesh-text-secondary)]">{description}</p>
        <div className="mt-4 space-y-2 text-xs text-[var(--mesh-text-secondary)]">
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] px-3 py-2">
            <span className="font-medium">Created</span>
            <span>{formatRelativeTime(createdAt)}</span>
          </div>
          {isGroupThread && createdBy && (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] px-3 py-2">
              <span className="font-medium">Created by</span>
              <span className="truncate">{createdBy}</span>
            </div>
          )}
        </div>
        {isGroupThread && memberPreview.length > 0 && (
          <div className="mt-4 flex -space-x-2">
            {memberPreview.map((member) => (
              <Avatar
                key={member.userId}
                src={member.user.avatarUrl}
                alt={member.user.displayName}
                size="xs"
                className="h-8 w-8 border-2 border-[var(--mesh-bg)]"
              />
            ))}
          </div>
        )}
      </section>

      <section className="mesh-surface rounded-[24px] border border-[var(--mesh-border)] p-5">
        <div className="mb-3 flex items-center gap-2">
          <ImageIcon size={16} className="text-[var(--accent)]" />
          <h3 className="text-sm font-semibold text-[var(--mesh-text)]">Shared Sources</h3>
        </div>
        {sourceSummaries.length > 0 ? (
          <div className="space-y-2">
            {sourceSummaries.map((source) => (
              <div key={source.platform} className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] px-3 py-2">
                <span className={`text-sm font-medium ${platformColor(source.platform)}`}>{source.label}</span>
                <span className="rounded-full bg-[var(--accent)]/12 px-2.5 py-1 text-xs font-semibold text-[var(--accent)]">
                  {source.count}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] px-3 py-4 text-sm text-[var(--mesh-text-secondary)]">
            No shared sources in this conversation yet.
          </div>
        )}
      </section>

      <section className="mesh-surface rounded-[24px] border border-[var(--mesh-border)] p-5">
        <div className="mb-3 flex items-center gap-2">
          <LockKeyhole size={16} className="text-[var(--accent)]" />
          <h3 className="text-sm font-semibold text-[var(--mesh-text)]">Privacy</h3>
        </div>
        <div className="space-y-3 text-sm text-[var(--mesh-text-secondary)]">
          <div className="flex items-center gap-2 rounded-2xl border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] px-3 py-2">
            <ShieldCheck size={14} className="shrink-0 text-[var(--mesh-green)]" />
            <span>Member-only access</span>
          </div>
          <div className="rounded-2xl border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] px-3 py-3 leading-6">
            <p>Only members of this conversation can read and send messages here.</p>
            <p className="mt-2">Membership rules stay enforced from the server on every send and refresh.</p>
          </div>
        </div>
      </section>
    </aside>
  );
}
