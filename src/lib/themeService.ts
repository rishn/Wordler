import { doc, setDoc, getDoc } from 'firebase/firestore'
import { db } from './firebase'

export type Theme = 'light' | 'dark'

// Save user's theme preference to Firestore
export async function saveThemePreference(userId: string, theme: Theme) {
  const userDocRef = doc(db, 'users', userId)
  await setDoc(userDocRef, { theme }, { merge: true })
}

// Get user's theme preference from Firestore
export async function getThemePreference(userId: string): Promise<Theme | null> {
  const userDocRef = doc(db, 'users', userId)
  const docSnap = await getDoc(userDocRef)
  
  if (docSnap.exists()) {
    return docSnap.data().theme || null
  }
  
  return null
}
