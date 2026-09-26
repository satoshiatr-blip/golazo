// 小さなデータ（BGMファイル・チーム名簿）を IndexedDB に置く。試合動画は大きすぎるので保存しない
const DB = 'golazo'
const STORE = 'files'

function open() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open(DB, 1)
    r.onupgradeneeded = () => r.result.createObjectStore(STORE)
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}

export async function idbGet<T>(key: string): Promise<T | null> {
  try {
    const db = await open()
    return await new Promise(resolve => {
      const q = db.transaction(STORE).objectStore(STORE).get(key)
      q.onsuccess = () => resolve(q.result ?? null)
      q.onerror = () => resolve(null)
    })
  } catch { return null }
}

export async function idbSet(key: string, value: unknown) {
  try {
    const db = await open()
    const tx = db.transaction(STORE, 'readwrite')
    if (value == null) tx.objectStore(STORE).delete(key)
    else tx.objectStore(STORE).put(value, key)
  } catch { /* 保存できなくても今の操作は続けられる */ }
}

export const loadBgm = () => idbGet<File>('bgm')
export const saveBgm = (f: File | null) => idbSet('bgm', f)

// オープニング写真：元画像（photo:）と人物の切り抜き（cut:）
export const loadPhoto = (id: string, cut: boolean) => idbGet<Blob>(`${cut ? 'cut' : 'photo'}:${id}`)
export const savePhoto = (id: string, cut: boolean, b: Blob | null) => idbSet(`${cut ? 'cut' : 'photo'}:${id}`, b)
