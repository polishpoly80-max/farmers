import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { listBranches, getMyBranch, selectBranch as selectBranchApi } from '../services/api'
import { useAuth } from './AuthContext'

const STORAGE_KEY = 'selectedBranch'

const BranchContext = createContext()

export function BranchProvider({ children }) {
  const { user, isBranchStaff } = useAuth()
  const [branches, setBranches] = useState([])
  const [currentBranch, setCurrentBranch] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const persist = useCallback((branch) => {
    setCurrentBranch(branch)
    try {
      if (branch) localStorage.setItem(STORAGE_KEY, JSON.stringify(branch))
      else localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* storage unavailable (private mode) - selection stays in memory */
    }
  }, [])

  // Load the branch list once, then reconcile with the saved/server selection.
  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await listBranches()
        if (cancelled) return
        const list = data?.branches || []
        setBranches(list)

        if (!list.length) {
          persist(null)
          return
        }

        // Prefer the server-side preference (works across devices), then the
        // locally cached choice, then the first accepting branch.
        let resolved = null
        if (user) {
          try {
            const mine = await getMyBranch()
            if (mine?.branch) resolved = list.find((b) => b.branch_id === mine.branch.branch_id) || null
          } catch {
            /* not logged in yet or backend unavailable - fall through */
          }
        }
        if (!resolved && currentBranch) {
          resolved = list.find((b) => b.branch_id === currentBranch.branch_id) || null
        }
        if (!resolved) {
          resolved = list.find((b) => b.is_accepting_orders) || list[0]
        }
        if (resolved) persist(resolved)
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load farm branches')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
    // Intentionally run once per user session: re-running would fight the
    // customer's manual choice on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.user_id])

  const selectBranch = useCallback(
    async (branchId) => {
      const target = branches.find((b) => b.branch_id === branchId)
      if (!target) return null
      // Optimistic: the shop should switch instantly, persistence follows.
      persist(target)
      try {
        await selectBranchApi(branchId)
      } catch {
        /* keep the optimistic selection even if the server call fails */
      }
      return target
    },
    [branches, persist]
  )

  const branchId = currentBranch?.branch_id || null

  // Delivery rules for the selected branch, with sensible fallbacks.
  const delivery = useMemo(
    () => ({
      fee: currentBranch?.delivery_fee ?? 9.99,
      freeThreshold: currentBranch?.free_delivery_threshold ?? 50,
      radiusKm: currentBranch?.delivery_radius_km ?? null,
      isPickup: currentBranch?.is_accepting_orders !== false,
    }),
    [currentBranch]
  )

  /** True when `product` can be bought at the selected branch. */
  const isAvailableAtBranch = useCallback(
    (product) => {
      if (!product) return false
      const stock = product.branch_stock ?? product.stock_quantity
      return Number(stock) > 0
    },
    []
  )

  const value = {
    branches,
    currentBranch,
    branchId,
    loading,
    error,
    delivery,
    selectBranch,
    isAvailableAtBranch,
    isAdminView: isBranchStaff,
    refresh: async () => {
      const data = await listBranches()
      setBranches(data?.branches || [])
    },
  }

  return <BranchContext.Provider value={value}>{children}</BranchContext.Provider>
}

export function useBranch() {
  const context = useContext(BranchContext)
  if (!context) throw new Error('useBranch must be used within a BranchProvider')
  return context
}
