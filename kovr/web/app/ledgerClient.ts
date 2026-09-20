/**
 * The ledger, in the browser.
 *
 * KOVR keeps the balance and the bets on the device rather than on a server,
 * which is what lets it deploy as a static site plus a couple of stateless
 * functions. IndexedDB is the store; localStorage is the fallback when
 * IndexedDB is unavailable (private windows, blocked site data).
 */

import { Ledger } from '../../src/ledger/ledger.js';
import type { LedgerStorage } from '../../src/ledger/storage.js';
import { MemoryStorage } from '../../src/ledger/storage.js';

const DB_NAME = 'kovr';
const STORE_NAME = 'ledger';
const DOC_KEY = 'state';
const FALLBACK_KEY = 'kovr.ledger.v1';

/** Primary store. Survives reloads and is not cleared with session data. */
class IndexedDbStorage implements LedgerStorage {
  private handle: Promise<IDBDatabase> | null = null;

  private open(): Promise<IDBDatabase> {
    if (this.handle) return this.handle;
    this.handle = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB unavailable'));
      request.onblocked = () => reject(new Error('IndexedDB blocked'));
    });
    return this.handle;
  }

  private async run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const database = await this.open();
    return new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const request = work(transaction.objectStore(STORE_NAME));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
    });
  }

  async read(): Promise<string | null> {
    const value = await this.run<unknown>('readonly', (store) => store.get(DOC_KEY) as IDBRequest<unknown>);
    return typeof value === 'string' ? value : null;
  }

  async write(document: string): Promise<void> {
    await this.run('readwrite', (store) => store.put(document, DOC_KEY) as IDBRequest<IDBValidKey>);
  }

  async clear(): Promise<void> {
    await this.run('readwrite', (store) => store.delete(DOC_KEY) as IDBRequest<undefined>);
  }
}

/** Fallback for environments where IndexedDB is not usable. */
class LocalStorageStorage implements LedgerStorage {
  async read(): Promise<string | null> {
    try {
      return localStorage.getItem(FALLBACK_KEY);
    } catch {
      return null;
    }
  }

  async write(document: string): Promise<void> {
    try {
      localStorage.setItem(FALLBACK_KEY, document);
    } catch {
      // Out of quota or blocked: the session still works, it just will not
      // survive a reload. Better than refusing to place a bet.
    }
  }

  async clear(): Promise<void> {
    try {
      localStorage.removeItem(FALLBACK_KEY);
    } catch {
      // Nothing to do.
    }
  }
}

async function pickStorage(): Promise<LedgerStorage> {
  if (typeof indexedDB !== 'undefined') {
    const candidate = new IndexedDbStorage();
    try {
      await candidate.read();
      return candidate;
    } catch {
      // Fall through to the next option.
    }
  }
  if (typeof localStorage !== 'undefined') return new LocalStorageStorage();
  return new MemoryStorage();
}

/** Opening balance for a brand-new device. */
export const OPENING_BALANCE_CENTS = 1_000_000;

let instance: Ledger | null = null;
let opening: Promise<Ledger> | null = null;

export function ledger(): Promise<Ledger> {
  if (instance) return Promise.resolve(instance);
  if (!opening) {
    opening = pickStorage().then((storage) => {
      instance = new Ledger(storage, OPENING_BALANCE_CENTS);
      return instance;
    });
  }
  return opening;
}
