import type { ComparableMetadataField } from "../metadata/types.js";

export interface ItemMutationSnapshot {
  itemID: number;
  itemKey: string;
  fields: Partial<Record<ComparableMetadataField, unknown>>;
  creators: unknown[];
  tags: Array<{ tag: string; type: number }>;
  collectionIDs: number[];
  attachmentIDs: number[];
  noteIDs: number[];
  relatedItemKeys: string[];
  createdAt: string;
}

export interface OperationRecord {
  type: "classification" | "metadata";
  snapshot: ItemMutationSnapshot;
  changedFields: ComparableMetadataField[];
  createdAt: string;
}

export class SessionOperationLog {
  private readonly records = new Map<number, OperationRecord[]>();

  push(record: OperationRecord): void {
    const history = this.records.get(record.snapshot.itemID) || [];
    history.push(record);
    this.records.set(record.snapshot.itemID, history);
  }

  peek(itemID: number): OperationRecord | undefined {
    return this.records.get(itemID)?.at(-1);
  }

  pop(itemID: number): OperationRecord | undefined {
    const history = this.records.get(itemID);
    const record = history?.pop();
    if (history && history.length === 0) this.records.delete(itemID);
    return record;
  }

  clear(): void {
    this.records.clear();
  }
}

export function serializeSnapshot(snapshot: ItemMutationSnapshot): string {
  return JSON.stringify(snapshot);
}

export function deserializeSnapshot(value: string): ItemMutationSnapshot {
  const parsed = JSON.parse(value) as ItemMutationSnapshot;
  if (
    !parsed.itemID ||
    !parsed.itemKey ||
    !Array.isArray(parsed.collectionIDs)
  ) {
    throw new Error("Invalid operation snapshot");
  }
  return parsed;
}

export const operationLog = new SessionOperationLog();
