import { createContext, useContext, useState, useEffect } from 'react'
import { loginUser as apiLogin, registerUser as apiRegister, getMe, updateUserProfile } from '../services/api'
import { notifyLogin, autoEnablePushNotifications } from '../services/push'

const AuthContext = createContext()
const MAX_LOGIN_ATTEMPTS = 20
const LOCK_DURATION = 15 * 60 * 1000

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('user')
      return savedUser ? JSON.parse(savedUser) : null
    } catch { return null }
  })
  const [loading, setLoading] = useState(false)
  const [token, setToken] = useState(() => localStorage.getItem('token') || null)

  const [loginAttempts, setLoginAttempts] = useState(() => {
    try {
      const saved = localStorage.getItem('loginAttempts')
      return saved ? JSON.parse(saved) : { count: 0, lockedUntil: null }
    } catch { return { count: 0, lockedUntil: null } }
  })

  useEffect(() => {
    localStorage.setItem('loginAttempts', JSON.stringify(loginAttempts))
  }, [loginAttempts])

  useEffect(() => {
    if (user) {
      localStorage.setItem('user', JSON.stringify(user))
      if (user.token || user.access_token) {
        const t = user.token || user.access_token
        localStorage.setItem('token', t)
        setToken(t)
      }
    } else {
      localStorage.removeItem('user')
      localStorage.removeItem('token')
      setToken(null)
    }
  }, [user])

  useEffect(() => {
    if (token) localStorage.setItem('token', token)
  }, [token])

  // Validate token on mount - fetch fresh profile
  useEffect(() => {
    const validate = async () => {
      if (!token || !user) return
      try {
        const data = await getMe()
        if (data.user) {
          if (data.user.is_active === false) {
            setUser(null)
            setToken(null)
            localStorage.removeItem('token')
            localStorage.removeItem('user')
            return
          }
          setUser(prev => ({ ...prev, ...data.user, token: token }))
        }
      } catch (error) {
        // Keep the cached session during a temporary backend/database outage.
        // Only an explicit auth rejection should sign the user out.
        if (error?.status === 401 || error?.status === 403) {
          setUser(null)
          setToken(null)
          localStorage.removeItem('token')
          localStorage.removeItem('user')
        } else {
          console.warn('Session validation deferred:', error.message)
        }
      }
    }
    validate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isLocked = () => {
    if (loginAttempts.lockedUntil && Date.now() < loginAttempts.lockedUntil) return true
    return false
  }
  useEffect(() => {
    if (loginAttempts.lockedUntil && Date.now() >= loginAttempts.lockedUntil) {
      setLoginAttempts({ count: 0, lockedUntil: null })
    }
  }, [loginAttempts])

  const getRemainingLockTime = () => {
    if (!loginAttempts.lockedUntil) return 0
    const remaining = loginAttempts.lockedUntil - Date.now()
    return remaining > 0 ? remaining : 0
  }

  const isActive = user?.is_active !== false
  const role = isActive ? (user?.role || 'customer') : 'customer'
  const isCustomer = role === 'customer'
  const isAdmin = isActive && (role === 'admin' || role === 'super_admin')
  const isWorker = isActive && role === 'worker'
  const isBranchStaff = isActive && ['admin', 'worker', 'super_admin'].includes(role)
  const isSuperAdmin = isActive && role === 'super_admin'
  const canAccessAdmin = isBranchStaff
  const canAccessSuper = isSuperAdmin

  const login = async (email, password) => {
    setLoading(true)
    try {
      if (isLocked()) {
        const mins = Math.ceil(getRemainingLockTime() / 60000)
        return { success: false, error: `Account locked. Try again in ${mins} minute(s).` }
      }
      if (!email || !password) return { success: false, error: 'Please enter email and password' }

      const data = await apiLogin({ email, password })
      setLoginAttempts({ count: 0, lockedUntil: null })
      const backendUser = data.user || data
      const accessToken = data.access_token || data.token || backendUser.token
      const userData = {
        user_id: backendUser.user_id || backendUser._id || 'user-' + Date.now(),
        email: backendUser.email || email,
        full_name: backendUser.full_name || backendUser.name || email.split('@')[0],
        phone: backendUser.phone || '',
        address: backendUser.address || '',
        role: backendUser.role || 'customer',
        tenant_id: backendUser.tenant_id || null,
        tenant_name: backendUser.tenant_name || null,
        is_active: backendUser.is_active ?? true,
        token: accessToken,
        access_token: accessToken,
        joined: backendUser.joined || new Date().toISOString(),
      }
      if (accessToken) localStorage.setItem('token', accessToken)
      setToken(accessToken)
      setLoginAttempts({ count: 0, lockedUntil: null })
      setUser(userData)
      autoEnablePushNotifications().catch(() => {})
      notifyLogin().catch(() => {})
      return { success: true, role: userData.role }
    } catch (error) {
      const msg = error.message || 'Login failed. Please try again.'
      // The server owns the lockout. Mirror its answer so the form locks in
      // step with the backend rather than counting differently on its own.
      const details = error?.detail
      if (error?.status === 429 || (details && details.locked)) {
        const retryAfter = (details?.retry_after || LOCK_DURATION) * 1000
        setLoginAttempts({ count: MAX_LOGIN_ATTEMPTS, lockedUntil: Date.now() + retryAfter })
        const mins = Math.ceil(retryAfter / 60000)
        return { success: false, error: msg || `Too many failed attempts. Try again in ${mins} minute(s).` }
      }
      const isAuthError = /invalid|not exist|unauthorized|credentials|forbidden|deactivated/i.test(msg)
      if (isAuthError) {
        const newCount = loginAttempts.count + 1
        setLoginAttempts({ ...loginAttempts, count: newCount })
        // Prefer the server's count when it sent one.
        const left = details?.attempts_remaining
        if (typeof left === 'number') {
          setLoginAttempts({ count: MAX_LOGIN_ATTEMPTS - left, lockedUntil: null })
          return { success: false, error: left > 0 ? `${msg} (${left} attempts remaining)` : msg }
        }
        if (newCount >= MAX_LOGIN_ATTEMPTS) {
          setLoginAttempts({ count: 0, lockedUntil: Date.now() + LOCK_DURATION })
          return { success: false, error: `Too many failed attempts. Account locked for 15 minutes.` }
        }
        return { success: false, error: `${msg} (${MAX_LOGIN_ATTEMPTS - newCount} attempts remaining)` }
      }
      return { success: false, error: msg }
    } finally {
      setLoading(false)
    }
  }

  const register = async (userData) => {
    setLoading(true)
    try {
      if (!userData.email || !userData.password || !userData.full_name) {
        return { success: false, error: 'Please fill in all required fields' }
      }
      if (userData.confirmPassword !== undefined && userData.password !== userData.confirmPassword) {
        return { success: false, error: 'Passwords do not match' }
      }
      if (userData.password.length < 6) return { success: false, error: 'Password must be at least 6 characters' }

      const payload = {
        email: userData.email,
        full_name: userData.full_name,
        name: userData.full_name,
        phone: userData.phone || null,
        address: userData.address || null,
        password: userData.password,
        role: userData.role || 'customer',
        tenant_id: userData.tenant_id || undefined,
      }
      // Remove empty role/tenant for public signup (backend will force customer)
      if (!userData.role || userData.role === 'customer') {
        delete payload.role
        delete payload.tenant_id
      }

      const data = await apiRegister(payload)
      const backendUser = data.user || data
      const accessToken = data.access_token || data.token || backendUser.token
      const newUser = {
        user_id: backendUser.user_id || backendUser._id || 'user-' + Date.now(),
        email: backendUser.email || userData.email,
        full_name: backendUser.full_name || userData.full_name,
        phone: backendUser.phone || userData.phone || '',
        address: backendUser.address || userData.address || '',
        role: backendUser.role || 'customer',
        tenant_id: backendUser.tenant_id || null,
        tenant_name: backendUser.tenant_name || null,
        is_active: backendUser.is_active ?? true,
        token: accessToken,
        access_token: accessToken,
        joined: backendUser.joined || new Date().toISOString(),
      }
      if (accessToken) localStorage.setItem('token', accessToken)
      setToken(accessToken)
      setUser(newUser)
      return { success: true, role: newUser.role }
    } catch (error) {
      const msg = error.message || 'Registration failed. Please try again.'
      return { success: false, error: msg }
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    setUser(null)
    setToken(null)
    localStorage.removeItem('token')
  }

  const updateProfile = async (updates) => {
    setLoading(true)
    try {
      const data = await updateUserProfile(updates)
      if (data.user) {
        setUser(prev => ({ ...prev, ...data.user, token: token }))
      }
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message || 'Update failed' }
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      login,
      register,
      logout,
      updateProfile,
      role,
      isActive,
      isCustomer,
      isAdmin,
      isWorker,
      isBranchStaff,
      isSuperAdmin,
      canAccessAdmin,
      canAccessSuper,
      loginAttempts,
      isLocked: isLocked(),
      remainingTime: getRemainingLockTime(),
      maxAttempts: MAX_LOGIN_ATTEMPTS
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
