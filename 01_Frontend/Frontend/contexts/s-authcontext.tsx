import React, { createContext, useContext, useState, useCallback } from 'react'

type AuthContextType = {
  password: string | null
  authorize: (pw: string) => void
  deauthorize: () => void
}

// Kontext für die Authentifizierung - speichert das Passwort im State
const AuthContext = createContext<AuthContextType>({
  password: null,
  authorize: () => {},
  deauthorize: () => {},
})

export const useAuth = () => useContext(AuthContext)

// Provider-Komponente stellt Auth-Kontext für Child Komponenten bereit
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [password, setPassword] = useState<string | null>(null)

  const authorize = useCallback((pw: string) => {
    setPassword(pw)
  }, [])

  // Entfernt das gespeicherte Passwort und gibt die Authentifizierung frei
  const deauthorize = useCallback(() => {
    setPassword(null)
  }, [])

  return (
    <AuthContext.Provider value={{ password, authorize, deauthorize }}>
      {children}
    </AuthContext.Provider>
  )
}