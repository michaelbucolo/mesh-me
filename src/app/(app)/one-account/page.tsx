import { redirect } from "next/navigation";

// The One Account page lives at /connected-accounts (kept as the URL slug so
// existing deep links keep working). This alias redirects there so /one-account
// still resolves.
export default function OneAccountPage() {
  redirect("/connected-accounts");
}
