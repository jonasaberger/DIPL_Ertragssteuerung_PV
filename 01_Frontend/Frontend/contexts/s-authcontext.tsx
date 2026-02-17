import React, { createContext, useContext, useState, useCallback } from 'react'

type AuthContextType = {
  password: string | null
  authorize: (pw: string) => void
  deauthorize: () => void
}

const AuthContext = createContext<AuthContextType>({
  password: null,
  authorize: () => {},
  deauthorize: () => {},
})

export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [password, setPassword] = useState<string | null>(null)

  const authorize = useCallback((pw: string) => {
    setPassword(pw)
  }, [])

  const deauthorize = useCallback(() => {
    setPassword(null)
  }, [])

  return (
    <AuthContext.Provider value={{ password, authorize, deauthorize }}>
      {children}
    </AuthContext.Provider>
  )
}