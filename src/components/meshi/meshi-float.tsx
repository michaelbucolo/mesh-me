"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence, useMotionValue, useSpring } from "framer-motion";
import { usePathname } from "next/navigation";
import {
  X, Sparkles, MessageCircle, Send, Search,
  ChevronRight, Palette, Settings, HelpCircle, History
} from "lucide-react";
import { MeshiMascot, type MeshiMood, type MeshiColor, type MeshiHat } from "./meshi-mascot";
import { MeshiChat } from "./meshi-chat";
import { getMeshGraphData, type MeshGraphEntity } from "@/lib/queries";
import { getMeshiPreference } from "@/lib/actions";

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

const MESHI_SIZE = 52;

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

  const [meshEntities, setMeshEntities] = useState<MeshGraphEntity[]>([]);
  const [meshStats, setMeshStats] = useState<{ followers: number; following: number; posts: number; communities: number; platforms: number }>({ followers: 0, following: 0, posts: 0, communities: 0, platforms: 0 });

  // Position starts bottom-right, no home position
  const meshiX = useMotionValue(typeof window !== "undefined" ? window.innerWidth - 80 : 900);
  const meshiY = useMotionValue(typeof window !== "undefined" ? window.innerHeight - 80 : 650);
  const springX = useSpring(meshiX, { stiffness: 200, damping: 25, mass: 0.6 });
  const springY = useSpring(meshiY, { stiffness: 200, damping: 25, mass: 0.6 });

  const [isDragging, setIsDragging] = useState(false);
  const [wasDragged, setWasDragged] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  const [isIdle, setIsIdle] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [clickBurst, setClickBurst] = useState(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hasGreetedThisPage, setHasGreetedThisPage] = useState(false);
  const [isPageTransitioning, setIsPageTransitioning] = useState(false);

  const [speechBubbles, setSpeechBubbles] = useState<Array<{
    id: string; text: string; role: "user" | "meshi"; timestamp: number;
  }>>([]);
  const [speechInput, setSpeechInput] = useState("");
  const [isMeshiTyping, setIsMeshiTyping] = useState(false);
  const speechInputRef = useRef<HTMLInputElement>(null);

  const pathname = usePathname();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("meshiEnabled");
      if (stored === "false") setMeshiEnabled(false);
    }
  }, []);

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

  useEffect(() => {
    let cancelled = false;
    getMeshGraphData().then((data) => {
      if (!cancelled) { setMeshEntities(data.entities); setMeshStats(data.stats); }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [pathname]);

  // Page transition bounce
  useEffect(() => {
    if (!meshiEnabled) return;
    if (pathname !== lastPath && lastPath !== "") {
      setIsPageTransitioning(true);
      setMood("excited");
      const timer = setTimeout(() => setIsPageTransitioning(false), 800);
      setLastPath(pathname);
      setHasGreetedThisPage(false);
      return () => clearTimeout(timer);
    }
    if (lastPath === "") setLastPath(pathname);
  }, [pathname, lastPath, meshiEnabled]);

  // Contextual greeting
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
    if (isIdle) setMood("sleepy");
    else if (isTyping) setMood("thinking");
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

  // Keep Meshi in view on resize
  useEffect(() => {
    const handleResize = () => {
      const maxX = window.innerWidth - 70;
      const maxY = window.innerHeight - 70;
      if (meshiX.get() > maxX) meshiX.set(maxX);
      if (meshiY.get() > maxY) meshiY.set(maxY);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [meshiX, meshiY]);

  const addSpeechBubble = useCallback((role: "user" | "meshi", text: string) => {
    const id = Date.now().toString() + Math.random().toString(36).slice(2);
    setSpeechBubbles((prev) => [...prev.slice(-4), { id, text, role, timestamp: Date.now() }]);
    setTimeout(() => { setSpeechBubbles((prev) => prev.filter((b) => b.id !== id)); }, 12000);
  }, []);

  const triggerSearch = useCallback(() => {
    setIsSearching(true);
    setSearchingText("Looking through your mesh...");
    setMood("thinking");
    setView("closed");
    const stats = meshStats;
    setTimeout(() => {
      setIsSearching(false);
      const summary = stats.followers + stats.following + stats.posts > 0
        ? `Found ${stats.followers} followers, ${stats.following} following, ${stats.posts} posts, ${stats.communities} communities across ${stats.platforms} platforms!`
        : "Your mesh is just getting started! Connect some platforms to see it grow.";
      setMood("excited");
      setView("speech");
      addSpeechBubble("meshi", summary);
    }, 3000);
  }, [meshStats, addSpeechBubble]);

  const getQuickResponse = useCallback((query: string): { text: string; mood: MeshiMood } => {
    const q = query.toLowerCase().trim();
    if (q.includes("mesh") && (q.includes("what") || q.includes("how") || q.includes("work")))
      return { text: "The Mesh is your entire digital universe visualized! Every connection as a glowing node.", mood: "excited" };
    if (q.includes("mechat") || q.includes("message") || q.includes("chat"))
      return { text: "MeChat merges all your conversations across platforms! Encrypted and private.", mood: "love" };
    if (q.includes("privacy") || q.includes("secure") || q.includes("safe"))
      return { text: "Privacy is #1! We never sell data, never track you, and you control everything.", mood: "cool" };
    if (q.includes("meshi") || q.includes("who are you"))
      return { text: "I\u2019m Meshi! Your guide to the mesh. I\u2019m always here to help!", mood: "love" };
    if (q.includes("pro") || q.includes("premium"))
      return { text: "MeshPro is $4.99/mo \u2014 Digital Footprint Scanner, custom cosmetics, and analytics.", mood: "wink" };
    if (q.includes("hello") || q.includes("hi") || q.includes("hey"))
      return { text: "Hey there! What can I help you with?", mood: "happy" };
    if (q.includes("thank"))
      return { text: "Anytime! Happy to help!", mood: "love" };
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

  const handleMeshiClick = useCallback(() => {
    if (wasDragged) return;
    if (view === "closed") { setView("actions"); setMood("excited"); }
    else if (view === "actions") { setView("closed"); }
    else if (view === "speech") { setView("closed"); setSpeechBubbles([]); }
    else { setView("closed"); }
  }, [view, wasDragged]);

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
    const maxX = (typeof window !== "undefined" ? window.innerWidth : 1024) - 56;
    const maxY = (typeof window !== "undefined" ? window.innerHeight : 768) - 56;
    meshiX.set(Math.max(0, Math.min(maxX, dragStartRef.current.px + dx)));
    meshiY.set(Math.max(0, Math.min(maxY, dragStartRef.current.py + dy)));
  }, [meshiX, meshiY]);

  const handlePointerUp = useCallback(() => {
    dragStartRef.current = null;
    setIsDragging(false);
  }, []);

  const closeAll = useCallback(() => { setView("closed"); setSpeechBubbles([]); }, []);

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
                <MeshiMascot size={64} mood="thinking" color={meshiColor} hat={meshiHat} speaking showGlow />
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="px-4 py-2 rounded-xl text-sm font-medium shadow-xl"
                style={{ background: "var(--bg-elevated)", color: "var(--text-primary)", border: "1px solid var(--accent)" }}>
                {searchingText}
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* THE ONE MESHI - standalone floating entity */}
      <AnimatePresence>
        {!isSearching && (
          <motion.div className="fixed z-40" style={{ left: springX, top: springY }}>
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
                />
              </motion.div>

              {/* Active ring when actions/speech open */}
              {view !== "closed" && view !== "chat" && (
                <motion.div className="absolute inset-0 rounded-full pointer-events-none"
                  style={{ border: "2px solid var(--accent)" }}
                  animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.2, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }} />
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actions Menu */}
      <AnimatePresence>
        {view === "actions" && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-20 right-4 z-50 w-[280px] max-w-[calc(100vw-2rem)] glass-dropdown rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-primary)]"
              style={{ background: "var(--bg-secondary)" }}>
              <MeshiMascot size={28} mood="happy" color={meshiColor} hat={meshiHat} showGlow={false} animate={false} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--text-primary)]">Meshi</p>
                <p className="text-[10px] text-[var(--text-muted)]">Your mesh.me AI</p>
              </div>
              <button onClick={closeAll}
                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-3 space-y-1">
              <button onClick={() => setView("speech")}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-left hover:bg-[var(--bg-hover)] transition-colors"
                style={{ color: "var(--text-primary)" }}>
                <MessageCircle className="h-4 w-4" style={{ color: "var(--accent)" }} />
                <span className="flex-1">Ask Meshi</span>
                <ChevronRight className="h-3.5 w-3.5 text-[var(--text-muted)]" />
              </button>
              <button onClick={() => triggerSearch()}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-left hover:bg-[var(--bg-hover)] transition-colors"
                style={{ color: "var(--text-primary)" }}>
                <Search className="h-4 w-4" style={{ color: "#f59e0b" }} />
                <span className="flex-1">What did I miss?</span>
                <ChevronRight className="h-3.5 w-3.5 text-[var(--text-muted)]" />
              </button>
              <button onClick={() => { if (typeof window !== "undefined") window.location.href = "/settings?tab=meshi"; }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-left hover:bg-[var(--bg-hover)] transition-colors"
                style={{ color: "var(--text-primary)" }}>
                <Palette className="h-4 w-4" style={{ color: "#0ea5e9" }} />
                <span className="flex-1">Customize Meshi</span>
                <ChevronRight className="h-3.5 w-3.5 text-[var(--text-muted)]" />
              </button>
              <button onClick={() => { if (typeof window !== "undefined") window.location.href = "/settings?tab=privacy"; }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-left hover:bg-[var(--bg-hover)] transition-colors"
                style={{ color: "var(--text-primary)" }}>
                <Settings className="h-4 w-4" style={{ color: "#38bdf8" }} />
                <span className="flex-1">Mesh Privacy</span>
                <ChevronRight className="h-3.5 w-3.5 text-[var(--text-muted)]" />
              </button>
              <button onClick={() => setView("chat")}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-left hover:bg-[var(--bg-hover)] transition-colors"
                style={{ color: "var(--text-primary)" }}>
                <HelpCircle className="h-4 w-4" style={{ color: "#a78bfa" }} />
                <span className="flex-1">Full Chat</span>
                <ChevronRight className="h-3.5 w-3.5 text-[var(--text-muted)]" />
              </button>

              {chatHistory.length > 0 && (
                <div className="pt-2 mt-1 border-t border-[var(--border-primary)]">
                  <div className="flex items-center gap-2 px-3 py-1 mb-1">
                    <History className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                    <span className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider">Recent</span>
                  </div>
                  {chatHistory.slice(-3).reverse().map((entry, i) => (
                    <button key={i} onClick={() => setView("speech")}
                      className="w-full px-3 py-1.5 text-xs text-[var(--text-tertiary)] truncate text-left hover:bg-[var(--bg-hover)] rounded-lg transition-colors">
                      <span className="text-[var(--text-secondary)]">You:</span> {entry.q}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="px-4 py-2 border-t border-[var(--border-primary)] flex items-center justify-between"
              style={{ background: "var(--bg-secondary)" }}>
              <div className="flex items-center gap-1 text-[9px] text-emerald-500 font-medium">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Zero data stored
              </div>
              <span className="text-[9px] text-[var(--text-muted)]">
                <Sparkles className="h-3 w-3 inline" /> mesh.me AI
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full Meshi Chat */}
      <MeshiChat isOpen={view === "chat"} onClose={closeAll} meshData={meshStats} meshEntities={meshEntities} />
    </>
  );
}
