"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence, useAnimationControls } from "framer-motion";
import { usePathname } from "next/navigation";
import { Send } from "lucide-react";
import {
  MeshiMascot,
  type MeshiAccessory,
  type MeshiBadge,
  type MeshiColor,
  type MeshiEyeStyle,
  type MeshiHair,
  type MeshiHat,
  type MeshiMood,
  type MeshiProp,
  PAGE_PROPS,
} from "./meshi-mascot";
import { MeshiChat } from "./meshi-chat";
import { MeshiActionsMenu } from "./meshi-actions-menu";
import { useCanvasHasMeshi } from "@/components/mesh/live/meshi-presence";
import { askMeshi, runMeshiAction } from "@/lib/meshi-client";
import type { MeshiAction, MeshiHistoryMessage } from "@/lib/meshi-shared";
import { getMeshGraphData, type MeshGraphEntity } from "@/lib/queries";
import { getMeshiPreference } from "@/lib/actions";
import {
  loadKnowledge, saveKnowledge, indexMeshData,
  getKnowledgeLevelDescription, type MeshiExplorationState,
} from "@/lib/meshi-knowledge";
import {
  areFocusedContentEqual,
  getFocusedContentFromElement,
  getVisibleFocusedContent,
  type FocusedContent,
} from "@/lib/meshi-content";
import { impactFeedback } from "@/lib/native/haptics";
import {
  MESHI_OPEN_EVENT,
  MESHI_PROMPT_EVENT,
  type MeshiOpenMode,
  type MeshiPromptDetail,
} from "@/lib/meshi-events";
import { reactionFor, subscribeMeshiCause } from "@/lib/meshi-bus";
import { shouldHideGlobalMeshi } from "@/lib/meshi-routes";
import { MESHI_PREFERENCES_EVENT, type MeshiPreferences } from "@/hooks/use-meshi-preferences";

// Meshi is chrome, not a character in the user's feed. One instance, docked in
// the corner (CSS owns the position — see `.meshi-float-shell` in globals.css),
// silent until opened. It used to trail the pointer, dodge scrolls, fly to a
// per-route arrival point and hold a permanent "Tap" balloon; all of that was
// the product performing for the user instead of waiting for them. The face
// still reacts to real causes (meshi-bus) and to typing/idleness, because a
// docked character that never blinks is a sticker — but it no longer moves,
// and it speaks only inside its own opened panel.

// The contextual prop for a route. Uses a most-specific-first prefix match so
// sub-routes (e.g. "/feed/abc") keep the prop; indexing PAGE_PROPS by the
// exact pathname dropped it on every sub-route.
function getContextualProp(pathname: string): MeshiProp {
  const key = Object.keys(PAGE_PROPS)
    .sort((a, b) => b.length - a.length)
    .find((k) => pathname.startsWith(k));
  return key ? PAGE_PROPS[key] : "none";
}

// On the Mesh, the canvas renders the single living Meshi (the user's avatar
// inside the world). The floating DOM body must yield to it so only ONE Meshi
// is ever visible — they are the same entity. Chat stays available as a modal.
//
// BEING ON /mesh IS NOT THE SAME AS THE CANVAS HAVING HIM. The pathname flips
// on the first frame of the navigation; the canvas Meshi does not exist until
// the mesh request returns. The path says WHERE to look; meshi-presence says
// whether he is actually there, and the handoff waits for that.
function isMeshSurfacePath(pathname: string) {
  return pathname === "/mesh" || pathname.startsWith("/mesh/");
}

const SEARCH_TRIGGERS = ["search", "find", "look for", "where", "show me"];

type MeshiView = "closed" | "actions" | "speech" | "chat";

const MESHI_SIZE = 44;

const MESHI_CONTINUITY_KEY = "meshi-continuity-state";
const MESHI_INSTANCE_ID_KEY = "meshi-instance-id";
// v2: the dock is CSS-fixed, so continuity no longer stores a position. Old
// v1 blobs (which did) fail the version check and are discarded cleanly.
const MESHI_CONTINUITY_STATE_VERSION = 2 as const;
const MESHI_CONTINUITY_MAX_AGE_MS = 10 * 60 * 1000;
const MESHI_VIEW_VALUES = new Set<MeshiView>(["closed", "actions", "speech", "chat"]);

type MeshiContinuityState = {
  version: typeof MESHI_CONTINUITY_STATE_VERSION;
  instanceId: string;
  updatedAt: number;
  pathname: string;
  view: MeshiView;
  mood: MeshiMood;
  activeProp: MeshiProp;
};

