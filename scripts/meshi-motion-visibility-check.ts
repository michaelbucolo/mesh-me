import assert from "node:assert/strict";
import { observeMeshiMotion } from "../src/components/meshi/observe-meshi-motion";

// Exercise the observer lifecycle without a browser or a render framework.
// These fakes track resource ownership and drive actual exported behavior.
const doc = new EventTarget() as EventTarget & { visibilityState: string };
doc.visibilityState = "visible";
const media = new EventTarget() as EventTarget & { matches: boolean };
media.matches = false;
let observersCreated = 0;
const observerInstances: FakeObserver[] = [];
class FakeObserver {
  targets = new Set<Element>();
  disconnected = false;
  constructor(readonly callback: IntersectionObserverCallback) {
    observerInstances.push(this);
    observersCreated += 1;
  }
  observe(target: Element) { this.targets.add(target); }
  unobserve(target: Element) { this.targets.delete(target); }
  disconnect() { this.disconnected = true; this.targets.clear(); }
  show(target: Element, isIntersecting: boolean) {
    this.callback([{ target, isIntersecting } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
}
Object.defineProperties(globalThis, {
  document: { configurable: true, value: doc },
  window: { configurable: true, value: { matchMedia: () => media } },
  IntersectionObserver: { configurable: true, writable: true, value: FakeObserver },
});
const first = {} as Element;
const second = {} as Element;
const eventsA: boolean[] = [];
const eventsB: boolean[] = [];
const stopA = observeMeshiMotion(first, (active) => eventsA.push(active));
const observer = observerInstances[0];
const stopB = observeMeshiMotion(second, (active) => eventsB.push(active));
assert.equal(observersCreated, 1, "All characters share one viewport observer");
assert.deepEqual(eventsA, [false], "Subscription resets any previously retained visible state");
assert.deepEqual(eventsB, [false], "Unmeasured/offscreen bodies start at rest");
observer.show(first, true);
observer.show(first, true);
assert.deepEqual(eventsA, [false, true], "Repeated intersections do not rerender a visible character");
assert.deepEqual(eventsB, [false], "An offscreen character never starts its animation loop");
observer.show(second, true);
doc.visibilityState = "hidden";
doc.dispatchEvent(new Event("visibilitychange"));
assert.equal(eventsA.at(-1), false, "Hiding the tab stops the first character");
assert.equal(eventsB.at(-1), false, "Hiding the tab stops every visible character");
observer.show(second, false);
doc.visibilityState = "visible";
doc.dispatchEvent(new Event("visibilitychange"));
assert.equal(eventsA.at(-1), true, "Returning resumes a visible character");
assert.equal(eventsB.at(-1), false, "Returning does not wake an offscreen character");
media.matches = true;
media.dispatchEvent(new Event("change"));
assert.equal(eventsA.at(-1), false, "Reduced motion is observed live");
media.matches = false;
media.dispatchEvent(new Event("change"));
assert.equal(eventsA.at(-1), true, "Removing reduced motion resumes only visible bodies");
stopA();
assert.equal(observer.targets.has(first), false, "Unmount releases its observed element");
assert.equal(observer.targets.has(second), true, "Unmount preserves other subscriptions");
const before = eventsA.length;
observer.show(first, true);
assert.equal(eventsA.length, before, "Late observer callbacks cannot notify an unmounted body");
stopB();
assert.equal(observer.disconnected, true, "Last unmount disconnects the shared observer");
const beforeB = eventsB.length;
doc.dispatchEvent(new Event("visibilitychange"));
media.dispatchEvent(new Event("change"));
assert.equal(eventsB.length, beforeB, "Last unmount removes lifecycle listeners");

// A remount while hidden must overwrite a formerly true state immediately.
doc.visibilityState = "hidden";
const resumed: boolean[] = [];
const stopResumed = observeMeshiMotion(first, (active) => resumed.push(active));
assert.deepEqual(resumed, [false], "A hidden resubscription resets stale motion state");
observer.show(first, true);
assert.deepEqual(resumed, [false], "A disconnected observer cannot wake a new subscription");
stopResumed();

// Older browsers without IO still observe document and motion preferences.
Object.defineProperty(globalThis, "IntersectionObserver", { configurable: true, value: undefined });
doc.visibilityState = "visible";
const fallback: boolean[] = [];
const stopFallback = observeMeshiMotion(first, (active) => fallback.push(active));
assert.deepEqual(fallback, [true], "No-IO fallback remains functional");
doc.visibilityState = "hidden";
doc.dispatchEvent(new Event("visibilitychange"));
assert.equal(fallback.at(-1), false, "No-IO fallback still pauses hidden tabs");
stopFallback();
console.log("Meshi motion visibility: 20 lifecycle assertions passed.");
