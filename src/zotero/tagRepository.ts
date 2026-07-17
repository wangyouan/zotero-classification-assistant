export function getManualTags(item: Zotero.Item): string[] {
  return item
    .getTags()
    .filter((tag) => (tag.type ?? 0) === 0)
    .map((tag) => tag.tag);
}

export function getAllTags(item: Zotero.Item): Array<{
  tag: string;
  type: number;
}> {
  return item.getTags().map((tag) => ({
    tag: tag.tag,
    type: tag.type ?? 0,
  }));
}
