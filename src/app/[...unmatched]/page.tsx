import { notFound } from "next/navigation";

// Unmatched URLs need request-time HTML too: a pre-rendered error document
// cannot contain the fresh CSP nonce supplied by the proxy. Keep the strict
// policy intact instead of allowing unsafe scripts on recovery pages.
export const dynamic = "force-dynamic";

export default function UnmatchedPage() {
  notFound();
}