function getOrCreateMeshiInstanceId() {
  if (typeof window === "undefined") return "meshi-server-instance";
  const existing = window.localStorage.getItem(MESHI_INSTANCE_ID_KEY);
  if (existing) return existing;

  const next =
    window.crypto?.randomUUID?.() ||
    `meshi-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(MESHI_INSTANCE_ID_KEY, next);
  return next;
}

function readMeshiContinuityState(): MeshiContinuityState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(MESHI_CONTINUITY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<MeshiContinuityState>;
    const age = Date.now() - (typeof parsed.updatedAt === "number" ? parsed.updatedAt : 0);

    if (
      parsed.version !== MESHI_CONTINUITY_STATE_VERSION ||
      !parsed.instanceId ||
      age > MESHI_CONTINUITY_MAX_AGE_MS
    ) {
      return null;
    }

    return {
      version: MESHI_CONTINUITY_STATE_VERSION,
      instanceId: parsed.instanceId,
      updatedAt: parsed.updatedAt || Date.now(),
      pathname: typeof parsed.pathname === "string" ? parsed.pathname : "",
      view: MESHI_VIEW_VALUES.has(parsed.view as MeshiView) ? (parsed.view as MeshiView) : "closed",
      mood: (parsed.mood || "happy") as MeshiMood,
      activeProp: (parsed.activeProp || "none") as MeshiProp,
    };
  } catch {
    return null;
  }
}

function writeMeshiContinuityState(state: MeshiContinuityState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MESHI_CONTINUITY_KEY, JSON.stringify(state));
  } catch {
    // Continuity is nice to have; storage limits should never break Meshi.
  }
}

export function MeshiFloat() {
  const [initialContinuity] = useState<MeshiContinuityState | null>(() => readMeshiContinuityState());
  const [instanceId] = useState(() => getOrCreateMeshiInstanceId());

  const [isMounted, setIsMounted] = useState(false);
  const [meshiEnabled, setMeshiEnabled] = useState(() => {
    if (typeof window === "undefined") return true;
    try { return localStorage.getItem("meshiEnabled") !== "false"; } catch { return true; }
  });
  const [view, setView] = useState<MeshiView>(() => initialContinuity?.view ?? "closed");

  const [mood, setMood] = useState<MeshiMood>(() => {
    if (initialContinuity?.mood) return initialContinuity.mood;
    if (typeof window === "undefined") return "happy";
    try { return (localStorage.getItem("meshiFace") || "happy") as MeshiMood; } catch { return "happy" as MeshiMood; }
  });
  const [meshiColor, setMeshiColor] = useState<MeshiColor>(() => {
    if (typeof window === "undefined") return "blue";
    try { return (localStorage.getItem("meshiColor") || "blue") as MeshiColor; } catch { return "blue" as MeshiColor; }
  });
  const [meshiHat, setMeshiHat] = useState<MeshiHat>(() => {
    if (typeof window === "undefined") return "none";
    try { return (localStorage.getItem("meshiHat") || "none") as MeshiHat; } catch { return "none" as MeshiHat; }
  });
  const [meshiHair, setMeshiHair] = useState<MeshiHair>(() => {
    if (typeof window === "undefined") return "none";
    try { return (localStorage.getItem("meshiHair") || "none") as MeshiHair; } catch { return "none" as MeshiHair; }
  });
  const [meshiAccessory, setMeshiAccessory] = useState<MeshiAccessory>(() => {
    if (typeof window === "undefined") return "none";
    try {
      const storedAccessory = localStorage.getItem("meshiAccessory");
      return ((storedAccessory === "lashes" ? "none" : storedAccessory) || "none") as MeshiAccessory;
    } catch { return "none" as MeshiAccessory; }
  });
  const [meshiEye, setMeshiEye] = useState<MeshiEyeStyle>(() => {
    if (typeof window === "undefined") return "regular";
    try {
      return ((localStorage.getItem("meshiEye") || (localStorage.getItem("meshiAccessory") === "lashes" ? "lashes" : "")) || "regular") as MeshiEyeStyle;
    } catch { return "regular" as MeshiEyeStyle; }
  });
  const [meshiBadge, setMeshiBadge] = useState<MeshiBadge>(() => {
    if (typeof window === "undefined") return "none";
    try { return (localStorage.getItem("meshiBadge") || "none") as MeshiBadge; } catch { return "none" as MeshiBadge; }
  });
  const [isSearching, setIsSearching] = useState(false);
  const [isFullscreenVideo, setIsFullscreenVideo] = useState(false);
  const [searchingText, setSearchingText] = useState("");
  const [focusedContent, setFocusedContent] = useState<FocusedContent | null>(null);
  const [chatHistory, setChatHistory] = useState<Array<{ q: string; a: string; time: Date }>>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem("meshi-chat-history");
      if (!raw) return [];
      const parsed = JSON.parse(raw) as Array<{ q: string; a: string; time: string }>;
      return parsed.map((entry) => ({ ...entry, time: new Date(entry.time) }));
    } catch {
      return [];
    }
  });

  const [meshEntities, setMeshEntities] = useState<MeshGraphEntity[]>([]);
  const [meshStats, setMeshStats] = useState<{ followers: number; following: number; posts: number; communities: number; platforms: number }>({ followers: 0, following: 0, posts: 0, communities: 0, platforms: 0 });
  const [knowledge, setKnowledge] = useState<MeshiExplorationState>(() => {
    if (typeof window === "undefined") return { totalNodesVisited: 0, totalExplorations: 0, lastExplorationAt: 0, knowledgeLevel: 1, entries: {} };
    return loadKnowledge();
  });
  const [isExploring, setIsExploring] = useState(false);
  const [explorationProgress, setExplorationProgress] = useState(0);

  const focusedContentRef = useRef<FocusedContent | null>(null);
  const explorationTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const speechBubbleTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const [isIdle, setIsIdle] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [activeProp, setActiveProp] = useState<MeshiProp>("none");
  const tapSquashControls = useAnimationControls();
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [speechBubbles, setSpeechBubbles] = useState<Array<{
    id: string; text: string; role: "user" | "meshi"; timestamp: number;
  }>>([]);
  const [speechInput, setSpeechInput] = useState("");
  const [isMeshiTyping, setIsMeshiTyping] = useState(false);
  // A vessel action Meshi proposed in speech mode that still needs the user's
  // go-ahead (currently: posting on their behalf).
  const [pendingSpeechAction, setPendingSpeechAction] = useState<MeshiAction | null>(null);
  const speechInputRef = useRef<HTMLInputElement>(null);

  const pathname = usePathname();
  const onMeshRoute = isMeshSurfacePath(pathname);
  // The canvas reports when it is actually drawing you. Until it does, the float
  // stays — so the walk into your mesh, the wait while it weaves, and the arrival
  // are one continuous character rather than three that replace each other.
  const canvasHasMeshi = useCanvasHasMeshi();
  const isMeshSurface = onMeshRoute && canvasHasMeshi;
  const isMeshSurfaceRef = useRef(isMeshSurface);
  useEffect(() => { isMeshSurfaceRef.current = isMeshSurface; }, [isMeshSurface]);

  // Flag the open chat/actions panel so the corner bug widget yields to it. The
  // flag must clear whenever the panel isn't actually visible — including when
  // Meshi is disabled or hidden on the current route — so it never lingers.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const panelVisible =
      isMounted &&
      meshiEnabled &&
      !shouldHideGlobalMeshi(pathname) &&
      (view === "chat" || view === "actions");
    if (panelVisible) {
      document.body.dataset.meshiPanel = "open";
    } else {
      delete document.body.dataset.meshiPanel;
    }
    return () => {
      delete document.body.dataset.meshiPanel;
    };
  }, [isMounted, meshiEnabled, pathname, view]);

  const persistContinuityState = useCallback(
    (patch: Partial<Omit<MeshiContinuityState, "version" | "instanceId" | "updatedAt">> = {}) => {
      if (!meshiEnabled) return;
      writeMeshiContinuityState({
        version: MESHI_CONTINUITY_STATE_VERSION,
        instanceId,
        updatedAt: Date.now(),
        pathname: patch.pathname || pathname,
        view: patch.view || view,
        mood: patch.mood || mood,
        activeProp: patch.activeProp || activeProp,
      });
    },
    [activeProp, instanceId, meshiEnabled, mood, pathname, view],
  );

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setIsMounted(true));
    const bubbleTimers = speechBubbleTimersRef.current;
    return () => {
      window.cancelAnimationFrame(frame);
      explorationTimersRef.current.forEach(clearTimeout);
      explorationTimersRef.current = [];
      for (const t of bubbleTimers.values()) clearTimeout(t);
      bubbleTimers.clear();
    };
  }, []);

  useEffect(() => {
    if (!isMounted || !meshiEnabled) return;
    persistContinuityState();
  }, [activeProp, isMounted, meshiEnabled, mood, pathname, persistContinuityState, view]);

  useEffect(() => {
    if (!meshiEnabled) return;

    const saveCurrentState = () => persistContinuityState();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") saveCurrentState();
    };

    window.addEventListener("pagehide", saveCurrentState);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("pagehide", saveCurrentState);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [meshiEnabled, persistContinuityState]);

  // In fullscreen video the docked body dims and closes its panels; the corner
  // position needs no correction because CSS owns it.
  useEffect(() => {
    const detectFullscreenVideo = () => {
      const element = document.fullscreenElement as HTMLElement | null;
      const videoActive = Boolean(
        element &&
        (element.tagName.toLowerCase() === "video" || element.querySelector("video"))
      );
      setIsFullscreenVideo(videoActive);
      if (videoActive) {
        setView("closed");
        const fullscreenContext = getFocusedContentFromElement(element) || getVisibleFocusedContent();
        if (fullscreenContext) {
          focusedContentRef.current = fullscreenContext;
          setFocusedContent(fullscreenContext);
        }
      }
    };

    document.addEventListener("fullscreenchange", detectFullscreenVideo);
    detectFullscreenVideo();
    return () => document.removeEventListener("fullscreenchange", detectFullscreenVideo);
  }, []);

  // Track the most-visible content card so chat and speech answers have the
  // right post in context. Tracking only — no popover; Meshi's content actions
  // live in the post's own ⋯ menu, which hands the exact post over via
  // MESHI_PROMPT_EVENT.
  useEffect(() => {
    if (!meshiEnabled || shouldHideGlobalMeshi(pathname)) return;
    let frame: number | null = null;

    const updateFocusedContent = () => {
      frame = null;
      const next = getVisibleFocusedContent();
      if (areFocusedContentEqual(focusedContentRef.current, next)) return;
      focusedContentRef.current = next;
      setFocusedContent(next);
    };

    const scheduleUpdate = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(updateFocusedContent);
    };

    scheduleUpdate();
    const interval = window.setInterval(scheduleUpdate, 2200);
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);

    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      window.clearInterval(interval);
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, [meshiEnabled, pathname]);

  useEffect(() => {
    if (!meshiEnabled) return;
    const timer = window.setTimeout(() => {
      getMeshiPreference().then((pref) => {
        if (pref) {
          if (pref.faceStyle) setMood(pref.faceStyle as MeshiMood);
          if (pref.colorTheme) setMeshiColor(pref.colorTheme as MeshiColor);
          if (pref.hatStyle) setMeshiHat(pref.hatStyle as MeshiHat);
          if (pref.hairStyle) setMeshiHair(pref.hairStyle as MeshiHair);
          if (pref.accessoryStyle) setMeshiAccessory(pref.accessoryStyle as MeshiAccessory);
          if (pref.eyeStyle) setMeshiEye(pref.eyeStyle as MeshiEyeStyle);
          if (pref.badgeStyle) setMeshiBadge(pref.badgeStyle as MeshiBadge);
        }
      }).catch(() => {});
    }, 900);
    return () => window.clearTimeout(timer);
  }, [meshiEnabled]);

  // Persist Meshi conversation memory
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(
        "meshi-chat-history",
        JSON.stringify(chatHistory.map((entry) => ({ ...entry, time: entry.time.toISOString() })))
      );
    } catch {
      // ignore storage errors
    }
  }, [chatHistory]);

  useEffect(() => {
    const applyPrefs = (prefs: Partial<MeshiPreferences>) => {
      if (prefs.color) setMeshiColor(prefs.color);
      if (prefs.hat) setMeshiHat(prefs.hat);
      if (prefs.hair) setMeshiHair(prefs.hair);
      if (prefs.accessory) setMeshiAccessory(prefs.accessory);
      if (prefs.eye) setMeshiEye(prefs.eye);
      if (prefs.badge) setMeshiBadge(prefs.badge);
      if (prefs.face) setMood(prefs.face);
      if (typeof prefs.enabled === "boolean") setMeshiEnabled(prefs.enabled);
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "meshiEnabled") setMeshiEnabled(e.newValue !== "false");
      if (e.key === "meshiColor") setMeshiColor((e.newValue || "blue") as MeshiColor);
      if (e.key === "meshiHat") setMeshiHat((e.newValue || "none") as MeshiHat);
      if (e.key === "meshiHair") setMeshiHair((e.newValue || "none") as MeshiHair);
      if (e.key === "meshiAccessory") setMeshiAccessory(((e.newValue === "lashes" ? "none" : e.newValue) || "none") as MeshiAccessory);
      if (e.key === "meshiEye") setMeshiEye((e.newValue || "regular") as MeshiEyeStyle);
      if (e.key === "meshiBadge") setMeshiBadge((e.newValue || "none") as MeshiBadge);
      if (e.key === "meshiFace") setMood((e.newValue || "happy") as MeshiMood);
    };
    const handlePreferenceEvent = (event: Event) => {
      const customEvent = event as CustomEvent<MeshiPreferences>;
      if (customEvent.detail) applyPrefs(customEvent.detail);
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(MESHI_PREFERENCES_EVENT, handlePreferenceEvent as EventListener);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(MESHI_PREFERENCES_EVENT, handlePreferenceEvent as EventListener);
    };
  }, []);

  // Load mesh data AND index it into knowledge system
  useEffect(() => {
    if (!meshiEnabled || view === "closed") return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      getMeshGraphData().then((data) => {
        if (!cancelled) {
          setMeshEntities(data.entities);
          setMeshStats(data.stats);
          // Auto-index mesh data into knowledge system
          if (data.entities.length > 0) {
            const nodes = data.entities.map((e) => ({
              id: e.id,
              type: e.type as "user" | "community" | "tag" | "post" | "platform",
              label: e.label,
              sublabel: e.sublabel || undefined,
              data: { followerCount: e.followerCount || 0, memberCount: e.memberCount || 0, isMutual: e.isMutual || false },
            }));
            setKnowledge((prev) => {
              const updated = indexMeshData(prev, nodes);
              saveKnowledge(updated);
              return updated;
            });
          }
        }
      }).catch(() => {});
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [meshiEnabled, view]);

  // Contextual prop follows the route; the body itself stays put.
  useEffect(() => {
    if (!meshiEnabled) return;
    const contextualProp = getContextualProp(pathname);
    queueMicrotask(() => setActiveProp(contextualProp));
  }, [pathname, meshiEnabled]);

  // Typing/idleness awareness: the docked face thinks while you type and dozes
  // when you've been away — reactions to the user's real state, not a timer
  // cycling expressions.
  useEffect(() => {
    if (!meshiEnabled) return;
    const armIdleTimer = () => {
      if (isIdle) setIsIdle(false);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => setIsIdle(true), 20000);
    };
    const handleKeyDown = () => {
      if (!isTyping) setIsTyping(true);
      armIdleTimer();
      if (view === "closed") setMood("thinking");
    };
    const handleKeyUp = () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => setIsTyping(false), 2000);
    };
    window.addEventListener("mousemove", armIdleTimer, { passive: true });
    window.addEventListener("keydown", handleKeyDown, { passive: true });
    window.addEventListener("keyup", handleKeyUp, { passive: true });
    window.addEventListener("pointerdown", armIdleTimer, { passive: true });
    idleTimerRef.current = setTimeout(() => setIsIdle(true), 20000);
    return () => {
      window.removeEventListener("mousemove", armIdleTimer);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("pointerdown", armIdleTimer);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, [meshiEnabled, isIdle, isTyping, view]);

  // Idle behavior
  useEffect(() => {
    if (!meshiEnabled || view !== "closed") return;
    if (isIdle) queueMicrotask(() => setMood("sleepy"));
    else if (isTyping) queueMicrotask(() => setMood("thinking"));
  }, [isIdle, isTyping, view, meshiEnabled]);

  // Meshi reacts to things that actually happened.
  //
  // This replaced an eight-second `setInterval` that cycled a per-route list of
  // moods — a character pulling faces on a timer while the user sat still,
  // which is what made Meshi read as decoration rather than as representing
  // anyone. Nothing here fires unless the product published a cause, so the
  // answer to "whose hand caused this?" is always a real one.
  useEffect(() => {
    if (!meshiEnabled) return;
    let settle: ReturnType<typeof setTimeout> | null = null;

    const unsubscribe = subscribeMeshiCause((cause) => {
      // A reaction is only legible on a Meshi the user can see doing nothing
      // else. While a panel is open, the face is not what the user is looking at.
      if (view !== "closed") return;

      const { mood: next, holdMs } = reactionFor(cause.kind);
      setMood(next);
      if (settle) clearTimeout(settle);
      // Return to itself afterwards. A face that holds an expression is posing,
      // not reacting.
      settle = setTimeout(() => setMood("happy"), holdMs);
    });

    return () => {
      unsubscribe();
      if (settle) clearTimeout(settle);
    };
  }, [meshiEnabled, view]);

  const addSpeechBubble = useCallback((role: "user" | "meshi", text: string) => {
    const id = Date.now().toString() + Math.random().toString(36).slice(2);
    setSpeechBubbles((prev) => [...prev.slice(-4), { id, text, role, timestamp: Date.now() }]);
    const timer = setTimeout(() => {
      setSpeechBubbles((prev) => prev.filter((b) => b.id !== id));
      speechBubbleTimersRef.current.delete(id);
    }, 12000);
    speechBubbleTimersRef.current.set(id, timer);
  }, []);

  // Meshi exploration — walks the mesh graph and indexes it. Status reads as
  // flat progress, not narration.
  const triggerExploration = useCallback(() => {
    setIsExploring(true);
    setIsSearching(true);
    setSearchingText("Scanning your mesh…");
    setMood("searching" as MeshiMood);
    setView("closed");
    setExplorationProgress(0);

    const totalSteps = 5;
    const stepDuration = 800;
    const messages = [
      "Reading connections…",
      "Indexing posts and communities…",
      "Indexing platforms…",
      "Updating notes…",
      "Finishing up…",
    ];

    explorationTimersRef.current.forEach(clearTimeout);
    explorationTimersRef.current = [];

    messages.forEach((msg, i) => {
      const t = setTimeout(() => {
        setSearchingText(msg);
        setExplorationProgress(((i + 1) / totalSteps) * 100);
        if (i === 1) setMood("learning" as MeshiMood);
        if (i === 3) setMood("thinking");
      }, i * stepDuration);
      explorationTimersRef.current.push(t);
    });

    const finishTimer = setTimeout(() => {
      setIsSearching(false);
      setIsExploring(false);
      setExplorationProgress(0);
      const stats = meshStats;
      const kLevel = knowledge.knowledgeLevel;
      const levelDesc = getKnowledgeLevelDescription(kLevel);
      const summary = stats.followers + stats.following + stats.posts > 0
        ? `Indexed ${stats.followers} followers, ${stats.following} following, ${stats.posts} posts and ${stats.communities} communities across ${stats.platforms} platforms. Knowledge level ${kLevel}/10 (${levelDesc}).`
        : "Nothing to index yet. Connect a platform to grow your mesh.";
      setMood("happy");
      setView("speech");
      addSpeechBubble("meshi", summary);
    }, totalSteps * stepDuration);
    explorationTimersRef.current.push(finishTimer);
  }, [meshStats, knowledge.knowledgeLevel, addSpeechBubble]);

  // Legacy triggerSearch now uses exploration
  const triggerSearch = triggerExploration;

  const submitSpeechPrompt = useCallback((rawText: string, contentOverride?: FocusedContent) => {
    const text = rawText.trim();
    if (!text || isMeshiTyping) return;
    const content = contentOverride ?? focusedContent;
    addSpeechBubble("user", text);
    setMood("thinking");
    setIsMeshiTyping(true);
    // A new prompt supersedes any unconfirmed vessel action from the last one.
    setPendingSpeechAction(null);

    const q = text.toLowerCase();
    const isSearchQuery = SEARCH_TRIGGERS.some((trigger) => q.includes(trigger));
    const isExploreQuery = q.includes("explore") || q.includes("index") || q.includes("learn more");
    const isFocusedContentQuery = Boolean(content && (
      q.includes("this post") ||
      q.includes("visible post") ||
      q.includes("this video") ||
      q.includes("this photo") ||
      q.includes("this image") ||
      q.includes("fact") ||
      q.includes("summar") ||
      q.includes("verify") ||
      q.includes("generated") ||
      q.includes("media") ||
      q.includes("authenticity")
    ));
    const isMeshQuery = q.includes("how many") || q.includes("who is") || q.includes("find ") || q.includes("@") ||
      q.includes("tell me about my mesh") || q.includes("summary") || q.includes("what do you know") || q.includes("knowledge level");
    const isInspectQuery = (pathname === "/mesh") && (
      q.includes("who is") ||
      q.includes("tell me about") ||
      q.includes("inspect") ||
      q.includes("look up")
    );

    const shouldAnimateSearch = !isSearching && (isMeshQuery || isSearchQuery || isExploreQuery || isInspectQuery || isFocusedContentQuery);
    if (shouldAnimateSearch) {
      setIsSearching(true);
      setSearchingText(isFocusedContentQuery ? "Checking the post…" : isExploreQuery ? "Scanning your mesh…" : "Searching…");
      setMood("searching" as MeshiMood);
      setView("closed");
      setActiveProp("magnifying-glass");
      setTimeout(() => {
        setSearchingText(isFocusedContentQuery ? "Reviewing source and media clues…" : "Working…");
        setActiveProp(isFocusedContentQuery ? "notebook" : PAGE_PROPS["/mesh"] || "compass");
        setMood("learning" as MeshiMood);
      }, 700);
    }

    const history: MeshiHistoryMessage[] = chatHistory.slice(-6).flatMap((entry) => [
      { role: "user" as const, content: entry.q },
      { role: "meshi" as const, content: entry.a },
    ]);

    const startedAt = Date.now();
    void (async () => {
      const response = await askMeshi({
        message: text,
        context: {
          meshData: meshStats,
          meshEntities: meshEntities.slice(0, 50),
          focusedContent: content || undefined,
          currentPage: pathname,
        },
        history,
      });

      const elapsed = Date.now() - startedAt;
      if (shouldAnimateSearch && elapsed < 900) {
        await new Promise((resolve) => setTimeout(resolve, 900 - elapsed));
      }

      if (shouldAnimateSearch) {
        setIsSearching(false);
        setIsExploring(false);
        setExplorationProgress(0);
        setView("speech");
      }

      setMood(response.mood as MeshiMood);
      addSpeechBubble("meshi", response.content);
      setIsMeshiTyping(false);
      setChatHistory((prev) => [...prev.slice(-49), { q: text, a: response.content, time: new Date() }]);

      // Vessel actions: suggestions are read-only so Meshi runs them right away;
      // a ready-to-send post waits for explicit confirmation.
      if (response.action?.type === "suggest") {
        setIsMeshiTyping(true);
        const result = await runMeshiAction({
          action: "suggest",
          suggestionType: (response.action.suggestionType as "people" | "communities" | "content") || "people",
        });
        setMood(result.mood);
        addSpeechBubble("meshi", result.message);
        setIsMeshiTyping(false);
      } else if (response.action?.type === "post" && response.action.content) {
        setPendingSpeechAction(response.action);
      }

      setTimeout(() => setMood("happy"), 3000);
    })();
  }, [isMeshiTyping, addSpeechBubble, focusedContent, isSearching, chatHistory, meshStats, meshEntities, pathname]);

  const confirmPendingSpeechAction = useCallback(() => {
    const content = pendingSpeechAction?.content;
    if (!content || isMeshiTyping) return;
    setPendingSpeechAction(null);
    setIsMeshiTyping(true);
    setMood("thinking");
    void (async () => {
      const result = await runMeshiAction({ action: "post", content });
      setMood(result.mood);
      addSpeechBubble("meshi", result.message);
      setIsMeshiTyping(false);
      if (result.success) void impactFeedback("MEDIUM");
    })();
  }, [pendingSpeechAction, isMeshiTyping, addSpeechBubble]);

  const handleSpeechSend = useCallback(() => {
    const text = speechInput.trim();
    if (!text || isMeshiTyping) return;
    setSpeechInput("");
    submitSpeechPrompt(text);
  }, [isMeshiTyping, speechInput, submitSpeechPrompt]);

  useEffect(() => {
    if (view === "speech") setTimeout(() => speechInputRef.current?.focus(), 100);
  }, [view]);

  const handleMeshiClick = useCallback(() => {
    // A one-shot press acknowledgment; no particles, no escalation.
    tapSquashControls.start({
      scale: [0.92, 1.06, 1],
      transition: { duration: 0.3, ease: [0.22, 1.2, 0.36, 1], times: [0, 0.5, 1] },
    });
    // void: impactFeedback is async and rejects when the native bridge is
    // unavailable — every other call site guards it, so match them here.
    void impactFeedback("MEDIUM");
    if (view === "closed") { setView("actions"); setMood("excited"); }
    else if (view === "actions") { setView("closed"); }
    else if (view === "speech") { setView("closed"); setSpeechBubbles([]); }
    else { setView("closed"); }
  }, [view, tapSquashControls]);

  const closeAll = useCallback(() => { setView("closed"); setSpeechBubbles([]); setPendingSpeechAction(null); }, []);

  // Global Meshi entrypoint so any screen can open Meshi in a specific mode.
  useEffect(() => {
    const handleMeshiOpen = (event: Event) => {
      const customEvent = event as CustomEvent<MeshiOpenMode>;
      const mode = customEvent.detail || "actions";
      // On the Mesh the floating body is hidden, so anchored modes (speech/actions)
      // have nothing to attach to — open the full chat modal instead.
      if (isMeshSurfaceRef.current) {
        setView("chat");
        setMood("happy");
        return;
      }
      if (mode === "speech") {
        setView("speech");
        setMood("thinking");
      } else if (mode === "chat") {
        setView("chat");
        setMood("happy");
      } else {
        setView("actions");
        setMood("excited");
      }
    };

    window.addEventListener(MESHI_OPEN_EVENT, handleMeshiOpen as EventListener);
    return () => window.removeEventListener(MESHI_OPEN_EVENT, handleMeshiOpen as EventListener);
  }, []);

  // A surface handed Meshi a specific post (the ⋯ menu's Summarize/Fact-check/
  // Verify media). The event carries the content, so the answer is about that
  // post — not whichever card happened to be most visible.
  useEffect(() => {
    const handleMeshiPrompt = (event: Event) => {
      const detail = (event as CustomEvent<MeshiPromptDetail>).detail;
      if (!detail?.prompt) return;
      if (detail.content) {
        focusedContentRef.current = detail.content;
        setFocusedContent(detail.content);
      }
      // On the Mesh the anchored speech panel has no body to attach to; the
      // chat modal owns the conversation there.
      if (isMeshSurfaceRef.current) {
        setView("chat");
        return;
      }
      setView("speech");
      submitSpeechPrompt(detail.prompt, detail.content);
    };

    window.addEventListener(MESHI_PROMPT_EVENT, handleMeshiPrompt as EventListener);
    return () => window.removeEventListener(MESHI_PROMPT_EVENT, handleMeshiPrompt as EventListener);
  }, [submitSpeechPrompt]);

  // Keyboard shortcut: Cmd/Ctrl + M toggles Meshi menu
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "m") {
        e.preventDefault();
        setView((prev) => (prev !== "closed" ? "closed" : isMeshSurfaceRef.current ? "chat" : "actions"));
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  if (!isMounted || !meshiEnabled || shouldHideGlobalMeshi(pathname)) return null;

  const activeHeldProp: MeshiProp =
    isFullscreenVideo || isSearching
      ? "magnifying-glass"
      : isTyping || isMeshiTyping
        ? "keyboard"
        : view === "actions" || view === "speech" || view === "chat"
          ? activeProp
          : "none";

  return (
    <>
      {/* THE ONE MESHI — docked chrome. CSS pins the shell to the corner
          (`.meshi-float-shell`); the body never moves. On the Mesh the canvas
          draws this same entity as the user's avatar, so the floating body
          yields there to keep Meshi a strict singleton. */}
      {!isMeshSurface && (
      <AnimatePresence>
        <motion.div
          data-meshi-float="true"
          data-meshi-singleton="true"
          data-meshi-instance-id={instanceId}
          data-meshi-owned="true"
          className="meshi-float-shell fixed z-40"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{
            opacity: isFullscreenVideo ? 0.46 : 1,
            scale: isFullscreenVideo ? 0.56 : 1,
          }}
          exit={{ opacity: 0, scale: 0.5 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}>
            {isSearching && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.94 }}
                className="absolute bottom-full right-0 mb-2 min-w-[11rem] rounded-[var(--r-md)] border border-[var(--border-primary)] bg-[var(--bg-elevated)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] shadow-lg"
              >
                <span className="block">{searchingText || "Working…"}</span>
                {isExploring && explorationProgress > 0 && (
                  <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
                    <motion.span
                      className="block h-full rounded-full bg-[var(--accent)]"
                      animate={{ width: `${explorationProgress}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </span>
                )}
              </motion.div>
            )}
            {/* Speech bubbles above Meshi — this IS its opened panel. */}
            {view === "speech" && (
              <div className="absolute bottom-full right-0 mb-2 flex flex-col items-end gap-2 w-[280px]">
                <AnimatePresence>
                  {speechBubbles.slice(-3).map((bubble) => (
                    <motion.div key={bubble.id}
                      initial={{ opacity: 0, y: 15, scale: 0.8 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.9 }}
                      transition={{ type: "spring", damping: 20, stiffness: 300 }}
                      className={`max-w-[260px] px-3 py-2 rounded-[var(--r-lg)] text-xs shadow-lg ${
                        bubble.role === "user"
                          ? "brand-button text-white rounded-br-[var(--r-xs)] self-end"
                          : "bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-primary)] rounded-bl-[var(--r-xs)]"
                      }`}>
                      {bubble.role === "meshi" && (
                        <div className="mb-1 flex items-start gap-1.5">
                          <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[var(--accent)]" aria-hidden="true" />
                          <span className="text-micro font-medium text-[var(--accent-text)]">Meshi</span>
                        </div>
                      )}
                      <p className="leading-relaxed">{bubble.text}</p>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {isMeshiTyping && (
                  <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                    className="px-3 py-2 rounded-[var(--r-lg)] rounded-bl-[var(--r-xs)] bg-[var(--bg-elevated)] border border-[var(--border-primary)] shadow-lg">
                    <div className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <motion.div key={i} className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]"
                          animate={{ y: [0, -3, 0] }} transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.12 }} />
                      ))}
                    </div>
                  </motion.div>
                )}
                {pendingSpeechAction?.type === "post" && pendingSpeechAction.content && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                    className="w-full rounded-[var(--r-lg)] rounded-bl-[var(--r-xs)] border border-[var(--accent)]/40 bg-[var(--bg-elevated)] px-3 py-2 shadow-lg">
                    <p className="mb-2 text-micro font-medium text-[var(--accent-text)]">Ready to post</p>
                    <p className="mb-2 max-h-20 overflow-y-auto text-xs leading-relaxed text-[var(--text-primary)]">
                      {pendingSpeechAction.content}
                    </p>
                    <div className="flex gap-1.5">
                      <button
                        onClick={confirmPendingSpeechAction}
                        className="rounded-[var(--r-sm)] brand-button px-2.5 py-1 text-micro font-medium text-white shadow">
                        Post it
                      </button>
                      <button
                        onClick={() => setPendingSpeechAction(null)}
                        className="rounded-[var(--r-sm)] bg-[var(--bg-tertiary)] px-2.5 py-1 text-micro text-[var(--text-secondary)] transition hover:bg-[var(--bg-hover)]">
                        Not now
                      </button>
                    </div>
                  </motion.div>
                )}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 w-full">
                  <input ref={speechInputRef} type="text" value={speechInput}
                    onChange={(e) => setSpeechInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSpeechSend()}
                    placeholder="Ask Meshi"
                    className="flex-1 bg-[var(--bg-elevated)] border border-[var(--border-primary)] rounded-[var(--r-sm)] px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] shadow-lg" />
                  <button onClick={handleSpeechSend} disabled={!speechInput.trim()}
                    className="p-2 rounded-[var(--r-sm)] brand-button text-white disabled:opacity-40 shadow-lg">
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </motion.div>
              </div>
            )}

            {/* MESHI ENTITY — a stationary 44px button. */}
            <motion.div
              onClick={handleMeshiClick}
              className="relative cursor-pointer select-none rounded-full"
              style={{ width: MESHI_SIZE, height: MESHI_SIZE }}
              data-meshi-primary="true"
              role="button"
              aria-label="Open Meshi"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  handleMeshiClick();
                }
              }}
              animate={tapSquashControls}
            >
              <MeshiMascot
                size={MESHI_SIZE}
                mood={isFullscreenVideo ? "learning" : isSearching ? "searching" as MeshiMood : mood}
                color={meshiColor}
                hat={meshiHat}
                hair={meshiHair}
                accessory={isFullscreenVideo || isSearching ? "glasses" : meshiAccessory}
                eyeStyle={meshiEye}
                badge={meshiBadge}
                showGlow={view !== "closed" || isSearching || isFullscreenVideo}
                interactive
                prop={activeHeldProp}
              />
            </motion.div>
          </motion.div>
      </AnimatePresence>
      )}

      {/* Actions Menu — hidden on mesh page */}
      <AnimatePresence>
        {view === "actions" && (
          <MeshiActionsMenu
            meshiColor={meshiColor}
            meshiHat={meshiHat}
            onClose={closeAll}
            onAskMeshi={() => setView("speech")}
            onSearchMesh={() => triggerSearch()}
            onOpenChat={() => setView("chat")}
          />
        )}
      </AnimatePresence>

      {/* Full Meshi Chat */}
      <MeshiChat
        isOpen={view === "chat"}
        onClose={closeAll}
        hat={meshiHat}
        color={meshiColor}
        hair={meshiHair}
        accessory={meshiAccessory}
        faceStyle={mood}
        meshData={meshStats}
        meshEntities={meshEntities}
        focusedContent={focusedContent || undefined}
      />
    </>
  );
}
