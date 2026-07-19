import type { Metadata } from "next";
import { LegalDocumentPage } from "@/components/legal/legal-document-page";
import { meshBrand } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Data Deletion",
  description: `How to delete your data from ${meshBrand.name}, including connected-account data and platform-initiated deletion requests.`,
};

// Public, no-login page. Meta (Facebook / Instagram / Threads) and Google both
// require a publicly reachable URL describing how a user can delete their data.
export default function DataDeletionPage() {
  const sections = [
    {
      id: "delete-account",
      title: "Delete your entire account",
      content: (
        <>
          <p>The fastest way to remove everything is to delete your Mesh.me account. This permanently removes your profile, sessions, posts, messages, settings, Meshi preferences, and every connected-account record.</p>
          <p>Sign in and go to <a href="/account/delete">Settings → Delete account</a>, or open <a href="/account/delete">meshs.me/account/delete</a> directly. Personal data is deleted or anonymized within 30 days; backups and cached copies are purged within 90 days.</p>
        </>
      ),
    },
    {
      id: "disconnect-platform",
      title: "Delete data from a single connected platform",
      content: (
        <>
          <p>If you only want to remove one connected service (for example your Instagram or YouTube connection) without deleting your Mesh.me account, sign in and open <a href="/connected-accounts">Connected accounts</a>, then disconnect that platform.</p>
          <p>Disconnecting immediately deletes the stored OAuth tokens for that platform, revokes the token with the provider where the provider supports revocation, and removes the synced posts, comments, media, and followers we cached for that connection.</p>
        </>
      ),
    },
    {
      id: "platform-initiated",
      title: "Requests initiated from Meta (Facebook, Instagram, Threads)",
      content: (
        <>
          <p>When you remove Mesh.me from your Facebook, Instagram, or Threads account, Meta notifies us automatically and we delete the connected-account data tied to that platform identity. This runs through our Data Deletion Request and Deauthorize callbacks; no further action is required from you.</p>
          <p>After a data-deletion request is processed, Meta shows a confirmation code and a status URL you can visit to confirm the request completed.</p>
        </>
      ),
    },
    {
      id: "contact",
      title: "Ask us to delete your data",
      content: (
        <>
          <p>If you cannot access your account or want to confirm a deletion, email <a href="mailto:security@meshs.me">security@meshs.me</a> from the address on your account. We honor access, correction, deletion, restriction, and export requests, including California and European privacy rights.</p>
        </>
      ),
    },
  ];

  return (
    <LegalDocumentPage
      eyebrow="mesh.me Data Deletion"
      title="Delete your data, on your terms."
      summary="This page explains every way to delete your data from Mesh.me — your whole account, a single connected platform, or a request initiated from Meta — and how to reach us if you need help."
      updatedLabel="Last updated: July 19, 2026"
      sections={sections}
    />
  );
}
