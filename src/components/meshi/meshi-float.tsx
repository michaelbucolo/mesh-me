"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence, useMotionValue, useSpring } from "framer-motion";
import { usePathname } from "next/navigation";
import {
  Send, Search,
} from "lucide-react";
import { MeshiMascot, type MeshiMood, type MeshiColor, type MeshiHat, type MeshiProp, PAGE_PROPS } from "./meshi-mascot";
import { MeshiChat } from "./meshi-chat";
import { MeshiActionsMenu } from "./meshi-actions-menu";
import { getMeshGraphData, type MeshGraphEntity } from "@/lib/queries";
import { getMeshiPreference } from "@/lib/actions";
import {
  loadKnowledge, saveKnowledge, indexMeshData, answerMeshQuestion,
  getKnowledgeLevelDescription, type MeshiExplorationState,
} from "@/lib/meshi-knowledge";
import { impactFeedback } from "@/lib/native/haptics";

// Meshi is ONE standalone AI entity. No bubble, no home position.
// Click Meshi to open actions. Meshi floats freely in the bottom-right.

const GREETINGS: Record<string, { text: string; mood: MeshiMood }> = {
  "/mesh": { text: "Welcome to your Mesh!", mood: "excited" },
  "/feed": { text: "Here\u2019s your feed!", mood: "happy" },
  "/messages": { text: "MeChat is ready!", mood: "love" },
  "/communities": { text: "Explore communities!", mood: "excited" },
  "/notifications": { text: "Let me catch you up!", mood: "thinking" },
  "/settings": { text: "Need help?", mood: "happy" },
  "/explore": { text: "Let\u2019s discover!", mood: "excited" },
  "/search": { text: "What are we looking for?", mood: "thinking" },
  "/profile": { text: "Looking good!", mood: "wink" },
  "/meshpro": { text: "MeshPro unlocks more!", mood: "excited" },
};

const SEARCH_TRIGGERS = ["search", "find", "look for", "where", "show me"];

const PAGE_AMBIENT_MOODS: Record<string, MeshiMood[]> = {
  "/mesh": ["excited", "happy", "cool"],
  "/feed": ["happy", "love", "wink"],
  "/messages": ["love", "happy", "wink"],
  "/explore": ["excited", "cool", "happy"],
  "/settings": ["thinking", "happy", "cool"],
  "/profile": ["wink", "happy", "love"],
  "/meshpro": ["excited", "cool", "happy"],
  "/notifications": ["thinking", "surprised", "happy"],
  "/communities": ["excited", "love", "happy"],
};

type MeshiView = "closed" | "actions" | "speech" | "chat";

const MESHI_SIZE = 48;

// Safe insets: Meshi docks bottom-right but must never overlap UI.
// Detects sidebar, header, mobile nav, and any data-meshi-zone elements to avoid.
function getSafePosition() {
  if (typeof window === "undefined") return { x: 900, y: 600 };
  const isMobile = window.innerWidth < 1024;
  const safeBottom = isMobile ? 80 : 16; // mobile nav is ~60px + gap
  const safeRight = 16;

  // Check for sidebar width on desktop
  const sidebar = document.querySelector("[data-sidebar]");
  const sidebarWidth = sidebar ? sidebar.getBoundingClientRect().right : 0;

  // Check for any UI zones Meshi should avoid
  const zones = document.querySelectorAll("[data-meshi-zone]");
  let maxBlockedRight = window.innerWidth - MESHI_SIZE - safeRight;
  let maxBlockedBottom = window.innerHeight - MESHI_SIZE - safeBottom;

  zones.forEach((zone) => {
    const rect = (zone as HTMLElement).getBoundingClientRect();
    // If a zone is near bottom-right, push Meshi above/left of it
    if (rect.right > window.innerWidth - 120 && rect.bottom > window.innerHeight - 120) {
      maxBlockedRight = Math.min(maxBlockedRight, rect.left - MESHI_SIZE - 8);
      maxBlockedBottom = Math.min(maxBlockedBottom, rect.top - MESHI_SIZE - 8);
    }
  });

  return {
    x: Math.max(sidebarWidth + 8, maxBlockedRight),
    y: Math.max(48, maxBlockedBottom), // never above header
  };
}

