"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Search, X } from "lucide-react";
import { helpCategories, helpCategoryMeta, type HelpArticle, type HelpCategory } from "@/lib/help-center";

type HelpCenterSearchProps = {
  articles: HelpArticle[];
};

type ActiveCategory = "all" | HelpCategory;

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function articleMatches(article: HelpArticle, query: string) {
  if (!query) return true;

  const category = helpCategoryMeta[article.category];
  const searchableText = [
    article.title,
    article.summary,
    category.label,
    category.description,
    ...article.steps,
    ...article.relatedLinks.map((link) => link.label),
  ].join(" ");

  return normalize(searchableText).includes(query);
}

export function HelpCenterSearch({ articles }: HelpCenterSearchProps) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<ActiveCategory>("all");
  const normalizedQuery = normalize(query);

  const filteredArticles = useMemo(() => {
    return articles.filter((article) => {
      const categoryMatches = activeCategory === "all" || article.category === activeCategory;
      return categoryMatches && articleMatches(article, normalizedQuery);
    });
  }, [activeCategory, articles, normalizedQuery]);

  const categoryCounts = useMemo(() => {
    return helpCategories.reduce<Record<HelpCategory, number>>((acc, category) => {
      acc[category] = articles.filter((article) => article.category === category).length;
      return acc;
    }, {} as Record<HelpCategory, number>);
  }, [articles]);

  function resetSearch() {
    setQuery("");
    setActiveCategory("all");
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <aside className="help-filter-panel mesh-section h-fit p-4">
        <label htmlFor="help-search" className="text-sm font-black text-[var(--text-primary)]">
          Search help
        </label>
        <div className="mt-3 flex min-h-11 items-center gap-2 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-input)] px-3">
          <Search className="h-4 w-4 shrink-0 text-[var(--accent)]" aria-hidden="true" />
          <input
            id="help-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
            placeholder="Search account, billing, errors..."
            type="search"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]" aria-label="Clear search">
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="mt-4 grid gap-2" aria-label="Help categories">
          <button
            type="button"
            onClick={() => setActiveCategory("all")}
            className={`help-category-button ${activeCategory === "all" ? "help-category-button-active" : ""}`}
            aria-pressed={activeCategory === "all"}
          >
            <span>All articles</span>
            <span>{articles.length}</span>
          </button>
          {helpCategories.map((category) => {
            const meta = helpCategoryMeta[category];
            const Icon = meta.icon;
            const active = activeCategory === category;

            return (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                className={`help-category-button ${active ? "help-category-button-active" : ""}`}
                aria-pressed={active}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{meta.label}</span>
                </span>
                <span>{categoryCounts[category]}</span>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-black text-[var(--text-primary)]">
              {filteredArticles.length} article{filteredArticles.length === 1 ? "" : "s"}
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              {activeCategory === "all" ? "All help topics" : helpCategoryMeta[activeCategory].description}
            </p>
          </div>
          {(query || activeCategory !== "all") && (
            <button type="button" onClick={resetSearch} className="mesh-choice inline-flex min-h-10 items-center justify-center rounded-xl px-3 text-sm font-black text-[var(--text-secondary)]">
              Reset
            </button>
          )}
        </div>

        {filteredArticles.length > 0 ? (
          <div className="grid gap-3">
            {filteredArticles.map((article) => {
              const meta = helpCategoryMeta[article.category];
              const Icon = meta.icon;

              return (
                <article key={article.id} id={article.id} className="rounded-2xl border border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] p-4 shadow-[var(--shadow-sm)]">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-primary)] bg-[var(--bg-primary)] px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-[var(--text-muted)]">
                        <Icon className="h-3.5 w-3.5 text-[var(--accent)]" aria-hidden="true" />
                        {meta.label}
                      </span>
                      <h2 className="mt-3 text-lg font-black text-[var(--text-primary)]">{article.title}</h2>
                    </div>
                  </div>

                  <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{article.summary}</p>

                  <details className="mt-4 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)]/70 p-3">
                    <summary className="cursor-pointer text-sm font-black text-[var(--text-primary)]">How to handle it</summary>
                    <ol className="mt-3 grid gap-2">
                      {article.steps.map((step, index) => (
                        <li key={step} className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-2 text-sm leading-6 text-[var(--text-secondary)]">
                          <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent-subtle)] text-xs font-black text-[var(--accent)]">
                            {index + 1}
                          </span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ol>
                  </details>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {article.relatedLinks.map((link) => (
                      <Link key={`${article.id}-${link.href}`} href={link.href} className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-[var(--border-primary)] px-3 text-xs font-black text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]">
                        {link.label}
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </Link>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="mesh-section p-6 text-center">
            <Search className="mx-auto h-8 w-8 text-[var(--accent)]" aria-hidden="true" />
            <h2 className="mt-3 text-lg font-black text-[var(--text-primary)]">No help articles found</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--text-secondary)]">
              Try a different word like password, billing, data, Meshi, platform, or error.
            </p>
            <button type="button" onClick={resetSearch} className="brand-button mt-4 inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-black text-white">
              Clear search
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
