import type { Metadata } from "next";
import { LegalDocumentPage } from "@/components/legal/legal-document-page";
import { meshBrand } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `Privacy Policy for ${meshBrand.name}. Your data belongs to you. We never sell your information.`,
};

export default function PrivacyPage() {
  const sections = [
    {
      id: "collection",
      title: "1. Information we collect",
      content: (
        <>
          <p><strong>Account data.</strong> When you create a Mesh.me account we collect what is needed to operate it — your email address, username, display name, and a hashed (never plaintext) password. We may use email or phone-number verification to help prevent abuse and secure your account.</p>
          <p><strong>Profile and content.</strong> Optional profile details you provide (bio, location, website, avatar, banner image, accent color, interest tags) and the content you create — posts, comments, messages in MeChat, community activity, and your Meshi customization.</p>
          <p><strong>Connected accounts.</strong> When you connect a third-party platform (including GitHub, Discord, Spotify, X/Twitter, Twitch, YouTube, Instagram, Facebook, LinkedIn, Reddit, TikTok, Pinterest, Snapchat, Threads, SoundCloud, Patreon, and Dribbble), we store the platform name, your platform username/ID, and encrypted OAuth tokens for the scopes you explicitly authorize, plus the specific content those scopes let you view or manage inside Mesh.me.</p>
          <p><strong>Payment data.</strong> MeshPro payments are processed by Stripe. We receive limited billing metadata (such as subscription status and the last four digits/card brand) but we do not receive or store your full card number.</p>
          <p><strong>Age-verification status.</strong> If you opt into age-restricted content, identity/age verification is performed by a third-party verifier. We receive only a pass/fail verification status — we do not receive or store your ID document.</p>
          <p><strong>Usage and technical data.</strong> For operating, securing, and debugging the Service we collect data such as pages visited, features used, device type, browser, operating system, approximate location derived from IP, and IP address.</p>
        </>
      ),
    },
    {
      id: "use",
      title: "2. How we use your information",
      content: (
        <>
          <p>We use your information to operate and personalize Mesh.me; power the Mesh, Feed, MeChat, Communities, Analytics, and Meshi experiences; support connected-platform features you enable; process MeshPro subscriptions through Stripe; communicate with you about your account and security; and improve the Service.</p>
          <p>We also use data to detect and prevent abuse and fraud, maintain security, enforce our <a href="/terms">Terms</a> and age-verification requirements, and comply with legal obligations.</p>
          <p>Mesh.me does not use your data to sell advertising, build third-party advertising profiles, or engage in data-broker monetization, and we will never sell your personal data. This is a permanent, foundational commitment.</p>
        </>
      ),
    },
    {
      id: "legal-bases",
      title: "3. Legal bases for processing (EEA/UK)",
      content: (
        <>
          <p>If you are in the European Economic Area or the United Kingdom, we process your personal data on these legal bases: <strong>performance of a contract</strong> (to provide the Service you request); <strong>legitimate interests</strong> (to secure, improve, and protect the Service, balanced against your rights); <strong>consent</strong> (for optional features such as connecting a third-party account or opting into age-restricted content, which you may withdraw at any time); and <strong>legal obligation</strong> (to comply with applicable law).</p>
        </>
      ),
    },
    {
      id: "cookies",
      title: "4. Cookies and similar technologies",
      content: (
        <>
          <p>We use strictly necessary cookies to keep you signed in and to secure authentication and OAuth flows (for example, session and CSRF/OAuth-state cookies). We use limited first-party, operational analytics to understand and improve how the Service is used.</p>
          <p>We do not use third-party advertising cookies or cross-site ad trackers. You can control cookies through your browser settings, though disabling strictly necessary cookies will break sign-in and security features.</p>
        </>
      ),
    },
    {
      id: "sharing",
      title: "5. How we share information",
      content: (
        <>
          <p>We do not sell personal information. Public content you intentionally publish may be visible to other users and discoverable by search engines. When you trigger cross-platform actions through Mesh.me, those actions are carried out through your authorized connection, and the destination platform&apos;s own privacy rules also apply.</p>
          <p>We share data only with service providers (subprocessors) that help us operate the Service under confidentiality and data-processing terms: <strong>Vercel</strong> (application hosting), <strong>Turso</strong> (database hosting), <strong>Stripe</strong> (payment processing), <strong>Resend</strong> (transactional email), and <strong>OpenAI</strong> (generating Meshi&apos;s replies — see section 5a). We may also disclose information to comply with valid legal process, enforce our Terms, or protect the rights, safety, and security of our users, the public, or Mesh.me. If Mesh.me is involved in a merger, acquisition, or asset sale, we will continue to protect your information and notify you of any change in control.</p>
        </>
      ),
    },
    {
      id: "meshi-ai",
      title: "5a. Meshi and AI processing",
      content: (
        <>
          <p>Meshi&apos;s replies are generated by a third-party AI provider, <strong>OpenAI</strong>. When you ask Meshi something we send that provider what you typed, your username and display name, and — where it is needed to answer — grounding context from your Mesh: your follower, following, post, community and platform counts; the names, handles and follower counts of up to 40 people or communities visible to you at the time; and the post you are looking at, including its author and up to 900 characters of its text. Recent turns of the same conversation go with it.</p>
          <p><strong>You control the context.</strong> The <em>Meshi memory</em> rule in your privacy controls governs it. Set it to hidden and Mesh.me stops looking your Mesh up and stops sending it — no counts, no names, no post text, no conversation history. What you typed and your display name still reach the provider, because that is the question being answered; if you do not want something sent, do not type it. Turning the rule off does not delete anything already sent.</p>
          <p><strong>Other people&apos;s data.</strong> Your own choice does not speak for anyone else, so before any third party&apos;s name, handle or post text is included we check <em>their</em> Meshi memory rule and drop it if they have switched it off.</p>
          <p>Not every reply involves the provider — some Mesh.me answers entirely from your own data without contacting it. We do not send your MeChat messages, mirrored platform DMs, email address, password, payment details or connected-platform tokens; we do not use the output to build advertising profiles; and we do not sell any of it.</p>
        </>
      ),
    },
    {
      id: "platform-api-compliance",
      title: "6. Connected platforms and third-party API compliance",
      content: (
        <>
          <p>When you connect a third-party account, Mesh.me uses that platform&apos;s official API only for the scopes you authorize, and only to power the features you use inside Mesh.me. We do not use connected-platform data for advertising, and we do not transfer or sell it.</p>
          <p><strong>Google API Services Limited Use.</strong> Mesh.me&apos;s use and transfer of information received from Google APIs adheres to the <a href="https://developers.google.com/terms/api-services-user-data-policy" rel="noopener noreferrer" target="_blank">Google API Services User Data Policy</a>, including the Limited Use requirements. Data obtained from Google (including YouTube) is used solely to provide and improve the user-facing features you request, is not transferred to third parties except as necessary to provide those features or as required by law, is not used for advertising, and is not read by humans except with your consent, for security purposes, or to comply with applicable law.</p>
          <p><strong>Meta platforms.</strong> For Facebook, Instagram, and Threads, removing Mesh.me from your platform account triggers automatic deletion of the associated connected-account data through our data deletion and deauthorize callbacks. You can also request deletion at any time from the <a href="/data-deletion">Data Deletion</a> page.</p>
        </>
      ),
    },
    {
      id: "retention",
      title: "7. Data retention and deletion",
      content: (
        <>
          <p>We retain information while your account is active and as needed to provide the Service. If you delete your account, we delete or anonymize personal data within 30 days, except where longer retention is required by law. Connected-platform tokens are deleted immediately when you disconnect an account, and backup or cached copies are purged within 90 days.</p>
          <p>For step-by-step instructions on deleting your account, removing a single connected platform, or how platform-initiated deletion works, see our <a href="/data-deletion">Data Deletion</a> page. You can also request a copy (export) of your data through product settings.</p>
        </>
      ),
    },
    {
      id: "rights",
      title: "8. Your privacy rights and choices",
      content: (
        <>
          <p>You can review and update your profile, visibility settings, connected accounts, message permissions, notifications, and data controls from product settings at any time.</p>
          <p>Depending on where you live, you may have rights to access, correct, delete, restrict, or export your personal data, to object to certain processing, and to withdraw consent. <strong>EEA/UK</strong> residents have these rights under the GDPR and may lodge a complaint with their local supervisory authority. <strong>California</strong> residents have rights under the CCPA/CPRA to know, access, delete, and correct personal information and to opt out of &quot;sale&quot; or &quot;sharing&quot; — Mesh.me does not sell or share personal information as those terms are defined, and we do not discriminate against you for exercising your rights.</p>
          <p>To exercise any right, use the controls in settings or contact <a href="mailto:security@meshs.me">security@meshs.me</a>. We will verify your request and respond within the timeframe required by applicable law.</p>
        </>
      ),
    },
    {
      id: "children",
      title: "9. Children's privacy",
      content: (
        <>
          <p>Mesh.me is not directed to children under 13, and you must be at least 13 to use the Service. We do not knowingly collect personal information from children under 13; if we learn we have, we will delete it. Age-restricted (NSFW) content is limited to verified users who are at least 18. If you believe a child under 13 has provided us information, contact <a href="mailto:security@meshs.me">security@meshs.me</a>.</p>
        </>
      ),
    },
    {
      id: "transfers",
      title: "10. International data transfers",
      content: (
        <>
          <p>Mesh.me is operated from the United States, and our subprocessors may process data in the United States and other countries. If you access the Service from outside the United States, you understand your information will be transferred to and processed in the United States, where data-protection laws may differ from those in your country. Where required, we rely on appropriate safeguards (such as the European Commission&apos;s Standard Contractual Clauses) for international transfers.</p>
        </>
      ),
    },
    {
      id: "security",
      title: "11. Security, changes, and contact",
      content: (
        <>
          <p>We apply industry-standard safeguards including password hashing, encrypted OAuth-token storage, HTTPS transport security, secure HTTP headers, CSRF protection, rate limiting, and input validation across endpoints. MeChat conversations are restricted to their members, connected-platform tokens are encrypted at rest, and payment details are handled by Stripe rather than stored by Mesh.me. No internet service can guarantee absolute security.</p>
          <p>We may update this Privacy Policy from time to time. When we make material changes we will update the &quot;Last updated&quot; date below and, where appropriate, provide additional notice. If you have privacy questions or want to exercise your rights, contact <a href="mailto:security@meshs.me">security@meshs.me</a>.</p>
        </>
      ),
    },
  ];

  return (
    <LegalDocumentPage
      eyebrow="mesh.me Privacy Policy"
      title="Your data should stay legible to you."
      summary="This policy explains how Mesh.me collects, uses, shares, retains, protects, exports, and deletes your data — and the rights and controls you have over it. The product goal is privacy-first operation with user-visible controls, not hidden exploitation."
      updatedLabel="Last updated: July 19, 2026"
      sections={sections}
    />
  );
}
