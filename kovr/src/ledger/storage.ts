/**
 * Where the ledger is kept.
 *
 * The ledger is one JSON document, read and written whole. That makes every
 * operation atomic by construction: there is no partial write that could
 * leave a bet recorded without its debit, or a payout without its bet.
 *
 * A browser backs this with IndexedDB; tests back it with a Map.
 */

export interface LedgerStorage {
  read(): Promise<string | null>;
  write(document: string): Promise<void>;
  clear(): Promise<void>;
}

/** In-memory storage. Used by tests and as a fallback when none is available. */
export class MemoryStorage implements LedgerStorage {
  private document: string | null = null;

  async read(): Promise<string | null> {
    return this.document;
  }

  async write(document: string): Promise<void> {
    this.document = document;
  }

  async clear(): Promise<void> {
    this.document = null;
  }
}
