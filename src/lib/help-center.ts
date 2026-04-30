import {
  AlertTriangle,
  Bot,
  CreditCard,
  Database,
  KeyRound,
  Link2,
  ShieldCheck,
  UserRound,
  type LucideIcon,
} from "lucide-react";

export type HelpCategory = "accounts" | "meshi" | "safety" | "billing" | "connected-platforms" | "data" | "passwords" | "errors";

export type HelpArticle = {
  id: string;
  category: HelpCategory;
  title: string;
  summary: string;
  steps: string[];
  relatedLinks: Array<{ href: string; label: string }>;
};

export const helpCategoryMeta = {
  accounts: {
    label: "Accounts",
    description: "Create, access, verify, and manage your Mesh.me account.",
    icon: UserRound,
  },
  meshi: {
    label: "Meshi",
    description: "Understand the companion that represents you across Mesh.me.",
    icon: Bot,
  },
  safety: {
    label: "Safety",
    description: "Privacy, security, blocked users, NSFW controls, and protection defaults.",
    icon: ShieldCheck,
  },
  billing: {
    label: "Billing",
    description: "Mesh Pro, Stripe checkout, subscription access, and payment issues.",
    icon: CreditCard,
  },
  "connected-platforms": {
    label: "Connected platforms",
    description: "Link accounts, review permissions, sync content, and disconnect safely.",
    icon: Link2,
  },
  data: {
    label: "Data",
    description: "Export, delete, hide, and understand what Mesh.me stores.",
    icon: Database,
  },
  passwords: {
    label: "Password problems",
    description: "Login trouble, password reset, verification, and account recovery.",
    icon: KeyRound,
  },
  errors: {
    label: "Common errors",
    description: "404, 500, sync failures, checkout problems, and blocked requests.",
    icon: AlertTriangle,
  },
} satisfies Record<HelpCategory, { label: string; description: string; icon: LucideIcon }>;

