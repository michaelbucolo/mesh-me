import type { Metadata } from "next";
import { SearchClient } from "./search-client";

export const metadata: Metadata = { title: "Search" };

type SearchPageProps = {
  searchParams: Promise<{ q?: string | string[] }>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q: rawQuery } = await searchParams;
  const query = (typeof rawQuery === "string" ? rawQuery : rawQuery?.[0] || "").slice(0, 200);
  return <SearchClient key={query} initialQuery={query} />;
}
