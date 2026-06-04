const databaseName = "instasetka-assets";
const databaseVersion = 1;
const storeName = "assetBlobs";

export async function saveAssetBlob(assetId: string, blob: Blob) {
  const database = await openAssetDatabase();

  try {
    await runAssetStoreTransaction(database, "readwrite", (store) => {
      store.put(blob, assetId);
    });
  } finally {
    database.close();
  }
}

export async function loadAssetBlob(assetId: string): Promise<Blob | null> {
  const database = await openAssetDatabase();

  try {
    return await getAssetBlob(database, assetId);
  } finally {
    database.close();
  }
}

export async function loadAssetPreviewUrls(assetIds: string[]): Promise<Record<string, string>> {
  const database = await openAssetDatabase();
  const previewUrls: Record<string, string> = {};

  try {
    await Promise.all(
      assetIds.map(async (assetId) => {
        const blob = await getAssetBlob(database, assetId);
        if (blob) {
          previewUrls[assetId] = URL.createObjectURL(blob);
        }
      }),
    );
  } finally {
    database.close();
  }

  return previewUrls;
}

export async function deleteUnreferencedAssetBlobs(keptAssetIds: string[]) {
  const keptIds = new Set(keptAssetIds);
  const database = await openAssetDatabase();

  try {
    await runAssetStoreTransaction(database, "readwrite", (store) => {
      const request = store.openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          return;
        }

        if (!keptIds.has(String(cursor.key))) {
          cursor.delete();
        }
        cursor.continue();
      };
    });
  } finally {
    database.close();
  }
}

function openAssetDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, databaseVersion);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(storeName)) {
        database.createObjectStore(storeName);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open asset database"));
  });
}

function getAssetBlob(database: IDBDatabase, assetId: string): Promise<Blob | null> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, "readonly");
    const store = transaction.objectStore(storeName);
    const request = store.get(assetId);

    request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : null);
    request.onerror = () => reject(request.error ?? new Error(`Could not read asset ${assetId}`));
  });
}

function runAssetStoreTransaction(
  database: IDBDatabase,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Asset transaction failed"));
    transaction.onabort = () => reject(transaction.error ?? new Error("Asset transaction aborted"));
    action(store);
  });
}
