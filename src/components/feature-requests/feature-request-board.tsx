"use client";

import { useMemo, useState } from "react";
import {
  ArrowBigUp,
  CheckCircle2,
  Hammer,
  Lightbulb,
  Loader2,
  Rocket,
  Search,
  Send,
  Sparkles,
} from "lucide-react";
import {
  featureRequestStatuses,
  getFeatureRequestStatusLabel,
  type FeatureRequestItem,
  type FeatureRequestStatus,
} from "@/lib/feature-request-options";

type FeatureRequestBoardProps = {
  initialRequests: FeatureRequestItem[];
  isAdmin: boolean;
};

type FilterValue = FeatureRequestStatus | "all";
type SortValue = "popular" | "newest" | "status";

const statusIcons = {
  under_review: Search,
  planned: Lightbulb,
  building: Hammer,
  released: CheckCircle2,
} satisfies Record<FeatureRequestStatus, typeof Search>;

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function sortRequests(requests: FeatureRequestItem[], sort: SortValue) {
  const statusOrder = new Map(featureRequestStatuses.map((status, index) => [status.value, index]));

  return [...requests].sort((a, b) => {
    if (sort === "newest") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    if (sort === "status") {
      const statusDelta = (statusOrder.get(a.status) ?? 0) - (statusOrder.get(b.status) ?? 0);
      if (statusDelta !== 0) return statusDelta;
    }

    const voteDelta = b.voteCount - a.voteCount;
    if (voteDelta !== 0) return voteDelta;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export function FeatureRequestBoard({ initialRequests, isAdmin }: FeatureRequestBoardProps) {
  const [requests, setRequests] = useState(initialRequests);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [filter, setFilter] = useState<FilterValue>("all");
  const [sort, setSort] = useState<SortValue>("popular");
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const [pendingStatusId, setPendingStatusId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const counts = useMemo(() => {
    return featureRequestStatuses.reduce<Record<FeatureRequestStatus, number>>((acc, status) => {
      acc[status.value] = requests.filter((request) => request.status === status.value).length;
      return acc;
    }, {
      under_review: 0,
      planned: 0,
      building: 0,
      released: 0,
    });
  }, [requests]);

  const visibleRequests = useMemo(() => {
    const filtered = filter === "all" ? requests : requests.filter((request) => request.status === filter);
    return sortRequests(filtered, sort);
  }, [filter, requests, sort]);

  const groupedRequests = useMemo(() => {
    return featureRequestStatuses.map((status) => ({
      ...status,
      requests: sortRequests(
        visibleRequests.filter((request) => request.status === status.value),
        sort,
      ),
    }));
  }, [sort, visibleRequests]);

  async function submitRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setNotice(null);

    try {
      const response = await fetch("/api/feature-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ title, description }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; request?: FeatureRequestItem };

      if (!response.ok || !payload.request) {
        throw new Error(payload.error || "Idea could not be submitted.");
      }

      setRequests((current) => [payload.request!, ...current]);
      setTitle("");
      setDescription("");
      setFilter("all");
      setSort("newest");
      setNotice({ type: "success", message: "Idea submitted for review." });
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Idea could not be submitted." });
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleVote(request: FeatureRequestItem) {
    if (pendingRequestId) return;

    const previous = requests;
    const nextHasVoted = !request.hasVoted;
    setPendingRequestId(request.id);
    setNotice(null);
    setRequests((current) =>
      current.map((item) =>
        item.id === request.id
          ? {
              ...item,
              hasVoted: nextHasVoted,
              voteCount: Math.max(0, item.voteCount + (nextHasVoted ? 1 : -1)),
            }
          : item,
      ),
    );

    try {
      const response = await fetch(`/api/feature-requests/${request.id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ action: nextHasVoted ? "upvote" : "remove" }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; request?: FeatureRequestItem };

      if (!response.ok || !payload.request) {
        throw new Error(payload.error || "Vote could not be saved.");
      }

      setRequests((current) => current.map((item) => (item.id === payload.request!.id ? payload.request! : item)));
    } catch (error) {
      setRequests(previous);
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Vote could not be saved." });
    } finally {
      setPendingRequestId(null);
    }
  }

  async function changeStatus(request: FeatureRequestItem, status: FeatureRequestStatus) {
    if (!isAdmin || request.status === status) return;

    const previous = requests;
    setPendingStatusId(request.id);
    setNotice(null);
    setRequests((current) => current.map((item) => (item.id === request.id ? { ...item, status } : item)));

    try {
      const response = await fetch(`/api/feature-requests/${request.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ status }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; request?: FeatureRequestItem };

      if (!response.ok || !payload.request) {
        throw new Error(payload.error || "Status could not be updated.");
      }

      setRequests((current) => current.map((item) => (item.id === payload.request!.id ? payload.request! : item)));
    } catch (error) {
      setRequests(previous);
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Status could not be updated." });
    } finally {
      setPendingStatusId(null);
    }
  }

  function renderRequestCard(request: FeatureRequestItem) {
    const StatusIcon = statusIcons[request.status];
    const busy = pendingRequestId === request.id;

    return (
      <article key={request.id} className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-primary)]/78 p-4 shadow-[var(--shadow-sm)] transition hover:border-[var(--accent-muted)]">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => toggleVote(request)}
            disabled={busy}
            aria-pressed={request.hasVoted}
            className={`grid min-h-16 w-14 shrink-0 place-items-center rounded-2xl border text-sm font-black transition ${
              request.hasVoted
                ? "border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--accent)]"
                : "border-[var(--border-primary)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--accent)]"
            }`}
            title={request.hasVoted ? "Remove upvote" : "Upvote"}
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <ArrowBigUp className="h-5 w-5" aria-hidden="true" />}
            <span>{request.voteCount}</span>
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-2.5 py-1 text-[11px] font-black text-[var(--text-secondary)]">
                <StatusIcon className="h-3.5 w-3.5 text-[var(--accent)]" aria-hidden="true" />
                {getFeatureRequestStatusLabel(request.status)}
              </span>
              <span className="text-xs font-semibold text-[var(--text-muted)]">{formatDate(request.createdAt)}</span>
            </div>

            <h3 className="mt-3 text-base font-black leading-tight text-[var(--text-primary)]">{request.title}</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{request.description}</p>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-semibold text-[var(--text-muted)]">
                Suggested by {request.authorDisplayName || request.authorUsername}
              </p>

              {isAdmin && (
                <label className="flex items-center gap-2 text-xs font-black text-[var(--text-muted)]">
                  Status
                  <select
                    value={request.status}
                    disabled={pendingStatusId === request.id}
                    onChange={(event) => changeStatus(request, event.currentTarget.value as FeatureRequestStatus)}
                    className="rounded-full border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-3 py-1.5 text-xs font-black text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                  >
                    {featureRequestStatuses.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          </div>
        </div>
      </article>
    );
  }

  return (
    <div className="grid h-full min-h-0 gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
      <aside className="min-h-0 rounded-3xl border border-[var(--border-primary)] bg-[var(--bg-secondary)]/78 p-4 shadow-[var(--shadow-sm)]">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--accent)] text-white">
            <Rocket className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="mesh-kicker">Ideas</p>
            <h1 className="text-2xl font-black text-[var(--text-primary)]">Feature requests</h1>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-[var(--text-secondary)]">
          Suggest what Mesh.me should build next. Vote on useful ideas and track what is under review, planned, building, or released.
        </p>

        <form onSubmit={submitRequest} className="mt-5 grid gap-3">
          <label className="grid gap-2 text-sm font-black text-[var(--text-primary)]">
            Idea title
            <input
              value={title}
              onChange={(event) => setTitle(event.currentTarget.value)}
              required
              minLength={4}
              maxLength={120}
              className="min-h-12 rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-primary)] px-4 text-sm font-semibold outline-none transition focus:border-[var(--accent)]"
              placeholder="A better shared scrolling queue"
            />
          </label>

          <label className="grid gap-2 text-sm font-black text-[var(--text-primary)]">
            What should it do?
            <textarea
              value={description}
              onChange={(event) => setDescription(event.currentTarget.value)}
              required
              minLength={12}
              maxLength={1200}
              rows={6}
              className="min-h-36 resize-none rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-primary)] px-4 py-3 text-sm font-semibold leading-6 outline-none transition focus:border-[var(--accent)]"
              placeholder="Describe the workflow, who it helps, and why it matters."
            />
          </label>

          <button type="submit" disabled={submitting} className="mesh-action mesh-action-primary justify-center px-5">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
            {submitting ? "Submitting..." : "Submit idea"}
          </button>
        </form>

        {notice && (
          <p className={`mt-4 rounded-2xl border p-3 text-sm font-semibold ${
            notice.type === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
              : "border-red-500/30 bg-red-500/10 text-red-500"
          }`} role={notice.type === "error" ? "alert" : "status"}>
            {notice.message}
          </p>
        )}
      </aside>

      <section className="flex min-h-0 flex-col rounded-3xl border border-[var(--border-primary)] bg-[var(--bg-secondary)]/72 shadow-[var(--shadow-sm)]">
        <div className="shrink-0 border-b border-[var(--border-primary)] p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black text-[var(--text-primary)]">{requests.length} ideas</p>
              <p className="text-xs font-semibold text-[var(--text-muted)]">Vote once per idea. Admins can move status.</p>
            </div>
            <label className="flex items-center gap-2 text-xs font-black text-[var(--text-muted)]">
              Sort
              <select
                value={sort}
                onChange={(event) => setSort(event.currentTarget.value as SortValue)}
                className="rounded-full border border-[var(--border-primary)] bg-[var(--bg-primary)] px-3 py-2 text-xs font-black text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
              >
                <option value="popular">Most votes</option>
                <option value="newest">Newest</option>
                <option value="status">Status</option>
              </select>
            </label>
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="Filter by status">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`shrink-0 rounded-full border px-3 py-2 text-xs font-black transition ${
                filter === "all"
                  ? "border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--accent)]"
                  : "border-[var(--border-primary)] bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              All {requests.length}
            </button>
            {featureRequestStatuses.map((status) => (
              <button
                key={status.value}
                type="button"
                onClick={() => setFilter(status.value)}
                className={`shrink-0 rounded-full border px-3 py-2 text-xs font-black transition ${
                  filter === status.value
                    ? "border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--accent)]"
                    : "border-[var(--border-primary)] bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                {status.label} {counts[status.value]}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
          {visibleRequests.length === 0 ? (
            <div className="grid min-h-72 place-items-center rounded-3xl border border-dashed border-[var(--border-primary)] bg-[var(--bg-primary)]/55 p-6 text-center">
              <div>
                <Sparkles className="mx-auto h-9 w-9 text-[var(--accent)]" aria-hidden="true" />
                <h2 className="mt-3 text-lg font-black text-[var(--text-primary)]">No ideas here yet.</h2>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[var(--text-secondary)]">
                  Submit the first request or switch filters to see more ideas.
                </p>
              </div>
            </div>
          ) : filter === "all" ? (
            <div className="grid gap-3 xl:grid-cols-4">
              {groupedRequests.map((group) => {
                const Icon = statusIcons[group.value];
                return (
                  <section key={group.value} className="min-w-0 rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-primary)]/42 p-3">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <h2 className="inline-flex min-w-0 items-center gap-2 text-sm font-black text-[var(--text-primary)]">
                        <Icon className="h-4 w-4 shrink-0 text-[var(--accent)]" aria-hidden="true" />
                        <span className="truncate">{group.label}</span>
                      </h2>
                      <span className="rounded-full border border-[var(--border-primary)] px-2 py-0.5 text-xs font-black text-[var(--text-muted)]">
                        {group.requests.length}
                      </span>
                    </div>
                    <div className="grid gap-3">
                      {group.requests.length > 0 ? group.requests.map(renderRequestCard) : (
                        <p className="rounded-2xl border border-dashed border-[var(--border-primary)] p-4 text-sm leading-6 text-[var(--text-muted)]">
                          Nothing {group.label.toLowerCase()} yet.
                        </p>
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
          ) : (
            <div className="grid gap-3 xl:grid-cols-2">{visibleRequests.map(renderRequestCard)}</div>
          )}
        </div>
      </section>
    </div>
  );
}