export function MeshiFloat() {
  const [meshiEnabled, setMeshiEnabled] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("meshiEnabled") !== "false";
  });
  const [view, setView] = useState<MeshiView>("closed");
  const [mood, setMood] = useState<MeshiMood>("happy");
  const [meshiColor, setMeshiColor] = useState<MeshiColor>("blue");
  const [meshiHat, setMeshiHat] = useState<MeshiHat>("none");
  const [showGreeting, setShowGreeting] = useState(false);
  const [greetingText, setGreetingText] = useState("");
  const [lastPath, setLastPath] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchingText, setSearchingText] = useState("");
  const [, setChatHistory] = useState<Array<{ q: string; a: string; time: Date }>>([]);

  const [meshEntities, setMeshEntities] = useState<MeshGraphEntity[]>([]);
  const [meshStats, setMeshStats] = useState<{ followers: number; following: number; posts: number; communities: number; platforms: number }>({ followers: 0, following: 0, posts: 0, communities: 0, platforms: 0 });
  const [knowledge, setKnowledge] = useState<MeshiExplorationState>(() => {
    if (typeof window === "undefined") return { totalNodesVisited: 0, totalExplorations: 0, lastExplorationAt: 0, knowledgeLevel: 1, entries: {} };
    return loadKnowledge();
  });
  const [isExploring, setIsExploring] = useState(false);
  const [explorationProgress, setExplorationProgress] = useState(0);

  // Position starts in safe bottom-right zone (never overlapping UI)
  const safePos = getSafePosition();
  const meshiX = useMotionValue(safePos.x);
  const meshiY = useMotionValue(safePos.y);
  const springX = useSpring(meshiX, { stiffness: 200, damping: 25, mass: 0.6 });
  const springY = useSpring(meshiY, { stiffness: 200, damping: 25, mass: 0.6 });

  const [isDragging, setIsDragging] = useState(false);
  const [wasDragged, setWasDragged] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  const [isIdle, setIsIdle] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [activeProp, setActiveProp] = useState<MeshiProp>("none");
  const [clickBurst, setClickBurst] = useState(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hasGreetedThisPage, setHasGreetedThisPage] = useState(false);
  const [isPageTransitioning, setIsPageTransitioning] = useState(false);
  const [isMeshTransition, setIsMeshTransition] = useState(false);
  const prevPathnameRef = useRef("");
  const [isFirstTimeMeshi, setIsFirstTimeMeshi] = useState(() => {
    if (typeof window === "undefined") return false;
    return !localStorage.getItem("meshiInteracted");
  });

  const [speechBubbles, setSpeechBubbles] = useState<Array<{
    id: string; text: string; role: "user" | "meshi"; timestamp: number;
  }>>([]);
  const [speechInput, setSpeechInput] = useState("");
  const [isMeshiTyping, setIsMeshiTyping] = useState(false);
  const speechInputRef = useRef<HTMLInputElement>(null);

  const pathname = usePathname();

  useEffect(() => {
    getMeshiPreference().then((pref) => {
      if (pref) {
        if (pref.faceStyle) setMood(pref.faceStyle as MeshiMood);
        if (pref.colorTheme) setMeshiColor(pref.colorTheme as MeshiColor);
        if (pref.hatStyle) setMeshiHat(pref.hatStyle as MeshiHat);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "meshiEnabled") setMeshiEnabled(e.newValue !== "false");
      if (e.key === "meshiColor") setMeshiColor((e.newValue || "blue") as MeshiColor);
      if (e.key === "meshiHat") setMeshiHat((e.newValue || "none") as MeshiHat);
      if (e.key === "meshiFace") setMood((e.newValue || "happy") as MeshiMood);
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // Load mesh data AND index it into knowledge system
  useEffect(() => {
    let cancelled = false;
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
    return () => { cancelled = true; };
  }, [pathname]);

  // Page transition bounce + contextual prop
  useEffect(() => {
    if (!meshiEnabled) return;
    // Set contextual prop based on current page
    const matchedPropKey = Object.keys(PAGE_PROPS).find((key) => pathname.startsWith(key));
    const contextualProp = matchedPropKey ? PAGE_PROPS[matchedPropKey] : "none";
    queueMicrotask(() => setActiveProp(contextualProp));
    if (pathname !== lastPath && lastPath !== "") {
      queueMicrotask(() => {
        setIsPageTransitioning(true);
        setMood("excited");
        setLastPath(pathname);
        setHasGreetedThisPage(false);
      });
      const timer = setTimeout(() => setIsPageTransitioning(false), 800);
      return () => clearTimeout(timer);
    }
    if (lastPath === "") queueMicrotask(() => setLastPath(pathname));
  }, [pathname, lastPath, meshiEnabled]);

  // Mesh page transition — animate Meshi toward canvas center when entering /mesh
  useEffect(() => {
    if (!meshiEnabled) return;
    const prev = prevPathnameRef.current;
    const enteringMesh = pathname === "/mesh" && prev !== "/mesh" && prev !== "";
    const leavingMesh = pathname !== "/mesh" && prev === "/mesh";

    if (enteringMesh) {
      queueMicrotask(() => setIsMeshTransition(true));
      const centerX = window.innerWidth / 2 - MESHI_SIZE / 2;
      const centerY = window.innerHeight / 2 - MESHI_SIZE / 2;
      meshiX.set(centerX);
      meshiY.set(centerY);
      const timer = setTimeout(() => setIsMeshTransition(false), 600);
      prevPathnameRef.current = pathname;
      return () => clearTimeout(timer);
    } else if (leavingMesh) {
      queueMicrotask(() => setIsMeshTransition(true));
      const safe = getSafePosition();
      const centerX = window.innerWidth / 2 - MESHI_SIZE / 2;
      const centerY = window.innerHeight / 2 - MESHI_SIZE / 2;
      meshiX.set(centerX);
      meshiY.set(centerY);
      requestAnimationFrame(() => {
        meshiX.set(safe.x);
        meshiY.set(safe.y);
      });
      const timer = setTimeout(() => setIsMeshTransition(false), 600);
      prevPathnameRef.current = pathname;
      return () => clearTimeout(timer);
    }

    prevPathnameRef.current = pathname;
  }, [pathname, meshiEnabled, meshiX, meshiY]);
  useEffect(() => {
    if (!meshiEnabled || hasGreetedThisPage || view !== "closed") return;
    const matchedKey = Object.keys(GREETINGS).find((key) => pathname.startsWith(key));
    if (matchedKey) {
      const greeting = GREETINGS[matchedKey];
      queueMicrotask(() => {
        setGreetingText(greeting.text);
        setMood(greeting.mood);
        setHasGreetedThisPage(true);
      });
      let hideTimer: ReturnType<typeof setTimeout>;
      const showTimer = setTimeout(() => {
        setShowGreeting(true);
        hideTimer = setTimeout(() => setShowGreeting(false), 3000);
      }, 1000);
      return () => { clearTimeout(showTimer); clearTimeout(hideTimer); };
    }
  }, [pathname, hasGreetedThisPage, view, meshiEnabled]);

  // User interaction reactions
  useEffect(() => {
    if (!meshiEnabled) return;
    const handleKeyDown = () => {
      if (!isTyping) setIsTyping(true);
      if (isIdle) setIsIdle(false);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => setIsIdle(true), 20000);
      if (view === "closed") setMood("thinking");
    };
    const handleKeyUp = () => { setTimeout(() => setIsTyping(false), 2000); };
    const handleClick = () => {
      setClickBurst(true);
      setTimeout(() => setClickBurst(false), 400);
      if (view === "closed") setMood("happy");
    };
    const handleMouseMove = () => {
      if (isIdle) setIsIdle(false);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => setIsIdle(true), 20000);
    };
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("keydown", handleKeyDown, { passive: true });
    window.addEventListener("keyup", handleKeyUp, { passive: true });
    window.addEventListener("click", handleClick, { passive: true });
    idleTimerRef.current = setTimeout(() => setIsIdle(true), 20000);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("click", handleClick);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [meshiEnabled, isIdle, isTyping, view]);

  // Idle behavior
  useEffect(() => {
    if (!meshiEnabled || view !== "closed") return;
    if (isIdle) queueMicrotask(() => setMood("sleepy"));
    else if (isTyping) queueMicrotask(() => setMood("thinking"));
  }, [isIdle, isTyping, view, meshiEnabled]);

  // Ambient mood cycling
  useEffect(() => {
    if (!meshiEnabled || view !== "closed" || isIdle || isTyping || isDragging) return;
    const matchedKey = Object.keys(PAGE_AMBIENT_MOODS).find((key) => pathname.startsWith(key));
    if (!matchedKey) return;
    const moods = PAGE_AMBIENT_MOODS[matchedKey];
    let idx = 0;
    const interval = setInterval(() => { idx = (idx + 1) % moods.length; setMood(moods[idx]); }, 8000);
    return () => clearInterval(interval);
  }, [pathname, meshiEnabled, view, isIdle, isTyping, isDragging]);

  // Scroll reaction
  useEffect(() => {
    if (!meshiEnabled || view !== "closed") return;
    let lastScrollY = window.scrollY;
    let pendingTimeout: ReturnType<typeof setTimeout> | null = null;
    const handleScrollDirection = () => {
      const delta = window.scrollY - lastScrollY;
      lastScrollY = window.scrollY;
      if (Math.abs(delta) > 50) {
        setMood(delta > 0 ? "cool" : "surprised");
        if (pendingTimeout) clearTimeout(pendingTimeout);
        pendingTimeout = setTimeout(() => { setMood("happy"); pendingTimeout = null; }, 600);
      }
    };
    window.addEventListener("scroll", handleScrollDirection, { passive: true });
    return () => { window.removeEventListener("scroll", handleScrollDirection); if (pendingTimeout) clearTimeout(pendingTimeout); };
  }, [meshiEnabled, view]);

  // Keep Meshi in safe zone on resize — snap to safe position if out of bounds
  useEffect(() => {
    const handleResize = () => {
      const safe = getSafePosition();
      const curX = meshiX.get();
      const curY = meshiY.get();
      // If Meshi is near the default position or out of bounds, snap to safe zone
      if (curX > window.innerWidth - MESHI_SIZE - 8 || curY > window.innerHeight - MESHI_SIZE - 8) {
        meshiX.set(safe.x);
        meshiY.set(safe.y);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [meshiX, meshiY]);

  const addSpeechBubble = useCallback((role: "user" | "meshi", text: string) => {
    const id = Date.now().toString() + Math.random().toString(36).slice(2);
    setSpeechBubbles((prev) => [...prev.slice(-4), { id, text, role, timestamp: Date.now() }]);
    setTimeout(() => { setSpeechBubbles((prev) => prev.filter((b) => b.id !== id)); }, 12000);
  }, []);

  // Meshi exploration animation — travels through mesh nodes and indexes them
  const triggerExploration = useCallback(() => {
    setIsExploring(true);
    setIsSearching(true);
    setSearchingText("Exploring your mesh...");
    setMood("searching" as MeshiMood);
    setView("closed");
    setExplorationProgress(0);

    const totalSteps = 5;
    const stepDuration = 800;
    const messages = [
      "Discovering connections...",
      "Indexing posts & communities...",
      "Mapping your digital universe...",
      "Learning about your mesh...",
      "Almost done!",
    ];

    messages.forEach((msg, i) => {
      setTimeout(() => {
        setSearchingText(msg);
        setExplorationProgress(((i + 1) / totalSteps) * 100);
        if (i === 1) setMood("learning" as MeshiMood);
        if (i === 3) setMood("thinking");
      }, i * stepDuration);
    });

    setTimeout(() => {
      setIsSearching(false);
      setIsExploring(false);
      setExplorationProgress(0);
      const stats = meshStats;
      const kLevel = knowledge.knowledgeLevel;
      const levelDesc = getKnowledgeLevelDescription(kLevel);
      const summary = stats.followers + stats.following + stats.posts > 0
        ? `Exploration complete! Found ${stats.followers} followers, ${stats.following} following, ${stats.posts} posts, ${stats.communities} communities across ${stats.platforms} platforms. Knowledge Level: ${kLevel}/10 (${levelDesc})`
        : "Your mesh is just getting started! Connect some platforms to see it grow.";
      setMood("celebrating" as MeshiMood);
      setView("speech");
      addSpeechBubble("meshi", summary);
      setTimeout(() => setMood("excited"), 2000);
    }, totalSteps * stepDuration);
  }, [meshStats, knowledge.knowledgeLevel, addSpeechBubble]);

  // Legacy triggerSearch now uses exploration
  const triggerSearch = triggerExploration;

  // Enhanced quick response with knowledge system integration
  const getQuickResponse = useCallback((query: string): { text: string; mood: MeshiMood } => {
    const q = query.toLowerCase().trim();

    // Check if this is a mesh knowledge question (how many, who is, find, etc.)
    const isMeshQuery = q.includes("how many") || q.includes("who is") || q.includes("find ") ||
      q.includes("@") || q.includes("tell me about my mesh") || q.includes("summary") ||
      q.includes("what do you know") || q.includes("knowledge level");

    if (isMeshQuery) {
      const result = answerMeshQuestion(knowledge, query);
      return { text: result.answer, mood: result.mood as MeshiMood };
    }

    if (q.includes("knowledge") || q.includes("how smart") || q.includes("level")) {
      const level = knowledge.knowledgeLevel;
      const desc = getKnowledgeLevelDescription(level);
      return {
        text: `I'm at Knowledge Level ${level}/10 — ${desc}! I've explored ${knowledge.totalNodesVisited} nodes and learned ${Object.keys(knowledge.entries).length} things about your mesh.`,
        mood: level >= 5 ? "excited" : "happy",
      };
    }

    if (q.includes("explore") || q.includes("index") || q.includes("learn more"))
      return { text: "I'll explore your mesh right now! Watch me go!", mood: "excited" };

    if (q.includes("mesh") && (q.includes("what") || q.includes("how") || q.includes("work")))
      return { text: "The Mesh is your entire digital universe visualized! Every connection as a glowing node.", mood: "excited" };
    if (q.includes("mechat") || q.includes("message") || q.includes("chat"))
      return { text: "MeChat merges all your conversations across platforms! Encrypted and private.", mood: "love" };
    if (q.includes("privacy") || q.includes("secure") || q.includes("safe"))
      return { text: "Privacy is #1! We never sell data, never track you, and you control everything.", mood: "cool" };
    if (q.includes("meshi") || q.includes("who are you"))
      return { text: `I'm Meshi! Your mesh.me AI companion. Knowledge Level ${knowledge.knowledgeLevel}/10 and growing!`, mood: "love" };
    if (q.includes("pro") || q.includes("premium"))
      return { text: "MeshPro is $4.99/mo \u2014 Digital Footprint Scanner, custom cosmetics, and analytics.", mood: "wink" };
    if (q.includes("hello") || q.includes("hi") || q.includes("hey"))
      return { text: "Hey there! What can I help you with?", mood: "happy" };
    if (q.includes("thank"))
      return { text: "Anytime! Happy to help!", mood: "love" };
    return { text: "Great question! For a deeper dive, open the full chat.", mood: "thinking" };
  }, [knowledge]);

  const handleSpeechSend = useCallback(() => {
    const text = speechInput.trim();
    if (!text || isMeshiTyping) return;
    setSpeechInput("");
    addSpeechBubble("user", text);
    setMood("thinking");
    setIsMeshiTyping(true);

    const q = text.toLowerCase();
    const isSearchQuery = SEARCH_TRIGGERS.some((trigger) => q.includes(trigger));
    const isExploreQuery = q.includes("explore") || q.includes("index") || q.includes("learn more");

    // Mesh knowledge questions — Meshi pulls out magnifying glass and explores
    const isMeshQuery = q.includes("how many") || q.includes("who is") || q.includes("find ") || q.includes("@") ||
      q.includes("tell me about my mesh") || q.includes("summary") || q.includes("what do you know") || q.includes("knowledge level");

    if (isMeshQuery && !isSearching) {
      // Magnifying glass exploration animation, then answer
      setIsSearching(true);
      setSearchingText("Searching through your mesh...");
      setMood("searching" as MeshiMood);
      setView("closed");
      setTimeout(() => {
        setSearchingText("Analyzing data...");
        setMood("learning" as MeshiMood);
      }, 1500);
      setTimeout(() => {
        setIsSearching(false);
        const result = answerMeshQuestion(knowledge, text);
        setMood(result.mood as MeshiMood);
        setView("speech");
        addSpeechBubble("meshi", result.answer);
        setIsMeshiTyping(false);
        setChatHistory((prev) => [...prev.slice(-49), { q: text, a: result.answer, time: new Date() }]);
        setTimeout(() => setMood("happy"), 3000);
      }, 3000);
      return;
    }

    if ((isSearchQuery || isExploreQuery) && !isSearching) {
      setTimeout(() => { setIsMeshiTyping(false); triggerExploration(); }, 500);
      return;
    }

    // Node inspector mode: when on mesh page and asking about a person/entity
    const isInspectQuery = (pathname === "/mesh") && (
      text.toLowerCase().includes("who is") ||
      text.toLowerCase().includes("tell me about") ||
      text.toLowerCase().includes("inspect") ||
      text.toLowerCase().includes("look up")
    );
    if (isInspectQuery) {
      setMood("searching");
      setActiveProp("magnifying-glass");
      setTimeout(() => {
        setActiveProp(PAGE_PROPS["/mesh"] || "compass");
        setMood("learning");
      }, 3000);
    }
    setTimeout(() => {
      const response = getQuickResponse(text);
      setMood(isInspectQuery ? "learning" : response.mood);
      addSpeechBubble("meshi", response.text);
      setIsMeshiTyping(false);
      setChatHistory((prev) => [...prev.slice(-49), { q: text, a: response.text, time: new Date() }]);
    }, isInspectQuery ? 1500 : 800 + Math.random() * 600);
  }, [speechInput, isMeshiTyping, isSearching, knowledge, addSpeechBubble, triggerExploration, getQuickResponse, pathname]);

  useEffect(() => {
    if (view === "speech") setTimeout(() => speechInputRef.current?.focus(), 100);
  }, [view]);

  const handleMeshiClick = useCallback(() => {
    if (wasDragged) return;
    impactFeedback("MEDIUM");
    // Mark first-time interaction
    if (isFirstTimeMeshi) {
      setIsFirstTimeMeshi(false);
      localStorage.setItem("meshiInteracted", "true");
    }
    if (view === "closed") { setView("actions"); setMood("excited"); }
    else if (view === "actions") { setView("closed"); }
    else if (view === "speech") { setView("closed"); setSpeechBubbles([]); }
    else { setView("closed"); }
  }, [view, wasDragged, isFirstTimeMeshi]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    dragStartRef.current = { x: e.clientX, y: e.clientY, px: springX.get(), py: springY.get() };
    setWasDragged(false);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [springX, springY]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) { setIsDragging(true); setWasDragged(true); }
    const maxX = (typeof window !== "undefined" ? window.innerWidth : 1024) - MESHI_SIZE;
    const isMobile = (typeof window !== "undefined" ? window.innerWidth : 1024) < 1024;
    const safeBottom = isMobile ? 80 : 16;
    const maxY = (typeof window !== "undefined" ? window.innerHeight : 768) - MESHI_SIZE - safeBottom;
    meshiX.set(Math.max(0, Math.min(maxX, dragStartRef.current.px + dx)));
    meshiY.set(Math.max(0, Math.min(maxY, dragStartRef.current.py + dy)));
  }, [meshiX, meshiY]);

  const handlePointerUp = useCallback(() => {
    dragStartRef.current = null;
    setIsDragging(false);
    // Snap back to safe zone if released near edges where UI lives
    const curX = meshiX.get();
    const curY = meshiY.get();
    const safe = getSafePosition();
    const nearRight = curX > window.innerWidth - MESHI_SIZE - 24;
    const nearBottom = curY > safe.y - 8;
    if (nearRight && nearBottom) {
      meshiX.set(safe.x);
      meshiY.set(safe.y);
    }
  }, [meshiX, meshiY]);

  const closeAll = useCallback(() => { setView("closed"); setSpeechBubbles([]); }, []);

  // On /mesh page: show transition animation then hide; on other pages: show normally
  const isOnMeshPage = pathname === "/mesh";

  if (!meshiEnabled) return null;

  return (
    <>
      {/* Search Overlay */}
      <AnimatePresence>
        {isSearching && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] pointer-events-none flex items-center justify-center"
          >
            <motion.div className="flex flex-col items-center gap-3"
              animate={{ x: [0, 100, -80, 60, -40, 0], y: [0, -50, 30, -60, 20, 0] }}
              transition={{ duration: 4, ease: "easeInOut" }}>
              <motion.div animate={{ rotate: [0, 10, -10, 15, -5, 0] }} transition={{ duration: 0.8, repeat: Infinity }}>
                <MeshiMascot size={80} mood={isExploring ? "searching" as MeshiMood : "thinking"} color={meshiColor} hat={meshiHat} speaking showGlow />
              </motion.div>
              {/* Magnifying glass icon */}
              <motion.div
                animate={{ rotate: [-15, 15, -15], scale: [1, 1.1, 1] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                className="text-2xl"
              >
                <Search className="h-8 w-8" style={{ color: "var(--accent)" }} />
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="px-4 py-2 rounded-xl text-sm font-medium shadow-xl flex flex-col items-center gap-1"
                style={{ background: "var(--bg-elevated)", color: "var(--text-primary)", border: "1px solid var(--accent)" }}>
                <span>{searchingText}</span>
                {isExploring && explorationProgress > 0 && (
                  <div className="w-32 h-1.5 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: "var(--accent)" }}
                      animate={{ width: `${explorationProgress}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                )}
                <span className="text-[10px] text-[var(--text-muted)]">Knowledge Level {knowledge.knowledgeLevel}/10</span>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* THE ONE MESHI - standalone floating entity */}
      <AnimatePresence>
        {!isSearching && (!isOnMeshPage || isMeshTransition) && (
          <motion.div className="fixed z-40" style={{ left: springX, top: springY }}
            initial={isOnMeshPage ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.5 }}
            animate={isOnMeshPage ? { opacity: 0, scale: 0.6 } : { opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}>
            {/* Speech bubbles above Meshi */}
            {view === "speech" && (
              <div className="absolute bottom-full right-0 mb-2 flex flex-col items-end gap-2 w-[280px]">
                <AnimatePresence>
                  {speechBubbles.slice(-3).map((bubble) => (
                    <motion.div key={bubble.id}
                      initial={{ opacity: 0, y: 15, scale: 0.8 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.9 }}
                      transition={{ type: "spring", damping: 20, stiffness: 300 }}
                      className={`max-w-[260px] px-3 py-2 rounded-2xl text-xs shadow-lg ${
                        bubble.role === "user"
                          ? "brand-button text-white rounded-br-sm self-end"
                          : "bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-primary)] rounded-bl-sm"
                      }`}>
                      {bubble.role === "meshi" && (
                        <div className="flex items-start gap-1.5 mb-1">
                          <MeshiMascot size={14} mood={mood} color={meshiColor} hat={meshiHat} showGlow={false} animate={false} />
                          <span className="text-[10px] font-medium text-[var(--accent)]">Meshi</span>
                        </div>
                      )}
                      <p className="leading-relaxed">{bubble.text}</p>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {isMeshiTyping && (
                  <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                    className="px-3 py-2 rounded-2xl rounded-bl-sm bg-[var(--bg-elevated)] border border-[var(--border-primary)] shadow-lg">
                    <div className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <motion.div key={i} className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]"
                          animate={{ y: [0, -3, 0] }} transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.12 }} />
                      ))}
                    </div>
                  </motion.div>
                )}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 w-full">
                  <input ref={speechInputRef} type="text" value={speechInput}
                    onChange={(e) => setSpeechInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSpeechSend()}
                    placeholder="Ask Meshi anything..."
                    className="flex-1 bg-[var(--bg-elevated)] border border-[var(--border-primary)] rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] shadow-lg" />
                  <button onClick={handleSpeechSend} disabled={!speechInput.trim()}
                    className="p-2 rounded-xl brand-button text-white disabled:opacity-40 shadow-lg">
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </motion.div>
              </div>
            )}

            {/* Greeting tooltip */}
            <AnimatePresence>
              {showGreeting && view === "closed" && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 5, scale: 0.95 }}
                  className="absolute bottom-full right-0 mb-2 px-3 py-2 rounded-xl text-xs max-w-[180px] shadow-lg pointer-events-none"
                  style={{ background: "var(--bg-elevated)", color: "var(--text-primary)", border: "1px solid var(--border-primary)" }}>
                  <p>{greetingText}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* MESHI ENTITY - standalone, no container/bubble */}
            <motion.div
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onClick={handleMeshiClick}
              className={`cursor-pointer select-none ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
              style={{ touchAction: "none", width: MESHI_SIZE, height: MESHI_SIZE }}
              animate={{
                scale: clickBurst ? [1, 1.15, 1] : isPageTransitioning ? [1, 1.2, 0.9, 1.1, 1] : 1,
                rotate: isPageTransitioning ? [0, 10, -10, 5, 0] : isDragging ? [0, 3, -3, 0] : 0,
              }}
              transition={{ duration: isPageTransitioning ? 0.6 : 0.3, ease: "easeOut" }}>
              <motion.div
                animate={
                  isDragging
                    ? { rotate: [0, 8, -8, 8, 0] }
                    : isIdle
                      ? { y: [0, -1, 0], opacity: [1, 0.7, 1] }
                      : { y: [0, -3, 0, -1, 0], rotate: [0, 1, -1, 0.5, 0] }
                }
                transition={
                  isDragging
                    ? { duration: 0.5, repeat: Infinity }
                    : isIdle
                      ? { duration: 3, repeat: Infinity, ease: "easeInOut" }
                      : { duration: 4, repeat: Infinity, ease: "easeInOut" }
                }>
                <MeshiMascot
                  size={MESHI_SIZE}
                  mood={isDragging ? "excited" : mood}
                  color={meshiColor}
                  hat={meshiHat}
                  showGlow={view !== "closed"}
                  interactive
                  prop={view === "closed" ? activeProp : "none"}
                  bouncy={isIdle}
                />
              </motion.div>

              {/* Active ring when actions/speech open */}
              {view !== "closed" && view !== "chat" && (
                <motion.div className="absolute inset-0 rounded-full pointer-events-none"
                  style={{ border: "2px solid var(--accent)" }}
                  animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.2, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }} />
              )}

              {/* First-time pulse indicator — draws attention to Meshi for new users */}
              {isFirstTimeMeshi && view === "closed" && (
                <>
                  <motion.div
                    className="absolute -inset-2 rounded-full pointer-events-none"
                    style={{ border: "2px solid var(--accent)" }}
                    animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
                  />
                  <motion.div
                    className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full text-[8px] font-bold text-white pointer-events-none shadow-lg"
                    style={{ background: "var(--accent)" }}
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    Hi!
                  </motion.div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actions Menu — hidden on mesh page */}
      <AnimatePresence>
        {view === "actions" && !isOnMeshPage && (
          <MeshiActionsMenu
            meshiColor={meshiColor}
            meshiHat={meshiHat}
            onClose={closeAll}
            onAskMeshi={() => setView("speech")}
            onSearchMesh={() => triggerSearch()}
          />
        )}
      </AnimatePresence>

      {/* Full Meshi Chat */}
      <MeshiChat isOpen={view === "chat"} onClose={closeAll} meshData={meshStats} meshEntities={meshEntities} />
    </>
  );
}
