import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from '../services/api'
import {
  getPushStatus,
  enablePushNotifications,
  disablePushNotifications,
  isPushSupported,
} from '../services/push'
import { useAuth } from './AuthContext'

const NotificationContext = createContext()

const POLL_INTERVAL_MS = 30000

export function NotificationProvider({ children }) {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [push, setPush] = useState({
    supported: false,
    permission: 'default',
    subscribed: false,
    loading: true,
  })
  const panelRef = useRef(null)
  const buttonRef = useRef(null)

  const load = useCallback(async () => {
    if (!user) {
      setNotifications([])
      setUnread(0)
      return
    }
    setLoading(true)
    try {
      const data = await getNotifications()
      setNotifications(data?.notifications || [])
      setUnread(data?.unread ?? 0)
    } catch {
      /* keep the last known list rather than blanking the bell on a blip */
    } finally {
      setLoading(false)
    }
  }, [user])

  const refreshUnread = useCallback(async () => {
    if (!user) return
    try {
      const data = await getUnreadCount()
      setUnread(data?.unread ?? 0)
    } catch {
      /* polling is best-effort */
    }
  }, [user])

  // Load on sign-in, clear on sign-out.
  useEffect(() => {
    if (!user) {
      setNotifications([])
      setUnread(0)
      return
    }
    load()
  }, [user, load])

  // Poll the lightweight unread counter so the badge stays live.
  useEffect(() => {
    if (!user) return undefined
    refreshUnread()
    const id = setInterval(refreshUnread, POLL_INTERVAL_MS)
    const onFocus = () => refreshUnread()
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(id)
      window.removeEventListener('focus', onFocus)
    }
  }, [user, refreshUnread])

  // Web push status, and a bridge so an arriving push refreshes the in-app list.
  useEffect(() => {
    if (!user) {
      setPush({ supported: false, permission: 'default', subscribed: false, loading: false })
      return undefined
    }
    let cancelled = false
    let unlisten = null

    const setup = async () => {
      if (!isPushSupported()) {
        if (!cancelled) {
          setPush({ supported: false, permission: 'unsupported', subscribed: false, loading: false })
        }
        return
      }
      try {
        const status = await getPushStatus()
        if (cancelled) return
        setPush({
          supported: true,
          permission: status.permission,
          subscribed: status.subscribed,
          loading: false,
        })
        // A push that lands while the tab is open should also fill the bell.
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.addEventListener('message', onWorkerMessage)
          unlisten = () => navigator.serviceWorker.removeEventListener('message', onWorkerMessage)
        }
      } catch {
        if (!cancelled) {
          setPush({ supported: false, permission: 'unsupported', subscribed: false, loading: false })
        }
      }
    }

    const onWorkerMessage = (event) => {
      if (event?.data?.type === 'PUSH_RECEIVED') load()
    }

    setup()
    return () => {
      cancelled = true
      unlisten?.()
    }
  }, [user, load])

  // Close the panel on outside click / Escape.
  useEffect(() => {
    if (!open) return undefined
    const onPointerDown = (event) => {
      if (panelRef.current?.contains(event.target)) return
      if (buttonRef.current?.contains(event.target)) return
      setOpen(false)
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const markRead = useCallback(
    async (notification) => {
      if (!notification || notification.read) return
      // Optimistic - the bell should respond instantly.
      setNotifications((prev) =>
        prev.map((n) =>
          n.notification_id === notification.notification_id ? { ...n, read: true } : n
        )
      )
      setUnread((count) => Math.max(0, count - 1))
      try {
        await markNotificationRead(notification.notification_id)
      } catch {
        load()
      }
    },
    [load]
  )

  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    setUnread(0)
    try {
      await markAllNotificationsRead()
    } catch {
      load()
    }
  }, [load])

  const enablePush = useCallback(async () => {
    setPush((p) => ({ ...p, loading: true }))
    try {
      await enablePushNotifications()
      setPush((p) => ({ ...p, subscribed: true, permission: 'granted', loading: false }))
      return { success: true }
    } catch (error) {
      setPush((p) => ({ ...p, loading: false }))
      return { success: false, error: error.message }
    }
  }, [])

  const disablePush = useCallback(async () => {
    setPush((p) => ({ ...p, loading: true }))
    try {
      await disablePushNotifications()
      setPush((p) => ({ ...p, subscribed: false, loading: false }))
      return { success: true }
    } catch (error) {
      setPush((p) => ({ ...p, loading: false }))
      return { success: false, error: error.message }
    }
  }, [])

  const togglePanel = useCallback(() => setOpen((v) => !v), [])

  const value = useMemo(
    () => ({
      notifications,
      unread,
      loading,
      open,
      push,
      togglePanel,
      closePanel: () => setOpen(false),
      refresh: load,
      markRead,
      markAllRead,
      enablePush,
      disablePush,
      panelRef,
      buttonRef,
    }),
    [notifications, unread, loading, open, push, togglePanel, load, markRead, markAllRead, enablePush, disablePush]
  )

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider')
  }
  return context
}
