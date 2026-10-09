import type { Session, User } from '@supabase/supabase-js'
import { createContext, useContext } from 'react'

export type AuthState =
  | { status: 'loading'; session: null; user: null }
  | { status: 'signedOut'; session: null; user: null }
  | { status: 'signedIn'; session: Session; user: User }

export type AuthContextValue = AuthState & {
  /** true cuando la sesión viene de un enlace de "olvidé mi contraseña". */
  isRecovery: boolean
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return value
}

/** Para pantallas que solo existen con sesión iniciada. */
export function useUser(): User {
  const auth = useAuth()
  if (auth.status !== 'signedIn') throw new Error('useUser requiere una sesión iniciada')
  return auth.user
}
