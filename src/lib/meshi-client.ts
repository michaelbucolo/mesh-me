import {
  createMeshiOfflineResponse,
  normalizeMeshiMood,
  type MeshiContext,
  type MeshiHistoryMessage,
  type MeshiMood,
  type MeshiResponse,
} from "./meshi-shared";

export interface AskMeshiInput {
  message: string;
  context?: MeshiContext;
  history?: MeshiHistoryMessage[];
  signal?: AbortSignal;
}

function normalizeResponse(data: Partial<MeshiResponse>): MeshiResponse {
  return {
    content: typeof data.content === "string" && data.content.trim()
      ? data.content
      : "I could not form a safe answer from that response. Try asking me again.",
    mood: normalizeMeshiMood(data.mood, "thinking"),
    action: data.action,
    source: data.source ?? "local",
    model: data.model,
    meshi: data.meshi ?? {
      identity: "mascot-user-vessel",
      engineReady: false,
      grounded: false,
    },
  };
}

export async function askMeshi(input: AskMeshiInput): Promise<MeshiResponse> {
  try {
    const response = await fetch("/api/meshi/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: input.message,
        context: input.context,
        history: input.history,
      }),
      signal: input.signal,
    });

    if (response.status === 401) {
      return {
        ...createMeshiOfflineResponse(),
        content: "Please log in to use Meshi. Mesh.me keeps Meshi tied to a real account so your private Mesh stays protected.",
      };
    }

    if (!response.ok) return createMeshiOfflineResponse();
    return normalizeResponse(await response.json().catch(() => ({})));
  } catch {
    return createMeshiOfflineResponse();
  }
}

export interface MeshiActionRequest {
  action: "post" | "message" | "follow" | "unfollow" | "react" | "suggest";
  content?: string;
  communityId?: string;
  tags?: string[];
  recipientId?: string;
  messageContent?: string;
  targetUserId?: string;
  postId?: string;
  reactionType?: string;
  suggestionType?: "people" | "communities" | "content";
}

export interface MeshiActionResult {
  success: boolean;
  message: string;
  mood: MeshiMood;
  data?: unknown;
}

/**
 * Execute a vessel action on the user's behalf through /api/meshi/actions.
 * Always resolves — failures come back as a spoken-style message so Meshi
 * can report them in its own voice instead of throwing.
 */
export async function runMeshiAction(request: MeshiActionRequest): Promise<MeshiActionResult> {
  try {
    const response = await fetch("/api/meshi/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });

    const data = (await response.json().catch(() => ({}))) as {
      success?: boolean;
      message?: string;
      mood?: unknown;
      error?: string;
      data?: unknown;
    };

    if (!response.ok || !data.success) {
      return {
        success: false,
        message: data.error
          ? `I couldn't do that: ${data.error.toLowerCase()}.`
          : "I couldn't complete that action right now. Try again in a moment.",
        mood: "thinking",
      };
    }

    return {
      success: true,
      message: data.message || "Done!",
      mood: normalizeMeshiMood(data.mood, "happy"),
      data: data.data,
    };
  } catch {
    return {
      success: false,
      message: "I couldn't reach the mesh to do that. Your request stayed private — try again in a moment.",
      mood: "thinking",
    };
  }
}
