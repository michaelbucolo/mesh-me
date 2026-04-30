"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";

interface Tab {
  id: string;
  label: string;
  count?: number;
}

interface TabsProps {
  tabs: Tab[];
  defaultTab?: string;
  onChange?: (tabId: string) => void;
  children: (activeTab: string) => React.ReactNode;
  className?: string;
}

export function Tabs({ tabs, defaultTab, onChange, children, className }: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id || "");

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    onChange?.(tabId);
  };

  return (
    <div className={className}>
      <div className="flex overflow-x-auto border-b border-[var(--ds-border)] ds-scrollbar" role="tablist">
        {tabs.map((tab) => (
          <button
            type="button"
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            role="tab"
            aria-selected={activeTab === tab.id}
            className={cn(
              "ds-focus-ring relative min-h-[var(--ds-control-height)] whitespace-nowrap px-4 py-3 text-sm font-semibold transition-colors",
              activeTab === tab.id
                ? "text-[var(--text-primary)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            )}
          >
            <span className="flex items-center gap-2">
              {tab.label}
              {tab.count !== undefined && (
                <span className="rounded-[var(--ds-radius-pill)] bg-[var(--ds-surface-muted)] px-1.5 py-0.5 text-xs text-[var(--text-muted)]">{tab.count}</span>
              )}
            </span>
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-[var(--accent)]" />
            )}
          </button>
        ))}
      </div>
      <div className="mt-4" role="tabpanel">{children(activeTab)}</div>
    </div>
  );
}
