import type { IdentityProvider } from "@/lib/identity-auth";

type IdentityProviderButtonsProps = {
  providers: IdentityProvider[];
  next?: string | null;
  className?: string;
};

const PROVIDER_LABEL: Record<IdentityProvider, string> = {
  google: "Continue with Google",
  apple: "Continue with Apple",
};

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 18 18" className="h-[18px] w-[18px]" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.34A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.94H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.06l3.01-2.34Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.94l3.01 2.34C4.68 5.16 6.66 3.58 9 3.58Z" />
    </svg>
  );
}

function AppleGlyph() {
  return (
    <svg viewBox="0 0 16 18" className="h-[18px] w-[18px]" aria-hidden="true" fill="currentColor">
      <path d="M13.27 13.79c-.24.56-.53 1.07-.87 1.55-.46.65-.84 1.1-1.13 1.35-.45.41-.93.62-1.45.63-.37 0-.82-.1-1.34-.32-.52-.21-1-.32-1.44-.32-.46 0-.95.11-1.49.32-.54.22-.97.33-1.3.34-.5.02-.99-.2-1.47-.66-.31-.27-.71-.74-1.19-1.41-.52-.72-.94-1.55-1.28-2.5-.36-1.03-.54-2.02-.54-2.98 0-1.1.24-2.05.72-2.85a4.2 4.2 0 0 1 1.49-1.51 4 4 0 0 1 2.02-.57c.39 0 .9.12 1.54.36.64.24 1.05.36 1.23.36.13 0 .59-.14 1.36-.42.73-.26 1.35-.37 1.86-.33 1.37.11 2.4.65 3.08 1.63-1.23.74-1.83 1.78-1.82 3.11.01 1.04.39 1.9 1.13 2.59.34.32.71.56 1.13.74-.09.26-.19.51-.3.76ZM10.6.36c0 .82-.3 1.59-.9 2.3-.72.85-1.6 1.34-2.55 1.26a2.57 2.57 0 0 1-.02-.31c0-.79.34-1.63.96-2.32.31-.35.7-.64 1.18-.87.48-.23.93-.36 1.35-.38.01.1.01.21.01.32Z" />
    </svg>
  );
}

const PROVIDER_GLYPH: Record<IdentityProvider, () => React.ReactElement> = {
  google: GoogleGlyph,
  apple: AppleGlyph,
};

export function IdentityProviderButtons({ providers, next, className }: IdentityProviderButtonsProps) {
  if (!providers.length) return null;

  const suffix = next ? `?next=${encodeURIComponent(next)}` : "";

  return (
    <div className={className}>
      <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
        <span className="h-px flex-1 bg-[var(--glass-card-border)]" />
        or
        <span className="h-px flex-1 bg-[var(--glass-card-border)]" />
      </div>
      <div className="mt-4 space-y-2.5">
        {providers.map((provider) => {
          const Glyph = PROVIDER_GLYPH[provider];
          return (
            <a
              key={provider}
              href={`/api/auth/identity/${provider}${suffix}`}
              className="group relative flex w-full items-center justify-center gap-3 rounded-xl border border-[var(--glass-card-border)] bg-[var(--bg-elevated)] px-4 py-2.5 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--bg-hover)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              {/* Periwinkle → cyan gradient edge that lights up on hover. */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                style={{
                  padding: 1,
                  background: "linear-gradient(120deg, var(--accent), var(--mesh-cyan))",
                  WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
                  WebkitMaskComposite: "xor",
                  maskComposite: "exclude",
                } as React.CSSProperties}
              />
              <span className="inline-flex transition-transform duration-300 ease-out motion-safe:group-hover:-translate-y-0.5 motion-safe:group-hover:scale-110">
                <Glyph />
              </span>
              {PROVIDER_LABEL[provider]}
            </a>
          );
        })}
      </div>
    </div>
  );
}
