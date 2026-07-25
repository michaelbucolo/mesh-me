import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasMeshiConsent, meshiDeniedUserIds } from "@/lib/consent";
import { prisma } from "@/lib/prisma";
import { meshiQuery } from "@/lib/meshi-engine";
import { callMeshiReasoning } from "@/lib/meshi-reasoning";
import { isSameOriginRequest, readJsonObject } from "@/lib/request-guard";
import { rateLimit } from "@/lib/security";
import { durableRateLimit } from "@/lib/durable-rate-limit";
import { createMeshiResponse, normalizeMeshiMood, type MeshiAction, type MeshiContext, type MeshiHistoryMessage } from "@/lib/meshi-shared";

// Cap the per-request prompt so a single caller can't drive unbounded
// upstream (OpenAI) input-token spend on the shared API key.
const MAX_MESHI_MESSAGE_LENGTH = 2000;

interface ChatRequest {
  message: string;
  context?: MeshiContext;
  history?: MeshiHistoryMessage[];
}

// --- Safe recursive descent math parser (no eval/Function) ---
// Supports: +, -, *, /, **, %, parentheses, sqrt(), pi, e
function evaluateMath(expr: string): number | null {
  try {
    const cleaned = expr
      .replace(/[xX×]/g, "*")
      .replace(/[÷]/g, "/")
      .replace(/\s+/g, "");

    let pos = 0;
    const ch = () => cleaned[pos] || "";
    const advance = () => cleaned[pos++];

    function parseNumber(): number | null {
      // Handle sqrt(...)
      if (cleaned.slice(pos, pos + 4).toLowerCase() === "sqrt") {
        pos += 4;
        if (ch() !== "(") return null;
        advance(); // skip (
        const inner = parseExpr();
        if (inner === null || ch() !== ")") return null;
        advance(); // skip )
        return Math.sqrt(inner);
      }
      // Handle pi
      if (cleaned.slice(pos, pos + 2).toLowerCase() === "pi") {
        pos += 2;
        return Math.PI;
      }
      // Handle e (Euler's number, but not if followed by digit like 1e5)
      if (ch().toLowerCase() === "e" && !/\d/.test(cleaned[pos - 1] || "")) {
        pos += 1;
        return Math.E;
      }
      // Handle parenthesized expressions
      if (ch() === "(") {
        advance();
        const val = parseExpr();
        if (val === null || ch() !== ")") return null;
        advance();
        return val;
      }
      // Handle unary minus
      if (ch() === "-") {
        advance();
        const val = parsePower();
        return val === null ? null : -val;
      }
      // Handle unary plus
      if (ch() === "+") {
        advance();
        return parsePower();
      }
      // Parse numeric literal (including decimals and scientific notation like 1e5)
      const start = pos;
      while (/[\d.]/.test(ch())) advance();
      if (ch().toLowerCase() === "e" && /\d/.test(cleaned[pos - 1] || "")) {
        advance(); // skip e
        if (ch() === "+" || ch() === "-") advance(); // skip sign
        while (/\d/.test(ch())) advance();
      }
      if (pos === start) return null;
      const num = parseFloat(cleaned.slice(start, pos));
      return isNaN(num) ? null : num;
    }

    function parsePower(): number | null {
      let base = parseNumber();
      if (base === null) return null;
      while (cleaned.slice(pos, pos + 2) === "**" || ch() === "^") {
        pos += cleaned.slice(pos, pos + 2) === "**" ? 2 : 1;
        const exp = parseNumber();
        if (exp === null) return null;
        base = Math.pow(base, exp);
      }
      return base;
    }

    function parseTerm(): number | null {
      let left = parsePower();
      if (left === null) return null;
      while (ch() === "*" || ch() === "/" || ch() === "%") {
        const op = advance();
        const right = parsePower();
        if (right === null) return null;
        if (op === "*") left = left * right;
        else if (op === "/") { if (right === 0) return null; left = left / right; }
        else left = left % right;
      }
      return left;
    }

    function parseExpr(): number | null {
      let left = parseTerm();
      if (left === null) return null;
      while (ch() === "+" || ch() === "-") {
        const op = advance();
        const right = parseTerm();
        if (right === null) return null;
        left = op === "+" ? left + right : left - right;
      }
      return left;
    }

    const result = parseExpr();
    if (result === null || pos !== cleaned.length) return null;
    if (!isFinite(result)) return null;
    return result;
  } catch {
    return null;
  }
}

