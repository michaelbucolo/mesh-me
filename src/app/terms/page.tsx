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
      title: "Acceptance, eligibility, and accounts",
      content: (
        <>
          <p>By accessing or using Mesh.me, you agree to these Terms of Service. If you do not agree, do not use the service.</p>
          <p>You must be at least 13 years old to use Mesh.me. Certain features, including NSFW content access, require age verification in compliance with applicable state and federal laws. You are responsible for your account credentials, account accuracy, and the activity that happens through your account.</p>
          <p>Mesh.me uses phone number verification as part of the signup process to help prevent abuse and strengthen account security.</p>
        </>
      ),
    },
    {
      id: "content",
      title: "User content and prohibited conduct",
      content: (
        <>
          <p>You retain ownership of the content you create. By posting it to Mesh.me, you grant the limited rights needed for the service to host, display, distribute, and operate that content within the platform.</p>
          <p>You may not use Mesh.me for harassment, spam, unlawful conduct, unauthorized automation, malicious code, impersonation, or rights infringement. Violations can lead to removal, suspension, or termination.</p>
        </>
      ),
    },
    {
      id: "platforms",
      title: "Connected platforms and third-party services",
      content: (
        <>
          <p>Mesh.me supports connections to third-party platforms including GitHub, Discord, Spotify, X (Twitter), Twitch, YouTube, Instagram, Facebook, LinkedIn, Reddit, TikTok, Pinterest, Snapchat, Threads, SoundCloud, Patreon, Dribbble, and others through user-authorized OAuth flows and official APIs.</p>
          <p>Platform connections are subject to each provider&apos;s terms of service, API policies, rate limits, and approval status. Mesh.me only requests scopes you explicitly authorize and uses the minimum permissions necessary for each feature.</p>
          <p>Cross-platform interactions (likes, comments, reposts) are executed through your authorized connections and require the relevant account to be connected. Mesh.me does not bypass or circumvent any provider&apos;s API restrictions.</p>
          <p>
            See the <Link href="/trust" className="text-[var(--accent)] underline">Trust Center</Link> for detailed information about each platform&apos;s integration status and capabilities.
          </p>
        </>
      ),
    },
    {
      id: "meshpro",
      title: "Subscriptions, payments, and zero-ads policy",
      content: (
        <>
          <p>Mesh Pro is an optional subscription ($4.99/month or $39.99/year) that unlocks expanded analytics, digital footprint scanning, cross-platform insights, advanced security tools, Meshi customization, mesh cosmetics, and a verified badge. Nearly every core feature of Mesh.me is free forever.</p>
          <p>Payments are processed securely through Stripe. Apple Pay, Google Pay, and major credit/debit cards are accepted. Subscriptions are recurring and can be canceled at any time through your account settings or the Stripe billing portal.</p>
          <p>Mesh.me will never display advertisements or sell user data. MeshPro subscriptions are the sole revenue source for the platform. This commitment is a core product principle, not a temporary policy.</p>
        </>
      ),
    },
    {
      id: "content-moderation",
      title: "Content moderation and NSFW policy",
      content: (
        <>
          <p>NSFW content is disabled by default for all users. Access to NSFW content requires age verification in compliance with applicable state and federal laws, including but not limited to state ID verification requirements where mandated.</p>
          <p>Mesh.me employs automated content classification and user reporting systems. Content that violates platform rules or applicable law will be removed. Repeat violations may result in account suspension or termination.</p>
        </>
      ),
    },
    {
      id: "legal",
      title: "Liability, warranties, disputes, and termination",
      content: (
        <>
          <p>The service is provided on an as-is and as-available basis. To the fullest extent allowed by law, Mesh.me disclaims warranties and limits liability for indirect or consequential damages.</p>
          <p>Mesh.me reserves the right to suspend or terminate accounts that violate these terms. Users may delete their account at any time through product settings, which initiates data deletion per the privacy policy.</p>
          <p>These terms are governed by the laws of the State of Delaware. Questions can be directed to hello@meshs.me.</p>
        </>
      ),
    },
  ];

  return (
    <LegalDocumentPage
      eyebrow="mesh.me Terms of Service"
      title="The rules should be as clear as the product promise."
      summary="These terms cover launch use of Mesh.me, including account eligibility, user content, connected-platform boundaries, Mesh Pro billing, and the legal terms that govern the service."
      updatedLabel="Last updated: June 23, 2026"
      sections={sections}
    />
  );
}
