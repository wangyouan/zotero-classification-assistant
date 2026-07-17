export interface IndexedTag {
  tag: string;
  type: number;
}

export interface IndexedItem {
  id: number;
  key: string;
  libraryID: number;
  title: string;
  abstractNote: string;
  creators: string[];
  publicationTitle: string;
  date: string;
  DOI: string;
  tags: IndexedTag[];
  collectionIDs: number[];
  collectionPaths: Record<number, string>;
  tokens: string[];
  dateModified?: string;
}

export interface ScoredItem {
  item: IndexedItem;
  score: number;
  components: {
    text: number;
    manualTag: number;
    publication: number;
    creator: number;
    titlePhrase: number;
    semantic?: number;
  };
}
