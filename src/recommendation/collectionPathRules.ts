export function collectionPathsConflict(left: string, right: string): boolean {
  return left.startsWith(`${right} / `) || right.startsWith(`${left} / `);
}

export function removeParentChildPathDuplicates<T extends { path: string }>(
  candidates: T[],
): T[] {
  const selected: T[] = [];
  for (const candidate of candidates) {
    if (
      !selected.some((existing) =>
        collectionPathsConflict(candidate.path, existing.path),
      )
    ) {
      selected.push(candidate);
    }
  }
  return selected;
}
