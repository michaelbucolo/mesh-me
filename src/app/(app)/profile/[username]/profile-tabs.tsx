"use client";

import { useState } from "react";
import { PostCard } from "@/components/feed/post-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { FileText, Image as ImageIcon, Info, Users, MapPin, Calendar, Globe } from "lucide-react";
import Link from "next/link";

type TabId = "posts" | "media" | "about" | "communities";

interface ProfileTabsProps {
  posts: Array<{
    id: string;
    content: string;
    createdAt: string;
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
  }>;
  communities: Array<{
    id: string;
    name: string;
    slug: string;
    memberCount: number;
    role: string;
  }>;
  connectedAccounts: Array<{ platform: string; platformUsername: string | null }>;
  profile: {
    bio: string | null;
    location: string | null;
    website: string | null;
    createdAt: string;
    interests: string[];
  };
  currentUserId?: string;
  isOwnProfile: boolean;
  displayName: string;
}

const TABS: { id: TabId; label: string; icon: typeof FileText }[] = [
  { id: "posts", label: "Posts", icon: FileText },
  { id: "media", label: "Media", icon: ImageIcon },
  { id: "about", label: "About", icon: Info },
  { id: "communities", label: "Communities", icon: Users },
];

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "#E4405F",
  youtube: "#FF0000",
  tiktok: "#000000",
  twitter: "#1DA1F2",
  twitch: "#9146FF",
  spotify: "#1DB954",
  soundcloud: "#FF5500",
  linkedin: "#0A66C2",
  github: "#333333",
  discord: "#5865F2",
  snapchat: "#FFFC00",
  pinterest: "#BD081C",
  reddit: "#FF4500",
  facebook: "#1877F2",
  threads: "#000000",
  bluesky: "#0085FF",
};

export function ProfileTabs({ posts, communities, connectedAccounts, profile, currentUserId, isOwnProfile, displayName }: ProfileTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("posts");

  const mediaPosts = posts.filter((p) => p.media.length > 0);

  return (
    <div className="border-t border-zinc-800">
      {/* Tab buttons */}
      <div className="flex border-b border-zinc-800">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-all border-b-2 ${
              activeTab === tab.id
                ? "text-blue-400 border-blue-400"
                : "text-zinc-500 border-transparent hover:text-zinc-300"
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="px-4 py-6">
        {/* Posts Tab */}
        {activeTab === "posts" && (
          <div className="space-y-4">
            {posts.length > 0 ? (
              posts.map((post) => (
                <PostCard key={post.id} post={post} currentUserId={currentUserId} />
              ))
            ) : (
              <EmptyState
                icon={FileText}
                title="No posts yet"
                description={isOwnProfile ? "Share your first post!" : `${displayName} hasn't posted yet.`}
              />
            )}
          </div>
        )}

        {/* Media Tab */}
        {activeTab === "media" && (
          mediaPosts.length > 0 ? (
            <div className="grid grid-cols-3 gap-1">
              {mediaPosts.map((post) => (
                <Link key={post.id} href={`/feed/${post.id}`}>
                  <div className="aspect-square bg-zinc-900 border border-zinc-800/50 rounded-sm overflow-hidden relative group cursor-pointer">
                    <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                      <ImageIcon className="h-6 w-6 text-zinc-600" />
                    </div>
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-white text-xs">{post._count.reactions} likes</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={ImageIcon}
              title="No media yet"
              description={isOwnProfile ? "Share a post with photos or videos!" : `${displayName} hasn't shared any media yet.`}
            />
          )
        )}

        {/* About Tab */}
        {activeTab === "about" && (
          <div className="space-y-6">
            {profile.bio && (
              <div>
                <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-2">Bio</h3>
                <p className="text-sm text-zinc-300 leading-relaxed">{profile.bio}</p>
              </div>
            )}

            <div className="grid gap-3">
              {profile.location && (
                <div className="flex items-center gap-3 text-sm">
                  <MapPin className="h-4 w-4 text-zinc-500" />
                  <span className="text-zinc-300">{profile.location}</span>
                </div>
              )}
              {profile.website && (
                <div className="flex items-center gap-3 text-sm">
                  <Globe className="h-4 w-4 text-zinc-500" />
                  <a href={profile.website} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
                    {profile.website.replace(/^https?:\/\//, "")}
                  </a>
                </div>
              )}
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="h-4 w-4 text-zinc-500" />
                <span className="text-zinc-300">
                  Joined {new Date(profile.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                </span>
              </div>
            </div>

            {profile.interests.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-2">Interests</h3>
                <div className="flex flex-wrap gap-1.5">
                  {profile.interests.map((tag) => (
                    <Badge key={tag} variant="secondary">{tag}</Badge>
                  ))}
                </div>
              </div>
            )}

            {connectedAccounts.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-2">Connected Platforms</h3>
                <div className="grid gap-2">
                  {connectedAccounts.map((account) => (
                    <div
                      key={account.platform}
                      className="flex items-center gap-3 p-3 rounded-xl bg-zinc-900/50 border border-zinc-800"
                    >
                      <div
                        className="h-8 w-8 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                        style={{ backgroundColor: PLATFORM_COLORS[account.platform] || "#666" }}
                      >
                        {account.platform.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-zinc-200 capitalize">{account.platform}</p>
                        {account.platformUsername && (
                          <p className="text-xs text-zinc-500">@{account.platformUsername}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Communities Tab */}
        {activeTab === "communities" && (
          communities.length > 0 ? (
            <div className="space-y-2">
              {communities.map((community) => (
                <Link
                  key={community.id}
                  href={`/communities/${community.slug}`}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-zinc-800/50 transition-colors"
                >
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-600 to-blue-500 flex items-center justify-center text-white font-bold text-sm">
                    {community.name[0]}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-zinc-200">{community.name}</h4>
                    <p className="text-xs text-zinc-500">{community.memberCount} members</p>
                  </div>
                  {community.role !== "member" && (
                    <Badge variant="secondary" className="text-[10px]">{community.role}</Badge>
                  )}
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Users}
              title="No communities"
              description={isOwnProfile ? "Join a community to connect with others!" : `${displayName} hasn't joined any communities yet.`}
            />
          )
        )}
      </div>
    </div>
  );
}
