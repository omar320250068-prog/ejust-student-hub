/**
 * Shared text normalization for retrieval.
 *
 * Lives in its own module so both the retriever and the knowledge base can use
 * it without importing each other and creating a cycle.
 */

/**
 * Common words carry no signal for a small corpus, so they're dropped before
 * scoring. Kept short — over-filtering hurts recall on phrases like
 * "where is the library".
 */
export const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "can", "do", "does", "for",
  "from", "get", "go", "how", "i", "in", "is", "it", "its", "me", "my", "of", "on",
  "or", "that", "the", "their", "them", "then", "there", "these", "this", "to", "was",
  "what", "when", "where", "which", "who", "why", "will", "with", "you", "your", "tell",
]);

/** Light stemmer: enough to match "buildings"/"building", "prices"/"price". */
export function stem(token: string): string {
  if (token.length > 4 && token.endsWith("ies")) return `${token.slice(0, -3)}y`;
  if (token.length > 4 && token.endsWith("es")) return token.slice(0, -2);
  if (token.length > 3 && token.endsWith("s") && !token.endsWith("ss")) return token.slice(0, -1);
  return token;
}

export function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .split(/[^a-z0-9+]+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
    .map(stem);
}
