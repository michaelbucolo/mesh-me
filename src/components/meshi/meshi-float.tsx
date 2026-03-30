"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import {
  X, Settings, History, Sparkles, MessageCircle,
  ChevronRight, Palette, HelpCircle, Send, GripVertical
} from "lucide-react";
import { MeshiMascot, type MeshiMood } from "./meshi-mascot";
import { MeshiChat } from "./meshi-chat";
import { getMeshGraphData, type MeshGraphEntity } from "@/lib/queries";

// Meshi contextual greetings per route
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
};

// Keywords that trigger visual search (only when contextually relevant)
const SEARCH_TRIGGERS = ["search", "find", "look for", "where", "show me"];

// Element detection zones for drag-to-learn
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

// Default position: logo area (top-left)
const LOGO_POSITION = { x: 16, y: 16 };

/**
 * Global floating Meshi \u2014 a real entity that lives across the entire app.
 * Features: contextual greetings, mini-mesh sidebar, visual search animation,
 * chat history, and personality that makes Meshi feel alive.
 */
export function MeshiFloat() {
  const [meshiEnabled, setMeshiEnabled] = useState(true);
  const [view, setView] = useState<MeshiView>("closed");
  const [mood, setMood] = useState<MeshiMood>("happy");
  const [showGreeting, setShowGreeting] = useState(false);
  const [greetingText, setGreetingText] = useState("");
  const [lastPath, setLastPath] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchingText, setSearchingText] = useState("");
  const [chatHistory, setChatHistory] = useState<Array<{ q: string; a: string; time: Date }>>([]);

  // Mesh-aware data
  const [meshEntities, setMeshEntities] = useState<MeshGraphEntity[]>([]);
  const [meshStats, setMeshStats] = useState<{ followers: number; following: number; posts: number; communities: number; platforms: number }>({ followers: 0, following: 0, posts: 0, communities: 0, platforms: 0 });

  // Drag state
  const [position, setPosition] = useState(LOGO_POSITION);
  const [isDragging, setIsDragging] = useState(false);
  const [wasDragged, setWasDragged] = useState(false);
  const [dragOverElement, setDragOverElement] = useState<string | null>(null);
  const [showDragHint, setShowDragHint] = useState(false);
  const meshiRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  // Speech bubble state — messages appear as floating bubbles near Meshi
  const [speechBubbles, setSpeechBubbles] = useState<Array<{
    id: string;
    text: string;
    role: "user" | "meshi";
    timestamp: number;
  }>>([]);
  const [speechInput, setSpeechInput] = useState("");
  const [isMeshiTyping, setIsMeshiTyping] = useState(false);
  const speechInputRef = useRef<HTMLInputElement>(null);

  const pathname = usePathname();

  // Load Meshi enabled preference from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("meshiEnabled");
      if (stored === "false") setMeshiEnabled(false);
      const savedPos = localStorage.getItem("meshiPosition");
      if (savedPos) {
        try {
          const parsed = JSON.parse(savedPos);
          if (typeof parsed.x === "number" && typeof parsed.y === "number") {
            setPosition(parsed);
          }
        } catch { /* ignore */ }
      }
      // Show drag hint on first visit
      if (!localStorage.getItem("meshiDragHintSeen")) {
        const timer = setTimeout(() => {
          setShowDragHint(true);
          setTimeout(() => {
            setShowDragHint(false);
            localStorage.setItem("meshiDragHintSeen", "1");
          }, 6000);
        }, 3000);
        return () => clearTimeout(timer);
      }
    }
  }, []);

  // Fetch mesh graph data for Meshi awareness
  useEffect(() => {
    let cancelled = false;
    getMeshGraphData().then((data) => {
      if (!cancelled) {
        setMeshEntities(data.entities);
        setMeshStats(data.stats);
      }
    }).catch(() => { /* ignore fetch errors */ });
    return () => { cancelled = true; };
  }, [pathname]);

  // Listen for changes from settings page
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "meshiEnabled") {
        setMeshiEnabled(e.newValue !== "false");
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // Contextual greeting on page navigation
  useEffect(() => {
    if (!meshiEnabled) return;
    if (pathname !== lastPath && view === "closed") {
      setLastPath(pathname);
      const matchedKey = Object.keys(GREETINGS).find((key) => pathname.startsWith(key));
      if (matchedKey) {
        const greeting = GREETINGS[matchedKey];
        setGreetingText(greeting.text);
        setMood(greeting.mood);
        let hideTimer: ReturnType<typeof setTimeout>;
        const showTimer = setTimeout(() => {
          setShowGreeting(true);
          hideTimer = setTimeout(() => setShowGreeting(false), 4000);
        }, 1500);
        return () => {
          clearTimeout(showTimer);
          clearTimeout(hideTimer);
        };
      }
    }
  }, [pathname, lastPath, view, meshiEnabled]);

  // Add a speech bubble
  const addSpeechBubble = useCallback((role: "user" | "meshi", text: string) => {
    const id = `${role}-${Date.now()}`;
    setSpeechBubbles((prev) => [...prev.slice(-4), { id, text, role, timestamp: Date.now() }]);
    setTimeout(() => {
      setSpeechBubbles((prev) => prev.filter((b) => b.id !== id));
    }, 12000);
  }, []);

  // Meshi visual search \u2014 bounces around the screen searching
  const triggerSearch = useCallback((_query: string) => {
    setIsSearching(true);
    setSearchingText("Looking through your mesh...");
    setMood("thinking");
    setView("closed");
    setTimeout(() => setSearchingText("Scanning your mesh..."), 800);
    setTimeout(() => setSearchingText("Checking connected platforms..."), 2000);
    setTimeout(() => setSearchingText("Gathering results..."), 3200);
    setTimeout(() => {
      setIsSearching(false);
      setSearchingText("");
      setMood("excited");
      setView("speech");
      addSpeechBubble("meshi", "Here\u2019s what I found! Your mesh is looking great. Want me to dig deeper?");
    }, 4500);
  }, [addSpeechBubble]);

  // Handle speech input
  const handleSpeechSend = useCallback(() => {
    const text = speechInput.trim();
    if (!text || isMeshiTyping) return;
    setSpeechInput("");
    addSpeechBubble("user", text);
    setMood("thinking");
    setIsMeshiTyping(true);

    const isSearchQuery = SEARCH_TRIGGERS.some((trigger) => text.toLowerCase().includes(trigger));

    if (isSearchQuery && !isSearching) {
      setTimeout(() => {
        setIsMeshiTyping(false);
        triggerSearch(text);
      }, 500);
      return;
    }

    setTimeout(() => {
      const response = getQuickResponse(text);
      setMood(response.mood);
      addSpeechBubble("meshi", response.text);
      setIsMeshiTyping(false);
      setChatHistory((prev) => [...prev.slice(-49), { q: text, a: response.text, time: new Date() }]);
    }, 800 + Math.random() * 600);
  }, [speechInput, isMeshiTyping, isSearching, addSpeechBubble, triggerSearch]);

  // Quick response for speech bubbles
  const getQuickResponse = (query: string): { text: string; mood: MeshiMood } => {
    const q = query.toLowerCase().trim();
    if (q.includes("mesh") && (q.includes("what") || q.includes("how") || q.includes("work")))
      return { text: "The Mesh is your entire digital universe visualized! Every connection as a glowing node.", mood: "excited" };
    if (q.includes("mechat") || q.includes("message") || q.includes("chat"))
      return { text: "MeChat merges all your conversations across platforms! Encrypted and private.", mood: "love" };
    if (q.includes("privacy") || q.includes("secure") || q.includes("safe"))
      return { text: "Privacy is #1! We never sell data, never track you, and you control everything.", mood: "cool" };
    if (q.includes("meshi") || q.includes("who are you"))
      return { text: "I\u2019m Meshi! Your AI guide to the mesh. Pet me and I\u2019ll wiggle!", mood: "love" };
    if (q.includes("pro") || q.includes("premium"))
      return { text: "MeshPro is $4.99/mo \u2014 Digital Footprint Scanner, custom cosmetics, and analytics.", mood: "wink" };
    if (q.includes("hello") || q.includes("hi") || q.includes("hey"))
      return { text: "Hey there! What can I help you with?", mood: "happy" };
    if (q.includes("thank"))
      return { text: "Anytime! Pet me if you\u2019re feeling generous!", mood: "love" };
    return { text: "Great question! For a deeper dive, open the full chat.", mood: "thinking" };
  };

  // Focus speech input when speech mode opens
  useEffect(() => {
    if (view === "speech") {
      setTimeout(() => speechInputRef.current?.focus(), 100);
    }
  }, [view]);

  // Handle Meshi mood changes from petting
  const handleMoodChange = useCallback((newMood: MeshiMood) => {
    setMood(newMood);
  }, []);

  // Drag-to-learn: detect element under Meshi
  const detectElementUnderMeshi = useCallback((x: number, y: number) => {
    for (const zone of ELEMENT_ZONES) {
      const el = document.querySelector(zone.selector);
      if (el) {
        const rect = el.getBoundingClientRect();
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
          return zone;
        }
      }
    }
    return null;
  }, []);

  // Pointer drag handlers
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    dragStartRef.current = { x: e.clientX, y: e.clientY, px: position.x, py: position.y };
    setWasDragged(false);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [position]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      setIsDragging(true);
      setWasDragged(true);
    }
    const newX = dragStartRef.current.px + dx;
    const newY = dragStartRef.current.py + dy;
    const maxX = (typeof window !== "undefined" ? window.innerWidth : 1024) - 56;
    const maxY = (typeof window !== "undefined" ? window.innerHeight : 768) - 56;
    setPosition({ x: Math.max(0, Math.min(maxX, newX)), y: Math.max(0, Math.min(maxY, newY)) });
    const zone = detectElementUnderMeshi(e.clientX, e.clientY);
    setDragOverElement(zone?.label || null);
  }, [detectElementUnderMeshi]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragStartRef.current) return;
    const didDrag = wasDragged;
    dragStartRef.current = null;
    setIsDragging(false);
    // Drag-to-learn: show explanation for zone
    const zone = detectElementUnderMeshi(e.clientX, e.clientY);
    if (zone && didDrag) {
      setMood("excited");
      setView("speech");
      addSpeechBubble("meshi", zone.description);
    }
    setDragOverElement(null);
    // Snap to logo position if close
    const distToLogo = Math.sqrt(
      Math.pow(position.x - LOGO_POSITION.x, 2) + Math.pow(position.y - LOGO_POSITION.y, 2)
    );
    if (distToLogo < 80) {
      setPosition(LOGO_POSITION);
      localStorage.setItem("meshiPosition", JSON.stringify(LOGO_POSITION));
    } else {
      localStorage.setItem("meshiPosition", JSON.stringify(position));
    }
  }, [position, wasDragged, detectElementUnderMeshi, addSpeechBubble]);

  // Reset to logo position
  const resetToLogo = useCallback(() => {
    setPosition(LOGO_POSITION);
    localStorage.setItem("meshiPosition", JSON.stringify(LOGO_POSITION));
  }, []);

  const isAtLogo = Math.abs(position.x - LOGO_POSITION.x) < 5 && Math.abs(position.y - LOGO_POSITION.y) < 5;

  if (!meshiEnabled) return null;

  return (
    <>
      {/* === Meshi Visual Search Overlay === */}
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
                <MeshiMascot size={64} mood="thinking" color="blue" speaking showGlow />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="px-4 py-2 rounded-xl text-sm font-medium shadow-xl"
                style={{ background: "var(--bg-elevated)", color: "var(--text-primary)", border: "1px solid var(--accent)" }}
              >
                {searchingText}
              </motion.div>
            </motion.div>
            <motion.div
              className="absolute inset-0"
              style={{ background: "radial-gradient(circle at 50% 50%, transparent 30%, rgba(45,127,249,0.03) 70%)" }}
              animate={{ opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Drag zone highlight */}
      <AnimatePresence>
        {isDragging && dragOverElement && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[70] px-4 py-2 rounded-xl text-sm font-medium shadow-xl"
            style={{ background: "var(--accent)", color: "white" }}>
            Drop to learn about: {dragOverElement}
          </motion.div>
        )}
      </AnimatePresence>

      {/* === Floating Meshi Button + Speech Bubbles === */}
      <AnimatePresence>
        {(view === "closed" || view === "speech") && !isSearching && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="fixed top-0 left-0 z-40 flex flex-col items-end gap-2"
            style={{ transform: `translate(${position.x}px, ${position.y}px)`, touchAction: "none" }}
          >
            {/* Speech bubbles that float near Meshi */}
            <AnimatePresence>
              {view === "speech" && speechBubbles.slice(-3).map((bubble) => (
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
                      <MeshiMascot size={16} mood={mood} color="blue" showGlow={false} animate={false} />
                      <span className="text-[10px] font-medium text-[var(--accent)]">Meshi</span>
                    </div>
                  )}
                  <p className="leading-relaxed">{bubble.text}</p>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Meshi typing indicator */}
            {isMeshiTyping && view === "speech" && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="px-3 py-2 rounded-2xl rounded-bl-sm bg-[var(--bg-elevated)] border border-[var(--border-primary)] shadow-lg"
              >
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <motion.div key={i} className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]"
                      animate={{ y: [0, -3, 0] }}
                      transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.12 }}
                    />
                  ))}
                </div>
              </motion.div>
            )}

            {/* Speech input bar */}
            {view === "speech" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 w-[260px]"
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
            )}

            {/* First-time drag hint */}
            <AnimatePresence>
              {showDragHint && view === "closed" && !isDragging && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 5, scale: 0.95 }}
                  className="px-3 py-2 rounded-xl text-xs max-w-[220px] shadow-lg"
                  style={{ background: "var(--bg-elevated)", color: "var(--text-primary)", border: "1px solid var(--accent)" }}
                >
                  <div className="flex items-start gap-2">
                    <GripVertical className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" style={{ color: "var(--accent)" }} />
                    <p><strong>Tip:</strong> Drag me to any part of the screen to learn about it! Click me to chat.</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Greeting bubble */}
            <AnimatePresence>
              {showGreeting && view === "closed" && !showDragHint && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 5, scale: 0.95 }}
                  className="px-3 py-2 rounded-xl text-xs max-w-[200px] shadow-lg"
                  style={{ background: "var(--bg-elevated)", color: "var(--text-primary)", border: "1px solid var(--border-primary)" }}
                >
                  <div className="flex items-start gap-2">
                    <MeshiMascot size={20} mood={mood} color="blue" showGlow={false} />
                    <p>{greetingText}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Main Meshi button — draggable interactive bubble */}
            <motion.div className="relative">
              <motion.button
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  if (wasDragged) return;
                  if (view === "speech") {
                    setView("closed");
                    setSpeechBubbles([]);
                  } else {
                    setView("speech");
                  }
                }}
                onDoubleClick={() => setView("mini-mesh")}
                onContextMenu={(e) => { e.preventDefault(); setView("mini-mesh"); }}
                className={`rounded-full shadow-2xl transition-shadow group relative cursor-grab active:cursor-grabbing ${
                  isDragging ? "ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--bg-primary)]" : "hover:shadow-[0_0_24px_rgba(45,127,249,0.4)]"
                }`}
                style={{
                  width: 56, height: 56,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  aspectRatio: "1 / 1",
                  borderRadius: "9999px",
                  background: "var(--bg-elevated)",
                  border: `2px solid ${dragOverElement ? "#10b981" : "var(--accent)"}`,
                  boxShadow: isDragging ? "0 0 24px rgba(45,127,249,0.5)" : undefined,
                }}
                aria-label="Talk to Meshi (Beta)"
                title="Click to chat \u2022 Right-click for menu"
              >
                <motion.div
                  animate={isDragging ? { rotate: [0, 10, -10, 10, 0] } : { y: [0, -3, 0, -1, 0], rotate: [0, 2, -2, 1, 0] }}
                  transition={isDragging ? { duration: 0.5, repeat: Infinity } : { duration: 4, repeat: Infinity, ease: "easeInOut" }}
                >
                  <MeshiMascot
                    size={44}
                    mood={isDragging ? "excited" : mood}
                    color="blue"
                    showGlow={false}
                    interactive
                    onMoodChange={handleMoodChange}
                  />
                </motion.div>
                {/* BETA badge */}
                <div className="absolute -top-2 -left-1 px-1 py-0.5 rounded text-[7px] font-bold uppercase tracking-wider text-white shadow-sm" style={{ background: "var(--accent)" }}>Beta</div>
                {/* Drag hint on hover */}
                {!isDragging && (
                  <div className="absolute -bottom-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-4 h-4 rounded-full flex items-center justify-center text-white" style={{ background: "var(--accent)" }}>
                      <GripVertical className="h-2.5 w-2.5" />
                    </div>
                  </div>
                )}
                {/* Chat indicator on hover */}
                {view === "closed" && !isDragging && (
                  <div className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-4 h-4 rounded-full flex items-center justify-center text-white" style={{ background: "var(--accent)" }}>
                      <MessageCircle className="h-2.5 w-2.5" />
                    </div>
                  </div>
                )}
                {/* Close indicator when in speech mode */}
                {view === "speech" && (
                  <div className="absolute -top-1 -right-1">
                    <div className="w-4 h-4 rounded-full flex items-center justify-center text-white" style={{ background: "var(--accent)" }}>
                      <X className="h-2.5 w-2.5" />
                    </div>
                  </div>
                )}
              </motion.button>
              {!isAtLogo && !isDragging && (
                <motion.button initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 0.6, scale: 1 }}
                  whileHover={{ opacity: 1 }} onClick={resetToLogo}
                  className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[8px] text-[var(--text-muted)] whitespace-nowrap hover:text-[var(--accent)] transition-colors"
                  title="Return to logo position">
                  {"\u2190 home"}
                </motion.button>
              )}
            </motion.div>

            {/* Quick access buttons */}
            <div className="flex gap-1">
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.6 }}
                whileHover={{ opacity: 1, scale: 1.1 }}
                onClick={() => setView("mini-mesh")}
                className="p-1.5 rounded-full"
                style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-primary)" }}
                aria-label="Open Meshi menu"
                title="Meshi menu"
              >
                <Sparkles className="h-3.5 w-3.5" style={{ color: "var(--accent)" }} />
              </motion.button>
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.6 }}
                whileHover={{ opacity: 1, scale: 1.1 }}
                onClick={() => setView("chat")}
                className="p-1.5 rounded-full"
                style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-primary)" }}
                aria-label="Open full chat"
                title="Full chat"
              >
                <MessageCircle className="h-3.5 w-3.5" style={{ color: "var(--accent)" }} />
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* === Mini Mesh Panel === */}
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
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-primary)]" style={{ background: "var(--bg-secondary)" }}>
              <MeshiMascot size={32} mood="happy" color="blue" showGlow={false} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--text-primary)]">{"Meshi\u2019s Mesh"} <span className="text-[8px] font-bold uppercase tracking-wider px-1 py-0.5 rounded text-white ml-1" style={{ background: "var(--accent)" }}>Beta</span></p>
                <p className="text-[10px] text-[var(--text-muted)]">{"Your AI buddy\u2019s corner"}</p>
              </div>
              <button onClick={() => setView("closed")} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Mini mesh visualization */}
            <div className="p-4" style={{ background: "var(--bg-primary)" }}>
              <div className="relative h-32 rounded-xl overflow-hidden" style={{ background: "var(--bg-tertiary)" }}>
                <svg className="w-full h-full" viewBox="0 0 200 100">
                  <circle cx="100" cy="50" r="12" fill="#2d7ff9" opacity="0.9">
                    <animate attributeName="r" values="12;14;12" dur="2s" repeatCount="indefinite" />
                  </circle>
                  {[
                    { x: 40, y: 25, label: "Chat", color: "#8b5cf6" },
                    { x: 160, y: 25, label: "Search", color: "#06b6d4" },
                    { x: 30, y: 75, label: "Guide", color: "#10b981" },
                    { x: 170, y: 75, label: "Style", color: "#f59e0b" },
                    { x: 100, y: 10, label: "Summary", color: "#ec4899" },
                    { x: 100, y: 90, label: "History", color: "#6366f1" },
                  ].map((node, i) => (
                    <g key={node.label}>
                      <line x1="100" y1="50" x2={node.x} y2={node.y} stroke={node.color} strokeWidth="0.8" opacity="0.4">
                        <animate attributeName="opacity" values="0.2;0.6;0.2" dur={`${2 + i * 0.3}s`} repeatCount="indefinite" />
                      </line>
                      <circle cx={node.x} cy={node.y} r="6" fill={node.color} opacity="0.7">
                        <animate attributeName="opacity" values="0.5;0.9;0.5" dur={`${2 + i * 0.2}s`} repeatCount="indefinite" />
                      </circle>
                      <text x={node.x} y={node.y + 14} textAnchor="middle" fontSize="6" fill="var(--text-muted)" opacity="0.8">{node.label}</text>
                    </g>
                  ))}
                </svg>
              </div>
            </div>

            {/* Action buttons */}
            <div className="px-4 pb-4 space-y-1.5">
              <button onClick={() => setView("speech")} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-left hover:bg-[var(--bg-hover)] transition-colors" style={{ color: "var(--text-primary)" }}>
                <MessageCircle className="h-4 w-4" style={{ color: "var(--accent)" }} />
                <span className="flex-1">Ask Meshi</span>
                <ChevronRight className="h-3.5 w-3.5 text-[var(--text-muted)]" />
              </button>
              <button onClick={() => triggerSearch("everything")} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-left hover:bg-[var(--bg-hover)] transition-colors" style={{ color: "var(--text-primary)" }}>
                <Sparkles className="h-4 w-4" style={{ color: "#f59e0b" }} />
                <span className="flex-1">What did I miss?</span>
                <ChevronRight className="h-3.5 w-3.5 text-[var(--text-muted)]" />
              </button>
              <button onClick={() => { if (typeof window !== "undefined") window.location.href = "/settings?tab=meshi"; }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-left hover:bg-[var(--bg-hover)] transition-colors" style={{ color: "var(--text-primary)" }}>
                <Palette className="h-4 w-4" style={{ color: "#ec4899" }} />
                <span className="flex-1">Customize Meshi</span>
                <ChevronRight className="h-3.5 w-3.5 text-[var(--text-muted)]" />
              </button>
              <button onClick={() => { if (typeof window !== "undefined") window.location.href = "/settings?tab=privacy"; }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-left hover:bg-[var(--bg-hover)] transition-colors" style={{ color: "var(--text-primary)" }}>
                <Settings className="h-4 w-4" style={{ color: "#6366f1" }} />
                <span className="flex-1">Mesh Privacy</span>
                <ChevronRight className="h-3.5 w-3.5 text-[var(--text-muted)]" />
              </button>

              {/* Chat history */}
              {chatHistory.length > 0 && (
                <div className="pt-2 mt-2 border-t border-[var(--border-primary)]">
                  <div className="flex items-center gap-2 px-3 py-1 mb-1">
                    <History className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                    <span className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider">Recent chats</span>
                  </div>
                  {chatHistory.slice(-3).reverse().map((entry, i) => (
                    <button key={i} onClick={() => setView("speech")} className="w-full px-3 py-1.5 text-xs text-[var(--text-tertiary)] truncate text-left hover:bg-[var(--bg-hover)] rounded-lg transition-colors">
                      <span className="text-[var(--text-secondary)]">You:</span> {entry.q}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-[var(--border-primary)] flex items-center justify-between" style={{ background: "var(--bg-secondary)" }}>
              <div className="flex items-center gap-1 text-[9px] text-emerald-500 font-medium">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Zero data stored
              </div>
              <button onClick={() => setView("chat")} className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors flex items-center gap-1">
                <HelpCircle className="h-3 w-3" />
                Full chat
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* === Full Meshi Chat (for deeper conversations) === */}
      <MeshiChat
        isOpen={view === "chat"}
        onClose={() => setView("closed")}
        meshData={meshStats}
        meshEntities={meshEntities}
      />
    </>
  );
}
