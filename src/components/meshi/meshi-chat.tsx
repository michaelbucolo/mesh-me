"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Sparkles, Search, BarChart3, Shield, HelpCircle } from "lucide-react";
import { askMeshi } from "@/lib/meshi-client";
import type { MeshiHistoryMessage } from "@/lib/meshi-shared";
import type { MeshGraphEntity } from "@/lib/queries";
import { MeshiPresenceGlyph } from "@/components/meshi/meshi-presence-glyph";
import type { MeshiAccessory, MeshiMood, MeshiHat, MeshiColor, MeshiHair } from "./meshi-mascot";

interface ChatMessage {
  id: string;
  role: "user" | "meshi";
  content: string;
  timestamp: Date;
}

const QUICK_ACTIONS = [
  { icon: Search, label: "Search", prompt: "Search my Mesh" },
  { icon: BarChart3, label: "Summary", prompt: "Summarize my Mesh" },
  { icon: Shield, label: "Privacy", prompt: "How is my privacy looking?" },
  { icon: HelpCircle, label: "Help", prompt: "Explain how Mesh.me works" },
];

interface MeshiChatProps {
  isOpen: boolean;
  onClose: () => void;
  hat?: MeshiHat;
  color?: MeshiColor;
  hair?: MeshiHair;
  accessory?: MeshiAccessory;
  faceStyle?: string;
  meshData?: {
    followers?: number;
    following?: number;
    posts?: number;
    communities?: number;
    platforms?: number;
  };
  meshEntities?: MeshGraphEntity[];
}

function toMeshiHistory(messages: ChatMessage[]): MeshiHistoryMessage[] {
  return messages
    .filter((message) => message.id !== "welcome")
    .slice(-8)
    .map((message) => ({
      role: message.role,
      content: message.content,
    }));
}

export function MeshiChat({
  isOpen,
  onClose,
  faceStyle,
  meshData,
  meshEntities,
}: MeshiChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "meshi",
      content: "Hi. I'm Meshi. Ask me to search, explain, or help with your Mesh. Privacy stays first.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [meshiMood, setMeshiMood] = useState<MeshiMood>((faceStyle as MeshiMood) || "happy");
  const [isTyping, setIsTyping] = useState(false);
  const [statusLabel, setStatusLabel] = useState("Private companion");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || isTyping || !faceStyle) return;
    queueMicrotask(() => setMeshiMood(faceStyle as MeshiMood));
  }, [faceStyle, isOpen, isTyping]);

  const handleSend = useCallback((text?: string) => {
    const messageText = text || input.trim();
    if (!messageText || isTyping) return;

    const previousMessages = messages;
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: messageText,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);
    setMeshiMood("thinking");
    setStatusLabel("Thinking with Mesh context");

    void (async () => {
      const response = await askMeshi({
        message: messageText,
        context: {
          meshData,
          meshEntities: meshEntities?.slice(0, 50),
          currentPage: typeof window === "undefined" ? undefined : window.location.pathname,
        },
        history: toMeshiHistory(previousMessages),
      });

      setMeshiMood(response.mood as MeshiMood);
      setStatusLabel(
        response.source === "llm"
          ? "LLM + Mesh context"
          : response.source === "database"
            ? "Mesh data answer"
            : response.source === "offline"
              ? "Offline fallback"
              : "Local safety fallback",
      );
      setMessages((prev) => [
        ...prev,
        {
          id: `meshi-${Date.now()}`,
          role: "meshi",
          content: response.content,
          timestamp: new Date(),
        },
      ]);
      setIsTyping(false);
    })();
  }, [input, isTyping, meshData, meshEntities, messages]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          data-meshi-owned="true"
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] right-3 z-50 flex h-[calc(100dvh-9rem)] min-h-[22rem] max-h-[520px] w-[calc(100vw-1.5rem)] max-w-[360px] flex-col overflow-hidden rounded-2xl shadow-2xl glass-dropdown sm:bottom-4 sm:right-4 sm:h-[520px] sm:max-h-[calc(100vh-6rem)] sm:w-[360px]"
        >
          <div className="flex items-center gap-3 border-b border-[var(--border-primary)] px-4 py-3" style={{ background: "var(--bg-secondary)" }}>
            <MeshiPresenceGlyph size={36} active={isTyping || meshiMood === "thinking"} label="Chat with the single Meshi companion" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[var(--text-primary)]">Meshi</p>
              <p className="text-[10px] text-[var(--text-muted)]">{isTyping ? "Thinking..." : statusLabel}</p>
            </div>
            <div className="flex items-center gap-1">
              <div className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-medium text-emerald-500">
                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                Private
              </div>
              <button
                onClick={onClose}
                aria-label="Close Meshi chat"
                className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-secondary)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-4" style={{ background: "var(--bg-primary)" }}>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                    msg.role === "user"
                      ? "brand-button rounded-br-md text-white"
                      : "rounded-bl-md border border-[var(--border-primary)] bg-[var(--bg-secondary)] text-[var(--text-primary)]"
                  }`}
                >
                  {msg.content}
                </div>
              </motion.div>
            ))}

            {isTyping && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                <div className="rounded-2xl rounded-bl-md border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-4 py-3">
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        className="h-2 w-2 rounded-full bg-[var(--accent)]"
                        animate={{ y: [0, -4, 0] }}
                        transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                      />
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {messages.length <= 2 && (
            <div className="border-t border-[var(--border-primary)] px-4 py-2" style={{ background: "var(--bg-secondary)" }}>
              <p className="mb-2 flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
                <Sparkles className="h-3 w-3" />
                Start here
              </p>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_ACTIONS.map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.label}
                      onClick={() => handleSend(action.prompt)}
                      className="flex items-center gap-1 rounded-lg bg-[var(--bg-tertiary)] px-2 py-1 text-[11px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                    >
                      <Icon className="h-3 w-3" />
                      {action.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 border-t border-[var(--border-primary)] px-4 py-3" style={{ background: "var(--bg-secondary)" }}>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Ask me anything..."
              className="flex-1 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-tertiary)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || isTyping}
              aria-label="Send message to Meshi"
              className="rounded-xl brand-button p-2 text-white transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
