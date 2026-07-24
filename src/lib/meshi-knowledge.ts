/**
 * Meshi Knowledge System
 * 
 * Meshi gets smarter the more it explores the mesh.
 * Knowledge is stored in localStorage and accumulates over time.
 * Meshi can answer questions about the user's mesh based on indexed data.
 */

interface MeshiKnowledgeEntry {
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
      const parsed = JSON.parse(stored) as Partial<MeshiExplorationState> | null;
      // Validate/merge over defaults: a legacy or corrupted value missing
      // `entries` would otherwise crash indexNode (state.entries[node.id]).
      if (parsed && typeof parsed === "object") {
        return {
          ...getDefaultState(),
          ...parsed,
          entries: parsed.entries && typeof parsed.entries === "object" ? parsed.entries : {},
        };
      }
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

/** Index a node that Meshi has visited/explored.
 *  When `incrementVisit` is false (used by bulk auto-indexing), visitCount
 *  and totalExplorations are NOT incremented — only new entries are upserted.
 */
function indexNode(
  state: MeshiExplorationState,
  node: {
    id: string;
    type: "user" | "community" | "tag" | "post" | "platform";
    label: string;
    sublabel?: string;
    data?: Record<string, unknown>;
  },
  incrementVisit = true
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
    visitCount: incrementVisit ? (existing?.visitCount || 0) + 1 : (existing?.visitCount || 0),
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
    totalExplorations: incrementVisit ? state.totalExplorations + 1 : state.totalExplorations,
    lastExplorationAt: now,
    knowledgeLevel,
  };
}

/** Bulk index multiple nodes (e.g., when Meshi auto-indexes the whole mesh).
 *  Does NOT inflate visitCount or totalExplorations per-node — only upserts data
 *  and increments totalExplorations by 1 for the entire pass.
 */
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
    current = indexNode(current, node, false);
  }
  // Count 1 exploration pass for the entire bulk index, not per-node
  return {
    ...current,
    totalExplorations: current.totalExplorations + 1,
  };
}

/** Query the knowledge system - returns matching entries */

/** Answer a mesh question using indexed knowledge */

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
