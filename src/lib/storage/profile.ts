// IndexedDB 封装：存 ProfileData 与简历/主页原文（可能较大）
import type { ProfileData } from '@/types/profile'
import { emptyProfile } from '@/types/profile'

const DB_NAME = 'career-copilot'
const DB_VERSION = 1
const STORE_KV = 'kv' // 通用键值：profile、rawResumeText 等

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_KV)) {
        db.createObjectStore(STORE_KV)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

async function kvGet<T>(key: string): Promise<T | undefined> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_KV, 'readonly')
    const req = tx.objectStore(STORE_KV).get(key)
    req.onsuccess = () => resolve(req.result as T | undefined)
    req.onerror = () => reject(req.error)
  })
}

async function kvSet(key: string, value: unknown): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_KV, 'readwrite')
    tx.objectStore(STORE_KV).put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

const K_PROFILE = 'profile'
const K_RAW_RESUME = 'rawResumeText'

export async function loadProfile(): Promise<ProfileData> {
  const p = await kvGet<ProfileData>(K_PROFILE)
  return p ?? emptyProfile()
}

export async function saveProfile(profile: ProfileData): Promise<void> {
  await kvSet(K_PROFILE, { ...profile, updatedAt: Date.now() })
}

export async function saveRawResume(text: string): Promise<void> {
  await kvSet(K_RAW_RESUME, text)
}

export async function loadRawResume(): Promise<string | undefined> {
  return kvGet<string>(K_RAW_RESUME)
}
