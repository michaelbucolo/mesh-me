"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import {
  X, Settings, History, Sparkles, MessageCircle,
  ChevronRight, Palette, HelpCircle
} from "lucide-react";
import { MeshiMascot, type MeshiMood } from "./meshi-mascot";
import { MeshiChat } from "./meshi-chat";

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

type MeshiView = "closed" | "chat" | "mini-mesh";

/**
 * Global floating Meshi \u2014 a real entity that lives across the entire app.
 * Features: contextual greetings, mini-mesh sidebar, visual search animation,
 * chat history, and personality that makes Meshi feel alive.
 */
export function MeshiFloat() {
  const [view, setView] = useState<MeshiView>("closed");
  const [mood, setMood] = useState<MeshiMood>("happy");
  const [showGreeting, setShowGreeting] = useState(false);
  const [greetingText, setGreetingText] = useState("");
  const [lastPath, setLastPath] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchingText, setSearchingText] = useState("");
  const [chatHistory, setChatHistory] = useState<Array<{ q: string; a: string; time: Date }>>([]);
  const pathname = usePathname();

  // Contextual greeting on page navigation
  useEffect(() => {
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
  }, [pathname, lastPath, view]);

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
      setView("chat");
    }, 4500);
  }, []);

  // Chat history tracker
  const addChatEntry = useCallback((question: string, answer: string) => {
    setChatHistory((prev) => [...prev.slice(-49), { q: question, a: answer, time: new Date() }]);
  }, []);
  void addChatEntry; // Will be wired to MeshiChat callback

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

      {/* === Floating Meshi Button === */}
      <AnimatePresence>
        {view === "closed" && !isSearching && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2"
          >
            {/* Greeting bubble */}
            <AnimatePresence>
              {showGreeting && (
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

            {/* Main Meshi button */}
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setView("chat")}
              onContextMenu={(e) => { e.preventDefault(); setView("mini-mesh"); }}
              className="rounded-full shadow-2xl p-1.5 transition-shadow hover:shadow-[0_0_24px_rgba(45,127,249,0.4)] group relative"
              style={{ background: "var(--bg-elevated)", border: "2px solid var(--accent)" }}
              aria-label="Talk to Meshi"
              title="Click to chat"
            >
              <motion.div
                animate={{ y: [0, -3, 0, -1, 0], rotate: [0, 2, -2, 1, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              >
                <MeshiMascot size={44} mood={mood} color="blue" showGlow={false} />
              </motion.div>
              {/* Mini mesh orbiting dots */}
              <div className="absolute inset-0 pointer-events-none">
                {[0, 60, 120, 180, 240, 300].map((angle, i) => (
                  <motion.div
                    key={angle}
                    className="absolute w-1.5 h-1.5 rounded-full"
                    style={{
                      background: "var(--accent)",
                      left: `${50 + 42 * Math.cos((angle * Math.PI) / 180)}%`,
                      top: `${50 + 42 * Math.sin((angle * Math.PI) / 180)}%`,
                      transform: "translate(-50%, -50%)",
                    }}
                    animate={{ opacity: [0.3, 0.8, 0.3], scale: [0.8, 1.2, 0.8] }}
                    transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
                  />
                ))}
              </div>
              {/* Chat indicator on hover */}
              <div className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="w-4 h-4 rounded-full flex items-center justify-center text-white" style={{ background: "var(--accent)" }}>
                  <MessageCircle className="h-2.5 w-2.5" />
                </div>
              </div>
            </motion.button>

            {/* Mini-mesh quick access */}
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              whileHover={{ opacity: 1, scale: 1.1 }}
              onClick={() => setView("mini-mesh")}
              className="p-1.5 rounded-full"
              style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-primary)" }}
              aria-label="Open Meshi menu"
              title="Open Meshi menu"
            >
              <Sparkles className="h-3.5 w-3.5" style={{ color: "var(--accent)" }} />
            </motion.button>
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
                <p className="text-sm font-semibold text-[var(--text-primary)]">{"Meshi\u2019s Mesh"}</p>
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
              <button onClick={() => setView("chat")} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-left hover:bg-[var(--bg-hover)] transition-colors" style={{ color: "var(--text-primary)" }}>
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
              <button onClick={() => { if (typeof window !== "undefined") window.location.href = "/settings?tab=meshi"; }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-left hover:bg-[var(--bg-hover)] transition-colors" style={{ color: "var(--text-primary)" }}>
                <Settings className="h-4 w-4" style={{ color: "#6366f1" }} />
                <span className="flex-1">Meshi Settings</span>
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
                    <button key={i} onClick={() => setView("chat")} className="w-full px-3 py-1.5 text-xs text-[var(--text-tertiary)] truncate text-left hover:bg-[var(--bg-hover)] rounded-lg transition-colors">
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
                Help
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* === Meshi Chat === */}
      <MeshiChat
        isOpen={view === "chat"}
        onClose={() => setView("closed")}
      />
    </>
  );
}
