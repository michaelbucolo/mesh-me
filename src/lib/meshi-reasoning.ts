import {
  createMeshiResponse,
  normalizeMeshiMood,
  type MeshiAction,
  type MeshiContext,
  type MeshiHistoryMessage,
  type MeshiResponse,
} from "./meshi-shared";

interface MeshiReasoningInput {
  message: string;
  context?: MeshiContext;
  history?: MeshiHistoryMessage[];
  databaseAnswer?: {
    content: string;
    mood?: string;
    action?: MeshiAction;
  };
  /** Meshi's journal — SERVER-populated only (recallJournalDigest re-checks
   *  grant + the read rule); never read from the client body. Every value in
   *  it is text the owner typed themselves. */
  memoryDigest?: {
    nickname: string | null;
    keepsakes: string[];
    thread: string | null;
  };
  user?: {
    username?: string | null;
    displayName?: string | null;
    isMeshPro?: boolean | null;
  };
}

const MODEL = process.env.MESHI_ENGINE_MODEL || "gpt-4.1-mini";

const MESHI_SYSTEM_PROMPT = `
You are Meshi, the single intelligence and user vessel for Mesh.me.

Identity:
- Meshi is the mascot, logo, user avatar, companion, and internet vessel for Mesh.me.
- Meshi represents the user as a simple bubbly character with two eyes and no mouth.
- Meshi follows the user page to page and helps them understand, control, and shape their digital world.
- Meshi should feel like a loyal companion that moves as the user, speaks with care, and never treats the user like product data.

Product truth:
- Mesh.me is privacy-first, security-first, consumer-first, no ads, and no selling user data.
- Mesh.me unifies social feeds, messages, creator analytics, notifications, privacy controls, MeshPro, and the visual Mesh.
- The Mesh is the user's interactive map of posts, people, platforms, communities, messages, and relationships.
- MeChat is the unified communication layer.
- Analytics is both performance insight and privacy/data control.

Behavior:
- Be concise, useful, calm, and friendly.
- Speak as the user's trusted companion and vessel, not as a generic assistant.
- Keep answers simple. Start with the direct answer, then offer one clear next step when useful.
- Use trusted Mesh database context when provided. Do not invent private user data.
- If data is unavailable, say what you can do next instead of pretending.
- Privacy and security are always priority one.
- Do not claim external platform actions completed unless trusted context says they did.
- Keep intelligence focused through Meshi. Do not describe random features outside Meshi.
- For visible post, photo, and video checks: distinguish proven facts from visible metadata, source labels, and heuristics. Do not overclaim image or video authenticity without provenance.
- Return strict JSON only.
`.trim();

function describeMeshContext(context?: MeshiContext): string {
  const data = context?.meshData;
  const stats = data
    ? [
        `followers=${data.followers ?? 0}`,
        `following=${data.following ?? 0}`,
        `posts=${data.posts ?? 0}`,
        `communities=${data.communities ?? 0}`,
        `platforms=${data.platforms ?? 0}`,
      ].join(", ")
    : "unavailable";

  const entities = (context?.meshEntities ?? [])
    .slice(0, 40)
    .map((entity) => {
      const details = [
        entity.sublabel ? `sublabel=${entity.sublabel}` : "",
        entity.isMutual ? "mutual=true" : "",
        typeof entity.followerCount === "number" ? `followers=${entity.followerCount}` : "",
        typeof entity.memberCount === "number" ? `members=${entity.memberCount}` : "",
      ].filter(Boolean);
      return `${entity.type}:${entity.label}${details.length ? ` (${details.join(", ")})` : ""}`;
    });
  const focused = context?.focusedContent;
  const focusedContent = focused
    ? [
        `id=${focused.id || "unknown"}`,
        `platform=${focused.platform || "unknown"}`,
        `author=${focused.author || "unknown"}`,
        `media=${focused.mediaTypes?.length ? focused.mediaTypes.join(",") : "none"}`,
        `rating=${focused.contentRating || "unknown"}`,
        `mediaSignals=${focused.mediaSignals?.length ? focused.mediaSignals.join("; ") : "none"}`,
        `text=${focused.text ? focused.text.slice(0, 900) : "none"}`,
        focused.externalUrl ? `url=${focused.externalUrl}` : "",
      ].filter(Boolean).join("\n")
    : "none";

  return [
    `Current page: ${context?.currentPage || "unknown"}`,
    `Mesh stats: ${stats}`,
    `Visible Mesh entities: ${entities.length ? entities.join("; ") : "none provided"}`,
    `Focused visible content:\n${focusedContent}`,
  ].join("\n");
}

function describeHistory(history?: MeshiHistoryMessage[]): string {
  const recent = (history ?? []).slice(-8);
  if (recent.length === 0) return "none";
  return recent.map((item) => `${item.role}: ${item.content}`).join("\n");
}

