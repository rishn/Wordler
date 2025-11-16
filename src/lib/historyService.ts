import { collection, doc, setDoc, getDocs, deleteDoc, query, orderBy, limit, onSnapshot, Unsubscribe } from 'firebase/firestore'
import { db } from './firebase'
import type { SolveSummary } from './wordleTypes'

export type HistoryEntry = {
  id: number
  ts: number
  mode: 'nyt' | 'random' | 'simulation' | 'unknown'
  summary: SolveSummary
}

// Save a new solve attempt to Firestore
export async function saveAttempt(userId: string, entry: HistoryEntry) {
  const userHistoryRef = collection(db, 'users', userId, 'history')
  const docRef = doc(userHistoryRef, entry.id.toString())
  await setDoc(docRef, entry)
}

// Get all history for a user
export async function getHistory(userId: string): Promise<HistoryEntry[]> {
  const userHistoryRef = collection(db, 'users', userId, 'history')
  const q = query(userHistoryRef, orderBy('ts', 'desc'), limit(50))
  const snapshot = await getDocs(q)
  
  return snapshot.docs.map(doc => doc.data() as HistoryEntry)
}

// Listen to history changes in real-time
export function subscribeToHistory(userId: string, callback: (history: HistoryEntry[]) => void): Unsubscribe {
  const userHistoryRef = collection(db, 'users', userId, 'history')
  const q = query(userHistoryRef, orderBy('ts', 'desc'), limit(50))
  
  return onSnapshot(q, (snapshot) => {
    const history = snapshot.docs.map(doc => doc.data() as HistoryEntry)
    callback(history)
  })
}

// Delete a single entry
export async function deleteHistoryEntry(userId: string, entryId: number) {
  const docRef = doc(db, 'users', userId, 'history', entryId.toString())
  await deleteDoc(docRef)
}

// Clear all history for a user
export async function clearAllHistory(userId: string) {
  const userHistoryRef = collection(db, 'users', userId, 'history')
  const snapshot = await getDocs(userHistoryRef)
  
  const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref))
  await Promise.all(deletePromises)
}

// Migrate localStorage history to Firestore (one-time operation)
export async function migrateLocalStorageToFirestore(userId: string) {
  const localHistory = localStorage.getItem('history')
  if (!localHistory) return

  try {
    const entries = JSON.parse(localHistory) as any[]
    const historyEntries: HistoryEntry[] = entries.map((item, idx) => {
      if (item && item.summary) {
        return {
          id: item.id ?? idx,
          ts: item.ts ?? Date.now(),
          mode: item.mode ?? 'unknown',
          summary: item.summary as SolveSummary
        }
      }
      return {
        id: idx,
        ts: Date.now(),
        mode: 'unknown' as const,
        summary: item as SolveSummary
      }
    })

    // Save all to Firestore
    for (const entry of historyEntries) {
      await saveAttempt(userId, entry)
    }

    // Clear localStorage after successful migration
    localStorage.removeItem('history')
    console.log('Successfully migrated localStorage history to Firestore')
  } catch (error) {
    console.error('Error migrating localStorage history:', error)
  }
}
