import {
  createMeshiOfflineResponse,
  normalizeMeshiMood,
  type MeshiContext,
  type MeshiHistoryMessage,
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
