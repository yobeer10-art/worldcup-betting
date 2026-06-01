import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const AdminContext = createContext({ isAdmin: false, adminLoading: true })

export function AdminProvider({ children }) {
  const { user } = useAuth()
  const [isAdmin,      setIsAdmin]      = useState(false)
  const [adminLoading, setAdminLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setIsAdmin(false)
      setAdminLoading(false)
      return
    }
    supabase
      .rpc('is_admin')
      .then(({ data }) => {
        setIsAdmin(!!data)
        setAdminLoading(false)
      })
      .catch(() => {
        setIsAdmin(false)
        setAdminLoading(false)
      })
  }, [user])

  return (
    <AdminContext.Provider value={{ isAdmin, adminLoading }}>
      {children}
    </AdminContext.Provider>
  )
}

export const useAdmin = () => useContext(AdminContext)
