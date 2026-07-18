import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OneAccountClient } from "./one-account-client";
import { getCurrentUser } from "@/lib/auth";
import { getOneAccountOverview } from "@/lib/one-account";

export const metadata: Metadata = { title: "One Account" };

export default async function OneAccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const overview = await getOneAccountOverview(user.id);
  return <OneAccountClient overview={overview} />;
}
