"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence, useMotionValue, useSpring } from "framer-motion";
import { usePathname } from "next/navigation";
import {
  X, Settings, History, Sparkles, MessageCircle,
  ChevronRight, Palette, HelpCircle, Send, GripVertical
} from "lucide-react";
import { MeshiMascot, type MeshiMood, type MeshiColor, type MeshiHat } from "./meshi-mascot";
import { MeshiChat } from "./meshi-chat";
import { getMeshGraphData, type MeshGraphEntity } from "@/lib/queries";
import { getMeshiPreference } from "@/lib/actions";

// Meshi is ONE being — this component makes it feel alive.
// It roams the screen, reacts to user behavior, and travels
// between pages alongside the user. The sidebar logo is just
// Meshi's "home" position that it returns to when idle.

const GREETINGS: Record<string, { text: string; mood: MeshiMood }> = {
  "/mesh": { text: "Welcome to your Mesh! Click any node to interact.", mood: "excited" },
  "/feed": { text: "Here\u2019s your feed! I can help you find anything.", mood: "happy" },
  "/custom-feed": { text: "Your custom feed from all platforms!", mood: "happy" },
  "/messages": { text: "MeChat is ready! All your conversations in one place.", mood: "love" },
  "/communities": { text: "Explore communities or create your own!", mood: "excited" },
  "/notifications": { text: "Let me summarize what you\u2019ve missed!", mood: "thinking" },
  "/settings": { text: "Need help with settings? Just ask!", mood: "happy" },
  "/explore": { text: "Let\u2019s discover something new together!", mood: "excited" },
  "/connected-accounts": { text: "Manage your connected platforms here!", mood: "cool" },
  "/search": { text: "What are we looking for? I\u2019ll help!", mood: "thinking" },
  "/profile": { text: "Looking good! Want to customize your profile?", mood: "wink" },
  "/meshpro": { text: "MeshPro unlocks premium features!", mood: "excited" },
};

const SEARCH_TRIGGERS = ["search", "find", "look for", "where", "show me"];

const ELEMENT_ZONES: Array<{ selector: string; label: string; description: string }> = [
  { selector: "[data-meshi-zone='sidebar']", label: "Sidebar", description: "This is the main navigation. Use it to jump between The Mesh, Feed, MeChat, and more!" },
  { selector: "[data-meshi-zone='mesh-canvas']", label: "The Mesh", description: "This is your interactive mesh visualization. Click nodes to interact, drag to pan, scroll to zoom!" },
  { selector: "[data-meshi-zone='feed']", label: "Feed", description: "Your content feed! Like, comment, and share posts." },
  { selector: "[data-meshi-zone='settings']", label: "Settings", description: "Control everything about your mesh.me experience here." },
  { selector: "[data-meshi-zone='notifications']", label: "Notifications", description: "Your notification center. I can summarize what you've missed!" },
  { selector: "[data-meshi-zone='messages']", label: "MeChat", description: "Unified messaging across all your connected platforms. Encrypted and private." },
  { selector: "[data-meshi-zone='search']", label: "Search", description: "Find people, communities, posts, and topics across mesh.me." },
  { selector: "[data-meshi-zone='privacy']", label: "Privacy Controls", description: "Control who sees your mesh, your posts, and your connections. Privacy is our #1 priority!" },
];

type MeshiView = "closed" | "chat" | "mini-mesh" | "speech";
type MeshiBehavior = "home" | "roaming" | "traveling" | "reacting";

// Page-contextual ambient moods — Meshi's expression shifts based on where the user is
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

// Home position = near the sidebar logo (top-left)
const HOME_POSITION = { x: 28, y: 84 };
const HOME_SIZE = 32;
const FLOAT_SIZE = 56;

/**
 * Global floating Meshi — ONE unified being that travels across the entire app.
 *
 * Behaviors:
 * - HOME: Meshi sits in the sidebar logo area (small, subtle idle bounce)
 * - ROAMING: Meshi wanders the screen with gentle floating motions
 * - TRAVELING: Meshi flies across the screen during page transitions
 * - REACTING: Meshi bounces/jiggles in response to clicks, scrolls, typing
 */
