"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MeshiMascot, MeshiMini, type MeshiColor, type MeshiHat, type MeshiMood } from "./meshi-mascot";

// Meshi-to-Meshi interactions when visiting another user's mesh

type RPSChoice = "rock" | "paper" | "scissors";
type RPSResult = "win" | "lose" | "draw";

interface MeshiProfile {
  color: MeshiColor;
  hat: MeshiHat;
  mood: MeshiMood;
  username: string;
}

function getRPSResult(myChoice: RPSChoice, theirChoice: RPSChoice): RPSResult {
  if (myChoice === theirChoice) return "draw";
  if (
    (myChoice === "rock" && theirChoice === "scissors") ||
    (myChoice === "paper" && theirChoice === "rock") ||
    (myChoice === "scissors" && theirChoice === "paper")
  ) return "win";
  return "lose";
}

const RPS_EMOJI: Record<RPSChoice, string> = { rock: "\u270A", paper: "\u270B", scissors: "\u2702\uFE0F" };

export function MeshiMeetOverlay({
  myMeshi,
  theirMeshi,
  onClose,
}: {
  myMeshi: MeshiProfile;
  theirMeshi: MeshiProfile;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<"meet" | "rps-choose" | "rps-result" | "hat-exchange" | "idle">("meet");
  const [myChoice, setMyChoice] = useState<RPSChoice | null>(null);
  const [theirChoice, setTheirChoice] = useState<RPSChoice | null>(null);
  const [, setRpsResult] = useState<RPSResult | null>(null);
  const [hatExchanged, setHatExchanged] = useState(false);
  const [myCurrentHat, setMyCurrentHat] = useState(myMeshi.hat);
  const [theirCurrentHat, setTheirCurrentHat] = useState(theirMeshi.hat);
  const [myMood, setMyMood] = useState<MeshiMood>("excited");
  const [theirMood, setTheirMood] = useState<MeshiMood>("happy");
  const [message, setMessage] = useState(`Your Meshi met ${theirMeshi.username}'s Meshi!`);

  // Auto-advance from meet phase
  useEffect(() => {
    if (phase === "meet") {
      const timer = setTimeout(() => setPhase("idle"), 2000);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  const playRPS = useCallback(() => {
    setPhase("rps-choose");
    setMyChoice(null);
    setTheirChoice(null);
    setRpsResult(null);
    setMessage("Choose your move!");
    setMyMood("thinking");
    setTheirMood("thinking");
  }, []);

  const makeRPSChoice = useCallback((choice: RPSChoice) => {
    setMyChoice(choice);
    const choices: RPSChoice[] = ["rock", "paper", "scissors"];
    const aiChoice = choices[Math.floor(Math.random() * 3)];
    setTheirChoice(aiChoice);
    const result = getRPSResult(choice, aiChoice);
    setRpsResult(result);
    setPhase("rps-result");

    if (result === "win") {
      setMessage(`You win! ${RPS_EMOJI[choice]} beats ${RPS_EMOJI[aiChoice]}`);
      setMyMood("celebrating" as MeshiMood);
      setTheirMood("surprised");
    } else if (result === "lose") {
      setMessage(`They win! ${RPS_EMOJI[aiChoice]} beats ${RPS_EMOJI[choice]}`);
      setMyMood("surprised");
      setTheirMood("celebrating" as MeshiMood);
    } else {
      setMessage(`Draw! Both chose ${RPS_EMOJI[choice]}`);
      setMyMood("giggle");
      setTheirMood("giggle");
    }
    setTimeout(() => setPhase("idle"), 3000);
  }, []);

  const exchangeHats = useCallback(() => {
    if (myMeshi.hat === "none" && theirMeshi.hat === "none") {
      setMessage("Neither Meshi has a hat to exchange!");
      return;
    }
    setPhase("hat-exchange");
    setMessage("Exchanging hats...");
    setMyMood("excited");
    setTheirMood("excited");

    setTimeout(() => {
      if (!hatExchanged) {
        setMyCurrentHat(theirMeshi.hat);
        setTheirCurrentHat(myMeshi.hat);
        setHatExchanged(true);
        setMessage("Hats exchanged! Looking fresh!");
      } else {
        setMyCurrentHat(myMeshi.hat);
        setTheirCurrentHat(theirMeshi.hat);
        setHatExchanged(false);
        setMessage("Hats returned! Back to normal.");
      }
      setMyMood("love");
      setTheirMood("love");
      setTimeout(() => setPhase("idle"), 2000);
    }, 1000);
  }, [myMeshi.hat, theirMeshi.hat, hatExchanged]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ scale: 0.8, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.8, y: 20 }}
        className="bg-[var(--bg-elevated)] rounded-3xl p-6 shadow-2xl max-w-sm w-full mx-4 border border-[var(--border-primary)]"
      >
        {/* Two Meshis facing each other */}
        <div className="flex items-center justify-center gap-8 mb-4">
          <motion.div
            animate={phase === "hat-exchange" ? { x: [0, 30, 0], rotate: [0, 15, 0] } : { y: [0, -5, 0] }}
            transition={{ duration: phase === "hat-exchange" ? 1 : 2, repeat: phase === "hat-exchange" ? 0 : Infinity }}
            className="flex flex-col items-center gap-1"
          >
            <MeshiMascot size={56} mood={myMood} color={myMeshi.color} hat={myCurrentHat} showGlow />
            <span className="text-[10px] text-[var(--text-muted)] font-medium">You</span>
          </motion.div>

          {/* Interaction area */}
          <AnimatePresence mode="wait">
            {phase === "rps-choose" && (
              <motion.div
                key="rps-choose"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="text-lg"
              >
                VS
              </motion.div>
            )}
            {phase === "rps-result" && myChoice && theirChoice && (
              <motion.div
                key="rps-result"
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.2, 1] }}
                className="flex flex-col items-center gap-1"
              >
                <span className="text-2xl">{RPS_EMOJI[myChoice]}</span>
                <span className="text-xs text-[var(--text-muted)]">vs</span>
                <span className="text-2xl">{RPS_EMOJI[theirChoice]}</span>
              </motion.div>
            )}
            {phase === "hat-exchange" && (
              <motion.div
                key="hat-swap"
                initial={{ rotate: 0 }}
                animate={{ rotate: 360 }}
                transition={{ duration: 1 }}
                className="text-2xl"
              >
                🎩
              </motion.div>
            )}
            {(phase === "meet" || phase === "idle") && (
              <motion.div
                key="sparkle"
                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="text-2xl"
              >
                ✨
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div
            animate={phase === "hat-exchange" ? { x: [0, -30, 0], rotate: [0, -15, 0] } : { y: [0, -5, 0] }}
            transition={{ duration: phase === "hat-exchange" ? 1 : 2, repeat: phase === "hat-exchange" ? 0 : Infinity, delay: 0.3 }}
            className="flex flex-col items-center gap-1"
          >
            <MeshiMascot size={56} mood={theirMood} color={theirMeshi.color} hat={theirCurrentHat} showGlow />
            <span className="text-[10px] text-[var(--text-muted)] font-medium">{theirMeshi.username}</span>
          </motion.div>
        </div>

        {/* Message */}
        <motion.p
          key={message}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center text-sm text-[var(--text-primary)] font-medium mb-4"
        >
          {message}
        </motion.p>

        {/* RPS choices */}
        <AnimatePresence>
          {phase === "rps-choose" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex justify-center gap-3 mb-4"
            >
              {(["rock", "paper", "scissors"] as RPSChoice[]).map((choice) => (
                <motion.button
                  key={choice}
                  whileHover={{ scale: 1.15 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => makeRPSChoice(choice)}
                  className="w-14 h-14 rounded-2xl bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] border border-[var(--border-primary)] flex items-center justify-center text-2xl transition-colors"
                >
                  {RPS_EMOJI[choice]}
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action buttons */}
        {(phase === "idle" || phase === "meet") && (
          <div className="flex gap-2">
            <button
              onClick={playRPS}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium brand-button text-white transition-all"
            >
              ✊ Rock Paper Scissors
            </button>
            <button
              onClick={exchangeHats}
              disabled={myMeshi.hat === "none" && theirMeshi.hat === "none"}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-primary)] hover:bg-[var(--bg-hover)] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              🎩 Swap Hats
            </button>
          </div>
        )}

        {/* Close */}
        <button
          onClick={onClose}
          className="mt-3 w-full py-2 rounded-xl text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
        >
          Dismiss
        </button>
      </motion.div>
    </motion.div>
  );
}

// Small indicator that shows when viewing another user's mesh
export function MeshiVisitorBadge({
  viewingUsername,
  onInteract,
}: {
  viewingUsername: string;
  onInteract: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed bottom-24 left-4 z-50 flex items-center gap-2 px-3 py-2 rounded-2xl shadow-lg cursor-pointer hover:scale-105 transition-transform"
      style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-primary)" }}
      onClick={onInteract}
    >
      <MeshiMini size={20} color="blue" mood="excited" />
      <div className="flex flex-col">
        <span className="text-[10px] text-[var(--text-muted)]">Visiting</span>
        <span className="text-xs font-medium text-[var(--text-primary)]">{viewingUsername}&apos;s mesh</span>
      </div>
      <motion.span
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 1.5, repeat: Infinity }}
        className="text-sm"
      >
        👋
      </motion.span>
    </motion.div>
  );
}
