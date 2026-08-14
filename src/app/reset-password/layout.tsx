// The page itself is a client component, so the route segment config lives
// here: prerendered HTML froze build-time markup while the proxy stamps a
// fresh CSP nonce per request — every script on the cached page was refused.
// Per-request rendering lets Next stamp the live nonce onto its scripts.
export const dynamic = "force-dynamic";

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
