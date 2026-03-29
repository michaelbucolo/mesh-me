import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <header className="border-b border-[var(--border-primary)] glass sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-600 to-blue-500 flex items-center justify-center">
              <span className="text-white font-bold text-sm">m</span>
            </div>
            <span className="text-xl font-bold text-[var(--text-primary)]">mesh<span className="text-blue-400">.me</span></span>
          </Link>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">Terms of Service</h1>
        <p className="text-sm text-[var(--text-muted)] mb-8">Last updated: March 2026</p>
        <div className="prose prose-invert prose-zinc max-w-none space-y-6 text-[var(--text-tertiary)] text-sm leading-relaxed">

          <h2 className="text-xl font-semibold text-[var(--text-primary)]">1. Acceptance of Terms</h2>
          <p>By accessing or using mesh.me (&quot;the Platform&quot;, &quot;the Service&quot;), you agree to be bound by these Terms of Service (&quot;Terms&quot;). If you do not agree to all of these Terms, you may not access or use the Service. These Terms constitute a legally binding agreement between you and mesh.me.</p>

          <h2 className="text-xl font-semibold text-[var(--text-primary)]">2. Eligibility</h2>
          <p>You must be at least 13 years of age to use mesh.me. If you are between the ages of 13 and 18, you must have the consent of a parent or legal guardian. By using the Service, you represent and warrant that you meet these eligibility requirements. We do not knowingly collect personal information from children under 13 in compliance with the Children&apos;s Online Privacy Protection Act (COPPA).</p>

          <h2 className="text-xl font-semibold text-[var(--text-primary)]">3. User Accounts</h2>
          <p>You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to: (a) provide accurate, current, and complete information during registration; (b) maintain and promptly update your account information; (c) maintain the security of your password and accept all risks of unauthorized access; (d) immediately notify mesh.me if you discover or suspect any security breaches related to the Service.</p>

          <h2 className="text-xl font-semibold text-[var(--text-primary)]">4. User Content</h2>
          <p>You retain all ownership rights to the content you create and share on mesh.me. By posting content, you grant mesh.me a non-exclusive, worldwide, royalty-free license to use, display, reproduce, distribute, and promote your content solely within and in connection with the Platform. You are solely responsible for all content you post and must ensure it does not violate any laws, infringe any intellectual property rights, or violate the rights of any third party.</p>

          <h2 className="text-xl font-semibold text-[var(--text-primary)]">5. Prohibited Conduct</h2>
          <p>You agree not to: (a) harass, bully, threaten, or intimidate other users; (b) post content that is illegal, obscene, defamatory, or infringes intellectual property rights; (c) spam, manipulate, or abuse platform features; (d) impersonate any person or entity; (e) attempt to access other users&apos; accounts without authorization; (f) use bots, scrapers, or automated tools to access the Service without express permission; (g) upload malicious code, viruses, or any software intended to damage or alter the Service; (h) use the Service for any unlawful purpose or to violate any applicable local, state, national, or international law.</p>

          <h2 className="text-xl font-semibold text-[var(--text-primary)]">6. Community Guidelines</h2>
          <p>mesh.me is a platform built on respect and authentic connection. We expect all users to engage respectfully, contribute meaningfully, and help maintain a positive environment for everyone. Violation of community guidelines may result in content removal, account suspension, or permanent termination.</p>

          <h2 className="text-xl font-semibold text-[var(--text-primary)]">7. Connected Accounts &amp; Third-Party Platforms</h2>
          <p>mesh.me allows you to link accounts from third-party social media platforms. By connecting these accounts, you authorize mesh.me to access certain information from those platforms in accordance with their respective terms of service and official APIs. mesh.me is <strong className="text-[var(--text-secondary)]">not affiliated with, endorsed by, or sponsored by</strong> any third-party platform including but not limited to Instagram, YouTube, TikTok, X/Twitter, Twitch, Spotify, Discord, LinkedIn, GitHub, Reddit, Pinterest, Facebook, Snapchat, Threads, Bluesky, or SoundCloud. All third-party platform names, logos, and trademarks are the property of their respective owners and are used here solely for identification purposes. Cross-platform features (including content aggregation, cross-platform messaging, and interaction proxying) are subject to the availability and terms of each platform&apos;s official API. mesh.me accesses third-party platforms only through authorized OAuth connections initiated by you, and only performs actions you explicitly authorize. mesh.me does not guarantee the availability, accuracy, or functionality of any third-party integration, and features may be limited or unavailable depending on each platform&apos;s API policies.</p>

          <h2 className="text-xl font-semibold text-[var(--text-primary)]">8. MeshPro Subscription</h2>
          <p>mesh.me offers an optional premium subscription (&quot;MeshPro&quot;) with additional features. Subscriptions are billed on a recurring basis (monthly or annually) at the rates displayed at the time of purchase. You may cancel your subscription at any time through your account settings. Cancellation takes effect at the end of the current billing period. Refunds are handled in accordance with applicable law. mesh.me reserves the right to change subscription pricing with at least 30 days advance notice to current subscribers.</p>

          <h2 className="text-xl font-semibold text-[var(--text-primary)]">9. Zero Advertising Policy</h2>
          <p>mesh.me does not sell advertising space and does not display third-party advertisements. The Platform is funded through optional MeshPro subscriptions. We do not sell, rent, or trade your personal data to advertisers or data brokers.</p>

          <h2 className="text-xl font-semibold text-[var(--text-primary)]">10. Intellectual Property</h2>
          <p>The Service, including its original content (excluding user-generated content), features, functionality, design, and branding, is and will remain the exclusive property of mesh.me and its licensors. The Service is protected by copyright, trademark, and other intellectual property laws. You may not reproduce, distribute, modify, create derivative works of, publicly display, publicly perform, republish, or transmit any material from the Service without prior written consent.</p>

          <h2 className="text-xl font-semibold text-[var(--text-primary)]">11. Copyright &amp; DMCA Policy</h2>
          <p>mesh.me respects the intellectual property rights of others and expects users to do the same. If you believe that content on mesh.me infringes your copyright, you may submit a Digital Millennium Copyright Act (DMCA) takedown notice to our designated agent at copyright@mesh.me. Your notice must include: (a) identification of the copyrighted work; (b) identification of the infringing material and its location on the Service; (c) your contact information; (d) a statement of good faith belief that the use is not authorized; (e) a statement of accuracy under penalty of perjury; and (f) your physical or electronic signature. Repeat infringers may have their accounts terminated.</p>

          <h2 className="text-xl font-semibold text-[var(--text-primary)]">12. Privacy</h2>
          <p>Your use of the Service is also governed by our <Link href="/privacy" className="text-blue-400 hover:text-blue-300 underline">Privacy Policy</Link>, which is incorporated into these Terms by reference.</p>

          <h2 className="text-xl font-semibold text-[var(--text-primary)]">13. Limitation of Liability</h2>
          <p>To the maximum extent permitted by applicable law, mesh.me and its officers, directors, employees, and agents shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from: (a) your access to or use of or inability to access or use the Service; (b) any conduct or content of any third party on the Service; (c) any content obtained from the Service; (d) unauthorized access, use, or alteration of your transmissions or content; (e) any interruption or cessation of the Service; (f) any bugs, viruses, or the like that may be transmitted to or through the Service by any third party.</p>

          <h2 className="text-xl font-semibold text-[var(--text-primary)]">14. Disclaimer of Warranties</h2>
          <p>The Service is provided on an &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; basis without warranties of any kind, whether express or implied, including but not limited to implied warranties of merchantability, fitness for a particular purpose, and non-infringement. mesh.me does not warrant that the Service will be uninterrupted, timely, secure, or error-free.</p>

          <h2 className="text-xl font-semibold text-[var(--text-primary)]">15. Indemnification</h2>
          <p>You agree to defend, indemnify, and hold harmless mesh.me and its officers, directors, employees, and agents from and against any claims, damages, obligations, losses, liabilities, costs, or expenses arising from: (a) your use of the Service; (b) your violation of these Terms; (c) your violation of any third-party right, including any intellectual property right or privacy right; (d) any content you post on the Service.</p>

          <h2 className="text-xl font-semibold text-[var(--text-primary)]">16. Dispute Resolution</h2>
          <p>Any disputes arising out of or relating to these Terms or the Service shall first be attempted to be resolved through good-faith negotiation. If a dispute cannot be resolved through negotiation within 30 days, either party may pursue resolution through binding arbitration in accordance with the rules of the American Arbitration Association. Nothing in this section shall prevent either party from seeking injunctive or other equitable relief in court for matters related to data security, intellectual property, or unauthorized access.</p>

          <h2 className="text-xl font-semibold text-[var(--text-primary)]">17. Termination</h2>
          <p>mesh.me reserves the right to suspend or terminate your account at any time for violation of these Terms. You may delete your account at any time through the settings page. Upon account deletion, we will remove your personal data in accordance with our Privacy Policy, except where we are required to retain it by law.</p>

          <h2 className="text-xl font-semibold text-[var(--text-primary)]">18. Governing Law</h2>
          <p>These Terms shall be governed by and construed in accordance with the laws of the United States, without regard to its conflict of law provisions.</p>

          <h2 className="text-xl font-semibold text-[var(--text-primary)]">19. Severability</h2>
          <p>If any provision of these Terms is held to be unenforceable or invalid, such provision will be changed and interpreted to accomplish the objectives of such provision to the greatest extent possible under applicable law, and the remaining provisions will continue in full force and effect.</p>

          <h2 className="text-xl font-semibold text-[var(--text-primary)]">20. Changes to Terms</h2>
          <p>We reserve the right to modify these Terms at any time. If a revision is material, we will provide at least 30 days notice prior to any new terms taking effect. Your continued use of the Service after changes constitutes acceptance of the new Terms.</p>

          <h2 className="text-xl font-semibold text-[var(--text-primary)]">21. Contact</h2>
          <p>For questions about these Terms, contact us at legal@mesh.me.</p>
        </div>
      </main>
      <footer className="border-t border-[var(--border-primary)] py-8 mt-8">
        <div className="max-w-3xl mx-auto px-6 flex items-center justify-between text-xs text-[var(--text-muted)]">
          <span>&copy; 2026 mesh.me. All rights reserved.</span>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-[var(--text-tertiary)] transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-[var(--text-tertiary)] transition-colors">Terms of Service</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
