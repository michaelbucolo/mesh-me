import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { readInbox } from "@/lib/inbox/read-inbox";
import { InboxView } from "@/components/inbox/inbox-view";

export const metadata: Metadata = { title: "Inbox" };

// The read happens here because this is already a server component: one round
// trip instead of two, and the list is in the HTML rather than arriving after
// the bundle. The filters are then client-side over rows already in hand, so
// switching tabs never spins.
export default async function InboxPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=%2Finbox");

  const inbox = await readInbox(user.id, "all");

  return (
    // min-h-full, not h-full: the shell's scroll container sizes to content,
    // so h-full collapsed to the height of the list and left a slab of the
    // shell's own background showing underneath.
    <div className="h-full min-h-full w-full" style={{ background: "#070b14" }}>
      <InboxView initial={inbox} />
    </div>
  );
}
