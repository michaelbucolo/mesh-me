/**
 * Meshi Knowledge System
 * 
 * Meshi gets smarter the more it explores the mesh.
 * Knowledge is stored in localStorage and accumulates over time.
 * Meshi can answer questions about the user's mesh based on indexed data.
 */

export interface MeshiKnowledgeEntry {
  id: string;
  type: "user" | "community" | "tag" | "post" | "platform";
  label: string;
  sublabel?: string;
  data: Record<string, unknown>;
  indexedAt: number;
  visitCount: number;
}

export interface MeshiExplorationState {
  totalNodesVisited: number;
  totalExplorations: number;
  lastExplorationAt: number;
  knowledgeLevel: number; // 1-10, increases as Meshi explores more
  entries: Record<string, MeshiKnowledgeEntry>;
}

const STORAGE_KEY = "meshi-knowledge";

function getDefaultState(): MeshiExplorationState {
  return {
    totalNodesVisited: 0,
    totalExplorations: 0,
    lastExplorationAt: 0,
    knowledgeLevel: 1,
    entries: {},
  };
}

export function loadKnowledge(): MeshiExplorationState {
  if (typeof window === "undefined") return getDefaultState();
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as MeshiExplorationState;
      return parsed;
    }
  } catch { /* ignore */ }
  return getDefaultState();
}

export function saveKnowledge(state: MeshiExplorationState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* ignore - quota exceeded etc */ }
}

/** Index a node that Meshi has visited/explored */
export function indexNode(
  state: MeshiExplorationState,
  node: {
    id: string;
    type: "user" | "community" | "tag" | "post" | "platform";
    label: string;
    sublabel?: string;
    data?: Record<string, unknown>;
  }
): MeshiExplorationState {
  const existing = state.entries[node.id];
  const now = Date.now();
  
  const entry: MeshiKnowledgeEntry = {
    id: node.id,
    type: node.type,
    label: node.label,
    sublabel: node.sublabel,
    data: { ...(existing?.data || {}), ...(node.data || {}) },
    indexedAt: existing?.indexedAt || now,
    visitCount: (existing?.visitCount || 0) + 1,
  };

  const newEntries = { ...state.entries, [node.id]: entry };
  const totalNodesVisited = Object.keys(newEntries).length;
  
  // Knowledge level increases with more indexed nodes
  // Level 1: 0-5, Level 2: 6-15, Level 3: 16-30, etc.
  const knowledgeLevel = Math.min(10, Math.floor(Math.sqrt(totalNodesVisited / 2)) + 1);

  return {
    ...state,
    entries: newEntries,
    totalNodesVisited,
    totalExplorations: state.totalExplorations + 1,
    lastExplorationAt: now,
    knowledgeLevel,
  };
}

/** Bulk index multiple nodes (e.g., when Meshi explores the whole mesh) */
export function indexMeshData(
  state: MeshiExplorationState,
  nodes: Array<{
    id: string;
    type: "user" | "community" | "tag" | "post" | "platform";
    label: string;
    sublabel?: string;
    data?: Record<string, unknown>;
  }>
): MeshiExplorationState {
  let current = state;
  for (const node of nodes) {
    current = indexNode(current, node);
  }
  return current;
}

/** Query the knowledge system - returns matching entries */
export function queryKnowledge(
  state: MeshiExplorationState,
  query: string
): MeshiKnowledgeEntry[] {
  const q = query.toLowerCase().trim();
  const entries = Object.values(state.entries);
  
  return entries.filter((entry) => {
    const label = entry.label.toLowerCase();
    const sublabel = (entry.sublabel || "").toLowerCase();
    return label.includes(q) || sublabel.includes(q);
  });
}

