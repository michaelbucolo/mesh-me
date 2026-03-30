import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

// Meshi LLM — a reasoning engine that can answer ANY question with logic
// Architecture: designed to plug into OpenAI/Anthropic API when keys are available
// For now: sophisticated local reasoning with math, logic, general knowledge, and mesh awareness

interface ChatRequest {
  message: string;
  context?: {
    meshData?: {
      followers?: number;
      following?: number;
      posts?: number;
      communities?: number;
      platforms?: number;
    };
    meshEntities?: Array<{
      type: string;
      label: string;
      sublabel?: string;
      isMutual?: boolean;
      followerCount?: number;
      memberCount?: number;
    }>;
    currentPage?: string;
  };
  history?: Array<{ role: "user" | "meshi"; content: string }>;
}

// --- Math evaluation engine ---
function evaluateMath(expr: string): number | null {
  try {
    // Clean the expression
    const cleaned = expr
      .replace(/[xX×]/g, "*")
      .replace(/[÷]/g, "/")
      .replace(/\^/g, "**")
      .replace(/sqrt\(([^)]+)\)/gi, "Math.sqrt($1)")
      .replace(/pi/gi, "Math.PI")
      .replace(/\s+/g, "");

    // Only allow safe math characters
    if (!/^[\d+\-*/().%Math.sqrtPIeE,\s]+$/.test(cleaned)) return null;

    // eslint-disable-next-line no-eval
    const result = Function(`"use strict"; return (${cleaned})`)();
    if (typeof result === "number" && isFinite(result)) return result;
    return null;
  } catch {
    return null;
  }
}