// --- Logic & reasoning engine ---
interface ReasonResult {
  content: string;
  mood: string;
  action?: MeshiAction;
}

function summarizeVisibleContent(context?: MeshiContext) {
  const content = context?.focusedContent;
  if (!content) return null;

  const platform = content.platform && content.platform !== "meshme" ? content.platform : "Mesh.me";
  const media = content.mediaTypes?.length ? ` Media: ${content.mediaTypes.join(", ")}.` : "";
  const author = content.author ? ` by ${content.author}` : "";
  const text = (content.text || "").trim();
  const summary = text
    ? text.length > 260
      ? `${text.slice(0, 257)}...`
      : text
    : "This visible item has little or no caption text available in Mesh.me.";

  return `Visible post${author} from ${platform}: ${summary}${media}`;
}

function getVisibleContentFactCheck(context?: MeshiContext) {
  const content = context?.focusedContent;
  if (!content) return null;

  const text = (content.text || "").trim();
  const claims: string[] = [];
  const claimPatterns = [
    /\b(always|never|guaranteed|miracle|secret|proven|breaking|leaked|exclusive)\b/i,
    /\b(cure|treats|prevents|diagnosed|doctor|study|researchers)\b/i,
    /\b\d+(?:\.\d+)?\s?(?:%|percent|million|billion|trillion|x)\b/i,
    /\b(everyone|nobody|all users|no one)\b/i,
  ];
  claimPatterns.forEach((pattern) => {
    const match = text.match(pattern);
    if (match?.[0]) claims.push(match[0]);
  });

  const source = content.platform && content.platform !== "meshme" ? `${content.platform} source` : "Mesh.me source";
  const claimText = claims.length
    ? `Claims or high-confidence language to verify: ${[...new Set(claims)].slice(0, 4).join(", ")}.`
    : "I do not see obvious high-risk claim language in the visible caption.";
  const mediaText = content.mediaTypes?.length
    ? `It includes ${content.mediaTypes.join(", ")} media, so visual claims should be treated as unverified unless the original source provides provenance.`
    : "No media file is exposed in this card.";

  return `Local fact-check pass: ${source}. ${claimText} ${mediaText} I can only use visible Mesh.me metadata here, so treat this as a triage check, not proof.`;
}

function getVisibleContentMediaSignals(context?: MeshiContext) {
  const content = context?.focusedContent;
  if (!content) return null;

  const mediaText = content.mediaTypes?.length ? content.mediaTypes.join(", ") : "no visible media";
  const signals = content.mediaSignals?.filter(Boolean) || [];
  if (signals.length > 0) {
    return `Possible synthetic-media cues: ${signals.join("; ")}. Media shown: ${mediaText}. This is a metadata and caption check only, not pixel-level verification.`;
  }

  return `I do not see obvious synthetic-media cues in the visible caption, source URL, or media metadata. Media shown: ${mediaText}. That does not prove the photo or video is authentic; it means Mesh.me does not have enough provenance metadata to flag it.`;
}

