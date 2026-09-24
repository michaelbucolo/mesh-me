"use client";

import { createElement, useSyncExternalStore } from "react";
import { formatRelativeTime } from "@/lib/utils";

const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

/** A deterministic first render, even across clock or timezone differences. */
export function RelativeTime({ date, className }: { date: Date | string; className?: string }) {
  const hydrated = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  const parsed = new Date(date);
  if (!Number.isFinite(parsed.getTime())) return createElement("span", { className }, "Time unavailable");
  const iso = parsed.toISOString();
  // Do not calculate "now" during SSR or the first hydrating render. A minute
  // can tick over between them. The semantic timestamp remains available even
  // without JavaScript; once hydrated, use the person's current local time.
  return createElement("time", { dateTime: iso, title: iso, className }, hydrated ? formatRelativeTime(date) : iso.slice(5, 10));
}