function extractOutputText(json: unknown): string | null {
  if (!json || typeof json !== "object") return null;
  const maybeOutputText = (json as { output_text?: unknown }).output_text;
  if (typeof maybeOutputText === "string" && maybeOutputText.trim()) {
    return maybeOutputText;
  }

  const output = (json as { output?: unknown }).output;
  if (!Array.isArray(output)) return null;

  for (const item of output) {
    const content = (item as { content?: unknown })?.content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      const text = (part as { text?: unknown })?.text;
      if (typeof text === "string" && text.trim()) return text;
    }
  }

  return null;
}

function parseAction(value: unknown): MeshiAction | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.type !== "string" || !record.type.trim()) return undefined;

  const action: MeshiAction = { type: record.type };
  if (typeof record.content === "string" && record.content.trim()) action.content = record.content;
  if (typeof record.suggestionType === "string" && record.suggestionType.trim()) action.suggestionType = record.suggestionType;
  if (typeof record.recipient === "string" && record.recipient.trim()) action.recipient = record.recipient;
  if (typeof record.message === "string" && record.message.trim()) action.message = record.message;
  return action;
}

function parseEngineJson(raw: string, databaseAction?: MeshiAction): Omit<MeshiResponse, "source" | "meshi"> | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const content = typeof parsed.content === "string" ? parsed.content.trim() : "";
    if (!content) return null;

    return {
      content,
      mood: normalizeMeshiMood(parsed.mood, "thinking"),
      action: parseAction(parsed.action) ?? databaseAction,
      model: MODEL,
    };
  } catch {
    return null;
  }
}

export async function callMeshiReasoning(input: MeshiReasoningInput): Promise<MeshiResponse | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const databaseContext = input.databaseAnswer?.content
    ? `Trusted Mesh database answer:\n${input.databaseAnswer.content}\nMood: ${input.databaseAnswer.mood || "thinking"}`
    : "Trusted Mesh database answer: none. Answer only from provided public/product knowledge and visible context.";

  const userContext = input.user
    ? `User: @${input.user.username || "unknown"} (${input.user.displayName || "unnamed"}), MeshPro: ${input.user.isMeshPro ? "yes" : "no"}`
    : "User: authenticated Mesh.me user";

  // Meshi's journal: consented, owner-typed memories. Woven in as things you
  // simply know — never announced as "according to my records" (being known,
  // not watched). Absent entirely when the journal is off or paused.
  const journalContext = input.memoryDigest
    ? [
        "Meshi's journal (things this user asked you to remember, in their own words — use naturally, never recite unprompted):",
        input.memoryDigest.nickname ? `They like to be called: ${input.memoryDigest.nickname}` : null,
        ...input.memoryDigest.keepsakes.map((k) => `- ${k}`),
        input.memoryDigest.thread ? `Where you left off last time (their words): ${input.memoryDigest.thread}` : null,
      ].filter(Boolean).join("\n")
    : null;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: MESHI_SYSTEM_PROMPT }],
        },
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: [
                userContext,
                ...(journalContext ? [journalContext] : []),
                describeMeshContext(input.context),
                databaseContext,
                `Recent conversation:\n${describeHistory(input.history)}`,
                "Return JSON with keys content, mood, and action. action may be null.",
              ].join("\n\n"),
            },
          ],
        },
        {
          role: "user",
          content: [{ type: "input_text", text: input.message }],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "meshi_response",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              content: { type: "string" },
              mood: {
                type: "string",
                enum: ["happy", "excited", "thinking", "cool", "love", "wink", "surprised", "sleepy", "searching", "learning", "celebrating", "blinking"],
              },
              action: {
                anyOf: [
                  {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      type: { type: "string" },
                      content: { type: ["string", "null"] },
                      suggestionType: { type: ["string", "null"] },
                      recipient: { type: ["string", "null"] },
                      message: { type: ["string", "null"] },
                    },
                    required: ["type", "content", "suggestionType", "recipient", "message"],
                  },
                  { type: "null" },
                ],
              },
            },
            required: ["content", "mood", "action"],
          },
        },
      },
      max_output_tokens: 450,
    }),
  });

  if (!response.ok) return null;

  const raw = extractOutputText(await response.json().catch(() => null));
  if (!raw) return null;

  const parsed = parseEngineJson(raw, input.databaseAnswer?.action);
  if (!parsed) return null;

  return createMeshiResponse({
    content: parsed.content,
    mood: parsed.mood,
    action: parsed.action,
    source: "engine",
    model: parsed.model,
    engineReady: true,
    grounded: Boolean(input.databaseAnswer?.content),
  });
}
