#!/usr/bin/env node
import assert from "node:assert/strict";
import process from "node:process";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RelativeTime } from "../src/components/ui/relative-time.tsx";

// Render the actual component under different clocks and timezone offsets.
// The server snapshot must not depend on the moment it happens to render.
const NativeDate = globalThis.Date;
const originalTimezone = process.env.TZ;
let now = NativeDate.parse("2026-09-24T12:00:59.000Z");
const timestamp = "2026-09-24T12:00:00.000Z";
try {
  globalThis.Date = class extends NativeDate {
    constructor(...args) {
      if (args.length) super(...args);
      else super(now);
    }
    static now() { return now; }
  };
  const render = () => renderToStaticMarkup(createElement(RelativeTime, { date: timestamp, className: "timestamp" }));
  const initial = render();
  assert.match(initial, /<time /);
  assert(initial.includes(timestamp), "Semantic absolute time was lost");
  assert(initial.includes(">09-24<"), "Initial text is not clock-independent");
  for (const timezone of ["UTC", "Pacific/Honolulu", "Pacific/Kiritimati"]) {
    process.env.TZ = timezone;
    for (const skew of [-86400000, 2000, 86400000]) {
      now = NativeDate.parse("2026-09-24T12:00:59.000Z") + skew;
      assert.equal(render(), initial, `Initial markup changed with ${timezone} / ${skew}ms`);
    }
  }
  const invalid = renderToStaticMarkup(createElement(RelativeTime, { date: "not-a-date" }));
  assert(invalid.includes("Time unavailable"), "Invalid timestamp was not handled");
  console.log("PASS: relative timestamps preserve initial markup across minute boundaries, clock skew, and timezones");
} finally {
  globalThis.Date = NativeDate;
  if (originalTimezone === undefined) delete process.env.TZ;
  else process.env.TZ = originalTimezone;
}