/** Answer a mesh question using indexed knowledge */
export function answerMeshQuestion(
  state: MeshiExplorationState,
  question: string
): { answer: string; confidence: "high" | "medium" | "low"; mood: string } {
  const q = question.toLowerCase().trim();
  const entries = Object.values(state.entries);
  
  // Count queries
  const userEntries = entries.filter((e) => e.type === "user");
  const communityEntries = entries.filter((e) => e.type === "community");
  const tagEntries = entries.filter((e) => e.type === "tag");
  const postEntries = entries.filter((e) => e.type === "post");
  const platformEntries = entries.filter((e) => e.type === "platform");

  // "how many" questions
  if (q.includes("how many")) {
    if (q.includes("post")) {
      return {
        answer: `I've indexed ${postEntries.length} post${postEntries.length !== 1 ? "s" : ""} on your mesh so far! ${postEntries.length === 0 ? "Let me explore more to find them." : ""}`,
        confidence: postEntries.length > 0 ? "high" : "low",
        mood: postEntries.length > 0 ? "excited" : "thinking",
      };
    }
    if (q.includes("people") || q.includes("person") || q.includes("follow") || q.includes("user") || q.includes("connection")) {
      return {
        answer: `I've found ${userEntries.length} people on your mesh! ${userEntries.length > 3 ? `Including ${userEntries.slice(0, 3).map((u) => u.label).join(", ")} and more.` : ""}`,
        confidence: userEntries.length > 0 ? "high" : "low",
        mood: userEntries.length > 0 ? "excited" : "thinking",
      };
    }
    if (q.includes("communit")) {
      return {
        answer: `You're part of ${communityEntries.length} communit${communityEntries.length !== 1 ? "ies" : "y"}!${communityEntries.length > 0 ? ` Like ${communityEntries.slice(0, 2).map((c) => c.label).join(" and ")}.` : ""}`,
        confidence: communityEntries.length > 0 ? "high" : "low",
        mood: communityEntries.length > 0 ? "happy" : "thinking",
      };
    }
    if (q.includes("platform") || q.includes("connect")) {
      return {
        answer: `You have ${platformEntries.length} platform${platformEntries.length !== 1 ? "s" : ""} connected!${platformEntries.length > 0 ? ` ${platformEntries.map((p) => p.label).join(", ")}.` : ""}`,
        confidence: platformEntries.length > 0 ? "high" : "low",
        mood: platformEntries.length > 0 ? "cool" : "thinking",
      };
    }
    if (q.includes("interest") || q.includes("tag")) {
      return {
        answer: `I found ${tagEntries.length} interest${tagEntries.length !== 1 ? "s" : ""} on your mesh!${tagEntries.length > 0 ? ` Including ${tagEntries.slice(0, 3).map((t) => t.label).join(", ")}.` : ""}`,
        confidence: tagEntries.length > 0 ? "high" : "low",
        mood: "happy",
      };
    }
  }

  // "is [person] on my mesh" / "who is [person]"
  const personMatch = q.match(/(?:is|who is|who's|find|where is|do i (?:know|follow))\s+@?(.+?)(?:\s+on|\s+in|\?|$)/i);
  if (personMatch) {
    const searchTerm = personMatch[1].trim().replace(/^@/, "");
    const found = entries.find(
      (e) =>
        e.label.toLowerCase().includes(searchTerm) ||
        (e.sublabel && e.sublabel.toLowerCase().includes(searchTerm))
    );
    if (found) {
      const typeLabel = found.type === "user" ? "person" : found.type;
      return {
        answer: `Yes! ${found.label}${found.sublabel ? ` (${found.sublabel})` : ""} is on your mesh as a ${typeLabel}. I've seen them ${found.visitCount} time${found.visitCount !== 1 ? "s" : ""} while exploring!`,
        confidence: "high",
        mood: "excited",
      };
    }
    return {
      answer: `I haven't found "${searchTerm}" on your mesh yet. They might not be in my knowledge base yet - let me explore more!`,
      confidence: "low",
      mood: "thinking",
    };
  }

  // "how many posts is @X in" / "@X mentions"
  const mentionMatch = q.match(/@(\w+).*(?:post|mention|appear|in)/i);
  if (mentionMatch) {
    const username = mentionMatch[1].toLowerCase();
    const found = entries.find(
      (e) => e.sublabel && e.sublabel.toLowerCase().includes(username)
    );
    if (found) {
      const postData = found.data as Record<string, unknown>;
      const postCount = (postData.postCount as number) || 0;
      return {
        answer: `${found.label} (${found.sublabel}) has ${postCount} post${postCount !== 1 ? "s" : ""} on your mesh. They've been quite active!`,
        confidence: "high",
        mood: "excited",
      };
    }
    return {
      answer: `I don't have data on @${username} yet. Let me explore your mesh more to find them!`,
      confidence: "low",
      mood: "thinking",
    };
  }

  // General mesh summary
  if (q.includes("summary") || q.includes("overview") || q.includes("tell me about my mesh") || q.includes("what do you know")) {
    const total = entries.length;
    if (total === 0) {
      return {
        answer: "I haven't explored your mesh much yet! Give me a moment and I'll index everything I can find.",
        confidence: "low",
        mood: "thinking",
      };
    }
    return {
      answer: `Here's what I know about your mesh (Knowledge Level ${state.knowledgeLevel}/10): ${userEntries.length} people, ${communityEntries.length} communities, ${tagEntries.length} interests, ${postEntries.length} posts, and ${platformEntries.length} platforms. I've explored ${state.totalExplorations} nodes total!`,
      confidence: "high",
      mood: "excited",
    };
  }

  // Fallback
  return {
    answer: `I'm still learning about your mesh (Level ${state.knowledgeLevel}/10)! I know about ${entries.length} things so far. Ask me about specific people, communities, or say "mesh summary" for an overview!`,
    confidence: "medium",
    mood: "happy",
  };
}

/** Get Meshi's knowledge level description */
export function getKnowledgeLevelDescription(level: number): string {
  const descriptions: Record<number, string> = {
    1: "Just getting started",
    2: "Learning the basics",
    3: "Getting familiar",
    4: "Building connections",
    5: "Well-informed",
    6: "Expert navigator",
    7: "Mesh master",
    8: "All-seeing",
    9: "Omniscient",
    10: "Legendary explorer",
  };
  return descriptions[level] || "Exploring...";
}
