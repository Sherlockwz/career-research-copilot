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

const K_PROFILE = 'profile'
const K_RAW_RESUME = 'rawResumeText'

export async function loadProfile(): Promise<ProfileData> {
  const p = await kvGet<ProfileData>(K_PROFILE)
  return p ?? emptyProfile()
}

// 在同一事务中比较版本并写入，拒绝旧窗口/旧表单把上一位求职人的数据写回来。
async function writeProfile(
  profile: ProfileData,
  expectedUpdatedAt: number,
  clearRawResume: boolean
): Promise<ProfileData> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_KV, 'readwrite')
    const store = tx.objectStore(STORE_KV)
    let saved: ProfileData
    const request = store.get(K_PROFILE)
    request.onsuccess = () => {
      const current = (request.result as ProfileData | undefined) ?? emptyProfile()
      if (current.updatedAt !== expectedUpdatedAt) {
        reject(new Error('个人数据已在其他窗口更新，请刷新后重试，避免混合不同求职人的信息。'))
        tx.abort()
        return
      }
      saved = { ...profile, updatedAt: Math.max(Date.now(), current.updatedAt + 1) }
      store.put(saved, K_PROFILE)
      if (clearRawResume) store.delete(K_RAW_RESUME)
    }
    tx.oncomplete = () => resolve(saved)
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

export function saveProfile(profile: ProfileData): Promise<ProfileData> {
  return writeProfile(profile, profile.updatedAt, false)
}

export function replaceProfile(profile: ProfileData, expectedUpdatedAt: number): Promise<ProfileData> {
  return writeProfile(profile, expectedUpdatedAt, true)
}

export async function saveRawResume(text: string): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_KV, 'readwrite')
    tx.objectStore(STORE_KV).put(text, K_RAW_RESUME)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function loadRawResume(): Promise<string | undefined> {
  return kvGet<string>(K_RAW_RESUME)
}
