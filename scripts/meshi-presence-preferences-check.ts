import assert from "node:assert/strict";
import { createGhostModeWriter } from "../src/lib/ghost-mode-writer";
import {
  broadcastGhostMode,
  GHOST_EVENT,
  GHOST_STORAGE_KEY,
  initializeGhostMode,
  readGhostMode,
} from "../src/lib/ghost-mode";
import {
  initializePresenceAccount,
  PRESENCE_ACCOUNT_EVENT,
  readActivityHidden,
  readPresenceAccount,
} from "../src/lib/presence-account";
import {
  broadcastWhereShare,
  readWhereShare,
  WHERE_SHARE_EVENT,
} from "../src/lib/where-share";

let assertions = 0;
function check(actual: unknown, expected: unknown, message: string) {
  assert.deepEqual(actual, expected, message);
  assertions++;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((accept, fail) => { resolve = accept; reject = fail; });
  return { promise, resolve, reject };
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

function fixture(initialGhost = true) {
  const published: boolean[] = [];
  const seeded: boolean[] = [];
  const requests: { ghost: boolean; response: ReturnType<typeof deferred<{ error?: string }>> }[] = [];
  const writer = createGhostModeWriter({
    publish: (ghost) => { published.push(ghost); },
    seed: (ghost) => { seeded.push(ghost); },
    persist: (ghost) => {
      const response = deferred<{ error?: string }>();
      requests.push({ ghost, response });
      return response.promise;
    },
    onChange: () => {},
  });
  writer.reconcile("account-a", initialGhost);
  return { writer, published, seeded, requests };
}

async function checkWriter() {
  const reveal = fixture();
  const revealing = reveal.writer.update(false);
  check([reveal.writer.isPending(), reveal.published], [true, []], "reveal stays hidden until the server accepts it");
  check(reveal.writer.update(false) === revealing, true, "simultaneous reveal controls share one pending operation");
  await flush();
  check(reveal.requests.map((request) => request.ghost), [false], "duplicate reveals create one transport request");
  reveal.requests[0].response.resolve({});
  check([await revealing, reveal.published, reveal.writer.isPending()], [{ success: true }, [false], false], "successful acknowledgement alone publishes visible presence");

  const hide = fixture(false);
  const hiding = hide.writer.update(true);
  check([hide.published, hide.requests], [[true], []], "hiding applies synchronously before transport starts");
  await flush();
  hide.requests[0].response.reject(new Error("private backend detail"));
  const hideFailure = await hiding;
  const hideError = "Ghost Mode is on for this device, but could not sync to your account. Retry to hide on all devices.";
  check([hideFailure, hide.writer.getError(), hide.published], [{ error: hideError }, hideError, [true]], "failed hide retains privacy and returns a safe retry explanation");
  hide.writer.reconcile("account-a", false);
  check([hide.seeded, hide.writer.getError()], [[false], hideError], "stale server reconciliation cannot undo a failed local hide");
  const retryHide = hide.writer.update(true);
  check([hide.writer.isPending(), hide.writer.getError()], [true, null], "retry clears the previous error while retaining pending state");
  await flush();
  hide.requests[1].response.resolve({});
  check([await retryHide, hide.requests.map((request) => request.ghost), hide.writer.getError()], [{ success: true }, [true, true], null], "a failed privacy save can be retried successfully");
  hide.writer.reconcile("account-a", true);
  check(hide.seeded, [false, true], "a matching server state reconciles the saved local hide");

  const failedReveal = fixture();
  const rejectedReveal = failedReveal.writer.update(false);
  await flush();
  failedReveal.requests[0].response.resolve({ error: "private backend detail" });
  const revealError = "Could not turn off Ghost Mode. Your presence is still hidden. Try again.";
  check([await rejectedReveal, failedReveal.published, failedReveal.writer.isPending()], [{ error: revealError }, [], false], "a rejected reveal remains hidden and redacts server error detail");
  const thrownReveal = failedReveal.writer.update(false);
  await flush();
  failedReveal.requests[1].response.reject(new Error("private transport detail"));
  check([await thrownReveal, failedReveal.published], [{ error: revealError }, []], "transport exceptions cannot reveal presence or expose exception detail");

  const queued = fixture();
  const queuedReveal = queued.writer.update(false);
  await flush();
  check([queued.writer.update(true) === queuedReveal, queued.published], [true, [true]], "hiding during an in-flight reveal immediately hides and joins the pending operation");
  check(queued.writer.update(false) === queuedReveal, true, "a competing reveal cannot cancel the queued hide");
  queued.requests[0].response.resolve({});
  await flush();
  check([queued.requests.map((request) => request.ghost), queued.published], [[false, true], [true]], "the queued hide is persisted before a reveal could publish");
  queued.requests[1].response.resolve({});
  check([await queuedReveal, queued.published, queued.writer.isPending()], [{ success: true }, [true, true], false], "queued hiding never flashes visible presence");

  const sameTick = fixture();
  const sameTickSave = sameTick.writer.update(false);
  sameTick.writer.update(true);
  await flush();
  check(sameTick.requests.map((request) => request.ghost), [true], "a hide queued before transport starts prevents the reveal request entirely");
  sameTick.requests[0].response.resolve({});
  await sameTickSave;

  const switched = fixture();
  const oldSave = switched.writer.update(false);
  await flush();
  switched.writer.reconcile("account-b", true);
  check([switched.writer.isPending(), switched.writer.getError(), switched.seeded], [false, null, [true, true]], "switching accounts adopts the new account policy immediately");
  const newSave = switched.writer.update(false);
  await flush();
  switched.requests[0].response.resolve({});
  const accountChanged = "Account changed. Please check Ghost Mode for this account.";
  check([await oldSave, switched.writer.isPending(), switched.published, switched.writer.getError()], [{ error: accountChanged }, true, [], null], "an old account response cannot publish or clear the new account operation");
  switched.requests[1].response.resolve({});
  check([await newSave, switched.published, switched.writer.isPending()], [{ success: true }, [false], false], "only the active account response can finish its reveal");

  const deferredSwitch = fixture();
  const obsolete = deferredSwitch.writer.update(false);
  deferredSwitch.writer.reconcile("account-b", true);
  check([await obsolete, deferredSwitch.requests, deferredSwitch.published], [{ error: accountChanged }, [], []], "switching accounts before the microtask prevents obsolete transport altogether");

  const staleFailure = fixture();
  const oldFailure = staleFailure.writer.update(false);
  await flush();
  staleFailure.writer.reconcile("account-b", false);
  staleFailure.requests[0].response.reject(new Error("old account detail"));
  check([await oldFailure, staleFailure.writer.getError(), staleFailure.seeded, staleFailure.published], [{ error: accountChanged }, null, [true, false], []], "a failed obsolete request cannot change the current account state or error");
}

async function checkClientPreferences() {
  const original = new Map(["window", "localStorage", "fetch"].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const stored = new Map<string, string>();
  let blockRead = false;
  let blockWrite = false;
  const events = new EventTarget();
  const eventCounts = { ghost: 0, where: 0, account: 0 };
  events.addEventListener(GHOST_EVENT, () => { eventCounts.ghost++; });
  events.addEventListener(WHERE_SHARE_EVENT, () => { eventCounts.where++; });
  events.addEventListener(PRESENCE_ACCOUNT_EVENT, () => { eventCounts.account++; });
  const heartbeats: { url: string; method?: string; credentials?: RequestCredentials; body: unknown }[] = [];
  const storage: Storage = {
    get length() { return stored.size; },
    clear: () => { stored.clear(); },
    key: (index) => Array.from(stored.keys())[index] ?? null,
    getItem: (key) => {
      if (blockRead) throw new Error("Storage blocked");
      return stored.get(key) ?? null;
    },
    setItem: (key, value) => {
      if (blockWrite) throw new Error("Storage blocked");
      stored.set(key, String(value));
    },
    removeItem: (key) => { stored.delete(key); },
  };

  try {
    Object.defineProperty(globalThis, "window", { configurable: true, value: events });
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
    Object.defineProperty(globalThis, "fetch", { configurable: true, value: (input: string | URL | Request, init?: RequestInit) => {
      heartbeats.push({ url: String(input), method: init?.method, credentials: init?.credentials, body: JSON.parse(String(init?.body)) });
      return Promise.resolve(new Response(null, { status: 204 }));
    } });

    check([readGhostMode(), readWhereShare(), readPresenceAccount(), readActivityHidden()], [true, false, null, true], "uninitialized client state defaults to hidden and never shares a location");
    blockRead = true;
    blockWrite = true;
    initializeGhostMode(false);
    check(readGhostMode(), false, "an authenticated account policy remains usable when storage is unavailable");
    initializeGhostMode(true);
    check(readGhostMode(), true, "hiding remains effective when both storage reads and writes fail");
    blockRead = false;
    stored.set(GHOST_STORAGE_KEY, "true");
    initializeGhostMode(false);
    check(readGhostMode(), false, "a failed write uses memory instead of readable stale storage");
    stored.set(GHOST_STORAGE_KEY, "false");
    initializeGhostMode(true);
    check(readGhostMode(), true, "readable stale visibility cannot override a hide whose storage write failed");
    blockWrite = false;
    initializeGhostMode(false);
    check([readGhostMode(), stored.get(GHOST_STORAGE_KEY)], [false, "false"], "successful persistence restores normal storage synchronization");

    stored.set("meshShareWhere", "true");
    initializePresenceAccount("account-a", false);
    await flush();
    check([readWhereShare(), readPresenceAccount(), readActivityHidden(), eventCounts.account], [false, "account-a", false, 1], "an account never inherits an old unscoped location opt-in");
    broadcastWhereShare(true);
    check([readWhereShare(), stored.get("meshShareWhere:account-a"), eventCounts.where, heartbeats.at(-1)], [true, "true", 1, { url: "/api/mesh/presence", method: "POST", credentials: "same-origin", body: { surface: "feed", shareWhere: true, ghostMode: false } }], "location consent is persisted per account and sent through the same-origin heartbeat");
    initializePresenceAccount("account-b", true);
    await flush();
    check([readWhereShare(), readActivityHidden()], [false, true], "a different account starts without another account's browsing consent");
    broadcastGhostMode(true);
    check([readGhostMode(), eventCounts.ghost, heartbeats.at(-1)?.body], [true, 1, { surface: "feed", ghostMode: true, shareWhere: false }], "hiding broadcasts immediately with the current account's own location policy");
    initializePresenceAccount("account-a", false);
    await flush();
    check(readWhereShare(), true, "returning to an account restores only that account's location opt-in");
    broadcastGhostMode(false);
    check(heartbeats.at(-1)?.body, { surface: "feed", ghostMode: false, shareWhere: true }, "Ghost Mode heartbeats preserve the active account's location preference");
    blockWrite = true;
    broadcastWhereShare(false);
    check([stored.get("meshShareWhere:account-a"), readWhereShare(), heartbeats.at(-1)?.body], ["true", false, { surface: "feed", shareWhere: false, ghostMode: false }], "opting out overrides readable stale consent even when storage rejects the write");
    broadcastGhostMode(false);
    check(heartbeats.at(-1)?.body, { surface: "feed", ghostMode: false, shareWhere: false }, "a later heartbeat cannot re-expose location after a failed opt-out write");
    initializePresenceAccount("account-b", false);
    await flush();
    check(readWhereShare(), false, "an account with no location consent remains opted out while another account has a memory override");
    initializePresenceAccount("account-a", false);
    await flush();
    check(readWhereShare(), false, "returning to the original account retains the unpersisted opt-out");
    blockWrite = false;
    broadcastWhereShare(false);
    check([stored.get("meshShareWhere:account-a"), readWhereShare()], ["false", false], "retrying the opt-out after storage recovers persists the hidden location policy");
    stored.set("meshShareWhere:account-a", "true");
    check(readWhereShare(), true, "successful persistence clears the memory override so storage changes synchronize again");
    blockRead = true;
    check(readWhereShare(), false, "unavailable location preference storage fails closed");
  } finally {
    for (const [key, descriptor] of original) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
}

async function main() {
  await checkWriter();
  await checkClientPreferences();
  console.log(`Meshi presence preferences: ${assertions} behavior assertions passed.`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
