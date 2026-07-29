/**
 * IndexedDB blob store for Capture screenshots.
 * Never lose the original — metadata lives in Zustand; pixels live here.
 */

const DB_NAME = "pickit-capture-media";
const STORE = "screenshots";
const DB_VERSION = 1;

type MediaRecord = {
  id: string;
  fullDataUrl: string;
  thumbnailDataUrl: string;
  updatedAt: string;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable."));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB open failed."));
  });
}

function idbRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

export async function putCaptureMedia(
  id: string,
  fullDataUrl: string,
  thumbnailDataUrl: string,
): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const record: MediaRecord = {
      id,
      fullDataUrl,
      thumbnailDataUrl,
      updatedAt: new Date().toISOString(),
    };
    await idbRequest(store.put(record));
  } finally {
    db.close();
  }
}

export async function getCaptureMedia(
  id: string,
): Promise<MediaRecord | null> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readonly");
    const store = tx.objectStore(STORE);
    const result = await idbRequest(store.get(id));
    return (result as MediaRecord | undefined) ?? null;
  } finally {
    db.close();
  }
}

export async function deleteCaptureMedia(id: string): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readwrite");
    await idbRequest(tx.objectStore(STORE).delete(id));
  } finally {
    db.close();
  }
}
