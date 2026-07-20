/**
 * Lightweight, dependency-free language guessing for Flow ranking. Coarse on
 * purpose: it returns a language only when reasonably confident and null
 * otherwise, so the ranker can BOOST same-language content without ever
 * penalizing text it cannot classify. Nothing here leaves the server.
 */

// A handful of high-frequency function words per major Latin-script language.
// Two or more hits is a confident signal; one is noise.
const LATIN_STOPWORDS: Record<string, string[]> = {
  en: ["the", "and", "you", "for", "that", "this", "with", "are", "have", "not", "was", "but", "what", "just"],
  es: ["que", "los", "las", "con", "por", "para", "una", "como", "pero", "más", "está", "porque", "muy", "esto"],
  pt: ["que", "não", "uma", "com", "para", "como", "mais", "você", "está", "isso", "também", "mas", "meu", "sua"],
  fr: ["les", "des", "une", "que", "pas", "pour", "vous", "avec", "est", "dans", "plus", "cette", "mais", "être"],
  de: ["und", "der", "die", "das", "nicht", "mit", "ist", "ein", "auch", "für", "auf", "sich", "aber", "eine"],
  it: ["che", "non", "per", "una", "con", "sono", "questo", "come", "più", "anche", "della", "gli", "sono", "molto"],
};

/**
 * Guess the primary language of a short text. Returns an ISO-639-1-ish code
 * (e.g. "en", "es", "ja") when confident, or null when the text is too short or
 * ambiguous to classify.
 */
export function guessLanguage(text: string | null | undefined): string | null {
  const t = (text || "").trim();
  if (t.length < 8) return null;

  // Unambiguous scripts first — a single match is decisive.
  if (/[぀-ヿ]/.test(t)) return "ja"; // hiragana / katakana
  if (/[가-힯]/.test(t)) return "ko"; // hangul
  if (/[一-鿿]/.test(t)) return "zh"; // han (after ja/ko so kana wins)
  if (/[؀-ۿ]/.test(t)) return "ar"; // arabic
  if (/[Ѐ-ӿ]/.test(t)) return "ru"; // cyrillic
  if (/[ऀ-ॿ]/.test(t)) return "hi"; // devanagari
  if (/[฀-๿]/.test(t)) return "th"; // thai
  if (/[א-׿]/.test(t)) return "he"; // hebrew

  // Latin script: the language with the most stopword hits wins, needing ≥2.
  const words = new Set(
    t.toLowerCase().replace(/[^a-zà-ÿ\s]/g, " ").split(/\s+/).filter(Boolean),
  );
  if (words.size < 3) return null;
  let best: string | null = null;
  let bestHits = 0;
  for (const [lang, stops] of Object.entries(LATIN_STOPWORDS)) {
    let hits = 0;
    for (const s of stops) if (words.has(s)) hits += 1;
    if (hits > bestHits) {
      bestHits = hits;
      best = lang;
    }
  }
  return bestHits >= 2 ? best : null;
}

/**
 * Parse an Accept-Language header into an ordered list of primary language
 * subtags, highest q-value first: "en-US,en;q=0.9,es;q=0.8" -> ["en","es"].
 */
export function parseAcceptLanguage(header: string | null | undefined): string[] {
  if (!header) return [];
  const entries: Array<{ base: string; q: number }> = [];
  for (const part of header.split(",")) {
    const [tag, ...params] = part.trim().split(";");
    const base = tag.trim().toLowerCase().split("-")[0];
    if (!base || base === "*") continue;
    let q = 1;
    for (const p of params) {
      const match = /^q=([0-9.]+)$/.exec(p.trim());
      if (match) q = Number.parseFloat(match[1]);
    }
    entries.push({ base, q: Number.isFinite(q) ? q : 1 });
  }
  entries.sort((a, b) => b.q - a.q);
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const { base } of entries) {
    if (!seen.has(base)) {
      seen.add(base);
      ordered.push(base);
    }
  }
  return ordered;
}
