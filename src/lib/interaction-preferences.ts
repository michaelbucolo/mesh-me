// Device preferences. If storage is unavailable, choices still work for this
// session. A single event keeps open settings and other tabs in sync.
const changed = "mesh:interaction-preferences";
const sessionValues = new Map<string, string>();

export function readInteractionPreference(key: string): string | null {
  if (typeof window === "undefined") return null;
  if (sessionValues.has(key)) return sessionValues.get(key)!;
  try { return window.localStorage.getItem(key); }
  catch { return sessionValues.get(key) ?? null; }
}

export function writeInteractionPreference(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
    sessionValues.delete(key);
  } catch { sessionValues.set(key, value); }
  window.dispatchEvent(new Event(changed));
}

export function subscribeInteractionPreferences(listener: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key) sessionValues.delete(event.key);
    else sessionValues.clear();
    listener();
  };
  window.addEventListener(changed, listener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(changed, listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function isHapticsEnabled(): boolean {
  return readInteractionPreference("meshHapticsEnabled") !== "0";
}

export function setHapticsEnabled(enabled: boolean): void {
  writeInteractionPreference("meshHapticsEnabled", enabled ? "1" : "0");
}

export function areVisualEffectsEnabled(): boolean {
  return readInteractionPreference("meshVisualEffectsEnabled") !== "0";
}

export function setVisualEffectsEnabled(enabled: boolean): void {
  writeInteractionPreference("meshVisualEffectsEnabled", enabled ? "1" : "0");
}

export function getSoundLevel(): number {
  const stored = readInteractionPreference("meshSoundLevel");
  const level = stored === null ? 0.4 : Number(stored);
  return Number.isFinite(level) ? Math.max(0, Math.min(1, level)) : 0.4;
}

export function setSoundLevel(level: number): void {
  if (Number.isFinite(level)) writeInteractionPreference("meshSoundLevel", String(Math.max(0, Math.min(1, level))));
}
