"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Sparkles, Search, Settings, BarChart3, Users, Shield, HelpCircle } from "lucide-react";
import { MeshiMascot, type MeshiMood, type MeshiHat, type MeshiColor } from "./meshi-mascot";
import type { MeshGraphEntity } from "@/lib/queries";

interface ChatMessage {
  id: string;
  role: "user" | "meshi";
  content: string;
  timestamp: Date;
}

// Quick action suggestions
const QUICK_ACTIONS = [
  { icon: Search, label: "Search my mesh", prompt: "Search my mesh for..." },
  { icon: BarChart3, label: "Mesh summary", prompt: "Give me a summary of my mesh activity" },
  { icon: Users, label: "Who follows me?", prompt: "Show me my followers" },
  { icon: Shield, label: "Privacy check", prompt: "How is my privacy looking?" },
  { icon: Settings, label: "Manage platforms", prompt: "Help me manage my connected platforms" },
  { icon: HelpCircle, label: "How does mesh.me work?", prompt: "Explain how mesh.me works" },
];

// Meshi's comprehensive knowledge base — stateless, indexing-only responses
// Meshi knows about EVERY feature on mesh.me and can guide users through anything
// Meshi is mesh-aware: it can look up people/entities from the user's mesh graph
function getMeshiResponse(
  query: string,
  meshData?: { followers?: number; following?: number; posts?: number; communities?: number; platforms?: number },
  meshEntities?: MeshGraphEntity[],
): { content: string; mood: MeshiMood } {
  const q = query.toLowerCase().trim();

  // ─── Mesh-aware entity lookup ───────────────────────────
  // KNOWLEDGE BOUNDARY: Meshi only knows what's on the user's mesh.
  // If someone asks about a person/entity not on their mesh, Meshi says "I don't know them yet."
  // This is a core design principle — Meshi is NOT a general-purpose AI.

  // Detect ANY person/entity query — broad pattern matching
  const personPatterns = [
    /(?:who is|who's|whos)\s+(.+)/i,
    /(?:tell me about|what about|info on|look up|do you know|know anything about)\s+(.+)/i,
    /(?:do i (?:know|follow)|am i following)\s+(.+)/i,
    /is\s+(.+?)\s+on my mesh/i,
    /(?:have you heard of|ever heard of|what do you think of|thoughts on)\s+(.+)/i,
    /(?:find|search for|look for)\s+(?:user |person |@)?(.+)/i,
  ];

  for (const pattern of personPatterns) {
    const match = q.match(pattern);
    if (match) {
      const rawTerm = (match[1] || match[2] || "").replace(/[?!.]+$/, "").trim().toLowerCase();
      // Skip if the term looks like a mesh.me feature rather than a person
      const featureWords = ["mesh", "feed", "mechat", "settings", "profile", "notification", "communit", "meshpro", "meshi", "privacy", "security", "achievement", "explore", "post"];
      if (rawTerm && !featureWords.some(fw => rawTerm.includes(fw))) {
        const searchTerm = rawTerm.replace(/^@/, "");

        // Search the user's mesh entities
        if (meshEntities && meshEntities.length > 0) {
          const found = meshEntities.find(
            (e) =>
              e.label.toLowerCase().includes(searchTerm) ||
              (e.sublabel && e.sublabel.toLowerCase().includes(searchTerm))
          );

          if (found) {
            if (found.type === "user") {
              const mutualText = found.isMutual ? "You follow each other (mutual)!" : "You follow them.";
              const followerText = found.followerCount ? ` They have ${found.followerCount} follower${found.followerCount !== 1 ? "s" : ""}.` : "";
              return {
                content: `${found.label} (${found.sublabel}) is on your mesh! ${mutualText}${followerText} Click their node on The Mesh to message, view profile, or manage the connection.`,
                mood: "excited",
              };
            }
            if (found.type === "community") {
              return {
                content: `${found.label} is a community you're part of!${found.memberCount ? ` It has ${found.memberCount} members.` : ""} Check it out from The Mesh or the Communities page.`,
                mood: "happy",
              };
            }
            if (found.type === "tag") {
              return {
                content: `"${found.label}" is one of your interests! It appears as a node on your mesh and helps me find relevant content and people for you.`,
                mood: "happy",
              };
            }
            if (found.type === "platform") {
              return {
                content: `You have ${found.label} connected${found.sublabel ? ` as ${found.sublabel}` : ""}! Content from ${found.label} appears in your Custom Feed, and interactions sync back natively.`,
                mood: "excited",
              };
            }
          } else {
            // Entity NOT on mesh — strict knowledge boundary
            return {
              content: `I don't know "${searchTerm}" yet! I can only tell you about people and things on your mesh. If they have a mesh.me account and share their mesh with you, I'll know all about them. Try searching for them on the Explore page!`,
              mood: "thinking",
            };
          }
        } else {
          // No mesh data loaded — still enforce boundary
          return {
            content: `I can only look up people and things that are on your mesh. I don't have info on "${searchTerm}" right now. Try following them or searching on the Explore page — once they're on your mesh, I'll know everything about them!`,
            mood: "thinking",
          };
        }
      }
    }
  }

  // Remaining mesh entity queries (connections list, etc.)
  if (meshEntities && meshEntities.length > 0) {

    // "Show me my connections" / "who do I follow"
    if (q.includes("my connections") || q.includes("who do i follow") || q.includes("list my") || q.includes("show my mesh")) {
      const people = meshEntities.filter((e) => e.type === "user");
      const comms = meshEntities.filter((e) => e.type === "community");
      const tags = meshEntities.filter((e) => e.type === "tag");
      const platforms = meshEntities.filter((e) => e.type === "platform");
      const parts = [];
      if (people.length > 0) parts.push(`${people.length} people (${people.slice(0, 3).map((p) => p.label).join(", ")}${people.length > 3 ? "..." : ""})`);
      if (comms.length > 0) parts.push(`${comms.length} communities`);
      if (tags.length > 0) parts.push(`${tags.length} interests`);
      if (platforms.length > 0) parts.push(`${platforms.length} platforms`);
      return {
        content: parts.length > 0
          ? `Your mesh has: ${parts.join(", ")}. Click any node on The Mesh for quick actions!`
          : "Your mesh is empty right now. Start by following people, joining communities, or connecting platforms!",
        mood: parts.length > 0 ? "excited" : "thinking",
      };
    }
  }

  // ─── Greeting / hello ───────────────────────────────────
  if (q.match(/^(hi|hello|hey|sup|yo|what'?s up|howdy|greetings)/)) {
    return {
      content: "Hey there! I'm Meshi, your mesh.me guide. I know everything about this platform and I can look up anyone on your mesh. What can I help you with?",
      mood: "excited",
    };
  }

  // ─── Gratitude ─────────────────────────────────────────
  if (q.match(/^(thanks|thank you|thx|ty|appreciate)/)) {
    return {
      content: "You're welcome! I'm always here if you need me. Just click me or drag me to any part of the app for help!",
      mood: "love",
    };
  }

  // ─── The Mesh (main visualization) ───────────────────────
  if (q.includes("mesh") && (q.includes("what") || q.includes("explain") || q.includes("how") || q.includes("work") || q.includes("use"))) {
    return {
      content: "The Mesh is the heart of mesh.me — it's an interactive visualization of your entire digital universe! Every person you follow, community you're in, platform you've connected, and interest you have appears as a glowing node. You can click any node for quick actions (message, follow, view profile), zoom in/out, and filter by type. It's your internet, visualized. One internet. One you.",
      mood: "excited",
    };
  }

  if (q.includes("node") || q.includes("click") || (q.includes("mesh") && q.includes("interact"))) {
    return {
      content: "Every node on The Mesh is interactive! Click any node to see quick actions — you can message someone, view their profile, follow/unfollow, or manage connected platforms. Double-click to zoom into a cluster. Use the filter bar at the top to show/hide different node types (people, communities, platforms, interests).",
      mood: "happy",
    };
  }

  // ─── Custom Feed ─────────────────────────────────────────
  if (q.includes("custom feed") || q.includes("feed layout") || q.includes("feed view")) {
    return {
      content: "The Custom Feed pulls content from all your connected platforms into one unified timeline! You can switch between layouts: Card view (like Instagram), Compact view (like Twitter/X), or Grid view (like Pinterest). It's your content, your way — and you interact with posts natively, so likes and comments sync back to the original platform.",
      mood: "happy",
    };
  }

  if (q.includes("feed") && !q.includes("custom")) {
    return {
      content: "mesh.me has two main feeds: The Mesh (your visual network map) and the Custom Feed (a unified content timeline from all your platforms). The Custom Feed lets you see Instagram, YouTube, TikTok, X, and more — all in one place. You can switch between Card, Compact, and Grid layouts!",
      mood: "excited",
    };
  }

  // ─── MeChat (messaging) ─────────────────────────────────
  if (q.includes("mechat") || q.includes("message") || q.includes("chat") || q.includes("dm") || q.includes("direct message")) {
    return {
      content: "MeChat is mesh.me's unified messaging hub! It merges conversations across all your connected platforms (Instagram DMs, X DMs, etc.) into one place with timestamps and read receipts. You can also have native mesh.me conversations. Messages are encrypted and private — mesh.me can't read them. Start a conversation from any profile or from the MeChat page!",
      mood: "love",
    };
  }

  // ─── Communities ─────────────────────────────────────────
  if (q.includes("communit") || q.includes("group") || q.includes("create community") || q.includes("join")) {
    return {
      content: "Communities are groups of mesh.me users with shared interests! You can join existing communities or create your own. Each community has its own feed, members list, and discussion space. Communities appear as nodes on your Mesh too. Go to the Communities page to explore, or create one from the Create Community page!",
      mood: "excited",
    };
  }

  // ─── Connected Accounts / Platforms ──────────────────────
  if (q.includes("platform") || q.includes("connect") || q.includes("link account") || q.includes("instagram") || q.includes("youtube") || q.includes("tiktok") || q.includes("twitter") || q.includes("twitch") || q.includes("spotify") || q.includes("reddit") || q.includes("linkedin") || q.includes("snapchat") || q.includes("discord") || q.includes("pinterest")) {
    return {
      content: "You can connect all major social platforms to mesh.me: Instagram, YouTube, TikTok, X (Twitter), Twitch, Spotify, Reddit, LinkedIn, Snapchat, Discord, Pinterest, and more! Once connected, you can view content from those platforms in your Custom Feed and interact natively — likes, comments, and follows sync back to the original platform. Manage your connections from the Connected Accounts page or through quick actions on The Mesh.",
      mood: "excited",
    };
  }

  // ─── Following / Followers ──────────────────────────────
  if (q.includes("follow")) {
    if (q.includes("how") || q.includes("someone") || q.includes("people")) {
      return {
        content: "When you follow someone on mesh.me who also has an account, you'll be prompted to choose: follow them on all their connected platforms, just the platform the post came from, or only on mesh.me. You can follow directly from The Mesh by clicking on any person node, or from their profile page!",
        mood: "happy",
      };
    }
    return {
      content: meshData?.followers
        ? `You have ${meshData.followers} follower${meshData.followers !== 1 ? "s" : ""} and you're following ${meshData.following || 0} people! Each connection is a node on your mesh. Click any person node to see their profile, message them, or manage the follow.`
        : "You don't have any followers yet. Start by following people, joining communities, or connecting your platforms — your mesh will grow naturally!",
      mood: meshData?.followers ? "love" : "thinking",
    };
  }

  // ─── Search ──────────────────────────────────────────────
  if (q.includes("search") || q.includes("find") || q.includes("look for") || q.includes("discover")) {
    return {
      content: "You can search for anything on mesh.me! Use the Search page (or Cmd/Ctrl+K) to find people, communities, posts, and topics. I can also help you search — just tell me what you're looking for and I'll point you in the right direction. On The Mesh, you can use filters to show specific node types.",
      mood: "excited",
    };
  }

  // ─── Notifications ───────────────────────────────────────
  if (q.includes("notification") || q.includes("alert") || q.includes("notify")) {
    return {
      content: "mesh.me has a smart notification system! You can receive notifications for follows, likes, comments, messages, and community activity. The smart notification digest summarizes your notifications so you get what matters without the noise. You can customize exactly what you get notified about in Settings > Notifications. You can even disable native app notifications and only use mesh.me's unified notifications!",
      mood: "cool",
    };
  }

  // ─── "What did I miss?" / Catch-up summary ─────────────
  if (q.includes("miss") || q.includes("catch up") || q.includes("catch-up") || q.includes("been away") || q.includes("haven't logged") || q.includes("what happened")) {
    return {
      content: "Welcome back! Here's what I found while you were away: You can enable the 'Meshi Catch-Up' feature in Settings > Meshi to get an automatic summary every time you return after being away. I'll scan your notifications, messages, and connected platforms to give you a quick digest of what matters most — new followers, trending posts in your communities, unread messages, and platform activity. No noise, just what's important!",
      mood: "excited",
    };
  }

  // ─── Summary / stats ────────────────────────────────────
  if (q.includes("summary") || q.includes("stats") || q.includes("activity") || q.includes("overview")) {
    const parts = [];
    if (meshData?.followers) parts.push(`${meshData.followers} follower${meshData.followers !== 1 ? "s" : ""}`);
    if (meshData?.following) parts.push(`following ${meshData.following} people`);
    if (meshData?.posts) parts.push(`${meshData.posts} post${meshData.posts !== 1 ? "s" : ""}`);
    if (meshData?.communities) parts.push(`${meshData.communities} communit${meshData.communities !== 1 ? "ies" : "y"}`);
    if (meshData?.platforms) parts.push(`${meshData.platforms} connected platform${meshData.platforms !== 1 ? "s" : ""}`);

    const summary = parts.length > 0
      ? `Here's your mesh at a glance: ${parts.join(", ")}. Your digital universe is growing! You can see detailed stats on The Mesh's Footprint Dashboard or in MeshPro's Cross-Platform Analytics.`
      : "Your mesh is just getting started! Try connecting some platforms, following people, or joining communities to build it out.";

    return { content: summary, mood: "happy" };
  }

  // ─── Profile ─────────────────────────────────────────────
  if (q.includes("profile") || q.includes("bio") || q.includes("avatar") || q.includes("display name")) {
    return {
      content: "Your profile is your digital identity on mesh.me! You can customize your display name, bio, avatar, location, website, social links, and interests. Your achievement titles and badges also appear on your profile. Only what you choose to make public is visible to others. Edit everything from Settings > Profile!",
      mood: "happy",
    };
  }

  // ─── Privacy ─────────────────────────────────────────────
  if (q.includes("privacy") || q.includes("private") || q.includes("who can see") || q.includes("visible") || q.includes("hide")) {
    return {
      content: "Privacy is mesh.me's #1 priority — not just from other users, but from mesh.me itself! We never sell your data, never track you with cookies, and never build ad profiles. You control exactly who sees your profile, posts, and connections. Everything defaults to maximum privacy. I don't store our conversations either — zero-knowledge design. Go to Settings > Privacy to control visibility, or Settings > Security Hub to manage your digital footprint.",
      mood: "cool",
    };
  }

  // ─── Security ────────────────────────────────────────────
  if (q.includes("security") || q.includes("secure") || q.includes("password") || q.includes("hack") || q.includes("safe")) {
    return {
      content: "mesh.me takes security seriously! Your account is protected with strong password requirements, rate limiting, and session management. You can change your password, sign out all sessions, and export your data from Settings > Security. The Security Hub (MeshPro) lets you manage and mass-delete content across all connected platforms. We also have account lockout protection against brute-force attacks.",
      mood: "cool",
    };
  }

  // ─── Settings ────────────────────────────────────────────
  if (q.includes("setting") || q.includes("configure") || q.includes("preference") || q.includes("options")) {
    return {
      content: "Settings is where you control everything! Here's what you'll find: Profile (edit your info), Interests & Links (personalize your experience), Customize (themes, colors, layout), Notifications (what alerts you get), Privacy (who sees what), Security (password, sessions), Blocked Users, Security Hub (content management), Digital Footprint (MeshPro), Achievements (titles & badges), Meshi (customize me!), and MeshPro (upgrade for extras).",
      mood: "happy",
    };
  }

  // ─── Posts / Creating content ────────────────────────────
  if (q.includes("post") || q.includes("create") || q.includes("write") || q.includes("publish") || q.includes("share")) {
    return {
      content: "You can create posts right from mesh.me! Hit the 'Create Post' button in the sidebar, or go to your Feed and click compose. Posts appear on your profile, in your followers' feeds, and in any communities you share them to. When you interact with posts from connected platforms (like, comment, share), those actions sync back natively!",
      mood: "excited",
    };
  }

  // ─── Explore ─────────────────────────────────────────────
  if (q.includes("explore") || q.includes("discover") || q.includes("trending") || q.includes("popular")) {
    return {
      content: "The Explore page helps you discover new people, communities, and content on mesh.me! Browse trending topics, find communities that match your interests, and discover users with similar vibes. It's a great way to grow your mesh organically.",
      mood: "excited",
    };
  }

  // ─── Themes / Customization ──────────────────────────────
  if (q.includes("theme") || q.includes("dark mode") || q.includes("light mode") || q.includes("color") || q.includes("accent") || q.includes("appearance")) {
    return {
      content: "mesh.me supports three modes: Light, Dark, and System (which follows your device preference). System is the default! You can also customize your accent color in Settings > Customize. The whole platform is designed to look beautiful in any mode — glass effects, smooth animations, and consistent styling throughout.",
      mood: "happy",
    };
  }

  // ─── Meshi identity ──────────────────────────────────────
  if (q.includes("who are you") || q.includes("what are you") || q.includes("tell me about yourself") || (q.includes("meshi") && !q.includes("meshpro"))) {
    return {
      content: "I'm Meshi! I'm the mesh.me mascot, logo, and your personal guide. I know everything about mesh.me and I'm here to help you navigate, search, manage, and understand the platform. I appear on The Mesh as a special node, I guide you during onboarding, I give tips in settings, and I'm always floating around ready to help! I never store your data — everything I do is stateless and privacy-first. MeshPro members can even customize my hat, face, and color!",
      mood: "love",
    };
  }

  // ─── Achievements / Titles ───────────────────────────────
  if (q.includes("achievement") || q.includes("title") || q.includes("badge") || q.includes("pioneer") || q.includes("milestone") || q.includes("unlock")) {
    return {
      content: "Achievements are titles you earn through milestones on mesh.me! Here are some: First Post (publish your first post), Ten Followers (grow your network), Community Creator (start a community), Platform Linker (connect a platform), Mesh Master (connect 5+ platforms), and more. The exclusive \"Pioneer\" title goes to the first 1 million fully verified users — once all spots are claimed, it's gone forever! Check Settings > Achievements to see your progress and set an active title that shows on your profile.",
      mood: "excited",
    };
  }

  // ─── MeshPro ─────────────────────────────────────────────
  if (q.includes("meshpro") || q.includes("pro") || q.includes("premium") || q.includes("upgrade") || q.includes("subscription") || q.includes("paid")) {
    return {
      content: "MeshPro is $4.99/month or $39.99/year — and nearly everything on mesh.me is free! MeshPro adds: customizing me (Meshi hats, faces, colors!), mesh cosmetics visible to others, Digital Footprint Scanner (find every trace of you online), cross-platform analytics, audience insights, advanced notification summaries, extra feed layouts, verified badge, and profile analytics. No ads ever — MeshPro is the only way we fund the platform.",
      mood: "wink",
    };
  }

  // ─── Customize Meshi ─────────────────────────────────────
  if (q.includes("customize") || q.includes("hat") || q.includes("cosmetic") || q.includes("appearance")) {
    return {
      content: "MeshPro members can customize me! Give me a top hat, crown, beanie, party hat, or flower. Change my expression to excited, thinking, sleepy, surprised, love, cool, or wink. Pick my color: blue, purple, pink, green, orange, cyan, gold, or rainbow. Go to Settings > Meshi to play dress-up! You can also add mesh cosmetics (visual effects) that other users will see on your mesh.",
      mood: "love",
    };
  }

  // ─── Digital Footprint ───────────────────────────────────
  if (q.includes("footprint") || q.includes("digital footprint") || q.includes("trace") || q.includes("data broker") || q.includes("identity scan")) {
    return {
      content: "The Digital Footprint Scanner (MeshPro) scans the web for every trace of your identity — accounts, data broker listings, mentions, and more. Think of it like Incogni but built right into mesh.me. You can see your known and unknown digital presence, monitor it over time, and take action to remove data. The Footprint Dashboard on The Mesh also gives you a quick overview. Go to Settings > Digital Footprint to run a scan!",
      mood: "thinking",
    };
  }

  // ─── Security Hub ────────────────────────────────────────
  if (q.includes("security hub") || q.includes("delete post") || q.includes("remove content") || q.includes("mass delete") || q.includes("manage content")) {
    return {
      content: "The Security Hub (in Settings) lets you manage and mass-delete content across all your connected platforms from one place! Review and delete posts, photos, videos, comments, and more — across Instagram, YouTube, TikTok, X, and all connected accounts. You can also manage active sessions, export your data, and sign out of all devices. It's your content, your control.",
      mood: "cool",
    };
  }

  // ─── Blocked users ───────────────────────────────────────
  if (q.includes("block") || q.includes("blocked")) {
    return {
      content: "You can block any user from Settings > Blocked Users or from their profile. Blocked users can't see your profile, posts, or send you messages. You can unblock them anytime. Your safety always comes first on mesh.me!",
      mood: "cool",
    };
  }

  // ─── Data / export ───────────────────────────────────────
  if (q.includes("data") || q.includes("export") || q.includes("download") || q.includes("delete account") || q.includes("delete my")) {
    return {
      content: "You own your data on mesh.me! You can export a complete copy of everything (posts, messages, account info) from Settings > Security Hub. If you want to delete your account, you can do that from Settings > Privacy — and when you delete, it's truly gone. We don't keep shadow copies. mesh.me believes your data is yours, period.",
      mood: "thinking",
    };
  }

  // ─── Onboarding ──────────────────────────────────────────
  if (q.includes("onboard") || q.includes("getting started") || q.includes("new") || q.includes("first time") || q.includes("setup") || q.includes("start")) {
    return {
      content: "Welcome aboard! Here's how to get the most out of mesh.me: 1) Set up your profile (bio, avatar, interests), 2) Connect your social platforms (Instagram, YouTube, etc.), 3) Follow people and join communities, 4) Explore The Mesh to see your digital universe grow! I guided you through privacy and security during signup — everything defaults to maximum privacy. Ask me anything anytime!",
      mood: "excited",
    };
  }

  // ─── Interests ───────────────────────────────────────────
  if (q.includes("interest") || q.includes("topic") || q.includes("tag")) {
    return {
      content: "Interests help personalize your mesh.me experience! Pick topics you care about (music, gaming, tech, art, etc.) and they'll appear as nodes on your Mesh. They also help me find relevant content, communities, and people for you. Update your interests anytime from Settings > Interests & Links.",
      mood: "happy",
    };
  }

  // ─── Reactions / Likes / Comments ────────────────────────
  if (q.includes("like") || q.includes("react") || q.includes("comment") || q.includes("reply") || q.includes("heart")) {
    return {
      content: "You can like, comment on, and react to posts right from mesh.me! The best part: when you interact with content from connected platforms (Instagram, YouTube, etc.), those actions sync back natively — the creator sees your like/comment on their platform as if you did it there. No mesh.me account required on their end!",
      mood: "love",
    };
  }

  // ─── Verification ────────────────────────────────────────
  if (q.includes("verif") || q.includes("verified") || q.includes("verify")) {
    return {
      content: "Verified accounts get a checkmark on their profile! Being verified also unlocks the chance to earn the exclusive Pioneer title (first 1M verified users). MeshPro members also get a verified badge. Verification helps build trust in the mesh.me community.",
      mood: "cool",
    };
  }

  // ─── Navigation help ─────────────────────────────────────
  if (q.includes("where") || q.includes("navigate") || q.includes("go to") || q.includes("how do i get to")) {
    return {
      content: "Here's how to get around mesh.me: The Mesh (your visual network) is the home page. Use the sidebar to navigate to Feed, Custom Feed, Explore, MeChat (messages), Communities, Notifications, your Profile, and Settings. On mobile, use the bottom navigation bar. You can also use Cmd/Ctrl+K to quickly search and jump anywhere!",
      mood: "happy",
    };
  }

  // ─── Help / general ──────────────────────────────────────
  if (q.includes("help") || q.includes("what can you") || q.includes("guide") || q.includes("assist")) {
    return {
      content: "I can help you with anything on mesh.me! Here's what I know about:\n\n• The Mesh — your interactive network visualization\n• Custom Feed — unified content from all platforms\n• MeChat — cross-platform messaging\n• Communities — groups and discussions\n• Connected Accounts — linking your socials\n• Notifications — smart summaries\n• Profile & Settings — customization\n• Achievements & Titles — milestones and badges\n• MeshPro — premium features\n• Privacy & Security — staying safe\n• Digital Footprint — managing your online presence\n\nJust ask me about any of these!",
      mood: "excited",
    };
  }

  // Default — comprehensive and helpful
  return {
    content: "That's a great question! I know everything about mesh.me — try asking me about The Mesh, Custom Feed, MeChat, communities, connected platforms, notifications, achievements, profile settings, privacy, security, Digital Footprint, MeshPro, themes, or anything else! I'm here to help you navigate your digital universe.",
    mood: "thinking",
  };
}

interface MeshiChatProps {
  isOpen: boolean;
  onClose: () => void;
  hat?: MeshiHat;
  color?: MeshiColor;
  faceStyle?: string;
  meshData?: {
    followers?: number;
    following?: number;
    posts?: number;
    communities?: number;
    platforms?: number;
  };
  meshEntities?: MeshGraphEntity[];
}

export function MeshiChat({ isOpen, onClose, hat = "none", color = "blue", meshData, meshEntities }: MeshiChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "meshi",
      content: "Hi there! I'm Meshi, your mesh.me guide. Ask me anything about your mesh — I'll help you search, summarize, and manage your digital universe. I never store any of your data!",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [meshiMood, setMeshiMood] = useState<MeshiMood>("happy");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSend = useCallback((text?: string) => {
    const messageText = text || input.trim();
    if (!messageText) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: messageText,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);
    setMeshiMood("thinking");

    // Call Meshi reasoning engine for intelligent responses
    const callMeshiReasoner = async () => {
      try {
        const res = await fetch("/api/meshi/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: messageText,
            context: {
              meshData,
              meshEntities: meshEntities?.slice(0, 50), // Limit payload size
            },
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setMeshiMood(data.mood as MeshiMood || "happy");
          const meshiMsg: ChatMessage = {
            id: `meshi-${Date.now()}`,
            role: "meshi",
            content: data.content,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, meshiMsg]);
        } else {
          // Fallback to local response
          const response = getMeshiResponse(messageText, meshData, meshEntities);
          setMeshiMood(response.mood);
          setMessages((prev) => [...prev, { id: `meshi-${Date.now()}`, role: "meshi", content: response.content, timestamp: new Date() }]);
        }
      } catch {
        // Fallback to local response on network error
        const response = getMeshiResponse(messageText, meshData, meshEntities);
        setMeshiMood(response.mood);
        setMessages((prev) => [...prev, { id: `meshi-${Date.now()}`, role: "meshi", content: response.content, timestamp: new Date() }]);
      } finally {
        setIsTyping(false);
      }
    };

    callMeshiReasoner();
  }, [input, meshData, meshEntities]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed bottom-4 right-4 z-50 w-[360px] max-w-[calc(100vw-2rem)] h-[520px] max-h-[calc(100vh-6rem)] glass-dropdown rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-primary)]" style={{ background: "var(--bg-secondary)" }}>
            <MeshiMascot
              size={36}
              mood={meshiMood}
              hat={hat}
              color={color}
              speaking={isTyping}
              showGlow={false}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[var(--text-primary)]">Meshi</p>
              <p className="text-[10px] text-[var(--text-muted)]">
                {isTyping ? "Thinking..." : "Your mesh.me guide"}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-[9px] font-medium">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                No data stored
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ background: "var(--bg-primary)" }}>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                    msg.role === "user"
                      ? "brand-button text-white rounded-br-md"
                      : "bg-[var(--bg-secondary)] text-[var(--text-primary)] rounded-bl-md border border-[var(--border-primary)]"
                  }`}
                >
                  {msg.content}
                </div>
              </motion.div>
            ))}

            {/* Typing indicator */}
            {isTyping && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex justify-start"
              >
                <div className="bg-[var(--bg-secondary)] rounded-2xl rounded-bl-md px-4 py-3 border border-[var(--border-primary)]">
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        className="w-2 h-2 rounded-full bg-[var(--accent)]"
                        animate={{ y: [0, -4, 0] }}
                        transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                      />
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick actions */}
          {messages.length <= 2 && (
            <div className="px-4 py-2 border-t border-[var(--border-primary)]" style={{ background: "var(--bg-secondary)" }}>
              <p className="text-[10px] text-[var(--text-muted)] mb-2 flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                Quick actions
              </p>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_ACTIONS.map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.label}
                      onClick={() => handleSend(action.prompt)}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                    >
                      <Icon className="h-3 w-3" />
                      {action.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="flex items-center gap-2 px-4 py-3 border-t border-[var(--border-primary)]" style={{ background: "var(--bg-secondary)" }}>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Ask Meshi anything..."
              className="flex-1 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-xl px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)]"
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim()}
              className="p-2 rounded-xl brand-button text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:shadow-lg"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
