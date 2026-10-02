import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from './AuthContext'
import { saveCart as saveCartApi, getCart as getCartApi, clearCart as clearCartApi, checkCartReminder } from '../services/api'

const CartContext = createContext()

// How often to ask the server whether an abandoned-cart nudge is due. The
// server owns the decision (idle time + cooldown), so this is only a heartbeat.
const REMINDER_CHECK_MS = 5 * 60 * 1000
// Wait this long after the last cart change before mirroring, so a shopper
// clicking through several products does not fire a request per click.
const SYNC_DEBOUNCE_MS = 1500

const toApiItem = (item) => ({
  product_id: String(item.product_id),
  name: item.name || '',
  price: Number(item.price) || 0,
  quantity: Number(item.quantity) || 0,
  image: item.image || null,
})

export function CartProvider({ children }) {
  const { user, token } = useAuth()
  const [cartItems, setCartItems] = useState(() => {
    try {
      const savedCart = localStorage.getItem('cart')
      return savedCart ? JSON.parse(savedCart) : []
    } catch {
      return []
    }
  })
  // Distinguishes "server cart genuinely empty" from "not restored yet", so a
  // signed-in shopper's cart is not wiped before it has been fetched.
  const [hydrated, setHydrated] = useState(false)
  const syncTimer = useRef(null)
  const restoredFor = useRef(null)

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cartItems))
  }, [cartItems])

  // Restore the server copy once per signed-in shopper, preferring the newer of
  // the two so a cart edited in another tab is not rolled back on this device.
  useEffect(() => {
    if (!token) {
      // Signed out: the local cart is anonymous and must not be overwritten by
      // whatever the previous account had stored server-side.
      setHydrated(false)
      restoredFor.current = null
      return
    }
    const key = user?.user_id || token
    if (restoredFor.current === key) return
    restoredFor.current = key

    let cancelled = false
    ;(async () => {
      try {
        const remote = await getCartApi()
        if (cancelled) return
        const remoteItems = remote?.items || []
        const localRaw = (() => {
          try { return JSON.parse(localStorage.getItem('cart') || '[]') } catch { return [] }
        })()
        if (remoteItems.length > localRaw.length) {
          setCartItems(remoteItems)
        }
      } catch {
        /* offline or not signed in yet - the local cart still works */
      } finally {
        if (!cancelled) setHydrated(true)
      }
    })()
    return () => { cancelled = true }
  }, [token, user?.user_id])

  // Mirror changes to the server for recovery. Guests are skipped: the reminder
  // needs an account to notify, so there is nothing to store.
  useEffect(() => {
    if (!token || !hydrated) return
    if (syncTimer.current) clearTimeout(syncTimer.current)
    syncTimer.current = setTimeout(() => {
      saveCartApi(cartItems.map(toApiItem)).catch(() => {})
    }, SYNC_DEBOUNCE_MS)
    return () => clearTimeout(syncTimer.current)
  }, [cartItems, token, hydrated])

  // Ask whether an abandoned-cart nudge is due. The server only sends one after
  // the cart has been idle and outside its cooldown, so polling cannot spam.
  useEffect(() => {
    if (!token || !hydrated) return
    if (!cartItems.length) return
    const check = () => { checkCartReminder().catch(() => {}) }
    const initial = setTimeout(check, 10000)
    const id = setInterval(check, REMINDER_CHECK_MS)
    return () => { clearTimeout(initial); clearInterval(id) }
  }, [token, hydrated, cartItems.length])

  const addToCart = useCallback((product, quantity = 1) => {
    setCartItems(prev => {
      const existingItem = prev.find(item => item.product_id === product.product_id)
      if (existingItem) {
        return prev.map(item =>
          item.product_id === product.product_id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        )
      }
      return [...prev, { ...product, quantity }]
    })
  }, [])

  const removeFromCart = useCallback((productId) => {
    setCartItems(prev => prev.filter(item => item.product_id !== productId))
  }, [])

  const updateQuantity = useCallback((productId, quantity) => {
    if (quantity <= 0) {
      setCartItems(prev => prev.filter(item => item.product_id !== productId))
      return
    }
    setCartItems(prev =>
      prev.map(item =>
        item.product_id === productId
          ? { ...item, quantity }
          : item
      )
    )
  }, [])

  // Clearing after checkout must also drop the server copy, otherwise the
  // abandoned-cart sweep would keep nudging about an order already placed.
  // (The order endpoint clears it too; this covers a checkout that never sends.)
  const clearCart = useCallback(() => {
    setCartItems([])
    if (token) clearCartApi().catch(() => {})
  }, [token])

  const getCartTotal = useCallback(() => {
    return cartItems.reduce((total, item) => total + (item.price * item.quantity), 0)
  }, [cartItems])

  const getCartCount = useCallback(
    () => cartItems.reduce((n, item) => n + (Number(item.quantity) || 0), 0),
    [cartItems]
  )

  return (
    <CartContext.Provider value={{
      cartItems,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      getCartTotal,
      getCartCount
    }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error('useCart must be used within a CartProvider')
  }
  return context
}
