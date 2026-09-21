"use client";

import Link from "next/link";
import { ArrowUpRight, MessageCircle, Send } from "lucide-react";
import { MeshiMascot } from "@/components/meshi/meshi-mascot";
import { useMessagesData } from "@/components/messages/messages-data-context";
import { MeChatConversationList } from "@/components/messages/mechat-conversation-list";

export function MessagesIndexPane() {
  const { currentUser, initialThreads, initialNotes } = useMessagesData();
  return (
    <>
      <div className="h-full min-h-0 lg:hidden"><MeChatConversationList variant="page" currentUser={currentUser} initialThreads={initialThreads} initialNotes={initialNotes} /></div>
      <div className="presence-message-welcome hidden h-full min-h-0 lg:flex">
        <div className="presence-welcome-stage" aria-hidden="true"><span /><span /><MeshiMascot size={124} mood="happy" prop="envelope" animate /></div>
        <p className="presence-kicker">A little closer</p>
        <h2>Send something.<br />Start something.</h2>
        <p className="presence-welcome-copy">The thought, the link, the thing that made you laugh. Your people are one conversation away.</p>
        <Link href="/messages?compose=true" className="mesh-button presence-primary-link"><Send size={16} aria-hidden="true" />Start a conversation<ArrowUpRight size={16} aria-hidden="true" /></Link>
        <div className="presence-welcome-footer"><MessageCircle size={15} aria-hidden="true" /><span>Mesh.me messages, together in one place.</span></div>
        <p className="presence-welcome-note">Connected platforms keep their own inboxes. Open them from your connected accounts.</p>
      </div>
    </>
  );
}