export function MeshiFloat() {
  const [meshiEnabled, setMeshiEnabled] = useState(true);
  const [view, setView] = useState<MeshiView>("closed");
  const [mood, setMood] = useState<MeshiMood>("happy");
  const [meshiColor, setMeshiColor] = useState<MeshiColor>("blue");
  const [meshiHat, setMeshiHat] = useState<MeshiHat>("none");
  const [showGreeting, setShowGreeting] = useState(false);
  const [greetingText, setGreetingText] = useState("");
  const [lastPath, setLastPath] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchingText, setSearchingText] = useState("");
  const [chatHistory, setChatHistory] = useState<Array<{ q: string; a: string; time: Date }>>([]);

  // Mesh-aware data
  const [meshEntities, setMeshEntities] = useState<MeshGraphEntity[]>([]);
  const [meshStats, setMeshStats] = useState<{ followers: number; following: number; posts: number; communities: number; platforms: number }>({ followers: 0, following: 0, posts: 0, communities: 0, platforms: 0 });

  // === UNIFIED MESHI POSITION STATE ===
  const [behavior, setBehavior] = useState<MeshiBehavior>("home");
  const [meshiSize, setMeshiSize] = useState(HOME_SIZE);
  const meshiX = useMotionValue(HOME_POSITION.x);
  const meshiY = useMotionValue(HOME_POSITION.y);
  const springX = useSpring(meshiX, { stiffness: 120, damping: 20, mass: 0.8 });
  const springY = useSpring(meshiY, { stiffness: 120, damping: 20, mass: 0.8 });

  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [wasDragged, setWasDragged] = useState(false);
  const [dragOverElement, setDragOverElement] = useState<string | null>(null);
  const dragStartRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  // Dynamic state
  const [isIdle, setIsIdle] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const [clickBurst, setClickBurst] = useState(false);
  const mouseRef = useRef({ x: 0, y: 0 });
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roamTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hasGreetedThisPage, setHasGreetedThisPage] = useState(false);
  const [isPageTransitioning, setIsPageTransitioning] = useState(false);

  // Speech bubble state
  const [speechBubbles, setSpeechBubbles] = useState<Array<{
    id: string; text: string; role: "user" | "meshi"; timestamp: number;
  }>>([]);
  const [speechInput, setSpeechInput] = useState("");
  const [isMeshiTyping, setIsMeshiTyping] = useState(false);
  const speechInputRef = useRef<HTMLInputElement>(null);

  const pathname = usePathname();

  // Load Meshi enabled preference
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("meshiEnabled");
      if (stored === "false") setMeshiEnabled(false);
    }
  }, []);

  // Load Meshi customization from DB
  useEffect(() => {
    getMeshiPreference().then((pref) => {
      if (pref) {
        if (pref.faceStyle) setMood(pref.faceStyle as MeshiMood);
        if (pref.colorTheme) setMeshiColor(pref.colorTheme as MeshiColor);
        if (pref.hatStyle) setMeshiHat(pref.hatStyle as MeshiHat);
      }
    }).catch(() => { /* use defaults */ });
  }, []);

  // Listen for settings changes
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

  // Fetch mesh graph data
  useEffect(() => {
    let cancelled = false;
    getMeshGraphData().then((data) => {
      if (!cancelled) { setMeshEntities(data.entities); setMeshStats(data.stats); }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [pathname]);

  // PAGE TRANSITION — Meshi flies across the screen
  useEffect(() => {
    if (!meshiEnabled) return;
    if (pathname !== lastPath && lastPath !== "") {
      setIsPageTransitioning(true);
      setBehavior("traveling");
      setMood("excited");
      setMeshiSize(FLOAT_SIZE);

      const w = window.innerWidth;
      const h = window.innerHeight;
      const midX = w * 0.3 + Math.random() * w * 0.4;
      const midY = h * 0.2 + Math.random() * h * 0.3;
      meshiX.set(midX);
      meshiY.set(midY);

      const settleTimer = setTimeout(() => {
        setIsPageTransitioning(false);
        setBehavior("roaming");
        meshiX.set(w - 80);
        meshiY.set(h - 80);
        setMeshiSize(FLOAT_SIZE);
      }, 1200);

      const homeTimer = setTimeout(() => {
        if (view === "closed") {
          setBehavior("home");
          meshiX.set(HOME_POSITION.x);
          meshiY.set(HOME_POSITION.y);
          setMeshiSize(HOME_SIZE);
        }
      }, 8000);

      setLastPath(pathname);
      setHasGreetedThisPage(false);
      return () => { clearTimeout(settleTimer); clearTimeout(homeTimer); };
    }
    if (lastPath === "") setLastPath(pathname);
  }, [pathname, lastPath, meshiEnabled, view, meshiX, meshiY]);

  // Contextual greeting on page navigation
  useEffect(() => {
    if (!meshiEnabled || hasGreetedThisPage || view !== "closed") return;
    const matchedKey = Object.keys(GREETINGS).find((key) => pathname.startsWith(key));
    if (matchedKey) {
      const greeting = GREETINGS[matchedKey];
      setGreetingText(greeting.text);
      setMood(greeting.mood);
      setHasGreetedThisPage(true);
      let hideTimer: ReturnType<typeof setTimeout>;
      const showTimer = setTimeout(() => {
        setShowGreeting(true);
        hideTimer = setTimeout(() => setShowGreeting(false), 4000);
      }, 1500);
      return () => { clearTimeout(showTimer); clearTimeout(hideTimer); };
    }
  }, [pathname, hasGreetedThisPage, view, meshiEnabled]);

  // USER INTERACTION REACTIONS
  useEffect(() => {
    if (!meshiEnabled) return;

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
      if (isIdle) setIsIdle(false);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => setIsIdle(true), 20000);
      if (behavior === "home") {
        const dist = Math.sqrt(
          Math.pow(e.clientX - HOME_POSITION.x, 2) + Math.pow(e.clientY - HOME_POSITION.y, 2)
        );
        if (dist < 100) setMood("excited");
      }
      if (behavior === "roaming" && !isDragging && view === "closed") {
        const targetX = e.clientX + (e.clientX > window.innerWidth / 2 ? -80 : 80);
        const targetY = e.clientY + 60;
        meshiX.set(Math.max(20, Math.min(window.innerWidth - 80, targetX)));
        meshiY.set(Math.max(20, Math.min(window.innerHeight - 80, targetY)));
      }
    };

    const handleKeyDown = () => {
      if (!isTyping) setIsTyping(true);
      if (isIdle) setIsIdle(false);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => setIsIdle(true), 20000);
      if (behavior === "home" && view === "closed") setMood("thinking");
    };
    const handleKeyUp = () => {
      setTimeout(() => setIsTyping(false), 2000);
    };

    const handleClick = (e: MouseEvent) => {
      if (behavior === "home" || behavior === "roaming") {
        setClickBurst(true);
        setTimeout(() => setClickBurst(false), 400);
        if (view === "closed") setMood("happy");
      }
      if (behavior === "home" && view === "closed") {
        const dist = Math.sqrt(
          Math.pow(e.clientX - HOME_POSITION.x, 2) + Math.pow(e.clientY - HOME_POSITION.y, 2)
        );
        if (dist > 400 && Math.random() > 0.7) {
          setBehavior("roaming");
          setMeshiSize(FLOAT_SIZE);
          meshiX.set(Math.max(20, Math.min(window.innerWidth - 80,
            e.clientX + (Math.random() > 0.5 ? 60 : -60))));
          meshiY.set(Math.max(20, Math.min(window.innerHeight - 80, e.clientY + 60)));
          if (roamTimerRef.current) clearTimeout(roamTimerRef.current);
          roamTimerRef.current = setTimeout(() => {
            if (view === "closed") {
              setBehavior("home");
              meshiX.set(HOME_POSITION.x);
              meshiY.set(HOME_POSITION.y);
              setMeshiSize(HOME_SIZE);
            }
          }, 5000);
        }
      }
    };

    const handleScroll = () => {
      setIsScrolling(true);
      if (isIdle) setIsIdle(false);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => setIsIdle(true), 20000);
      setTimeout(() => setIsScrolling(false), 300);
      if (behavior === "home") setMood("happy");
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("keydown", handleKeyDown, { passive: true });
    window.addEventListener("keyup", handleKeyUp, { passive: true });
    window.addEventListener("click", handleClick, { passive: true });
    window.addEventListener("scroll", handleScroll, { passive: true });
    idleTimerRef.current = setTimeout(() => setIsIdle(true), 20000);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("click", handleClick);
      window.removeEventListener("scroll", handleScroll);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (roamTimerRef.current) clearTimeout(roamTimerRef.current);
    };
  }, [meshiEnabled, isIdle, isTyping, behavior, isDragging, view, meshiX, meshiY]);

  // IDLE BEHAVIOR — Meshi gets sleepy and returns home
  useEffect(() => {
    if (!meshiEnabled || view !== "closed") return;
    if (isIdle && behavior !== "traveling") {
      setMood("sleepy");
      if (behavior === "roaming") {
        setBehavior("home");
        meshiX.set(HOME_POSITION.x);
        meshiY.set(HOME_POSITION.y);
        setMeshiSize(HOME_SIZE);
      }
    } else if (isTyping && view === "closed") {
      setMood("thinking");
    }
  }, [isIdle, isTyping, behavior, view, meshiEnabled, meshiX, meshiY]);

  // AMBIENT MOOD CYCLE — Meshi's expression subtly shifts based on current page
  useEffect(() => {
    if (!meshiEnabled || view !== "closed" || isIdle || isTyping || isDragging) return;
    const matchedKey = Object.keys(PAGE_AMBIENT_MOODS).find((key) => pathname.startsWith(key));
    if (!matchedKey) return;
    const moods = PAGE_AMBIENT_MOODS[matchedKey];
    let idx = 0;
    const interval = setInterval(() => {
      // Only cycle mood when user isn't actively triggering other mood changes
      if (behavior === "home" || behavior === "roaming") {
        idx = (idx + 1) % moods.length;
        setMood(moods[idx]);
      }
    }, 8000);
    return () => clearInterval(interval);
  }, [pathname, meshiEnabled, view, isIdle, isTyping, isDragging, behavior]);

  // SCROLL DIRECTION REACTION — Meshi leans into scroll direction
  useEffect(() => {
    if (!meshiEnabled || view !== "closed") return;
    let lastScrollY = window.scrollY;
    const handleScrollDirection = () => {
      const delta = window.scrollY - lastScrollY;
      lastScrollY = window.scrollY;
      if (Math.abs(delta) > 50) {
        setMood(delta > 0 ? "cool" : "surprised");
        setBehavior("reacting");
        setTimeout(() => {
          if (view === "closed") setBehavior("home");
        }, 600);
      }
    };
    window.addEventListener("scroll", handleScrollDirection, { passive: true });
    return () => window.removeEventListener("scroll", handleScrollDirection);
  }, [meshiEnabled, view]);

  // RANDOM ROAM — 15% chance every 30s to briefly wander
  useEffect(() => {
    if (!meshiEnabled || behavior !== "home" || view !== "closed") return;
    const interval = setInterval(() => {
      if (Math.random() > 0.85 && !isIdle) {
        setBehavior("roaming");
        setMeshiSize(FLOAT_SIZE);
        setMood("happy");
        const w = window.innerWidth;
        const h = window.innerHeight;
        meshiX.set(w * 0.5 + (Math.random() - 0.5) * w * 0.4);
        meshiY.set(h * 0.3 + Math.random() * h * 0.3);
        if (roamTimerRef.current) clearTimeout(roamTimerRef.current);
        roamTimerRef.current = setTimeout(() => {
          setBehavior("home");
          meshiX.set(HOME_POSITION.x);
          meshiY.set(HOME_POSITION.y);
          setMeshiSize(HOME_SIZE);
          setMood("happy");
        }, 4000);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [meshiEnabled, behavior, view, isIdle, meshiX, meshiY]);

  // Speech bubble helpers
  const addSpeechBubble = useCallback((role: "user" | "meshi", text: string) => {
    const id = `${role}-${Date.now()}`;
    setSpeechBubbles((prev) => [...prev.slice(-4), { id, text, role, timestamp: Date.now() }]);
    setTimeout(() => {
      setSpeechBubbles((prev) => prev.filter((b) => b.id !== id));
    }, 12000);
  }, []);

  const triggerSearch = useCallback(() => {
    setIsSearching(true);
    setSearchingText("Looking through your mesh...");
    setMood("thinking");
    setView("closed");
    setBehavior("traveling");
    setMeshiSize(FLOAT_SIZE);
    setTimeout(() => setSearchingText("Scanning your connections..."), 800);
    setTimeout(() => setSearchingText("Checking connected platforms..."), 2000);
    setTimeout(() => setSearchingText("Preparing your summary..."), 3200);
    setTimeout(() => {
      setIsSearching(false);
      setSearchingText("");
      setMood("excited");
      setBehavior("roaming");
      setView("speech");
      // Build a real catch-up summary from mesh data
      const parts: string[] = [];
      if (meshStats.followers > 0) parts.push(`${meshStats.followers} follower${meshStats.followers !== 1 ? "s" : ""}`);
      if (meshStats.following > 0) parts.push(`following ${meshStats.following}`);
      if (meshStats.platforms > 0) parts.push(`${meshStats.platforms} platform${meshStats.platforms !== 1 ? "s" : ""} connected`);
      if (meshStats.communities > 0) parts.push(`${meshStats.communities} communit${meshStats.communities !== 1 ? "ies" : "y"}`);
      const summary = parts.length > 0
        ? `Here's your mesh at a glance: ${parts.join(", ")}. Everything's looking good!`
        : "Your mesh is just getting started! Try connecting platforms, following people, or joining communities.";
      addSpeechBubble("meshi", summary);
    }, 4500);
  }, [addSpeechBubble, meshStats]);

  const getQuickResponse = useCallback((query: string): { text: string; mood: MeshiMood } => {
    const q = query.toLowerCase().trim();
    if (q.includes("mesh") && (q.includes("what") || q.includes("how") || q.includes("work")))
      return { text: "The Mesh is your entire digital universe visualized! Every connection as a glowing node.", mood: "excited" };
    if (q.includes("mechat") || q.includes("message") || q.includes("chat"))
      return { text: "MeChat merges all your conversations across platforms! Encrypted and private.", mood: "love" };
    if (q.includes("privacy") || q.includes("secure") || q.includes("safe"))
      return { text: "Privacy is #1! We never sell data, never track you, and you control everything.", mood: "cool" };
    if (q.includes("meshi") || q.includes("who are you"))
      return { text: "I\u2019m Meshi! Your guide to the mesh. Pet me and I\u2019ll wiggle!", mood: "love" };
    if (q.includes("pro") || q.includes("premium"))
      return { text: "MeshPro is $4.99/mo \u2014 Digital Footprint Scanner, custom cosmetics, and analytics.", mood: "wink" };
    if (q.includes("hello") || q.includes("hi") || q.includes("hey"))
      return { text: "Hey there! What can I help you with?", mood: "happy" };
    if (q.includes("thank"))
      return { text: "Anytime! Pet me if you\u2019re feeling generous!", mood: "love" };
    return { text: "Great question! For a deeper dive, open the full chat.", mood: "thinking" };
  }, []);

  const handleSpeechSend = useCallback(() => {
    const text = speechInput.trim();
    if (!text || isMeshiTyping) return;
    setSpeechInput("");
    addSpeechBubble("user", text);
    setMood("thinking");
    setIsMeshiTyping(true);

    const isSearchQuery = SEARCH_TRIGGERS.some((trigger) => text.toLowerCase().includes(trigger));
    if (isSearchQuery && !isSearching) {
      setTimeout(() => { setIsMeshiTyping(false); triggerSearch(); }, 500);
      return;
    }

    setTimeout(() => {
      const response = getQuickResponse(text);
      setMood(response.mood);
      addSpeechBubble("meshi", response.text);
      setIsMeshiTyping(false);
      setChatHistory((prev) => [...prev.slice(-49), { q: text, a: response.text, time: new Date() }]);
    }, 800 + Math.random() * 600);
  }, [speechInput, isMeshiTyping, isSearching, addSpeechBubble, triggerSearch, getQuickResponse]);

  useEffect(() => {
    if (view === "speech") setTimeout(() => speechInputRef.current?.focus(), 100);
  }, [view]);

  const handleMoodChange = useCallback((newMood: MeshiMood) => { setMood(newMood); }, []);

  const activateMeshi = useCallback(() => {
    if (wasDragged) return;
    if (behavior === "home" && view === "closed") {
      setBehavior("roaming");
      setMeshiSize(FLOAT_SIZE);
      meshiX.set(window.innerWidth - 80);
      meshiY.set(window.innerHeight - 80);
      setView("speech");
      setMood("excited");
    } else if (view === "speech") {
      setView("closed");
      setSpeechBubbles([]);
      setTimeout(() => {
        setBehavior("home");
        meshiX.set(HOME_POSITION.x);
        meshiY.set(HOME_POSITION.y);
        setMeshiSize(HOME_SIZE);
      }, 300);
    } else {
      setView("speech");
      if (behavior !== "roaming") {
        setBehavior("roaming");
        setMeshiSize(FLOAT_SIZE);
        meshiX.set(window.innerWidth - 80);
        meshiY.set(window.innerHeight - 80);
      }
    }
  }, [behavior, view, wasDragged, meshiX, meshiY]);

  const detectElementUnderMeshi = useCallback((x: number, y: number) => {
    for (const zone of ELEMENT_ZONES) {
      const el = document.querySelector(zone.selector);
      if (el) {
        const rect = el.getBoundingClientRect();
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return zone;
      }
    }
    return null;
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    dragStartRef.current = { x: e.clientX, y: e.clientY, px: springX.get(), py: springY.get() };
    setWasDragged(false);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [springX, springY]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      setIsDragging(true);
      setWasDragged(true);
      if (behavior === "home") { setBehavior("roaming"); setMeshiSize(FLOAT_SIZE); }
    }
    const maxX = (typeof window !== "undefined" ? window.innerWidth : 1024) - 56;
    const maxY = (typeof window !== "undefined" ? window.innerHeight : 768) - 56;
    meshiX.set(Math.max(0, Math.min(maxX, dragStartRef.current.px + dx)));
    meshiY.set(Math.max(0, Math.min(maxY, dragStartRef.current.py + dy)));
    setDragOverElement(detectElementUnderMeshi(e.clientX, e.clientY)?.label || null);
  }, [detectElementUnderMeshi, behavior, meshiX, meshiY]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragStartRef.current) return;
    const didDrag = wasDragged;
    dragStartRef.current = null;
    setIsDragging(false);
    const zone = detectElementUnderMeshi(e.clientX, e.clientY);
    if (zone && didDrag) {
      setMood("excited");
      setView("speech");
      addSpeechBubble("meshi", zone.description);
    }
    setDragOverElement(null);
    const distToHome = Math.sqrt(
      Math.pow(e.clientX - HOME_POSITION.x, 2) + Math.pow(e.clientY - HOME_POSITION.y, 2)
    );
    if (distToHome < 100 && didDrag) {
      setBehavior("home");
      meshiX.set(HOME_POSITION.x);
      meshiY.set(HOME_POSITION.y);
      setMeshiSize(HOME_SIZE);
    }
  }, [wasDragged, detectElementUnderMeshi, addSpeechBubble, meshiX, meshiY]);

  const goHome = useCallback(() => {
    setBehavior("home");
    meshiX.set(HOME_POSITION.x);
    meshiY.set(HOME_POSITION.y);
    setMeshiSize(HOME_SIZE);
    setView("closed");
  }, [meshiX, meshiY]);

  if (!meshiEnabled) return null;

  const isAtHome = behavior === "home";
  const currentSize = meshiSize;

  return (
    <>
      {/* Search Overlay */}
      <AnimatePresence>
        {isSearching && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] pointer-events-none flex items-center justify-center"
          >
            <motion.div
              className="flex flex-col items-center gap-3"
              animate={{ x: [0, 100, -80, 60, -40, 0], y: [0, -50, 30, -60, 20, 0] }}
              transition={{ duration: 4, ease: "easeInOut" }}
            >
              <motion.div
                animate={{ rotate: [0, 10, -10, 15, -5, 0] }}
                transition={{ duration: 0.8, repeat: Infinity }}
              >
                <MeshiMascot size={64} mood="thinking" color={meshiColor} hat={meshiHat} speaking showGlow />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="px-4 py-2 rounded-xl text-sm font-medium shadow-xl"
                style={{
                  background: "var(--bg-elevated)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--accent)",
                }}
              >
                {searchingText}
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Drag zone highlight */}
      <AnimatePresence>
        {isDragging && dragOverElement && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[70] px-4 py-2 rounded-xl text-sm font-medium shadow-xl"
            style={{ background: "var(--accent)", color: "white" }}
          >
            Drop to learn about: {dragOverElement}
          </motion.div>
        )}
      </AnimatePresence>

      {/* THE ONE MESHI — unified floating entity */}
      <AnimatePresence>
        {!isSearching && (
          <motion.div className="fixed z-40" style={{ left: springX, top: springY }}>
            {/* Speech bubbles */}
            {view === "speech" && (
              <div className="absolute bottom-full right-0 mb-2 flex flex-col items-end gap-2 w-[260px]">
                <AnimatePresence>
                  {speechBubbles.slice(-3).map((bubble) => (
                    <motion.div
                      key={bubble.id}
                      initial={{ opacity: 0, y: 15, scale: 0.8 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.9 }}
                      transition={{ type: "spring", damping: 20, stiffness: 300 }}
                      className={`max-w-[240px] px-3 py-2 rounded-2xl text-xs shadow-lg ${
                        bubble.role === "user"
                          ? "brand-button text-white rounded-br-sm self-end"
                          : "bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-primary)] rounded-bl-sm"
                      }`}
                    >
                      {bubble.role === "meshi" && (
                        <div className="flex items-start gap-1.5 mb-1">
                          <MeshiMascot size={16} mood={mood} color={meshiColor} hat={meshiHat} showGlow={false} animate={false} />
                          <span className="text-[10px] font-medium text-[var(--accent)]">Meshi</span>
                        </div>
                      )}
                      <p className="leading-relaxed">{bubble.text}</p>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {isMeshiTyping && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="px-3 py-2 rounded-2xl rounded-bl-sm bg-[var(--bg-elevated)] border border-[var(--border-primary)] shadow-lg"
                  >
                    <div className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <motion.div
                          key={i}
                          className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]"
                          animate={{ y: [0, -3, 0] }}
                          transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.12 }}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 w-full"
                >
                  <input
                    ref={speechInputRef}
                    type="text"
                    value={speechInput}
                    onChange={(e) => setSpeechInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSpeechSend()}
                    placeholder="Ask Meshi..."
                    className="flex-1 bg-[var(--bg-elevated)] border border-[var(--border-primary)] rounded-xl px-3 py-1.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] shadow-lg"
                  />
                  <button
                    onClick={handleSpeechSend}
                    disabled={!speechInput.trim()}
                    className="p-1.5 rounded-xl brand-button text-white disabled:opacity-40 shadow-lg"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </motion.div>
              </div>
            )}

            {/* Greeting bubble */}
            <AnimatePresence>
              {showGreeting && view === "closed" && !isAtHome && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 5, scale: 0.95 }}
                  className="absolute bottom-full right-0 mb-2 px-3 py-2 rounded-xl text-xs max-w-[200px] shadow-lg"
                  style={{
                    background: "var(--bg-elevated)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--border-primary)",
                  }}
                >
                  <div className="flex items-start gap-2">
                    <MeshiMascot size={20} mood={mood} color={meshiColor} hat={meshiHat} showGlow={false} />
                    <p>{greetingText}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* THE MESHI ENTITY */}
            <motion.div
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onClick={activateMeshi}
              onDoubleClick={() => setView("mini-mesh")}
              onContextMenu={(e) => { e.preventDefault(); setView("mini-mesh"); }}
              className={`rounded-full shadow-2xl transition-all cursor-pointer group relative ${
                isDragging
                  ? "ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--bg-primary)] cursor-grabbing"
                  : "hover:shadow-[0_0_24px_rgba(45,127,249,0.4)] cursor-grab"
              }`}
              style={{
                width: currentSize,
                height: currentSize,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "9999px",
                background: "var(--bg-elevated)",
                border: `2px solid ${dragOverElement ? "#10b981" : "var(--accent)"}`,
                boxShadow: isDragging ? "0 0 24px rgba(45,127,249,0.5)" : undefined,
                touchAction: "none",
              }}
              animate={{
                scale: clickBurst
                  ? [1, 1.2, 1]
                  : isScrolling && isAtHome
                    ? [1, 0.95, 1.05, 1]
                    : 1,
                rotate: isPageTransitioning
                  ? [0, 15, -15, 10, -5, 0]
                  : isDragging
                    ? [0, 5, -5, 3, 0]
                    : 0,
              }}
              transition={{
                duration: clickBurst ? 0.3 : isScrolling ? 0.4 : 0.5,
                ease: "easeOut",
              }}
            >
              <motion.div
                animate={
                  isDragging
                    ? { rotate: [0, 10, -10, 10, 0] }
                    : isIdle && isAtHome
                      ? { y: [0, -1, 0], opacity: [1, 0.7, 1] }
                      : isAtHome
                        ? { y: [0, -2, 0, -1, 0], rotate: [0, 1, -1, 0.5, 0] }
                        : { y: [0, -3, 0, -1, 0], rotate: [0, 2, -2, 1, 0] }
                }
                transition={
                  isDragging
                    ? { duration: 0.5, repeat: Infinity }
                    : isIdle
                      ? { duration: 3, repeat: Infinity, ease: "easeInOut" }
                      : { duration: 4, repeat: Infinity, ease: "easeInOut" }
                }
              >
                <MeshiMascot
                  size={currentSize - (isAtHome ? 8 : 12)}
                  mood={isDragging ? "excited" : mood}
                  color={meshiColor}
                  hat={meshiHat}
                  showGlow={!isAtHome}
                  interactive={!isAtHome}
                  onMoodChange={handleMoodChange}
                />
              </motion.div>

              {/* Beta badge — only when expanded */}
              {!isAtHome && (
                <div
                  className="absolute -top-2 -left-1 px-1 py-0.5 rounded text-[7px] font-bold uppercase tracking-wider text-white shadow-sm"
                  style={{ background: "var(--accent)" }}
                >
                  Beta
                </div>
              )}

              {/* Drag grip hint */}
              {!isAtHome && !isDragging && (
                <div className="absolute -bottom-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div
                    className="w-4 h-4 rounded-full flex items-center justify-center text-white"
                    style={{ background: "var(--accent)" }}
                  >
                    <GripVertical className="h-2.5 w-2.5" />
                  </div>
                </div>
              )}

              {/* Chat indicator */}
              {view === "closed" && !isDragging && !isAtHome && (
                <div className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div
                    className="w-4 h-4 rounded-full flex items-center justify-center text-white"
                    style={{ background: "var(--accent)" }}
                  >
                    <MessageCircle className="h-2.5 w-2.5" />
                  </div>
                </div>
              )}

              {/* Close button when speech is open */}
              {view === "speech" && (
                <div className="absolute -top-1 -right-1">
                  <div
                    className="w-4 h-4 rounded-full flex items-center justify-center text-white"
                    style={{ background: "var(--accent)" }}
                  >
                    <X className="h-2.5 w-2.5" />
                  </div>
                </div>
              )}
            </motion.div>

            {/* Quick access buttons — only when expanded */}
            {!isAtHome && view === "closed" && (
              <div className="flex gap-1 mt-1 justify-center">
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 0.6, scale: 1 }}
                  whileHover={{ opacity: 1, scale: 1.1 }}
                  onClick={() => setView("mini-mesh")}
                  className="p-1.5 rounded-full"
                  style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-primary)" }}
                  aria-label="Meshi menu"
                >
                  <Sparkles className="h-3.5 w-3.5" style={{ color: "var(--accent)" }} />
                </motion.button>
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 0.6, scale: 1 }}
                  whileHover={{ opacity: 1, scale: 1.1 }}
                  onClick={() => setView("chat")}
                  className="p-1.5 rounded-full"
                  style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-primary)" }}
                  aria-label="Full chat"
                >
                  <MessageCircle className="h-3.5 w-3.5" style={{ color: "var(--accent)" }} />
                </motion.button>
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 0.5, scale: 1 }}
                  whileHover={{ opacity: 1, scale: 1.1 }}
                  onClick={goHome}
                  className="p-1.5 rounded-full text-[8px]"
                  style={{
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border-primary)",
                    color: "var(--text-muted)",
                  }}
                  title="Return to logo"
                >
                  {"\u2190"}
                </motion.button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mini Mesh Panel */}
      <AnimatePresence>
        {view === "mini-mesh" && (
          <motion.div
            initial={{ opacity: 0, x: 20, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-4 right-4 z-50 w-[320px] max-w-[calc(100vw-2rem)] glass-dropdown rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            style={{ maxHeight: "calc(100vh - 6rem)" }}
          >
            <div
              className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-primary)]"
              style={{ background: "var(--bg-secondary)" }}
            >
              <MeshiMascot size={32} mood="happy" color={meshiColor} hat={meshiHat} showGlow={false} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  {"Meshi\u2019s Mesh"}{" "}
                  <span
                    className="text-[8px] font-bold uppercase tracking-wider px-1 py-0.5 rounded text-white ml-1"
                    style={{ background: "var(--accent)" }}
                  >
                    Beta
                  </span>
                </p>
                <p className="text-[10px] text-[var(--text-muted)]">{"Your buddy\u2019s corner"}</p>
              </div>
              <button
                onClick={goHome}
                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4" style={{ background: "var(--bg-primary)" }}>
              <div className="relative h-32 rounded-xl overflow-hidden" style={{ background: "var(--bg-tertiary)" }}>
                <svg className="w-full h-full" viewBox="0 0 200 100">
                  <circle cx="100" cy="50" r="12" fill="#2d7ff9" opacity="0.9">
                    <animate attributeName="r" values="12;14;12" dur="2s" repeatCount="indefinite" />
                  </circle>
                  {[
                    { x: 40, y: 25, label: "Chat", color: "#3b82f6" },
                    { x: 160, y: 25, label: "Search", color: "#06b6d4" },
                    { x: 30, y: 75, label: "Guide", color: "#10b981" },
                    { x: 170, y: 75, label: "Style", color: "#f59e0b" },
                    { x: 100, y: 10, label: "Summary", color: "#0ea5e9" },
                    { x: 100, y: 90, label: "History", color: "#38bdf8" },
                  ].map((node, i) => (
                    <g key={node.label}>
                      <line
                        x1="100" y1="50" x2={node.x} y2={node.y}
                        stroke={node.color} strokeWidth="0.8" opacity="0.4"
                      >
                        <animate attributeName="opacity" values="0.2;0.6;0.2" dur={`${2 + i * 0.3}s`} repeatCount="indefinite" />
                      </line>
                      <circle cx={node.x} cy={node.y} r="6" fill={node.color} opacity="0.7">
                        <animate attributeName="opacity" values="0.5;0.9;0.5" dur={`${2 + i * 0.2}s`} repeatCount="indefinite" />
                      </circle>
                      <text x={node.x} y={node.y + 14} textAnchor="middle" fontSize="6" fill="var(--text-muted)" opacity="0.8">
                        {node.label}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
            </div>

            <div className="px-4 pb-4 space-y-1.5">
              <button
                onClick={() => setView("speech")}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-left hover:bg-[var(--bg-hover)] transition-colors"
                style={{ color: "var(--text-primary)" }}
              >
                <MessageCircle className="h-4 w-4" style={{ color: "var(--accent)" }} />
                <span className="flex-1">Ask Meshi</span>
                <ChevronRight className="h-3.5 w-3.5 text-[var(--text-muted)]" />
              </button>
              <button
                onClick={() => triggerSearch()}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-left hover:bg-[var(--bg-hover)] transition-colors"
                style={{ color: "var(--text-primary)" }}
              >
                <Sparkles className="h-4 w-4" style={{ color: "#f59e0b" }} />
                <span className="flex-1">What did I miss?</span>
                <ChevronRight className="h-3.5 w-3.5 text-[var(--text-muted)]" />
              </button>
              <button
                onClick={() => { if (typeof window !== "undefined") window.location.href = "/settings?tab=meshi"; }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-left hover:bg-[var(--bg-hover)] transition-colors"
                style={{ color: "var(--text-primary)" }}
              >
                <Palette className="h-4 w-4" style={{ color: "#0ea5e9" }} />
                <span className="flex-1">Customize Meshi</span>
                <ChevronRight className="h-3.5 w-3.5 text-[var(--text-muted)]" />
              </button>
              <button
                onClick={() => { if (typeof window !== "undefined") window.location.href = "/settings?tab=privacy"; }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-left hover:bg-[var(--bg-hover)] transition-colors"
                style={{ color: "var(--text-primary)" }}
              >
                <Settings className="h-4 w-4" style={{ color: "#38bdf8" }} />
                <span className="flex-1">Mesh Privacy</span>
                <ChevronRight className="h-3.5 w-3.5 text-[var(--text-muted)]" />
              </button>

              {chatHistory.length > 0 && (
                <div className="pt-2 mt-2 border-t border-[var(--border-primary)]">
                  <div className="flex items-center gap-2 px-3 py-1 mb-1">
                    <History className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                    <span className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider">
                      Recent chats
                    </span>
                  </div>
                  {chatHistory.slice(-3).reverse().map((entry, i) => (
                    <button
                      key={i}
                      onClick={() => setView("speech")}
                      className="w-full px-3 py-1.5 text-xs text-[var(--text-tertiary)] truncate text-left hover:bg-[var(--bg-hover)] rounded-lg transition-colors"
                    >
                      <span className="text-[var(--text-secondary)]">You:</span> {entry.q}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div
              className="px-4 py-2 border-t border-[var(--border-primary)] flex items-center justify-between"
              style={{ background: "var(--bg-secondary)" }}
            >
              <div className="flex items-center gap-1 text-[9px] text-emerald-500 font-medium">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Zero data stored
              </div>
              <button
                onClick={() => setView("chat")}
                className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors flex items-center gap-1"
              >
                <HelpCircle className="h-3 w-3" />
                Full chat
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full Meshi Chat */}
      <MeshiChat isOpen={view === "chat"} onClose={goHome} meshData={meshStats} meshEntities={meshEntities} />
    </>
  );
}
