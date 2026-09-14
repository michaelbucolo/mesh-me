/** Content-only matching. Inputs must already have passed viewer permissions. */
export type RelatedContent = {
  content: string;
  tags: { tag: string }[];
};

const NOISE = new Set((
  "a an and are as at be been but by can do for from has have he her here him his how i if in is it its " +
  "just like me more my of on or our out she so some than that the their them there these they this to " +
  "up us was we were what when where which who will with you your new today watch video photo post " +
  "follow subscribe share comment link bio fyp foryou viral trending shorts reels http https www com " +
  "el la los las un una de del en y con por para que es le les des du et une dans sur au aux"
).split(/\s+/));

function terms(value: string): string[] {
  return (value.slice(0, 8000).normalize("NFKC").toLowerCase()
    .replace(/https?:\/\/\S+/g, " ").match(/[\p{L}\p{N}][\p{L}\p{N}_-]*/gu) ?? [])
    .filter((word) => word.length > 1 && !NOISE.has(word)).slice(0, 120);
}

function describe(post: RelatedContent) {
  const words = terms(post.content);
  const tags = new Set(post.tags.flatMap(({ tag }) => terms(tag)));
  const tokens = new Set([...words, ...tags]);
  const phrases = new Set(words.slice(1).map((word, i) => `${words[i]} ${word}`));
  return { tokens, tags, phrases };
}

export function scoreRelatedContent(anchor: RelatedContent, candidates: RelatedContent[]) {
  const source = describe(anchor);
  const documents = candidates.map(describe);
  const frequencies = new Map<string, number>();
  for (const doc of [source, ...documents]) {
    for (const token of doc.tokens) frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
  }
  const weight = (token: string) => 1 + Math.log((documents.length + 2) / ((frequencies.get(token) ?? 0) + 1));
  const magnitude = (tokens: Set<string>) => Math.sqrt([...tokens].reduce((sum, token) => sum + weight(token) ** 2, 0));
  const sourceMagnitude = magnitude(source.tokens);

  return documents.map((doc) => {
    const shared = [...source.tokens].filter((token) => doc.tokens.has(token));
    const sharedTags = [...source.tags].filter((tag) => doc.tags.has(tag));
    const sharedPhrases = [...source.phrases].filter((phrase) => doc.phrases.has(phrase));
    const cosine = shared.reduce((sum, token) => sum + weight(token) ** 2, 0)
      / (sourceMagnitude * magnitude(doc.tokens) || 1);
    // Format and author alone are not evidence of a shared subject.
    const related = sharedTags.length > 0 || (shared.length >= 2 && cosine >= 0.08);
    const score = related ? cosine * 10 + Math.min(sharedPhrases.length, 3) * 1.5 + Math.min(sharedTags.length, 3) : 0;
    return {
      score,
      reason: sharedTags.length > 0
        ? `Also about #${sharedTags[0]}`
        : "Related topics in this post",
    };
  });
}
