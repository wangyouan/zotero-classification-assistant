export interface BM25Document<T> {
  value: T;
  tokens: string[];
}

export interface BM25Result<T> {
  value: T;
  score: number;
}

export function rankBM25<T>(
  queryTokens: string[],
  documents: BM25Document<T>[],
  k1 = 1.5,
  b = 0.75,
): BM25Result<T>[] {
  if (!queryTokens.length || !documents.length) return [];
  const averageLength =
    documents.reduce((total, doc) => total + doc.tokens.length, 0) /
    documents.length;
  const documentFrequency = new Map<string, number>();
  for (const doc of documents) {
    for (const token of new Set(doc.tokens)) {
      documentFrequency.set(token, (documentFrequency.get(token) || 0) + 1);
    }
  }
  const query = [...new Set(queryTokens)];
  return documents
    .map((doc) => {
      const frequencies = new Map<string, number>();
      for (const token of doc.tokens) {
        frequencies.set(token, (frequencies.get(token) || 0) + 1);
      }
      let score = 0;
      for (const token of query) {
        const df = documentFrequency.get(token) || 0;
        if (!df) continue;
        const idf = Math.log(1 + (documents.length - df + 0.5) / (df + 0.5));
        const tf = frequencies.get(token) || 0;
        const lengthNormalization =
          averageLength > 0 ? doc.tokens.length / averageLength : 1;
        score +=
          idf *
          ((tf * (k1 + 1)) / (tf + k1 * (1 - b + b * lengthNormalization)));
      }
      return { value: doc.value, score };
    })
    .sort((a, bValue) => bValue.score - a.score);
}
