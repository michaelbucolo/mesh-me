import { redirect } from "next/navigation";

// The One Account experience has merged into Connected accounts — one page where
// every connected platform threads back to your single mesh.me identity. Kept as
// a redirect so existing links (nav, profile, deep links) keep working.
export default function OneAccountPage() {
  redirect("/connected-accounts");
}
