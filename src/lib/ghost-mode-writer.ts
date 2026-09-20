type SaveResult = { success?: true; error?: string };

/** Serialize privacy changes across controls. Hiding is immediate; becoming
 * visible waits for the server. Stale account responses cannot undo hiding. */
export function createGhostModeWriter({ publish, persist, onChange, seed = publish }: {
  publish: (next: boolean) => void;
  persist: (next: boolean) => Promise<{ error?: string }>;
  onChange: () => void;
  seed?: (next: boolean) => void;
}) {
  let pending: Promise<SaveResult> | null = null;
  let error: string | null = null;
  let account: string | null = null;
  let generation = 0;
  let desired = true;
  let dirty = false;

  return {
    isPending: () => pending !== null,
    getError: () => error,
    reconcile(accountId: string, serverGhost: boolean) {
      if (account !== accountId) {
        account = accountId;
        generation++;
        pending = null;
        error = null;
        dirty = false;
      } else if (pending || (dirty && desired !== serverGhost)) {
        return;
      }
      desired = serverGhost;
      dirty = false;
      error = null;
      seed(serverGhost);
      queueMicrotask(onChange);
    },
    update(next: boolean): Promise<SaveResult> {
      if (pending) {
        // A concurrent request to hide takes precedence over an in-flight reveal.
        if (next) { desired = true; dirty = true; publish(true); }
        return pending;
      }
      const currentGeneration = generation;
      desired = next;
      dirty = true;
      error = null;
      if (next) publish(true);
      pending = Promise.resolve().then(async () => {
        try {
          let saving = desired;
          for (;;) {
            if (currentGeneration !== generation) return { error: "Account changed. Please check Ghost Mode for this account." };
            const result = await persist(saving);
            if (currentGeneration !== generation) return { error: "Account changed. Please check Ghost Mode for this account." };
            if (saving !== desired) { saving = desired; continue; }
            if (result.error) throw new Error("Unable to save Ghost Mode");
            publish(saving);
            break;
          }
          return { success: true } as const;
        } catch {
          if (currentGeneration !== generation) return { error: "Account changed. Please check Ghost Mode for this account." };
          const wasHiding = desired;
          desired = true;
          error = wasHiding
            ? "Ghost Mode is on for this device, but could not sync to your account. Retry to hide on all devices."
            : "Could not turn off Ghost Mode. Your presence is still hidden. Try again.";
          return { error };
        } finally {
          if (currentGeneration === generation) {
            pending = null;
            onChange();
          }
        }
      });
      onChange();
      return pending;
    },
  };
}