function reason(query: string, context?: ChatRequest["context"]): ReasonResult {
  const q = query.toLowerCase().trim();

  if (context?.focusedContent && (
    q.includes("visible post") ||
    q.includes("this post") ||
    q.includes("this video") ||
    q.includes("this photo") ||
    q.includes("this image") ||
    q.includes("media") ||
    q.includes("fact") ||
    q.includes("summar") ||
    q.includes("machine") ||
    q.includes("generated") ||
    q.includes("authenticity")
  )) {
    if (q.includes("machine") || q.includes("generated") || q.includes("synthetic") || q.includes("deepfake") || q.includes("authenticity")) {
      return { content: getVisibleContentMediaSignals(context) || "I do not have a visible post to inspect yet.", mood: "learning" };
    }
    if (q.includes("fact") || q.includes("verify") || q.includes("true") || q.includes("false")) {
      return { content: getVisibleContentFactCheck(context) || "I do not have a visible post to inspect yet.", mood: "learning" };
    }
    return { content: summarizeVisibleContent(context) || "I do not have a visible post to summarize yet.", mood: "learning" };
  }

  // --- Math questions ---
  const mathMatch = q.match(/(?:what(?:'s| is)|calculate|compute|solve|evaluate)\s+(.+?)(?:\?|$)/i);
  if (mathMatch) {
    const result = evaluateMath(mathMatch[1]);
    if (result !== null) {
      return { content: `That's ${result}!`, mood: "excited" };
    }
  }

  // Direct math expressions
  const directMath = q.match(/^[\d\s+\-*/().^%]+$/);
  if (directMath) {
    const result = evaluateMath(q);
    if (result !== null) {
      return { content: `= ${result}`, mood: "happy" };
    }
  }

  // Percentage calculations
  const percentMatch = q.match(/what(?:'s| is)\s+(\d+)%?\s+(?:of|percent of)\s+(\d+)/i);
  if (percentMatch) {
    const pct = parseFloat(percentMatch[1]);
    const num = parseFloat(percentMatch[2]);
    return { content: `${pct}% of ${num} is ${(pct / 100) * num}.`, mood: "happy" };
  }

  // --- Mesh-aware entity lookups ---
  if (context?.meshEntities && context.meshEntities.length > 0) {
    const personMatch = q.match(/(?:who is|tell me about|do i (?:know|follow)|what about|info on|look up)\s+(.+)/i);
    if (personMatch) {
      const searchTerm = personMatch[1].replace(/[?!.]+$/, "").trim().toLowerCase();
      const found = context.meshEntities.find(
        (e) => e.label.toLowerCase().includes(searchTerm) || (e.sublabel && e.sublabel.toLowerCase().includes(searchTerm))
      );
      if (found) {
        if (found.type === "user") {
          const mutualText = found.isMutual ? "You follow each other!" : "You follow them.";
          const followerText = found.followerCount ? ` They have ${found.followerCount} followers.` : "";
          return { content: `${found.label} (${found.sublabel}) is on your mesh! ${mutualText}${followerText}`, mood: "excited" };
        }
        if (found.type === "community") {
          return { content: `${found.label} is a community you're in!${found.memberCount ? ` ${found.memberCount} members.` : ""}`, mood: "happy" };
        }
        if (found.type === "tag") {
          return { content: `"${found.label}" is one of your interests on your mesh.`, mood: "happy" };
        }
        if (found.type === "platform") {
          return { content: `You have ${found.label} connected${found.sublabel ? ` as ${found.sublabel}` : ""}! Content syncs both ways.`, mood: "excited" };
        }
      } else {
        return { content: `I don't see "${searchTerm}" on your mesh yet. They might not have a mesh.me account, or you might not be connected.`, mood: "thinking" };
      }
    }

    // Connection summary
    if (q.includes("my connections") || q.includes("who do i follow") || q.includes("show my mesh") || q.includes("my mesh")) {
      const people = context.meshEntities.filter((e) => e.type === "user");
      const comms = context.meshEntities.filter((e) => e.type === "community");
      const tags = context.meshEntities.filter((e) => e.type === "tag");
      const platforms = context.meshEntities.filter((e) => e.type === "platform");
      const parts = [];
      if (people.length > 0) parts.push(`${people.length} people (${people.slice(0, 3).map((p) => p.label).join(", ")}${people.length > 3 ? "..." : ""})`);
      if (comms.length > 0) parts.push(`${comms.length} communities`);
      if (tags.length > 0) parts.push(`${tags.length} interests`);
      if (platforms.length > 0) parts.push(`${platforms.length} connected platforms`);
      return {
        content: parts.length > 0
          ? `Your mesh has: ${parts.join(", ")}. Each one is a node you can interact with!`
          : "Your mesh is empty right now. Start by following people, joining communities, or connecting platforms!",
        mood: parts.length > 0 ? "excited" : "thinking",
      };
    }
  }

  // --- General knowledge & logic ---

  // Definitions / explanations
  if (q.startsWith("what is") || q.startsWith("what's") || q.startsWith("define") || q.startsWith("explain")) {
    // Mesh.me features
    if (q.includes("mesh.me") || q.includes("meshme")) return { content: "mesh.me is a privacy-first universal social platform that unifies your entire digital presence into one seamless experience. The Mesh visualizes your digital footprint, and you control everything.", mood: "excited" };
    if (q.includes("the mesh")) return { content: "The Mesh is an interactive visualization of your entire digital universe. Every person, community, platform, and interest is a node you can click, hide, or manage. It's your internet, all in one place.", mood: "excited" };
    if (q.includes("mechat")) return { content: "MeChat is mesh.me's private messaging hub. It brings your Mesh.me and supported connected-platform conversations into one member-only inbox.", mood: "love" };
    if (q.includes("meshi")) return { content: "I'm Meshi! Your guide to mesh.me. I can answer questions, help you navigate, search your mesh, and explain any feature. I'm always here floating around, ready to help!", mood: "love" };
    if (q.includes("node")) return { content: "A node is any entity on your mesh — a person, community, platform, interest, or post. You can click nodes for actions, hide them for privacy, and manage connections.", mood: "happy" };
    if (q.includes("privacy")) return { content: "Privacy on mesh.me means you control who can see your profile, Mesh branches, connections, and stats. Connected-account credentials are encrypted at rest, and access checks are enforced on the server.", mood: "cool" };
  }

  // Yes/no questions with logic
  if (q.startsWith("is ") || q.startsWith("are ") || q.startsWith("can ") || q.startsWith("does ") || q.startsWith("do ")) {
    // Prime number check
    const primeMatch = q.match(/is\s+(\d+)\s+(?:a\s+)?prime/i);
    if (primeMatch) {
      const n = parseInt(primeMatch[1]);
      if (n < 2) return { content: `No, ${n} is not prime. Prime numbers must be greater than 1.`, mood: "thinking" };
      let isPrime = true;
      for (let i = 2; i <= Math.sqrt(n); i++) {
        if (n % i === 0) { isPrime = false; break; }
      }
      return { content: isPrime ? `Yes! ${n} is a prime number.` : `No, ${n} is not prime. It's divisible by ${findSmallestFactor(n)}.`, mood: isPrime ? "excited" : "thinking" };
    }

    // Even/odd check
    const evenOddMatch = q.match(/is\s+(\d+)\s+(?:an?\s+)?(even|odd)/i);
    if (evenOddMatch) {
      const n = parseInt(evenOddMatch[1]);
      const type = evenOddMatch[2].toLowerCase();
      const isEven = n % 2 === 0;
      const answer = type === "even" ? isEven : !isEven;
      return { content: answer ? `Yes, ${n} is ${type}.` : `No, ${n} is ${type === "even" ? "odd" : "even"}.`, mood: "happy" };
    }

    // Mesh feature questions
    if (q.includes("free")) return { content: "Yes! Nearly every feature on mesh.me is free. MeshPro ($4.99/mo) adds extras like Digital Footprint Scanner and custom cosmetics, but core features are all free.", mood: "happy" };
    if (q.includes("private") || q.includes("secure")) return { content: "Mesh.me is built privacy-first, with explicit visibility controls, encrypted connected-account credentials, HTTPS, rate limits, and session protections. You can review privacy and security options in Settings.", mood: "cool" };
  }

  // How-to questions
  if (q.startsWith("how")) {
    if (q.includes("post") || q.includes("create")) return { content: "To create a post: click 'Create Post' in the sidebar (or the + button on mobile). Write your content, choose which connected platforms to cross-post to, add tags, and hit publish! It'll post to mesh.me and your selected platforms simultaneously.", mood: "excited" };
    if (q.includes("follow")) return { content: "Click any person node on The Mesh, or visit their profile. You'll get the option to follow on mesh.me only, on a specific platform, or everywhere at once!", mood: "happy" };
    if (q.includes("hide") || q.includes("privacy")) return { content: "Right-click any node on The Mesh to access privacy controls. You can hide individual nodes, entire branches (like all communities), or set custom visibility. Go to Settings > Mesh Privacy for global controls.", mood: "cool" };
  if (q.includes("connect") || q.includes("platform") || q.includes("link")) return { content: "Go to Connected Accounts in settings. Click the platform you want to link, authorize with your account, and it will appear as a node on your mesh. Mesh.me uses official APIs only; source-platform writes stay disabled unless the provider grants the needed scopes.", mood: "excited" };
    if (q.includes("message") || q.includes("chat") || q.includes("dm")) return { content: "Open Messages (MeChat) from the sidebar. You can start a conversation with someone on your Mesh or view supported connected-platform threads. Only conversation members can open a Mesh.me thread.", mood: "love" };
  }

  // Comparison / versus
  if (q.includes(" vs ") || q.includes(" versus ") || q.includes("difference between") || q.includes("compare")) {
    if (q.includes("mesh") && q.includes("feed")) return { content: "The Mesh is your visual network map — see and manage your entire digital footprint. The Feed is your content timeline — scroll through posts from people and platforms you follow. Both are core experiences, just different perspectives!", mood: "thinking" };
  }

  // Counting / listing
  if (q.includes("how many")) {
    if (context?.meshData) {
      const d = context.meshData;
      if (q.includes("follower")) return { content: `You have ${d.followers || 0} followers.`, mood: "happy" };
      if (q.includes("following") || q.includes("follow")) return { content: `You're following ${d.following || 0} people.`, mood: "happy" };
      if (q.includes("post")) return { content: `You have ${d.posts || 0} posts.`, mood: "happy" };
      if (q.includes("communit")) return { content: `You're in ${d.communities || 0} communities.`, mood: "happy" };
      if (q.includes("platform")) return { content: `You have ${d.platforms || 0} connected platforms.`, mood: "happy" };
    }
  }

  // Fun / personality
  if (q.includes("joke") || q.includes("funny")) {
    const jokes = [
      "Why did the node break up with the edge? Too many connections, not enough commitment!",
      "What did one mesh node say to the other? 'I feel a strong connection between us!'",
      "Why don't mesh nodes ever get lonely? Because they're always connected!",
      "What's a mesh's favorite type of music? Anything with good connections!",
    ];
    return { content: jokes[Math.floor(Math.random() * jokes.length)], mood: "wink" };
  }

  if (q.includes("thank")) return { content: "Anytime. Tap me whenever you need help.", mood: "love" };
  if (q.includes("who are you") || q.includes("what are you")) return { content: "I'm Meshi. I represent you on Mesh.me, follow you page to page, and help you search, understand, and control your Mesh. Privacy comes first.", mood: "love" };
  if (/\b(hello|hi|hey|sup|yo)\b/.test(q)) return { content: "Hey. Ask me to search, explain, or help with your Mesh.", mood: "happy" };
  if (q.includes("bye") || q.includes("goodbye") || q.includes("later")) return { content: "See you around. I'll be here when you need me.", mood: "love" };
  if (q.includes("good") && (q.includes("morning") || q.includes("afternoon") || q.includes("evening") || q.includes("night"))) return { content: "Good to see you! Your mesh is looking great today. Anything I can help with?", mood: "happy" };

  // Time/date
  if (q.includes("what time") || q.includes("current time")) return { content: `It's ${new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })} right now.`, mood: "happy" };
  if (q.includes("what day") || q.includes("today's date") || q.includes("what date")) return { content: `Today is ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}.`, mood: "happy" };

  // Mesh stats summary
  if (q.includes("summary") || q.includes("stats") || q.includes("overview") || q.includes("activity")) {
    if (context?.meshData) {
      const d = context.meshData;
      const parts = [];
      if (d.followers) parts.push(`${d.followers} followers`);
      if (d.following) parts.push(`following ${d.following} people`);
      if (d.posts) parts.push(`${d.posts} posts`);
      if (d.communities) parts.push(`${d.communities} communities`);
      if (d.platforms) parts.push(`${d.platforms} connected platforms`);
      return {
        content: parts.length > 0 ? `Here's your mesh at a glance: ${parts.join(", ")}. Your digital universe is growing!` : "Your mesh is just getting started! Connect some platforms and follow people to build it out.",
        mood: "happy",
      };
    }
  }

  // Mesh.me features knowledge base
  if (q.includes("feature") || q.includes("what can")) return { content: "mesh.me has three main areas: The Mesh (visualize & manage your digital footprint), Feed (content from all your platforms), and Messages (unified inbox). Plus: per-node privacy controls, cross-platform posting, achievement badges, Meshi (that's me!), communities, and MeshPro extras. What would you like to know more about?", mood: "excited" };
  if (q.includes("meshpro") || q.includes("pro") || q.includes("premium") || q.includes("upgrade")) return { content: "MeshPro is $4.99/mo or $39.99/yr. It adds: Digital Footprint Scanner, cross-platform analytics, custom mesh cosmetics, and advanced security tools. Everything else is free — we never gate core features.", mood: "happy" };
  if (q.includes("privacy") || q.includes("private") || q.includes("hide") || q.includes("visible")) return { content: "Privacy is a core Mesh.me control. You can set profile and Mesh visibility, hide connection branches or stats, and manage individual nodes. Server-side access checks enforce those choices; Settings > Mesh Privacy has the controls.", mood: "cool" };
  if (q.includes("security") || q.includes("secure") || q.includes("safe") || q.includes("hack")) return { content: "mesh.me uses strong encryption, rate limiting, account lockout protection, and session management. Your data is yours — we never sell it, track you, or build ad profiles. Change passwords, manage sessions, and export data from Settings > Security.", mood: "cool" };
  if (q.includes("notification") || q.includes("alert")) return { content: "mesh.me has smart notifications that intelligently summarize what matters. You can disable native app notifications and just use mesh.me's unified alerts. Customize exactly what you get notified about in Settings > Notifications.", mood: "happy" };
  if (q.includes("post") || q.includes("create") || q.includes("publish")) return { content: "Create posts from the sidebar or from The Mesh itself. Your post appears on Mesh.me immediately. Cross-posting only turns on for a source when its official API, approved scopes, and user-controlled publishing flow allow it.", mood: "excited" };
  if (q.includes("platform") || q.includes("connect") || q.includes("instagram") || q.includes("youtube") || q.includes("tiktok")) return { content: "Connect supported platforms like YouTube, X, Twitch, TikTok, GitHub, Discord, and more. Mesh.me imports through official APIs where allowed and keeps restricted platforms read-only until provider approval and scopes are available.", mood: "excited" };
  if (q.includes("communit") || q.includes("group")) return { content: "Communities are groups of mesh.me users with shared interests. Join existing ones or create your own. Each has its own feed and discussion space. They appear as nodes on your mesh!", mood: "happy" };
  if (q.includes("message") || q.includes("chat") || q.includes("dm") || q.includes("mechat")) return { content: "MeChat brings Mesh.me and supported connected-platform conversations into one private inbox. Start conversations from a profile or The Mesh; membership is checked whenever a thread is opened or a message is sent.", mood: "love" };
  if (q.includes("search") || q.includes("find") || q.includes("discover")) return { content: "Search for people, communities, posts, and topics. Use Cmd/Ctrl+K for quick search, or the Search page for detailed results. On The Mesh, use filters to show specific node types. I can also help you search — just ask!", mood: "happy" };
  if (q.includes("setting") || q.includes("config") || q.includes("preference")) return { content: "Settings has everything: Profile, Interests, Customize (themes), Notifications, Privacy, Security, Blocked Users, Achievements, Meshi settings, and MeshPro. Access from the sidebar or ask me about any specific setting!", mood: "happy" };
  if (q.includes("achieve") || q.includes("badge") || q.includes("title")) return { content: "Earn achievement titles and badges by using mesh.me! First 1M users get the 'Pioneer' badge. Complete your profile, connect platforms, grow your mesh, and unlock more. Titles display on your profile.", mood: "excited" };

  // --- Meshi vessel action intents ---
  // Detect when user wants Meshi to do something on their behalf
  if (q.includes("post for me") || q.includes("make a post") || q.includes("write a post") || q.includes("create a post for")) {
    return {
      content: "I can post on your behalf! Just tell me what you'd like to say and I'll create the post for you. You can also specify tags or a community. For example: 'Post: Hello mesh! #introduction'",
      mood: "excited",
      action: { type: "post_prompt" },
    };
  }

  if (q.startsWith("post:") || q.startsWith("post ")) {
    const postContent = q.replace(/^post:?\s*/i, "").trim();
    if (postContent.length > 0) {
      return {
        content: `I'll post this for you: "${postContent}". Sending it now!`,
        mood: "excited",
        action: { type: "post", content: postContent },
      };
    }
  }

  if ((q.includes("follow") && q.includes("for me")) || q.includes("follow them") || q.match(/follow\s+@?\w+/)) {
    return {
      content: "I can follow people for you! Click any person node on The Mesh and I'll handle the follow. Or tell me the username and I'll find them.",
      mood: "happy",
      action: { type: "follow_prompt" },
    };
  }

  if ((q.includes("message") || q.includes("send") || q.includes("dm")) && (q.includes("for me") || q.includes("to "))) {
    return {
      content: "I can send messages on your behalf! Click a person on The Mesh, or tell me who to message and what to say. For example: 'Message @username: Hey, let's connect!'",
      mood: "love",
      action: { type: "message_prompt" },
    };
  }

  if (q.includes("suggest") && (q.includes("people") || q.includes("follow") || q.includes("who"))) {
    return {
      content: "Let me find some people you might want to follow! I'll look at your interests and connections to find great matches.",
      mood: "excited",
      action: { type: "suggest", suggestionType: "people" },
    };
  }

  if (q.includes("suggest") && q.includes("communit")) {
    return {
      content: "Let me find communities that match your interests!",
      mood: "excited",
      action: { type: "suggest", suggestionType: "communities" },
    };
  }

  // Catch-all: intelligent default that shows Meshi can think
  return {
    content: "Great question — I can help with that. I can answer general questions, help with mesh.me tasks, and carry out actions on your behalf like drafting posts, messages, and follow workflows. Tell me what you'd like me to do next.",
    mood: "thinking",
  };
}

function findSmallestFactor(n: number): number {
  for (let i = 2; i <= Math.sqrt(n); i++) {
    if (n % i === 0) return i;
  }
  return n;
}

function isOpenEndedCreativeTask(query: string): boolean {
  const q = query.toLowerCase();
  const taskSignals = ["write", "draft", "brainstorm", "plan", "improve", "code", "email", "outline", "translate"];
  return taskSignals.some((signal) => q.includes(signal));
}

function isFocusedContentTask(query: string, context?: MeshiContext) {
  if (!context?.focusedContent) return false;
  const q = query.toLowerCase();
  return (
    q.includes("visible post") ||
    q.includes("this post") ||
    q.includes("this video") ||
    q.includes("this photo") ||
    q.includes("this image") ||
    q.includes("media") ||
    q.includes("fact") ||
    q.includes("verify") ||
    q.includes("summar") ||
    q.includes("machine") ||
    q.includes("generated") ||
    q.includes("synthetic") ||
    q.includes("deepfake") ||
    q.includes("authenticity")
  );
}

export async function POST(req: Request) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Bound how fast a single user can hit the (billed) reasoning backend.
    // The in-memory limiter is a per-instance fast-path that resets on cold
    // starts, so it can't bound a paid endpoint on serverless by itself; the
    // durable limiter enforces the cap per-user across all instances (and fails
    // open if the counter store is unreachable). The proxy adds a per-IP cap.
    const rl = rateLimit(`meshi-chat:${user.id}`, 30, 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json({ error: "You're chatting with Meshi too fast. Give it a moment." }, { status: 429 });
    }
    const durableRl = await durableRateLimit(`meshi-chat:${user.id}`, 30, 60 * 1000);
    if (!durableRl.allowed) {
      return NextResponse.json({ error: "You're chatting with Meshi too fast. Give it a moment." }, { status: 429 });
    }

    const body = (await readJsonObject(req)) as Partial<ChatRequest>;
    const { message, context } = body;
    // Cap conversation history (count + per-item size) so attacker-controlled
    // history can't inflate the upstream prompt beyond the message bound above.
    const history = Array.isArray(body.history)
      ? body.history
          .slice(-8)
          .filter((item): item is MeshiHistoryMessage => Boolean(item) && typeof item.content === "string")
          .map((item) => ({ role: item.role, content: item.content.slice(0, MAX_MESHI_MESSAGE_LENGTH) }))
      : undefined;

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    if (message.length > MAX_MESHI_MESSAGE_LENGTH) {
      return NextResponse.json(
        { error: `Message is too long. Keep it under ${MAX_MESHI_MESSAGE_LENGTH} characters.` },
        { status: 413 },
      );
    }

    // The caller's own "Meshi memory" rule. When it is switched off, Meshi must
    // not read their mesh (no grounding query) and must not ship their mesh
    // context upstream — the reasoning provider is off-device, so the context
    // object is the actual egress. Resolved server-side: the client supplies
    // `context`, so a client-side check would gate nothing.
    const meshiMayUseCallerData = await hasMeshiConsent(user.id);
    let groundedContext = meshiMayUseCallerData
      ? context
      : (context?.currentPage ? { currentPage: context.currentPage } : undefined);

    // `meshEntities` is the one Meshi input the server does not read itself: the
    // mesh graph is loaded for the mesh UI, handed to the client, and posted
    // back here — carrying other people's display names, handles and follower
    // counts straight into the reasoning provider's prompt. The caller's own
    // consent does not speak for them, so resolve theirs, here at the egress.
    if (groundedContext?.meshEntities?.length) {
      const peopleIds = groundedContext.meshEntities
        .filter((entity) => entity.type === "user" && entity.id)
        .map((entity) => entity.id as string);
      const denied = await meshiDeniedUserIds(peopleIds);
      if (denied.size > 0) {
        groundedContext = {
          ...groundedContext,
          meshEntities: groundedContext.meshEntities.filter(
            (entity) => entity.type !== "user" || !entity.id || !denied.has(entity.id),
          ),
        };
      }
    }

    // `focusedContent` is the post the caller is currently looking at, scraped
    // from the card in the DOM — and it carries that post's AUTHOR HANDLE and
    // its FULL TEXT. Usually someone else's.
    //
    // The gate directly above resolves consent for `meshEntities` (names,
    // handles, follower counts) and states the principle plainly: "The caller's
    // own consent does not speak for them, so resolve theirs, here at the
    // egress." That principle was never applied to this field, which ships
    // strictly more of a third party than meshEntities does — the post body
    // itself, not just a display name.
    //
    // Resolved by POST ID rather than by the author string: `author` is a
    // display name or handle, and matching a person by fuzzy name is exactly
    // how you strip the wrong record or quietly fail to strip the right one.
    // Only native posts are gated — content mirrored from another platform has
    // no mesh account whose consent we hold, and the caller is already looking
    // at it.
    if (groundedContext?.focusedContent?.id && (groundedContext.focusedContent.platform ?? "meshme") === "meshme") {
      const post = await prisma.post.findUnique({
        where: { id: groundedContext.focusedContent.id },
        select: { authorId: true },
      });
      if (post && post.authorId !== user.id) {
        const denied = await meshiDeniedUserIds([post.authorId]);
        if (denied.has(post.authorId)) {
          // Keep the non-identifying signals — media types, rating, provenance
          // cues — so "is this video real?" still works. Drop who wrote it and
          // what they said.
          groundedContext = {
            ...groundedContext,
            focusedContent: {
              ...groundedContext.focusedContent,
              author: undefined,
              text: undefined,
            },
          };
        }
      }
    }

    let databaseAnswer: { content: string; mood: string; action?: MeshiAction } | undefined;
    const openEndedTask = isOpenEndedCreativeTask(message);
    const focusedContentTask = isFocusedContentTask(message, groundedContext);

    // Try the smart query engine first — it queries the database for real answers
    if (meshiMayUseCallerData && !openEndedTask && !focusedContentTask) {
      try {
        const engineResult = await meshiQuery(message);
        if (engineResult.content) {
          databaseAnswer = {
            content: engineResult.content,
            mood: normalizeMeshiMood(engineResult.mood, "thinking"),
            action: engineResult.action,
          };
        }
      } catch {
        // Engine failed, fall through to local reasoning.
      }
    }

    if (focusedContentTask && !process.env.OPENAI_API_KEY) {
      const result = reason(message, groundedContext);
      return NextResponse.json(createMeshiResponse({
        content: result.content,
        mood: result.mood,
        action: result.action,
        source: "local",
        engineReady: false,
        grounded: true,
      }));
    }

    try {
      const engineResult = await callMeshiReasoning({
        message,
        context: groundedContext,
        // Prior turns are the same mesh data by another route: earlier answers
        // quoted the caller's connections, posts and stats, and the client
        // replays them here. Stripping `context` while forwarding `history`
        // would ship upstream exactly what the gate just withheld.
        history: meshiMayUseCallerData ? history : undefined,
        databaseAnswer,
        user: {
          username: user.username,
          displayName: user.displayName,
          isMeshPro: user.isMeshPro,
        },
      });
      if (engineResult) {
        return NextResponse.json(engineResult);
      }
    } catch {
      // If the reasoning provider is unavailable, keep Mesh.me usable with grounded fallback responses.
    }

    if (openEndedTask) {
      return NextResponse.json(createMeshiResponse({
        content: "My reasoning engine is the right tool for that. It is wired into Mesh.me now, but this environment needs the engine key configured before I can complete open-ended writing, planning, coding, and brainstorming tasks live.",
        mood: "thinking",
        source: "local",
        engineReady: false,
        grounded: false,
      }));
    }

    if (databaseAnswer) {
      return NextResponse.json(createMeshiResponse({
        content: databaseAnswer.content,
        mood: databaseAnswer.mood,
        action: databaseAnswer.action,
        source: "database",
        engineReady: false,
        grounded: true,
      }));
    }

    // Fallback to local reasoning only when no engine/database response is available.
    const result = reason(message, groundedContext);

    return NextResponse.json({
      ...createMeshiResponse({
        content: result.content,
        mood: result.mood,
        action: result.action,
        source: "local",
        engineReady: false,
        grounded: false,
      }),
    });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
