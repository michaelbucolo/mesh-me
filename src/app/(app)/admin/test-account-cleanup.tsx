"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Account = { id: string; username: string; posts: number; comments: number; eligible: boolean; reason: string };

export function TestAccountCleanup() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function review() {
    setPending(true); setMessage("");
    try {
      const response = await fetch("/api/admin/test-accounts", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not review accounts.");
      setAccounts(result.accounts);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not review accounts."); }
    finally { setPending(false); }
  }

  async function remove(account: Account) {
    if (pending || confirmation !== account.username) return;
    setPending(true); setMessage("");
    try {
      const response = await fetch("/api/admin/test-accounts", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: account.id, username: confirmation }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not remove account.");
      setAccounts((current) => current?.filter((item) => item.id !== account.id) ?? null);
      setSelected(null); setConfirmation(""); setMessage(`Removed @${account.username}.`);
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not remove account."); }
    finally { setPending(false); }
  }

  return (
    <section className="mesh-surface mt-5 rounded-2xl border border-[var(--ds-border)] p-5" aria-labelledby="fixture-cleanup-title">
      <h2 id="fixture-cleanup-title" className="text-lg font-semibold">Test account cleanup</h2>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">Review verified fixtures before removal. Administrators, connected identities and payment history are protected.</p>
      <Button className="mt-4" variant="secondary" disabled={pending} onClick={review}>{pending ? "Working…" : "Review test accounts"}</Button>
      {accounts && <div className="mt-4 space-y-3">
        {!accounts.length && <p className="text-sm text-[var(--text-secondary)]">No known test accounts remain.</p>}
        {accounts.map((account) => <div key={account.id} className="rounded-xl border border-[var(--ds-border)] p-4">
          <p className="font-semibold">@{account.username}</p>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">{account.posts} posts · {account.comments} comments. {account.reason}</p>
          {account.eligible && selected !== account.id && <Button className="mt-3" variant="secondary" disabled={pending} onClick={() => { setSelected(account.id); setConfirmation(""); }}>Review removal of @{account.username}</Button>}
          {account.eligible && selected === account.id && <div className="mt-3 max-w-md space-y-3">
            <p className="text-sm">This permanently deletes the account, its posts, comments, messages and sessions. Type <strong>{account.username}</strong> to confirm.</p>
            <label className="block text-sm" htmlFor={`confirm-${account.id}`}>Confirm username</label>
            <Input id={`confirm-${account.id}`} autoComplete="off" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} disabled={pending} />
            <div className="flex flex-wrap gap-2">
              <Button variant="danger" disabled={pending || confirmation !== account.username} onClick={() => remove(account)}>Delete @{account.username}</Button>
              <Button variant="ghost" disabled={pending} onClick={() => { setSelected(null); setConfirmation(""); }}>Cancel</Button>
            </div>
          </div>}
        </div>)}
      </div>}
      <p className="mt-3 text-sm" role="status">{message}</p>
    </section>
  );
}
