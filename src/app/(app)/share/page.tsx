import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ShareIntake } from "./share-intake";

// The manifest's share_target lands here: another app's share sheet sent
// title/text/url as query params. Signed out, the login redirect keeps the
// full path so the share survives authentication; signed in, the client half
// stashes the text and forwards to the feed composer.
export default async function SharePage({
  searchParams,
}: {
  searchParams: Promise<{ title?: string; text?: string; url?: string }>;
}) {
  const { title, text, url } = await searchParams;
  const user = await getCurrentUser();
  if (!user) {
    const params = new URLSearchParams();
    if (title) params.set("title", title);
    if (text) params.set("text", text);
    if (url) params.set("url", url);
    const next = params.size > 0 ? `/share?${params.toString()}` : "/share";
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  // Compose the shared pieces the way a person would have typed them: the
  // text (or title as fallback), then the link on its own line. Capped well
  // under the composer's 500-char limit so the box never opens over-full.
  const body = [
    (text || title || "").trim().slice(0, 400),
    (url || "").trim().slice(0, 500),
  ]
    .filter(Boolean)
    .join("\n\n");

  return <ShareIntake body={body} />;
}
