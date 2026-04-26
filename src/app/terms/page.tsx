import type { Metadata } from "next";
import Link from "next/link";
import { LegalDocumentPage } from "@/components/legal/legal-document-page";

export const metadata: Metadata = {
  title: "Terms of Service | mesh.me",
  description: "Terms of Service for mesh.me, the privacy-first social platform.",
};

export default function TermsPage() {
  const sections = [
    {
      id: "acceptance",
      title: "Acceptance, eligibility, and accounts",
      content: (
        <>
          <p>By accessing or using Mesh.me, you agree to these Terms of Service. If you do not agree, do not use the service.</p>
          <p>You must meet the platform&apos;s eligibility rules, including minimum age requirements. You are responsible for your account credentials, account accuracy, and the activity that happens through your account.</p>
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
          <p>Mesh.me can connect to third-party platforms through user-authorized OAuth flows and official APIs where available. Those connections remain subject to each provider&apos;s rules, permissions, and API limits.</p>
          <p>Mesh.me is not endorsed by those providers, does not control their policies, and cannot guarantee feature availability across all platforms or all time periods.</p>
          <p>
            The product goal is source-aware interaction and credit preservation. That remains bounded by the capabilities listed in the product and by provider approval status. See the <Link href="/trust" className="text-[var(--accent)] underline">Trust Center</Link> for the product-level explanation.
          </p>
        </>
      ),
    },
    {
      id: "meshpro",
      title: "Subscriptions, payments, and zero-ads policy",
      content: (
        <>
          <p>Mesh Pro is an optional subscription that unlocks expanded analytics, customization, and identity controls. Billing is recurring unless canceled under the plan rules shown at purchase time.</p>
          <p>Mesh.me does not rely on ad inventory or sale of user data as its core business model. Subscription changes, refunds, and pricing adjustments remain subject to applicable law and billing terms.</p>
        </>
      ),
    },
    {
      id: "legal",
      title: "Liability, warranties, disputes, and termination",
      content: (
        <>
          <p>The service is provided on an as-is and as-available basis. To the fullest extent allowed by law, Mesh.me disclaims warranties and limits liability for indirect or consequential damages.</p>
          <p>These terms also cover dispute resolution, indemnification, termination rights, severability, governing law, and change notices. Questions can be directed to legal@mesh.me.</p>
        </>
      ),
    },
  ];

  return (
    <LegalDocumentPage
      eyebrow="mesh.me Terms of Service"
      title="The rules should be as clear as the product promise."
      summary="These terms cover launch use of Mesh.me, including account eligibility, user content, connected-platform boundaries, Mesh Pro billing, and the legal terms that govern the service."
      updatedLabel="Last updated: April 26, 2026"
      sections={sections}
    />
  );
}
