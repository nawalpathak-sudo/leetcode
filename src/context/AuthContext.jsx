import { createContext, useContext, useState, useEffect } from 'react'
import { getStudent } from '../lib/db'

const AuthContext = createContext(null)
const SESSION_TTL = 15 * 24 * 60 * 60 * 1000 // 15 days

export function AuthProvider({ children }) {
  const [student, setStudent] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const saved = localStorage.getItem('alta_session')
    if (saved) {
      try {
        const { lead_id, expiresAt } = JSON.parse(saved)
        if (expiresAt && Date.now() > expiresAt) {
          localStorage.removeItem('alta_session')
          setLoading(false)
          return
        }
        getStudent(lead_id).then(s => {
          if (s) setStudent(s)
          else localStorage.removeItem('alta_session')
        }).catch(() => {
          localStorage.removeItem('alta_session')
        }).finally(() => {
          setLoading(false)
        })
      } catch {
        localStorage.removeItem('alta_session')
        setLoading(false)
      }
    } else {
      setLoading(false)
    }
  }, [])

  const login = (studentData) => {
    setStudent(studentData)
    localStorage.setItem('alta_session', JSON.stringify({
      lead_id: studentData.lead_id,
      phone: studentData.phone,
      expiresAt: Date.now() + SESSION_TTL,
    }))
  }

  const logout = () => {
    setStudent(null)
    localStorage.removeItem('alta_session')
  }

  return (
    <AuthContext.Provider value={{ student, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
