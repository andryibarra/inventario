import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { supabase } from '../../lib/supabase'
import { AuthContext, type AuthState } from './AuthContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [state, setState] = useState<AuthState>({ status: 'loading', session: null, user: null })
  const [isRecovery, setIsRecovery] = useState(false)
  const lastUserId = useRef<string | null>(null)

  useEffect(() => {
    // INITIAL_SESSION llega en cuanto se suscribe, así que no hace falta getSession().
    // No llamar otros métodos de supabase dentro de este callback (puede bloquearse).
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      const userId = session?.user.id ?? null
      // Al cambiar de usuario o cerrar sesión se descarta la caché: en un
      // dispositivo compartido no deben quedar datos de otro negocio en memoria.
      if (userId !== lastUserId.current) queryClient.clear()
      lastUserId.current = userId

      if (event === 'PASSWORD_RECOVERY') setIsRecovery(true)
      if (event === 'SIGNED_OUT') setIsRecovery(false)

      setState(
        session
          ? { status: 'signedIn', session, user: session.user }
          : { status: 'signedOut', session: null, user: null },
      )
    })
    return () => data.subscription.unsubscribe()
  }, [queryClient])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const value = useMemo(() => ({ ...state, isRecovery, signOut }), [state, isRecovery, signOut])

  return <AuthContext value={value}>{children}</AuthContext>
}
