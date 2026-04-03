"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Search, X, Sparkles, ArrowRight, Home, Waypoints, MessageCircle,
  Globe, Users, Bell, User, Settings, Link2, Send, TrendingUp,
  RefreshCw, FileText, BarChart3,
} from "lucide-react";
import { MeshiLogo } from "@/components/meshi/meshi-mascot";

interface MeshiCommandProps {
  isOpen: boolean;
  onClose: () => void;
  username?: string;
}

type CommandCategory = "navigation" | "actions" | "meshi";

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  category: CommandCategory;
  action: () => void;
  keywords?: string[];
}

const meshiResponses = [
  "Hey! What can I help you with?",
  "Need to navigate somewhere? Just type the page name!",
  "I can help you sync platforms, explore your mesh, or find content.",
  "Try typing 'sync' to sync platforms, or 'post' to create content!",
  "Your digital universe is looking great! What would you like to do?",
];

export function MeshiCommand({ isOpen, onClose, username }: MeshiCommandProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [meshiMessage, setMeshiMessage] = useState("");
  const [chatMode, setChatMode] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "meshi"; content: string }>>([]);

  const navigate = useCallback((path: string) => {
    router.push(path);
    onClose();
  }, [router, onClose]);

  const commands: CommandItem[] = [
    { id: "dashboard", label: "Dashboard", description: "Your home base", icon: Home, category: "navigation", action: () => navigate("/dashboard"), keywords: ["home", "main"] },
    { id: "mesh", label: "The Mesh", description: "Your digital universe", icon: Waypoints, category: "navigation", action: () => navigate("/mesh"), keywords: ["visualization", "map"] },
    { id: "feed", label: "Feed", description: "Posts from your network", icon: MessageCircle, category: "navigation", action: () => navigate("/feed"), keywords: ["posts", "social"] },
    { id: "content-hub", label: "Content Hub", description: "Cross-platform content", icon: Globe, category: "navigation", action: () => navigate("/content-hub"), keywords: ["content", "analytics"] },
    { id: "platforms", label: "Connected Platforms", description: "Manage connections", icon: Link2, category: "navigation", action: () => navigate("/connected-accounts"), keywords: ["connect", "oauth"] },
    { id: "messages", label: "Messages", description: "Direct messages", icon: MessageCircle, category: "navigation", action: () => navigate("/messages"), keywords: ["dm", "chat"] },
    { id: "communities", label: "Communities", description: "Browse communities", icon: Users, category: "navigation", action: () => navigate("/communities"), keywords: ["groups"] },
    { id: "notifications", label: "Notifications", description: "Activity & alerts", icon: Bell, category: "navigation", action: () => navigate("/notifications"), keywords: ["alerts"] },
    { id: "profile", label: "Profile", description: "Your profile page", icon: User, category: "navigation", action: () => navigate("/profile/" + (username || "")), keywords: ["me"] },
    { id: "settings", label: "Settings", description: "Preferences", icon: Settings, category: "navigation", action: () => navigate("/settings"), keywords: ["config"] },
    { id: "sync-all", label: "Sync All Platforms", description: "Pull latest data", icon: RefreshCw, category: "actions", action: () => navigate("/connected-accounts"), keywords: ["refresh"] },
    { id: "new-post", label: "Create Post", description: "Write a new post", icon: FileText, category: "actions", action: () => navigate("/feed"), keywords: ["write", "publish"] },
    { id: "analytics", label: "View Analytics", description: "Platform performance", icon: BarChart3, category: "actions", action: () => navigate("/content-hub"), keywords: ["stats"] },
    { id: "explore", label: "Explore Users", description: "Discover new people", icon: TrendingUp, category: "actions", action: () => navigate("/explore"), keywords: ["discover"] },
    { id: "chat-meshi", label: "Chat with Meshi", description: "Talk to your AI companion", icon: Sparkles, category: "meshi", action: () => setChatMode(true), keywords: ["ai", "help"] },
  ];

  const filteredCommands = query.trim()
    ? commands.filter((cmd) => {
        const q = query.toLowerCase();
        return cmd.label.toLowerCase().includes(q) || (cmd.description || "").toLowerCase().includes(q) || (cmd.keywords || []).some((k) => k.includes(q));
      })
    : commands;

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setChatMode(false);
      setMeshiMessage(meshiResponses[Math.floor(Math.random() * meshiResponses.length)]);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => { setSelectedIndex(0); }, [query]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (!isOpen) return;
      if (e.key === "Escape") {
        if (chatMode) setChatMode(false);
        else onClose();
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filteredCommands.length - 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      }
      if (e.key === "Enter" && !chatMode && filteredCommands[selectedIndex]) {
        e.preventDefault();
        filteredCommands[selectedIndex].action();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex, chatMode, onClose]);

  const handleChatSend = () => {
    if (!query.trim()) return;
    const userMsg = query.trim();
    setChatMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setQuery("");
    setTimeout(() => {
      let response = "I am still learning! Try asking me to navigate somewhere or sync your platforms.";
      const lower = userMsg.toLowerCase();
      if (lower.includes("hello") || lower.includes("hi") || lower.includes("hey")) {
        response = "Hey there! How can I help you today?";
      } else if (lower.includes("sync") || lower.includes("refresh")) {
        response = "Head to Connected Platforms to sync. Want me to take you there?";
      } else if (lower.includes("post") || lower.includes("create")) {
        response = "Head to the Feed to compose a new post, or use Content Hub for cross-platform publishing!";
      } else if (lower.includes("analytics") || lower.includes("stats")) {
        response = "Check out the Content Hub for cross-platform analytics!";
      } else if (lower.includes("who are you")) {
        response = "I am Meshi! Your AI companion and the heart of mesh.me.";
      } else if (lower.includes("help")) {
        response = "I can navigate, sync platforms, create posts, view analytics, and more!";
      } else if (lower.includes("thank")) {
        response = "You are welcome! Let me know if you need anything else!";
      }
      setChatMessages((prev) => [...prev, { role: "meshi", content: response }]);
    }, 500);
  };

  const grouped = {
    navigation: filteredCommands.filter((c) => c.category === "navigation"),
    actions: filteredCommands.filter((c) => c.category === "actions"),
    meshi: filteredCommands.filter((c) => c.category === "meshi"),
  };
  let flatIndex = 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[100]"
            style={{ background: "var(--bg-overlay)" }}
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="fixed z-[101] left-1/2 top-[15%] -translate-x-1/2 w-full max-w-[560px] mx-4 rounded-2xl overflow-hidden"
            style={{
              background: "var(--glass-elevated)",
              backdropFilter: "blur(24px) saturate(200%)",
              border: "1px solid var(--glass-border)",
              boxShadow: "0 24px 80px -12px rgba(0,0,0,0.5)",
            }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid var(--border-secondary)" }}>
              <MeshiLogo size={24} color="blue" mood="happy" />
              <p className="text-xs flex-1" style={{ color: "var(--text-secondary)" }}>
                {chatMode ? "Chat with Meshi" : meshiMessage}
              </p>
              <button onClick={onClose} className="p-1 rounded-lg transition-colors hover:bg-[var(--bg-hover)]">
                <X className="h-4 w-4" style={{ color: "var(--text-muted)" }} />
              </button>
            </div>

            {/* Input */}
            <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: chatMode ? "none" : "1px solid var(--border-secondary)" }}>
              {chatMode ? (
                <Sparkles className="h-4 w-4 flex-shrink-0" style={{ color: "var(--accent)" }} />
              ) : (
                <Search className="h-4 w-4 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
              )}
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (chatMode && e.key === "Enter") {
                    e.preventDefault();
                    handleChatSend();
                  }
                }}
                placeholder={chatMode ? "Talk to Meshi..." : "Search commands, pages, actions..."}
                className="flex-1 bg-transparent text-sm outline-none"
                style={{ color: "var(--text-primary)" }}
              />
              {chatMode && (
                <button onClick={handleChatSend} className="p-1.5 rounded-lg" style={{ background: "var(--accent)", color: "white" }}>
                  <Send className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Content */}
            {chatMode ? (
              <div className="max-h-[320px] overflow-y-auto p-4 space-y-3">
                {chatMessages.length === 0 && (
                  <div className="text-center py-8">
                    <div className="flex justify-center">
                      <MeshiLogo size={48} color="blue" mood="happy" />
                    </div>
                    <p className="text-sm mt-3" style={{ color: "var(--text-secondary)" }}>
                      Hey! Ask me anything about mesh.me!
                    </p>
                    <div className="flex flex-wrap gap-2 mt-4 justify-center">
                      {["What can you do?", "Sync my platforms", "Show analytics"].map((q) => (
                        <button
                          key={q}
                          onClick={() => {
                            setQuery(q);
                            setTimeout(handleChatSend, 50);
                          }}
                          className="text-xs px-3 py-1.5 rounded-full"
                          style={{ background: "var(--accent-muted)", color: "var(--accent)" }}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {chatMessages.map((msg, i) => (
                  <div key={i} className={cn("flex gap-2", msg.role === "user" ? "justify-end" : "justify-start")}>
                    {msg.role === "meshi" && <MeshiLogo size={20} color="blue" mood="happy" />}
                    <div
                      className="max-w-[80%] px-3 py-2 rounded-xl text-sm"
                      style={{
                        background: msg.role === "user" ? "var(--accent)" : "var(--bg-tertiary)",
                        color: msg.role === "user" ? "white" : "var(--text-primary)",
                      }}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="max-h-[360px] overflow-y-auto py-2">
                {filteredCommands.length === 0 && (
                  <div className="py-8 text-center">
                    <p className="text-sm" style={{ color: "var(--text-muted)" }}>No results found</p>
                    <button onClick={() => setChatMode(true)} className="text-xs mt-2" style={{ color: "var(--accent)" }}>
                      Chat with Meshi instead
                    </button>
                  </div>
                )}
                {(["meshi", "actions", "navigation"] as CommandCategory[]).map((cat) => {
                  const items = grouped[cat];
                  if (items.length === 0) return null;
                  const label = cat === "navigation" ? "Navigate" : cat === "actions" ? "Actions" : "Meshi";
                  return (
                    <div key={cat}>
                      <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                        {label}
                      </p>
                      {items.map((cmd) => {
                        const idx = flatIndex++;
                        return (
                          <button
                            key={cmd.id}
                            onClick={cmd.action}
                            onMouseEnter={() => setSelectedIndex(idx)}
                            className={cn(
                              "w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors",
                              idx === selectedIndex ? "bg-[var(--bg-hover)]" : ""
                            )}
                          >
                            <div className="flex-shrink-0" style={{ color: idx === selectedIndex ? "var(--accent)" : "var(--text-muted)" }}>
                              <cmd.icon className="h-4 w-4" />
                            </div>
                            <div className="flex-1 text-left">
                              <span style={{ color: "var(--text-primary)" }}>{cmd.label}</span>
                              {cmd.description && (
                                <span className="ml-2 text-xs" style={{ color: "var(--text-muted)" }}>
                                  {cmd.description}
                                </span>
                              )}
                            </div>
                            {idx === selectedIndex && (
                              <ArrowRight className="h-3.5 w-3.5" style={{ color: "var(--accent)" }} />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-2.5" style={{ borderTop: "1px solid var(--border-secondary)" }}>
              <div className="flex items-center gap-3">
                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                  <kbd className="px-1 py-0.5 rounded" style={{ background: "var(--bg-tertiary)" }}>Esc</kbd> Close
                </span>
              </div>
              <button
                onClick={() => setChatMode(!chatMode)}
                className="flex items-center gap-1.5 text-[10px] font-medium"
                style={{ color: chatMode ? "var(--text-secondary)" : "var(--accent)" }}
              >
                {chatMode ? (
                  <><Search className="h-3 w-3" /> Commands</>
                ) : (
                  <><Sparkles className="h-3 w-3" /> Chat with Meshi</>
                )}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
