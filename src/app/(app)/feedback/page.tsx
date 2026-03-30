"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  MessageSquarePlus,
  Bug,
  Lightbulb,
  Sparkles,
  Send,
  Check,
  AlertTriangle,
  ChevronDown,
  Star,
} from "lucide-react";

type FeedbackType = "bug" | "feature" | "improvement" | "general";

const FEEDBACK_TYPES: { id: FeedbackType; label: string; icon: React.ElementType; color: string; desc: string }[] = [
  { id: "bug", label: "Bug Report", icon: Bug, color: "#ef4444", desc: "Something isn't working correctly" },
  { id: "feature", label: "Feature Request", icon: Lightbulb, color: "#eab308", desc: "Suggest a new feature or capability" },
  { id: "improvement", label: "Improvement", icon: Sparkles, color: "#3b82f6", desc: "Make something existing better" },
  { id: "general", label: "General Feedback", icon: MessageSquarePlus, color: "#8b5cf6", desc: "Share your thoughts" },
];

export default function FeedbackPage() {
  const [type, setType] = useState<FeedbackType>("general");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [rating, setRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      setError("Please enter your feedback");
      return;
    }
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, subject, message, email, rating, page }),
      });

      if (res.ok) {
        setSubmitted(true);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to submit feedback");
      }
    } catch {
      setError("Failed to submit feedback. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
            <Check className="h-8 w-8 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Thank you!</h1>
          <p className="text-sm text-[var(--text-muted)] mb-6">
            Your feedback has been submitted. We read every piece of feedback and use it to improve mesh.me.
          </p>
          <Button
            variant="secondary"
            onClick={() => {
              setSubmitted(false);
              setSubject("");
              setMessage("");
              setRating(0);
              setPage("");
            }}
          >
            Submit more feedback
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: "var(--brand-gradient)" }}>
          <MessageSquarePlus className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Feedback</h1>
          <p className="text-sm text-[var(--text-muted)]">Help us make mesh.me better</p>
        </div>
      </div>

      {/* Dev notice */}
      <div className="rounded-2xl p-4 mb-6 flex items-start gap-3" style={{ background: "var(--accent-subtle)", border: "1px solid var(--accent-muted)" }}>
        <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: "var(--accent)" }} />
        <div>
          <p className="text-sm font-medium text-[var(--text-primary)]">mesh.me is in active development</p>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Your feedback directly shapes the future of the platform. Report bugs, request features, or share ideas — we review everything.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Feedback type */}
        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">What kind of feedback?</label>
          <div className="grid grid-cols-2 gap-2">
            {FEEDBACK_TYPES.map((ft) => (
              <button
                key={ft.id}
                type="button"
                onClick={() => setType(ft.id)}
                className={`flex items-center gap-2.5 p-3 rounded-xl text-left transition-all ${
                  type === ft.id
                    ? "ring-2 ring-[var(--accent)] bg-[var(--accent-subtle)]"
                    : "glass-surface hover:bg-[var(--bg-tertiary)]"
                }`}
              >
                <div className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: ft.color + "20" }}>
                  <ft.icon className="h-4 w-4" style={{ color: ft.color }} />
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--text-primary)]">{ft.label}</p>
                  <p className="text-[10px] text-[var(--text-muted)]">{ft.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Subject */}
        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Subject</label>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={type === "bug" ? "What went wrong?" : type === "feature" ? "What would you like to see?" : "Brief summary"}
          />
        </div>

        {/* Page / Area (optional) */}
        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
            Which page or feature? <span className="text-[var(--text-muted)] font-normal">(optional)</span>
          </label>
          <div className="relative">
            <select
              value={page}
              onChange={(e) => setPage(e.target.value)}
              className="w-full appearance-none bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl px-3 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] pr-8"
            >
              <option value="">Select area...</option>
              <option value="mesh">The Mesh</option>
              <option value="feed">Feed</option>
              <option value="custom-feed">Custom Feed</option>
              <option value="messages">Messages / MeChat</option>
              <option value="profile">Profile</option>
              <option value="settings">Settings</option>
              <option value="explore">Explore</option>
              <option value="communities">Communities</option>
              <option value="connected-accounts">Connected Accounts</option>
              <option value="notifications">Notifications</option>
              <option value="meshi">Meshi</option>
              <option value="search">Search</option>
              <option value="login-signup">Login / Signup</option>
              <option value="other">Other</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)] pointer-events-none" />
          </div>
        </div>

        {/* Message */}
        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Details</label>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={
              type === "bug"
                ? "Describe the issue. What were you doing? What did you expect to happen?"
                : type === "feature"
                ? "Describe the feature you'd like to see. How would it work?"
                : "Share your feedback, ideas, or thoughts..."
            }
            rows={5}
            maxLength={2000}
          />
          <p className="text-xs text-[var(--text-muted)] mt-1">{message.length}/2000</p>
        </div>

        {/* Rating */}
        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
            How would you rate mesh.me so far? <span className="text-[var(--text-muted)] font-normal">(optional)</span>
          </label>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star === rating ? 0 : star)}
                className="p-1 transition-all hover:scale-110"
              >
                <Star
                  className={`h-6 w-6 transition-colors ${
                    star <= rating ? "text-amber-400 fill-amber-400" : "text-[var(--text-muted)]"
                  }`}
                />
              </button>
            ))}
            {rating > 0 && (
              <span className="text-xs text-[var(--text-muted)] self-center ml-2">
                {rating === 1 ? "Needs work" : rating === 2 ? "Fair" : rating === 3 ? "Good" : rating === 4 ? "Great" : "Amazing!"}
              </span>
            )}
          </div>
        </div>

        {/* Contact email (optional) */}
        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
            Email for follow-up <span className="text-[var(--text-muted)] font-normal">(optional)</span>
          </label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
          />
          <p className="text-[10px] text-[var(--text-muted)] mt-1">Only used to follow up on your feedback if needed</p>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 flex items-center gap-2"
            >
              <AlertTriangle className="h-4 w-4" />
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        <Button type="submit" variant="gradient" disabled={submitting} className="w-full">
          {submitting ? (
            <span className="flex items-center gap-2">
              <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Submitting...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Send className="h-4 w-4" />
              Submit Feedback
            </span>
          )}
        </Button>
      </form>
    </div>
  );
}
