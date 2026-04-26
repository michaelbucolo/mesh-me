import type { Metadata } from "next";
import { LegalDocumentPage } from "@/components/legal/legal-document-page";

export const metadata: Metadata = {
  title: "Privacy Policy | mesh.me",
  description: "Privacy Policy for mesh.me. Your data belongs to you. We never sell your information.",
};

export default function PrivacyPage() {
  const sections = [
    {
      id: "collection",
      title: "Information we collect",
      content: (
        <>
          <p>When you create a Mesh.me account, we collect the account data needed to operate the product, such as your email address, username, display name, and password hash.</p>
          <p>You may also provide optional profile information such as a bio, location, website, avatar, banner image, accent color, and interest tags.</p>
          <p>When you connect third-party platform accounts, we store the platform name, your platform username, and the OAuth tokens required to access that service on your behalf. We only access scopes you explicitly authorize through the provider&apos;s consent flow.</p>
          <p>We also collect product usage and technical data for service operation, security, debugging, and analytics. That can include pages visited, features used, device type, browser, operating system, and IP address.</p>
        </>
      ),
    },
    {
      id: "use",
      title: "How we use your information",
      content: (
        <>
          <p>We use account and content data to operate Mesh.me, personalize the product, support connected-platform features, process subscriptions, send service communications, and improve the service.</p>
          <p>We also use data to detect abuse, prevent fraud, maintain security, satisfy legal obligations, and power the Mesh, Feed, MeChat, Analytics, and Meshi experiences.</p>
          <p>Mesh.me does not use your data to sell ads, build third-party advertising profiles, or participate in data-broker style monetization.</p>
        </>
      ),
    },
    {
      id: "sharing",
      title: "Sharing and disclosure",
      content: (
        <>
          <p>We do not sell personal information. Public content you intentionally publish may be visible to other users and discoverable by search engines.</p>
          <p>When you trigger cross-platform actions through Mesh.me, those actions are sent through your authorized connection to the source platform, and that platform&apos;s privacy rules also apply.</p>
          <p>We may share data with essential service providers such as hosting, payment, or email vendors under confidentiality and operational constraints, or when required by law.</p>
        </>
      ),
    },
    {
      id: "retention",
      title: "Retention, deletion, and portability",
      content: (
        <>
          <p>We retain information while your account is active and as needed to provide the service. If you delete your account, we will delete or anonymize personal data within the window described in our operational policy, except where legal retention is required.</p>
          <p>Users can request export or deletion through product controls and support channels. Backup and cached copies may persist temporarily while normal purge cycles complete.</p>
        </>
      ),
    },
    {
      id: "rights",
      title: "Privacy controls and legal rights",
      content: (
        <>
          <p>You can review or update profile information, visibility settings, connected accounts, message permissions, notifications, and data controls from product settings.</p>
          <p>Depending on your jurisdiction, you may also have rights to access, correct, delete, restrict, or export your information, and to object to certain processing.</p>
          <p>California and European privacy rights are supported through the same general user request channels. Mesh.me does not discriminate against users for exercising those rights.</p>
        </>
      ),
    },
    {
      id: "security",
      title: "Security and contact",
      content: (
        <>
          <p>Mesh.me applies standard safeguards including password hashing, encrypted session handling, input validation, transport security, secure headers, rate limiting, and controlled handling for provider tokens.</p>
          <p>No internet service can promise absolute security. If you have privacy questions or need to exercise your rights, contact privacy@mesh.me.</p>
        </>
      ),
    },
  ];

  return (
    <LegalDocumentPage
      eyebrow="mesh.me Privacy Policy"
      title="Your data should stay legible to you."
      summary="This page explains the launch version of how Mesh.me collects, uses, retains, protects, exports, and deletes user data. The product goal is privacy-first operation with user-visible controls, not hidden exploitation."
      updatedLabel="Last updated: April 26, 2026"
      sections={sections}
    />
  );
}
