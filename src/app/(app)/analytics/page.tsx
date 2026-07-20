import { redirect } from "next/navigation";

// Analytics is folded into the profile (an own-profile tab), so it is no longer a
// separate top-level destination. Keep this route as a permanent funnel so old
// links, bookmarks, the command palette, and the Mesh Pro CTA all land in the
// profile's Analytics tab. Auth is handled by /profile itself.
export default function AnalyticsPage() {
  redirect("/profile?tab=analytics");
}
