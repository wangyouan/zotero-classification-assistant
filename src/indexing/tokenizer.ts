const ENGLISH_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "in",
  "is",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "with",
]);

export function tokenize(value: string): string[] {
  const normalized = value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/10\.\d{4,9}\/\S+/gi, " ");
  const latin = normalized.match(/[\p{L}\p{N}]+/gu) || [];
  const wordTokens = latin.filter(
    (token) => !/^[\p{Script=Han}]+$/u.test(token),
  );
  const hanRuns = normalized.match(/[\p{Script=Han}]+/gu) || [];
  const hanTokens: string[] = [];
  for (const run of hanRuns) {
    const chars = [...run];
    hanTokens.push(...chars);
    for (let i = 0; i < chars.length - 1; i += 1) {
      hanTokens.push(chars[i] + chars[i + 1]);
    }
  }
  return [...wordTokens, ...hanTokens]
    .filter((token) => token.length > 1 || /^[\p{Script=Han}]$/u.test(token))
    .filter((token) => !ENGLISH_STOP_WORDS.has(token));
}

export function uniqueTokens(value: string): string[] {
  return [...new Set(tokenize(value))];
}