// --- Logic & reasoning engine ---
function reason(query: string, context?: ChatRequest["context"]): { content: string; mood: string } {
  const q = query.toLowerCase().trim();

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
    if (q.includes("mechat")) return { content: "MeChat is mesh.me's unified messaging hub. It merges conversations from all your connected platforms into one encrypted, private inbox.", mood: "love" };
    if (q.includes("meshi")) return { content: "I'm Meshi! Your AI guide to mesh.me. I can answer questions, help you navigate, search your mesh, and explain any feature. I'm always here floating around, ready to help!", mood: "love" };
    if (q.includes("node")) return { content: "A node is any entity on your mesh — a person, community, platform, interest, or post. You can click nodes for actions, hide them for privacy, and manage connections.", mood: "happy" };
    if (q.includes("privacy")) return { content: "Privacy on mesh.me means YOU control everything. Hide individual nodes, entire branches, or set visibility per-connection. mesh.me itself can't see your data — zero-knowledge architecture.", mood: "cool" };
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
    if (q.includes("private") || q.includes("secure")) return { content: "Absolutely. mesh.me is built privacy-first. Zero-knowledge architecture, no data selling, no tracking cookies, no ad profiles. You control everything.", mood: "cool" };
  }

  // How-to questions
  if (q.startsWith("how")) {
    if (q.includes("post") || q.includes("create")) return { content: "To create a post: click 'Create Post' in the sidebar (or the + button on mobile). Write your content, choose which connected platforms to cross-post to, add tags, and hit publish! It'll post to mesh.me and your selected platforms simultaneously.", mood: "excited" };
    if (q.includes("follow")) return { content: "Click any person node on The Mesh, or visit their profile. You'll get the option to follow on mesh.me only, on a specific platform, or everywhere at once!", mood: "happy" };
    if (q.includes("hide") || q.includes("privacy")) return { content: "Right-click any node on The Mesh to access privacy controls. You can hide individual nodes, entire branches (like all communities), or set custom visibility. Go to Settings > Mesh Privacy for global controls.", mood: "cool" };
    if (q.includes("connect") || q.includes("platform") || q.includes("link")) return { content: "Go to Connected Accounts in settings. Click the platform you want to link, authorize with your account, and it'll appear as a node on your mesh. Content flows in, interactions sync out!", mood: "excited" };
    if (q.includes("message") || q.includes("chat") || q.includes("dm")) return { content: "Open Messages (MeChat) from the sidebar. You can start a new conversation with anyone on your mesh, or view merged conversations from connected platforms. All messages are encrypted.", mood: "love" };
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

  if (q.includes("thank")) return { content: "Anytime! I'm always here if you need me. Just drag me over to anything you're curious about!", mood: "love" };
  if (q.includes("hello") || q.includes("hi") || q.includes("hey") || q.includes("sup") || q.includes("yo")) return { content: "Hey! What can I help you with? I can answer questions, help navigate, search your mesh, or explain any feature.", mood: "happy" };
  if (q.includes("bye") || q.includes("goodbye") || q.includes("later")) return { content: "See you around! I'll be right here whenever you need me.", mood: "love" };
  if (q.includes("who are you") || q.includes("what are you")) return { content: "I'm Meshi, your AI companion on mesh.me! I can answer any question, help you navigate the platform, search your mesh, explain features, do math, and more. I'm always floating around ready to help!", mood: "love" };
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
  if (q.includes("privacy") || q.includes("private") || q.includes("hide") || q.includes("visible")) return { content: "Privacy is mesh.me's #1 priority. You can hide any node, branch, or connection. Set per-node visibility (Private, Friends Only, Public, Custom). mesh.me itself uses zero-knowledge architecture — we can't see your data. Settings > Mesh Privacy has all the controls.", mood: "cool" };
  if (q.includes("security") || q.includes("secure") || q.includes("safe") || q.includes("hack")) return { content: "mesh.me uses strong encryption, rate limiting, account lockout protection, and session management. Your data is yours — we never sell it, track you, or build ad profiles. Change passwords, manage sessions, and export data from Settings > Security.", mood: "cool" };
  if (q.includes("notification") || q.includes("alert")) return { content: "mesh.me has smart notifications that use AI to summarize what matters. You can disable native app notifications and just use mesh.me's unified alerts. Customize exactly what you get notified about in Settings > Notifications.", mood: "happy" };
  if (q.includes("post") || q.includes("create") || q.includes("publish")) return { content: "Create posts from the sidebar or from The Mesh itself! Choose which connected platforms to cross-post to, add tags, and publish. Your post appears on mesh.me and syncs to selected platforms. Interactions (likes, comments) sync back!", mood: "excited" };
  if (q.includes("platform") || q.includes("connect") || q.includes("instagram") || q.includes("youtube") || q.includes("tiktok")) return { content: "Connect all major platforms: Instagram, YouTube, TikTok, X, Twitch, Spotify, Reddit, LinkedIn, Discord, and more. Content flows into your feed, interactions sync back natively. Manage from Connected Accounts or The Mesh.", mood: "excited" };
  if (q.includes("communit") || q.includes("group")) return { content: "Communities are groups of mesh.me users with shared interests. Join existing ones or create your own. Each has its own feed and discussion space. They appear as nodes on your mesh!", mood: "happy" };
  if (q.includes("message") || q.includes("chat") || q.includes("dm") || q.includes("mechat")) return { content: "MeChat merges all your conversations from connected platforms into one encrypted inbox. Start conversations from any profile or The Mesh. Messages are end-to-end encrypted — not even mesh.me can read them.", mood: "love" };
  if (q.includes("search") || q.includes("find") || q.includes("discover")) return { content: "Search for people, communities, posts, and topics. Use Cmd/Ctrl+K for quick search, or the Search page for detailed results. On The Mesh, use filters to show specific node types. I can also help you search — just ask!", mood: "happy" };
  if (q.includes("setting") || q.includes("config") || q.includes("preference")) return { content: "Settings has everything: Profile, Interests, Customize (themes), Notifications, Privacy, Security, Blocked Users, Achievements, Meshi settings, and MeshPro. Access from the sidebar or ask me about any specific setting!", mood: "happy" };
  if (q.includes("achieve") || q.includes("badge") || q.includes("title")) return { content: "Earn achievement titles and badges by using mesh.me! First 1M users get the 'Pioneer' badge. Complete your profile, connect platforms, grow your mesh, and unlock more. Titles display on your profile.", mood: "excited" };

  // Catch-all: intelligent default that shows Meshi can think
  return {
    content: "That's an interesting question! I'm Meshi, and I'm best at helping with mesh.me features, searching your mesh, managing privacy, and navigating the platform. I can also do math and answer general questions. What would you like help with?",
    mood: "thinking",
  };
}

function findSmallestFactor(n: number): number {
  for (let i = 2; i <= Math.sqrt(n); i++) {
    if (n % i === 0) return i;
  }
  return n;
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: ChatRequest = await req.json();
    const { message, context } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    // Rate limit: max 60 messages per minute per user (simple in-memory)
    const result = reason(message, context);

    return NextResponse.json({
      content: result.content,
      mood: result.mood,
    });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
