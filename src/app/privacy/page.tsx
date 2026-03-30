import Link from "next/link";
import { MeshiLogo } from "@/components/meshi/meshi-mascot";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <header className="border-b border-[var(--border-primary)] glass sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center">
          <Link href="/" className="flex items-center gap-2">
            <MeshiLogo size={32} color="blue" mood="happy" />
            <span className="brand-wordmark text-xl">mesh<span className="brand-wordmark-accent">.me</span></span>
          </Link>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="font-display text-3xl font-bold text-[var(--text-primary)] mb-2">Privacy Policy</h1>
        <p className="text-sm text-[var(--text-muted)] mb-8">Last updated: March 2026</p>
        <div className="space-y-6 text-[var(--text-tertiary)] text-sm leading-relaxed">

          <p>mesh.me (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform.</p>

          <h2 className="text-xl font-semibold text-[var(--text-primary)]">1. Information We Collect</h2>
          <p><strong className="text-[var(--text-secondary)]">Information you provide:</strong> When you create an account, we collect your email address, username, display name, and password (stored as a secure hash). You may also provide optional profile information such as a bio, location, website, avatar, banner image, accent color, and interest tags.</p>
          <p><strong className="text-[var(--text-secondary)]">Content you create:</strong> Posts, comments, messages, community contributions, and any other content you submit to the platform.</p>
          <p><strong className="text-[var(--text-secondary)]">Connected account data:</strong> When you link third-party platform accounts (such as Instagram, YouTube, TikTok, etc.), we store the platform name, your platform username, and OAuth tokens necessary to access those services on your behalf. We only access data that you explicitly authorize through each platform&apos;s OAuth consent screen.</p>
          <p><strong className="text-[var(--text-secondary)]">Usage data:</strong> We collect information about how you interact with mesh.me, including pages visited, features used, search queries, feed preferences, and interaction patterns. This data helps us improve the Service.</p>
          <p><strong className="text-[var(--text-secondary)]">Device and technical data:</strong> We may collect your IP address, browser type, device type, operating system, and similar technical information for security, analytics, and service optimization purposes.</p>

          <h2 className="text-xl font-semibold text-[var(--text-primary)]">2. How We Use Your Information</h2>
          <p>We use the information we collect to: (a) provide, operate, and maintain the mesh.me platform; (b) personalize your experience, including your feed, recommendations, and the Mesh visualization; (c) process your transactions (MeshPro subscriptions); (d) send you service-related communications and notifications; (e) generate smart notification summaries (processed locally, never sold to third parties); (f) detect, prevent, and address security issues, fraud, and abuse; (g) comply with legal obligations; (h) improve and develop new features.</p>

          <h2 className="text-xl font-semibold text-[var(--text-primary)]">3. Information Sharing &amp; Disclosure</h2>
          <p><strong className="text-[var(--text-secondary)]">We do not sell your personal information.</strong> mesh.me has a zero advertising policy and does not share data with advertisers or data brokers.</p>
          <p>We may share your information in the following limited circumstances:</p>
          <p>(a) <strong className="text-[var(--text-secondary)]">Public profile information:</strong> Content you choose to make public (profile, posts, community contributions) is visible to other users and may be indexed by search engines.</p>
          <p>(b) <strong className="text-[var(--text-secondary)]">Connected platforms:</strong> When you perform cross-platform actions (liking, commenting, following) through mesh.me, those actions are executed on the respective third-party platform through your authorized connection. The third-party platform&apos;s privacy policy governs how they handle that data.</p>
          <p>(c) <strong className="text-[var(--text-secondary)]">Service providers:</strong> We may share information with trusted third-party service providers who help us operate the platform (hosting, payment processing, email delivery), subject to strict confidentiality obligations.</p>
          <p>(d) <strong className="text-[var(--text-secondary)]">Legal requirements:</strong> We may disclose information when required by law, legal process, or government request, or when we believe disclosure is necessary to protect our rights, your safety, or the safety of others.</p>

          <h2 className="text-xl font-semibold text-[var(--text-primary)]">4. Connected Accounts &amp; Third-Party Data</h2>
          <p>When you connect a third-party account to mesh.me, we access only the data you authorize through that platform&apos;s OAuth consent flow. We store OAuth tokens securely and encrypted. You can disconnect any linked account at any time through your Connected Accounts settings, which will revoke our access and delete the stored tokens. We do not access your third-party account passwords. Each third-party platform has its own privacy policy, and we encourage you to review them.</p>

          <h2 className="text-xl font-semibold text-[var(--text-primary)]">5. Data Retention</h2>
          <p>We retain your personal information for as long as your account is active or as needed to provide you with the Service. If you delete your account, we will delete or anonymize your personal data within 30 days, except where we are required to retain certain information by law (such as transaction records). Cached or backup copies may take up to 90 days to be fully purged from our systems.</p>

          <h2 className="text-xl font-semibold text-[var(--text-primary)]">6. Your Privacy Controls &amp; Rights</h2>
          <p>You have the following rights regarding your personal data:</p>
          <p>(a) <strong className="text-[var(--text-secondary)]">Access:</strong> You can view all personal data associated with your account through your profile and settings pages.</p>
          <p>(b) <strong className="text-[var(--text-secondary)]">Correction:</strong> You can update or correct your personal information at any time through your account settings.</p>
          <p>(c) <strong className="text-[var(--text-secondary)]">Deletion:</strong> You can delete your account and all associated data through the settings page. You may also request data deletion by contacting privacy@mesh.me.</p>
          <p>(d) <strong className="text-[var(--text-secondary)]">Data portability:</strong> You can request a copy of your data in a machine-readable format by contacting privacy@mesh.me.</p>
          <p>(e) <strong className="text-[var(--text-secondary)]">Profile visibility:</strong> You can control whether your profile is public or private.</p>
          <p>(f) <strong className="text-[var(--text-secondary)]">Messaging controls:</strong> You can control who can send you messages.</p>
          <p>(g) <strong className="text-[var(--text-secondary)]">Block and mute:</strong> You can block or mute other users at any time.</p>
          <p>(h) <strong className="text-[var(--text-secondary)]">Notification controls:</strong> You can customize which notifications you receive and how they are delivered.</p>
          <p>(i) <strong className="text-[var(--text-secondary)]">Connected account management:</strong> You can connect or disconnect third-party accounts at any time.</p>

          <h2 className="text-xl font-semibold text-[var(--text-primary)]">7. California Privacy Rights (CCPA)</h2>
          <p>If you are a California resident, you have the right to: (a) know what personal information we collect about you; (b) request deletion of your personal information; (c) opt out of the sale of your personal information (note: we do not sell personal information); (d) not be discriminated against for exercising your privacy rights. To exercise these rights, contact privacy@mesh.me.</p>

          <h2 className="text-xl font-semibold text-[var(--text-primary)]">8. European Privacy Rights (GDPR)</h2>
          <p>If you are located in the European Economic Area (EEA), United Kingdom, or Switzerland, you have additional rights under the General Data Protection Regulation (GDPR) including: (a) the right to access your personal data; (b) the right to rectification; (c) the right to erasure; (d) the right to restrict processing; (e) the right to data portability; (f) the right to object to processing. Our legal basis for processing your data includes: your consent, performance of our contract with you (providing the Service), and our legitimate interests (security, fraud prevention, service improvement). To exercise these rights or lodge a complaint, contact privacy@mesh.me.</p>

          <h2 className="text-xl font-semibold text-[var(--text-primary)]">9. Children&apos;s Privacy</h2>
          <p>mesh.me is not directed to children under 13. We do not knowingly collect personal information from children under 13 in compliance with the Children&apos;s Online Privacy Protection Act (COPPA). If we discover that we have collected personal information from a child under 13, we will delete it immediately. If you believe a child under 13 has provided us with personal information, please contact privacy@mesh.me.</p>

          <h2 className="text-xl font-semibold text-[var(--text-primary)]">10. Cookies &amp; Similar Technologies</h2>
          <p>mesh.me uses essential cookies and session tokens to authenticate you and maintain your session. We do not use third-party tracking cookies or advertising cookies. We may use minimal analytics to understand general usage patterns, but we do not build advertising profiles or share analytics data with third parties.</p>

          <h2 className="text-xl font-semibold text-[var(--text-primary)]">11. Data Security</h2>
          <p>We implement industry-standard security measures to protect your information, including: (a) bcrypt password hashing (we never store plain-text passwords); (b) encrypted session tokens; (c) rate limiting and account lockout protection against brute-force attacks; (d) input validation and sanitization; (e) HTTPS encryption in transit; (f) secure HTTP headers (HSTS, X-Frame-Options, Content-Security-Policy). While we strive to protect your information, no method of electronic transmission or storage is 100% secure, and we cannot guarantee absolute security.</p>

          <h2 className="text-xl font-semibold text-[var(--text-primary)]">12. Automated Features &amp; Data Processing</h2>
          <p>mesh.me uses automated processing solely for notification summarization to help you manage information overload. Processed notification data is not stored beyond the summary generation and is never shared with or sold to third parties. We do not generate content, manipulate feeds algorithmically for engagement, or create user profiles for advertising purposes.</p>

          <h2 className="text-xl font-semibold text-[var(--text-primary)]">13. International Data Transfers</h2>
          <p>Your information may be transferred to and processed in countries other than your country of residence. When we transfer data internationally, we implement appropriate safeguards to ensure your data receives an adequate level of protection in accordance with applicable data protection laws.</p>

          <h2 className="text-xl font-semibold text-[var(--text-primary)]">14. Changes to This Privacy Policy</h2>
          <p>We may update this Privacy Policy from time to time. If we make material changes, we will notify you by posting a notice on the Service and updating the &quot;Last updated&quot; date. Your continued use of the Service after any changes constitutes your acceptance of the updated Privacy Policy.</p>

          <h2 className="text-xl font-semibold text-[var(--text-primary)]">15. Contact Us</h2>
          <p>For privacy inquiries, data requests, or concerns, contact us at:</p>
          <p>Email: privacy@mesh.me</p>
          <p>You may also exercise your privacy rights through your account settings page.</p>
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
