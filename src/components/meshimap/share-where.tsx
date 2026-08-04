"use client";

// TURNING SHARING ON — the only control that puts you on the map.
//
// ── THE ORDER MATTERS ──────────────────────────────────────────────────────
//
// The audience is chosen BEFORE the browser is ever asked for a location. The
// tempting order is the other way round — get the fix, then ask who can see it
// — and it is wrong twice: it prompts for a permission the user may not want
// to grant yet, and it produces a moment where a real reading exists in the
// page with no audience attached to it. Here, if you never pick an audience,
// the browser is never asked and there is nothing to leak.
//
// ── AND THE READING IS NEVER HELD ──────────────────────────────────────────
//
// The fix goes straight into the request. It is not stored in state, not put
// in a ref, not logged. The server answers with the CELL, which is what the
// component then displays — so what you are shown is what is actually stored,
// not a local copy of something more precise.

import { useState } from "react";
import type { Audience, Precision } from "@/lib/meshimap/coarse";

const AUDIENCE_LABELS: Array<{ value: Audience; label: string; detail: string }> = [
  { value: "mutuals", label: "Friends", detail: "People you follow who follow you back" },
  { value: "followers", label: "Followers", detail: "Anyone who follows you" },
  { value: "everyone", label: "Everyone on mesh.me", detail: "Not the public internet" },
];

const PRECISION_LABELS: Array<{ value: Precision; label: string; detail: string }> = [
  { value: "block", label: "Neighbourhood", detail: "About a kilometre across" },
  { value: "town", label: "Town", detail: "About ten kilometres" },
  { value: "region", label: "Region", detail: "About a hundred kilometres" },
];

type State =
  | { kind: "idle" }
  | { kind: "asking" }
  | { kind: "sharing"; at: { lat: number; lng: number }; precision: Precision; audience: Audience }
  | { kind: "denied" }
  | { kind: "error"; message: string };

export function ShareWhere({ initiallySharing }: { initiallySharing: boolean }) {
  const [open, setOpen] = useState(false);
  const [precision, setPrecision] = useState<Precision>("town");
  const [state, setState] = useState<State>(initiallySharing ? { kind: "idle" } : { kind: "idle" });

  async function share(audience: Audience) {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState({ kind: "error", message: "This device cannot report a location." });
      return;
    }
    setState({ kind: "asking" });

    // Only NOW is the browser asked — after the audience is known.
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const response = await fetch("/api/meshimap/location", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              // Straight through. Never assigned to state or a ref.
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              precision,
              audience,
            }),
          });
          if (!response.ok) {
            setState({ kind: "error", message: "That didn't go through. Nothing was shared." });
            return;
          }
          const data = (await response.json()) as {
            at: { lat: number; lng: number } | null;
            precision: Precision;
            audience: Audience;
          };
          if (!data.at) {
            setState({ kind: "idle" });
            return;
          }
          // The CELL the server stored — what is shown is what exists.
          setState({ kind: "sharing", at: data.at, precision: data.precision, audience: data.audience });
          setOpen(false);
        } catch {
          setState({ kind: "error", message: "That didn't go through. Nothing was shared." });
        }
      },
      () => setState({ kind: "denied" }),
      // No high accuracy: it costs battery and a warm-up delay to obtain
      // precision that is thrown away in the next step anyway.
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 },
    );
  }

  async function stop() {
    await fetch("/api/meshimap/location", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ audience: "nobody" }),
    }).catch(() => undefined);
    setState({ kind: "idle" });
    setOpen(false);
  }

  const sharing = state.kind === "sharing" || (initiallySharing && state.kind === "idle");

  return (
    <div className="absolute bottom-3 left-3">
      {!open && (
        <button
          type="button"
          data-testid="share-where-toggle"
          onClick={() => (sharing ? void stop() : setOpen(true))}
          className="rounded-full px-3.5 py-2"
          style={{
            background: sharing ? "#182642" : "#60a5fa",
            color: sharing ? "#dce4f5" : "#04060c",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {sharing ? "Stop sharing where I am" : "Put me on the map"}
        </button>
      )}

      {open && (
        <div
          data-testid="share-where-panel"
          className="w-[min(20rem,calc(100vw-1.5rem))] rounded-2xl p-3.5"
          style={{ background: "#0d1730", border: "1px solid #ffffff1f" }}
        >
          <div style={{ color: "#e8edf8", fontSize: 14, fontWeight: 600 }}>Who can see roughly where you are?</div>
          <p className="mt-1" style={{ color: "#93a0bb", fontSize: 11.5 }}>
            You appear at the centre of an area, never at your address. It disappears on its own
            after an hour.
          </p>

          <div className="mt-3 flex flex-col gap-1.5">
            {PRECISION_LABELS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPrecision(p.value)}
                className="flex items-center justify-between rounded-lg px-2.5 py-1.5 text-left"
                style={{
                  background: precision === p.value ? "#1d3358" : "#111d33",
                  border: `1px solid ${precision === p.value ? "#60a5fa" : "#ffffff14"}`,
                }}
              >
                <span style={{ color: "#dce4f5", fontSize: 12.5 }}>{p.label}</span>
                <span style={{ color: "#6d7c99", fontSize: 11 }}>{p.detail}</span>
              </button>
            ))}
          </div>

          <div className="mt-3 flex flex-col gap-1.5">
            {AUDIENCE_LABELS.map((a) => (
              <button
                key={a.value}
                type="button"
                data-testid={`share-where-${a.value}`}
                onClick={() => void share(a.value)}
                className="flex items-center justify-between rounded-lg px-2.5 py-2 text-left"
                style={{ background: "#182642" }}
              >
                <span style={{ color: "#e8edf8", fontSize: 13 }}>{a.label}</span>
                <span style={{ color: "#6d7c99", fontSize: 11 }}>{a.detail}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-2.5 w-full rounded-lg py-1.5"
            style={{ color: "#93a0bb", fontSize: 12.5 }}
          >
            Not now
          </button>

          {state.kind === "asking" && (
            <p className="mt-2" style={{ color: "#93a0bb", fontSize: 11.5 }}>
              Waiting for your device…
            </p>
          )}
          {state.kind === "denied" && (
            <p className="mt-2" style={{ color: "#f0a3a3", fontSize: 11.5 }}>
              Your device didn&apos;t share a location. Nothing was sent.
            </p>
          )}
          {state.kind === "error" && (
            <p className="mt-2" style={{ color: "#f0a3a3", fontSize: 11.5 }}>
              {state.message}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
