import type { Metadata } from "next";
import { SearchClient } from "./search-client";

export const metadata: Metadata = { title: "Search" };

type SearchPageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q = "" } = await searchParams;
  return <SearchClient initialQuery={q} />;
}
