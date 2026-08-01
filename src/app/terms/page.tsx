import type { Metadata } from "next";
import Link from "next/link";
import { LegalDocumentPage } from "@/components/legal/legal-document-page";
import { meshBrand } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: `Terms of Service for ${meshBrand.name}, the privacy-first social platform.`,
};

export default function TermsPage() {
  const sections = [
    {
      id: "acceptance",
      title: "1. Acceptance, eligibility, and accounts",
      content: (
        <>
          <p>These Terms of Service (the &quot;Terms&quot;) are a binding agreement between you and Mesh.me (&quot;Mesh.me,&quot; &quot;we,&quot; &quot;us&quot;) governing your access to and use of the Mesh.me websites, apps, and services (the &quot;Service&quot;). By accessing or using the Service, you agree to these Terms and to our <Link href="/privacy" className="text-[var(--accent-text)] underline">Privacy Policy</Link>. If you do not agree, do not use the Service.</p>
          <p>You must be at least 13 years old to use Mesh.me. If you are under the age of majority where you live, you may use the Service only with the involvement of a parent or legal guardian. Access to age-restricted (NSFW) content is limited to users who are at least 18 and have completed age verification, as described in Section 7.</p>
          <p>You are responsible for the accuracy of your account information, for keeping your credentials secure, and for all activity that occurs under your account. Mesh.me may use email, phone-number, or similar verification during signup to help prevent abuse and strengthen account security. Notify us promptly at <a href="mailto:security@meshs.me">security@meshs.me</a> if you suspect unauthorized use of your account.</p>
        </>
      ),
    },
    {
      id: "service",
      title: "2. The Service and changes to it",
      content: (
        <>
          <p>Mesh.me is a privacy-first social platform and digital identity hub that lets you unify your posts, messages, analytics, privacy controls, connected accounts, and online identity in one place, including features such as Mesh, Feed, MeChat, Communities, Analytics, and your Meshi.</p>
          <p>We are continually improving the Service and may add, change, suspend, or remove features at any time. Where a change materially reduces core functionality you rely on, we will make reasonable efforts to provide notice. Your continued use of the Service after a change takes effect means you accept the change.</p>
        </>
      ),
    },
    {
      id: "content",
      title: "3. Your content and the license you grant",
      content: (
        <>
          <p>You retain ownership of the content you create and post on Mesh.me (&quot;User Content&quot;). You are solely responsible for your User Content and for ensuring you have the rights necessary to post it.</p>
          <p>By posting User Content, you grant Mesh.me a worldwide, non-exclusive, royalty-free license to host, store, reproduce, display, adapt (for formatting and display), and distribute that content solely as needed to operate, provide, and promote the Service. This license ends when you delete your User Content or account, except for content others have re-shared, content retained in backups for a limited period, or where retention is required by law.</p>
          <p>If you send us feedback, ideas, or suggestions, you grant us a perpetual, irrevocable, royalty-free license to use them without restriction or obligation to you.</p>
        </>
      ),
    },
    {
      id: "conduct",
      title: "4. Acceptable use and prohibited conduct",
      content: (
        <>
          <p>You agree not to use the Service to: harass, abuse, threaten, or harm others; post spam or unlawful, infringing, or fraudulent content; impersonate any person or entity; upload malicious code; violate any applicable law or third party&apos;s rights; or attempt to gain unauthorized access to accounts, systems, or data.</p>
          <p>You may not scrape, harvest, or use automated means to access the Service except through interfaces we expressly provide, and you may not bypass rate limits, security controls, or access restrictions. Violations may result in content removal, feature limits, suspension, or termination.</p>
        </>
      ),
    },
    {
      id: "platforms",
      title: "5. Connected platforms and third-party services",
      content: (
        <>
          <p>Mesh.me lets you connect third-party platforms — Instagram, TikTok, YouTube, X (Twitter), Threads, Facebook, Snapchat, Discord, Twitch, Reddit, LinkedIn, and Pinterest — through user-authorized OAuth flows and official APIs. We request only the scopes you explicitly authorize and use the minimum permissions necessary for each feature.</p>
          <p>Your use of each connected platform remains subject to that provider&apos;s own terms, policies, API rules, rate limits, and approval status. Cross-platform actions (such as posting, liking, or following) are carried out on your behalf through your authorized connection and require the relevant account to be connected. Mesh.me does not bypass or circumvent any provider&apos;s API restrictions, and we are not responsible for third-party services or their availability.</p>
          <p>You can disconnect any platform at any time from <Link href="/connected-accounts" className="text-[var(--accent-text)] underline">Connected accounts</Link>; doing so deletes the stored tokens for that platform and, where the provider supports it, revokes our access. See the <Link href="/trust" className="text-[var(--accent-text)] underline">Trust Center</Link> for each platform&apos;s integration status.</p>
        </>
      ),
    },
    {
      id: "meshpro",
      title: "6. MeshPro subscriptions, payments, and zero-ads policy",
      content: (
        <>
          <p>MeshPro is an optional subscription ($4.99/month or $39.99/year) that unlocks features such as expanded analytics, digital footprint scanning, cross-platform insights, advanced security tools, Meshi customization, mesh cosmetics, and a verified badge. Nearly every core feature of Mesh.me is free.</p>
          <p>Payments are processed by Stripe; we do not store your full payment card details. Subscriptions renew automatically for the interval you select until canceled. You may cancel at any time from your account settings or the Stripe billing portal; cancellation stops future renewals and your MeshPro benefits continue through the end of the current paid period. Except where required by law, payments are non-refundable and partial periods are not refunded.</p>
          <p>We may change subscription pricing or features on a going-forward basis; changes will not affect the period you have already paid for, and we will provide notice of price changes before your next renewal. Mesh.me does not display advertisements or sell user data — MeshPro is the platform&apos;s sole revenue source, and this is a core product principle rather than a temporary policy.</p>
        </>
      ),
    },
    {
      id: "moderation",
      title: "7. Content moderation and NSFW policy",
      content: (
        <>
          <p>Age-restricted (NSFW) content is disabled by default for every account. Accessing it requires you to be at least 18 years old and to complete age verification in compliance with applicable state and federal law, including state ID-verification requirements where mandated. NSFW content remains hidden until an account is verified and the setting is explicitly enabled.</p>
          <p>Mesh.me uses a combination of automated content classification and user reporting to enforce these Terms. Content that violates our rules or applicable law may be removed, and repeat or serious violations may result in suspension or termination. We may preserve and disclose information where we believe in good faith it is required by law or necessary to protect users, the public, or the Service.</p>
        </>
      ),
    },
    {
      id: "ip",
      title: "8. Intellectual property and copyright (DMCA)",
      content: (
        <>
          <p>The Service, including its software, design, branding, and the Meshi character, is owned by Mesh.me and protected by intellectual-property laws. Except for your own User Content, nothing in these Terms grants you a right to use our names, logos, or other brand features without our prior written permission.</p>
          <p>We respect the intellectual-property rights of others and respond to notices of alleged infringement. If you believe content on Mesh.me infringes your copyright, send a notice to <a href="mailto:hello@meshs.me">hello@meshs.me</a> that includes: identification of the copyrighted work; the location (URL) of the material; your contact information; a statement that you have a good-faith belief the use is unauthorized; a statement, under penalty of perjury, that your notice is accurate and that you are the rights holder or authorized to act on their behalf; and your physical or electronic signature. We may remove infringing content and terminate repeat infringers.</p>
        </>
      ),
    },
    {
      id: "termination",
      title: "9. Termination and data deletion",
      content: (
        <>
          <p>You may stop using the Service and delete your account at any time from product settings. See the <Link href="/data-deletion" className="text-[var(--accent-text)] underline">Data Deletion</Link> page for how to delete your entire account, remove a single connected platform, or submit a platform-initiated deletion request. Deletion is handled as described in our <Link href="/privacy" className="text-[var(--accent-text)] underline">Privacy Policy</Link>.</p>
          <p>We may suspend or terminate your access if you violate these Terms, create risk or legal exposure for Mesh.me or others, or if we discontinue the Service. Sections that by their nature should survive termination — including content licenses you granted, disclaimers, limitations of liability, indemnification, and dispute terms — survive.</p>
        </>
      ),
    },
    {
      id: "liability",
      title: "10. Disclaimers, limitation of liability, and indemnification",
      content: (
        <>
          <p>The Service is provided on an &quot;as is&quot; and &quot;as available&quot; basis. To the fullest extent permitted by law, Mesh.me disclaims all warranties, express or implied, including merchantability, fitness for a particular purpose, and non-infringement, and does not warrant that the Service will be uninterrupted, secure, or error-free.</p>
          <p>To the fullest extent permitted by law, Mesh.me will not be liable for any indirect, incidental, special, consequential, or punitive damages, or for lost profits or data. Our total liability for any claim relating to the Service will not exceed the greater of the amount you paid us in the twelve months before the claim or USD $100.</p>
          <p>You agree to indemnify and hold Mesh.me harmless from claims, damages, and expenses (including reasonable legal fees) arising from your User Content, your use of the Service, or your violation of these Terms or applicable law.</p>
        </>
      ),
    },
    {
      id: "legal",
      title: "11. Governing law, disputes, and general terms",
      content: (
        <>
          <p>These Terms are governed by the laws of the State of Delaware, United States, without regard to its conflict-of-laws rules. Before filing a claim, you agree to first contact us at <a href="mailto:hello@meshs.me">hello@meshs.me</a> and attempt to resolve the dispute informally for at least 30 days. Any unresolved dispute will be subject to the exclusive jurisdiction of the state and federal courts located in Delaware, and you consent to venue there.</p>
          <p>We may update these Terms from time to time. When we make material changes, we will update the &quot;Last updated&quot; date below and, where appropriate, provide additional notice. Your continued use of the Service after changes take effect constitutes acceptance.</p>
          <p>If any provision of these Terms is found unenforceable, the remaining provisions stay in effect. Our failure to enforce a provision is not a waiver. These Terms, together with the Privacy Policy and any feature-specific terms, are the entire agreement between you and Mesh.me regarding the Service. Questions? Contact <a href="mailto:hello@meshs.me">hello@meshs.me</a> for general and legal inquiries or <a href="mailto:support@meshs.me">support@meshs.me</a> for support.</p>
        </>
      ),
    },
  ];

  return (
    <LegalDocumentPage
      eyebrow="mesh.me Terms of Service"
      title="The rules should be as clear as the product promise."
      summary="These terms cover use of Mesh.me — account eligibility, your content, connected-platform boundaries, MeshPro billing, content and NSFW policy, intellectual property, termination and data deletion, and the legal terms that govern the Service."
      updatedLabel="Last updated: July 19, 2026"
      sections={sections}
    />
  );
}
