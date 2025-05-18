export class IdbClient<T> {
  private readonly _dbName: string;
  private readonly _db: IDBDatabase;
  private readonly _storeName: string;

  static async create<T>(storeName: string, schemaVersion: number): Promise<IdbClient<T>> {
    const dbName = `${storeName}-${schemaVersion}-db`;
    const db = await IdbClient._openDatabase(dbName, storeName, schemaVersion);

    return new IdbClient(db, dbName, storeName);
  }

  private static async _openDatabase(dbName: string, storeName: string, dbVersion: number): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, dbVersion);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName);
        }

        resolve(db);
      };

      request.onsuccess = (event: Event) => {
        resolve((event.target as IDBOpenDBRequest).result);
      };

      request.onerror = (event: Event) => {
        reject(
          new Error(
            `Error opening IndexedDB object store '${storeName}': ${(event.target as IDBOpenDBRequest).error?.message}`
          )
        );
      };
    });
  }

  private constructor(db: IDBDatabase, dbName: string, storeName: string) {
    this._db = db;
    this._dbName = dbName;
    this._storeName = storeName;
  }

  async getAll(): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const transaction = this._db.transaction(this._storeName, 'readonly');
      const store = transaction.objectStore(this._storeName);
      const request = store.getAll();

      request.onsuccess = (event: Event) => {
        resolve((event.target as IDBRequest).result);
      };

      request.onerror = (event: Event) => {
        reject(
          new Error(
            `failed to get all records from store '${this._storeName}': ${(event.target as IDBRequest).error?.message}`
          )
        );
      };
    });
  }

  async get(key: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const transaction = this._db.transaction(this._storeName, 'readonly');
      const store = transaction.objectStore(this._storeName);
      const request = store.get(key);

      request.onsuccess = (event: Event) => {
        resolve((event.target as IDBRequest).result);
      };

      request.onerror = (event: Event) => {
        reject(
          new Error(
            // eslint-disable-next-line max-len
            `failed to get record with key '${key}' from store '${this._storeName}': ${(event.target as IDBRequest).error?.message}`
          )
        );
      };
    });
  }

  async upsert(key: string, value: T): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this._db.transaction(this._storeName, 'readwrite');
      const store = transaction.objectStore(this._storeName);
      const request = store.put(value, key);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = (event: Event) => {
        reject(
          new Error(
            // eslint-disable-next-line max-len, @typescript-eslint/restrict-template-expressions
            `failed to add record with '${value}' and key '${key}' to store '${this._storeName}': ${(event.target as IDBRequest).error?.message}`
          )
        );
      };
    });
  }

  async delete(key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this._db.transaction(this._storeName, 'readwrite');
      const store = transaction.objectStore(this._storeName);
      const request = store.delete(key);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = (event: Event) => {
        reject(
          new Error(
            // eslint-disable-next-line max-len
            `failed to delete record with key '${key}' from store '${this._storeName}': ${(event.target as IDBRequest).error?.message}`
          )
        );
      };
    });
  }

  async deleteAll(): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this._db.transaction(this._storeName, 'readwrite');
      const store = transaction.objectStore(this._storeName);
      const request = store.clear();

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = (event: Event) => {
        reject(
          new Error(
            // eslint-disable-next-line max-len
            `failed to delete all records from store '${this._storeName}': ${(event.target as IDBRequest).error?.message}`
          )
        );
      };
    });
  }

  close() {
    this._db.close();
  }

  deleteDatabase() {
    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(this._dbName);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = (event: Event) => {
        reject(
          new Error(`failed to delete database '${this._dbName}': ${(event.target as IDBRequest).error?.message}`)
        );
      };
    });
  }
}