export const helpArticles: HelpArticle[] = [
  {
    id: "create-and-access-account",
    category: "accounts",
    title: "Create or access your Mesh.me account",
    summary: "Use the login page as both sign in and sign up. If your identity is new, Mesh.me starts account creation from the same flow.",
    steps: [
      "Go to the entry screen and enter your username, email, or phone number.",
      "If Mesh.me recognizes you, Meshi appears and asks for your password.",
      "If the account does not exist, continue through account creation, then finish onboarding.",
      "After setup, your account is required to use Feed, Mesh, MeChat, Analytics, Settings, and connected platform tools.",
    ],
    relatedLinks: [
      { href: "/login", label: "Log in" },
      { href: "/signup", label: "Create account" },
    ],
  },
  {
    id: "verify-and-secure-account",
    category: "accounts",
    title: "Verify and secure your account",
    summary: "Mesh.me uses account verification, protected routes, and security settings to keep your identity safer.",
    steps: [
      "Confirm your email or phone when Mesh.me asks you to verify ownership.",
      "Open Settings to review privacy, sessions, security, and notification preferences.",
      "Use a strong password and update it immediately if you think someone else knows it.",
      "Sign out from shared devices when you are done.",
    ],
    relatedLinks: [
      { href: "/settings", label: "Settings" },
      { href: "/verify-email", label: "Verify email" },
    ],
  },
  {
    id: "what-is-meshi",
    category: "meshi",
    title: "What Meshi does",
    summary: "Meshi is the simple two-eyed companion that represents you across Mesh.me and helps guide your digital world.",
    steps: [
      "Meshi represents your presence inside the Mesh and follows you through product surfaces.",
      "Meshi is intentionally simple: bubble body, two eyes, no mouth, and minimal accessories.",
      "Meshi is the focused AI layer for help, navigation, and understanding your Mesh.me activity.",
      "Meshi should feel personal without covering important UI or making the app harder to use.",
    ],
    relatedLinks: [
      { href: "/about", label: "About Mesh.me" },
      { href: "/settings", label: "Customize Meshi" },
    ],
  },
  {
    id: "customize-meshi",
    category: "meshi",
    title: "Customize Meshi",
    summary: "Change Meshi colors, eyes, hats, hair, accessories, outfits, and badges from Settings.",
    steps: [
      "Open Settings and find the Meshi customization section.",
      "Pick visual options that still keep Meshi simple and readable.",
      "Some cosmetic items may be tied to Mesh Pro or future marketplace unlocks.",
      "Changes should update your identity surfaces across the platform.",
    ],
    relatedLinks: [
      { href: "/settings", label: "Settings" },
      { href: "/meshpro", label: "Mesh Pro" },
    ],
  },
  {
    id: "privacy-and-safety-defaults",
    category: "safety",
    title: "Privacy and safety defaults",
    summary: "Mesh.me is built around privacy-first defaults, no ads, no selling user data, and clear controls.",
    steps: [
      "NSFW content starts off by default and should only be enabled after required eligibility checks.",
      "Connected platform access depends on user consent and official provider permissions.",
      "Use privacy controls to decide what is public, private, hidden, synced, or deleted.",
      "If something feels unsafe, reduce visibility, disconnect a platform, or contact support.",
    ],
    relatedLinks: [
      { href: "/trust", label: "Trust center" },
      { href: "/privacy", label: "Privacy policy" },
    ],
  },
  {
    id: "blocked-requests-and-security",
    category: "safety",
    title: "Why a request may be blocked",
    summary: "Mesh.me blocks suspicious cross-origin and unauthenticated requests to protect accounts.",
    steps: [
      "If an action fails, refresh the page and try again from the normal Mesh.me interface.",
      "Make sure you are signed in before using app routes or account APIs.",
      "Avoid running actions from copied links, unknown websites, or browser extensions you do not trust.",
      "If the issue continues, include the action you tried and the page URL when contacting support.",
    ],
    relatedLinks: [
      { href: "/login", label: "Log in again" },
      { href: "/support", label: "Contact support" },
    ],
  },
  {
    id: "mesh-pro-billing",
    category: "billing",
    title: "Mesh Pro billing",
    summary: "Mesh Pro uses Stripe checkout so Mesh.me does not store card numbers.",
    steps: [
      "Open Mesh Pro or Billing and choose the plan you want.",
      "Checkout opens through Stripe or a configured Stripe payment link.",
      "After payment succeeds, your account should update with Mesh Pro access.",
      "If access does not update, revisit Mesh Pro, refresh, or contact support with your checkout email.",
    ],
    relatedLinks: [
      { href: "/meshpro", label: "Mesh Pro" },
      { href: "/billing", label: "Billing" },
    ],
  },
  {
    id: "payment-trouble",
    category: "billing",
    title: "Payment did not complete",
    summary: "Payments can fail if Stripe is not configured, the checkout session expires, or the payment method is declined.",
    steps: [
      "Try checkout again from Mesh Pro instead of reusing an old checkout link.",
      "Check whether the public Status page says payments are operational.",
      "Confirm the payment method with your bank or card provider.",
      "If you were charged but Mesh Pro did not activate, contact support and include the checkout email.",
    ],
    relatedLinks: [
      { href: "/status", label: "System status" },
      { href: "/support", label: "Contact support" },
    ],
  },
  {
    id: "connect-platform",
    category: "connected-platforms",
    title: "Connect a social platform",
    summary: "Connected accounts let Mesh.me import supported content, show platform origin, and sync allowed actions back through official APIs.",
    steps: [
      "Open Connected Accounts from the app.",
      "Choose the platform and complete OAuth or the available manual connection flow.",
      "Review the requested permissions before approving access.",
      "After connection, Mesh.me shows sync status and available platform capabilities.",
    ],
    relatedLinks: [
      { href: "/connected-accounts", label: "Connected Accounts" },
      { href: "/trust", label: "Trust center" },
    ],
  },
  {
    id: "disconnect-platform",
    category: "connected-platforms",
    title: "Disconnect a platform",
    summary: "Disconnecting stops future sync for that platform and helps you control what remains in Mesh.me.",
    steps: [
      "Open Connected Accounts and find the platform you want to remove.",
      "Use disconnect controls to stop future syncing.",
      "Open privacy and data controls if you also want to delete imported data.",
      "You may also revoke Mesh.me from the original platform's app authorization settings.",
    ],
    relatedLinks: [
      { href: "/connected-accounts", label: "Connected Accounts" },
      { href: "/privacy-controls", label: "Privacy controls" },
    ],
  },
  {
    id: "export-or-delete-data",
    category: "data",
    title: "Export or delete data",
    summary: "Mesh.me should make data ownership visible with export, delete, privacy, and permission controls.",
    steps: [
      "Open Settings or Privacy Controls.",
      "Review connected data, synced content, permissions, visibility, and account controls.",
      "Export your data before deleting anything you may want later.",
      "Use delete controls for imported data, individual content, or full account removal where available.",
    ],
    relatedLinks: [
      { href: "/privacy-controls", label: "Privacy controls" },
      { href: "/account/delete", label: "Delete account" },
    ],
  },
  {
    id: "where-data-comes-from",
    category: "data",
    title: "Understand where content came from",
    summary: "Mesh.me labels imported content with its source platform so creators keep credit and users understand origin.",
    steps: [
      "Look for the source platform label on feed cards, Mesh nodes, and shared content.",
      "Only interact with a source-platform post when the matching account is connected and the provider allows that action.",
      "Mesh.me-native posts live directly on Mesh.me.",
      "Imported content and native content can both appear in Feed, Mesh, MeChat, and profiles depending on visibility.",
    ],
    relatedLinks: [
      { href: "/feed", label: "Feed" },
      { href: "/mesh", label: "Mesh" },
    ],
  },
  {
    id: "reset-password",
    category: "passwords",
    title: "Reset your password",
    summary: "Use password reset if you cannot sign in or think your password may be compromised.",
    steps: [
      "Open Reset Password from the login page.",
      "Enter the email tied to your account.",
      "Check your inbox for the reset link and use it before it expires.",
      "After resetting, sign in again and review active sessions in Settings.",
    ],
    relatedLinks: [
      { href: "/reset-password", label: "Reset password" },
      { href: "/settings", label: "Security settings" },
    ],
  },
  {
    id: "login-password-not-working",
    category: "passwords",
    title: "Password is not working",
    summary: "If your password fails, Mesh.me should keep the message clear without exposing private account details.",
    steps: [
      "Check for typos and confirm you entered the right username, email, or phone number.",
      "Use the password visibility toggle if you need to verify what you typed.",
      "Reset your password if the issue continues.",
      "If you cannot access your email or phone, contact support from the Help Center.",
    ],
    relatedLinks: [
      { href: "/login", label: "Try login again" },
      { href: "/reset-password", label: "Reset password" },
    ],
  },
  {
    id: "lost-in-mesh-404",
    category: "errors",
    title: "Lost in the Mesh 404",
    summary: "A 404 means the link points to a page that does not exist or is no longer available.",
    steps: [
      "Use Home to return to the public site or app entry point.",
      "Use Search to look for the page, person, post, or topic.",
      "If you expected the link to work, contact support with the broken URL.",
      "Nothing private is exposed by the 404 page.",
    ],
    relatedLinks: [
      { href: "/", label: "Home" },
      { href: "/search", label: "Search" },
    ],
  },
  {
    id: "connection-snapped-500",
    category: "errors",
    title: "Connection Snapped 500",
    summary: "A 500 means the server hit a problem. Mesh.me shows a calm recovery screen instead of raw technical details.",
    steps: [
      "Use Reconnect or refresh the page.",
      "Check System Status if the problem continues.",
      "Try again later if the affected service is degraded.",
      "Contact support if the same action fails repeatedly.",
    ],
    relatedLinks: [
      { href: "/status", label: "System status" },
      { href: "/support", label: "Contact support" },
    ],
  },
];

export const helpCategories = Object.keys(helpCategoryMeta) as HelpCategory[];
