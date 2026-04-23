"use client";

import { ExternalLink, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";

interface InAppBrowserProps {
  isOpen: boolean;
  url: string | null;
  title?: string;
  onClose: () => void;
}

export function InAppBrowser({ isOpen, url, title = "Connected Content", onClose }: InAppBrowserProps) {
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const loading = loadedUrl !== url;

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen, url]);

  if (!isOpen || !url) return null;

  return (
    <div className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm">
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-white/10 bg-[var(--bg-secondary)]/95 px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{title}</p>
            <p className="truncate text-xs text-[var(--text-muted)]">{url}</p>
          </div>
          <div className="ml-3 flex items-center gap-2">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-colors"
            >
              <span className="inline-flex items-center gap-1">
                <ExternalLink className="h-3.5 w-3.5" />
                Open Externally
              </span>
            </a>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-colors"
              aria-label="Close in-app browser"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="relative flex-1 bg-white">
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/90">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading content...
              </div>
            </div>
          )}
          <iframe
            key={url}
            src={url}
            title={title}
            className="h-full w-full"
            onLoad={() => setLoadedUrl(url)}
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </div>
    </div>
  );
}
