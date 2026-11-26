/** Camada fina sobre IndexedDB. Nenhuma função aqui apaga dados em massa sem pedido explícito. */
export const DB_NAME = 'shopsmart-v2'
export const DB_VERSION = 1

export const STORES = ['kv', 'products', 'prices', 'purchases', 'lookupCache'] as const
export type StoreName = (typeof STORES)[number]

let dbPromise: Promise<IDBDatabase> | null = null

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}

export function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, DB_VERSION)
    open.onupgradeneeded = () => {
      const db = open.result
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv', { keyPath: 'key' })
      if (!db.objectStoreNames.contains('products')) {
        const s = db.createObjectStore('products', { keyPath: 'id' })
        s.createIndex('barcode', 'barcode', { unique: false })
      }
      if (!db.objectStoreNames.contains('prices')) {
        const s = db.createObjectStore('prices', { keyPath: 'id' })
        s.createIndex('productId', 'productId', { unique: false })
      }
      if (!db.objectStoreNames.contains('purchases')) {
        const s = db.createObjectStore('purchases', { keyPath: 'id' })
        s.createIndex('status', 'status', { unique: false })
      }
      if (!db.objectStoreNames.contains('lookupCache')) db.createObjectStore('lookupCache', { keyPath: 'key' })
    }
    open.onsuccess = () => {
      const db = open.result
      db.onversionchange = () => db.close()
      resolve(db)
    }
    open.onerror = () => reject(open.error)
    open.onblocked = () => reject(new Error('Banco de dados bloqueado por outra aba.'))
  })
  dbPromise.catch(() => {
    dbPromise = null
  })
  return dbPromise
}

/** Somente para testes: fecha e esquece a conexão. */
export async function resetDbConnection(): Promise<void> {
  if (dbPromise) {
    try {
      ;(await dbPromise).close()
    } catch {
      /* ignore */
    }
  }
  dbPromise = null
}

export async function getAll<T>(store: StoreName): Promise<T[]> {
  const db = await openDb()
  return req(db.transaction(store).objectStore(store).getAll() as IDBRequest<T[]>)
}

export async function getOne<T>(store: StoreName, key: IDBValidKey): Promise<T | undefined> {
  const db = await openDb()
  return req(db.transaction(store).objectStore(store).get(key) as IDBRequest<T | undefined>)
}

export async function putMany<T>(store: StoreName, values: T[]): Promise<void> {
  if (!values.length) return
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite')
    const os = tx.objectStore(store)
    for (const v of values) os.put(v)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}
export const putOne = <T>(store: StoreName, value: T) => putMany(store, [value])

export async function deleteOne(store: StoreName, key: IDBValidKey): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite')
    tx.objectStore(store).delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getByIndex<T>(store: StoreName, index: string, key: IDBValidKey): Promise<T[]> {
  const db = await openDb()
  return req(db.transaction(store).objectStore(store).index(index).getAll(key) as IDBRequest<T[]>)
}

/* ---------- KV ---------- */
export async function kvGet<T>(key: string): Promise<T | undefined> {
  const row = await getOne<{ key: string; value: T }>('kv', key)
  return row?.value
}
export function kvSet<T>(key: string, value: T): Promise<void> {
  return putOne('kv', { key, value })
}
export function kvDelete(key: string): Promise<void> {
  return deleteOne('kv', key)
}
export async function kvKeys(prefix = ''): Promise<string[]> {
  const rows = await getAll<{ key: string }>('kv')
  return rows.map((r) => r.key).filter((k) => k.startsWith(prefix))
}
