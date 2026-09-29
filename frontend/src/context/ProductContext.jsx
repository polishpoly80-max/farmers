import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { getBranchInventory } from '../services/api'
import { useBranch } from './BranchContext'

const initialProducts = [
  { product_id: '1', name: 'Farm Chicken', description: 'Farm-raised broiler chicken, hormone-free and antibiotic-free.', price: 12.99, originalPrice: 15.99, category: 'Chicken', stock_quantity: 150, weight: '1.5-2 kg', badge: 'BEST SELLER', image: '/images/farm-chicken.jpg' },
  { product_id: '2', name: 'Farm Fresh Eggs', description: 'Fresh eggs from free-range hens. Rich in omega-3 and vitamins.', price: 6.99, category: 'Eggs', stock_quantity: 0, weight: '30 pcs • 700g', image: '/images/farm-eggs.jpg' },
  { product_id: '3', name: 'Farm Duck', description: 'Fresh duck meat, ideal for roasting and festive meals.', price: 28.99, category: 'Duck', stock_quantity: 30, weight: '2.5-3 kg', image: '/images/farm-duck.jpg' },
  { product_id: '4', name: 'Farm Turkey', description: 'Premium whole turkey, perfect for holidays and family gatherings.', price: 34.99, originalPrice: 39.99, category: 'Turkey', stock_quantity: 25, weight: '5-7 kg', badge: 'PREMIUM', image: '/images/farm-turkey.jpg' },
  { product_id: '5', name: 'Chicken Wings (Pack)', description: 'Fresh chicken wings, perfect for frying or baking. Party pack.', price: 8.99, category: 'Chicken', stock_quantity: 200, weight: '1 kg', image: '/images/chicken-wings.jpg' },
  { product_id: '6', name: 'Quail Eggs (30 pcs)', description: 'Farm-fresh quail eggs, rich in protein and nutrients.', price: 9.99, category: 'Eggs', stock_quantity: 100, weight: '30 pcs • 350g', image: '/images/quail-eggs.jpg' },
  { product_id: '7', name: 'Chicken Breast (500g)', description: 'Lean chicken breast, boneless and skinless. High protein.', price: 7.99, category: 'Chicken', stock_quantity: 250, weight: '500g', badge: 'LEAN', image: '/images/farm-chicken.jpg' },
  { product_id: '8', name: 'Organic Layer Hen', description: 'Premium organic laying hens, certified organic feed.', price: 24.99, category: 'Chicken', stock_quantity: 50, weight: '2-2.5 kg', badge: 'PREMIUM', image: '/images/organic-layer-hen.jpg' },
  { product_id: '9', name: 'Smoked Duck Breast', description: 'Artisan smoked duck breast, ready to slice. 2 packs.', price: 19.99, category: 'Duck', stock_quantity: 40, weight: '600g', badge: 'NEW', image: '/images/smoked-duck-breast.jpg' },
  { product_id: '10', name: 'Free-Range Whole Chicken', description: 'Whole free-range chicken, pasture raised, full flavour.', price: 16.99, category: 'Chicken', stock_quantity: 80, weight: '1.8-2.2 kg', image: '/images/free-range-chicken.jpg' },
  { product_id: '11', name: 'Heritage Turkey Crown', description: 'Turkey crown joint, easy to roast, serves 4-6.', price: 29.99, category: 'Turkey', stock_quantity: 18, weight: '3-4 kg', image: '/images/farm-turkey.jpg' },
  { product_id: '12', name: 'Brown Farm Eggs (12)', description: 'Brown eggs from pasture hens. Deep orange yolks.', price: 4.49, category: 'Eggs', stock_quantity: 300, weight: '12 pcs • 700g', badge: 'VALUE', image: '/images/brown-eggs-12.jpg' },
]

const productImageById = Object.fromEntries(
  initialProducts.map(product => [product.product_id, product.image]),
)

const ProductContext = createContext()

export function ProductProvider({ children }) {
  const { branchId, currentBranch } = useBranch()
  // Per-branch stock, keyed by product_id. Empty until the first fetch, and
  // reset whenever the customer switches branch.
  const [branchStock, setBranchStock] = useState({})

  const [products, setProducts] = useState(() => {
    try {
      const saved = localStorage.getItem('products')
      if (saved) {
        const parsed = JSON.parse(saved)
        // migrate if saved has different length, keep saved but ensure stock_quantity field exists
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map(p => ({
            ...p,
            stock_quantity: p.stock_quantity ?? p.stock ?? 0,
            // Migrate products saved by older versions to the bundled local images.
            image: productImageById[p.product_id] || p.image,
          }))
        }
      }
    } catch {}
    return initialProducts
  })

  useEffect(() => {
    localStorage.setItem('products', JSON.stringify(products))
  }, [products])

  const getStatus = (stock) => {
    if (stock === 0) return 'Out of Stock'
    if (stock < 30) return 'Low Stock'
    return 'In Stock'
  }

  // ---- load this branch's stock whenever the selection changes ----
  const loadBranchStock = useCallback(async () => {
    if (!branchId) {
      setBranchStock({})
      return
    }
    try {
      const data = await getBranchInventory(branchId)
      const map = {}
      ;(data?.items || []).forEach((item) => {
        map[item.product_id] = item.stock_quantity
      })
      setBranchStock(map)
    } catch {
      // Admin-only endpoint rejects customers; fall back to shared stock.
      setBranchStock({})
    }
  }, [branchId])

  useEffect(() => {
    loadBranchStock()
  }, [loadBranchStock])

  /** Stock for a product at the selected branch, falling back to shared stock. */
  const stockFor = useCallback(
    (product) => {
      if (!product) return 0
      const id = product.product_id
      if (Object.prototype.hasOwnProperty.call(branchStock, id)) return branchStock[id]
      return product.stock_quantity ?? product.stock ?? 0
    },
    [branchStock]
  )

  /** Catalogue merged with the current branch's stock levels. */
  const branchProducts = useMemo(
    () =>
      products.map((p) => {
        const hasBranchStock = Object.prototype.hasOwnProperty.call(branchStock, p.product_id)
        return hasBranchStock
          ? { ...p, stock_quantity: branchStock[p.product_id], branch_stock: branchStock[p.product_id] }
          : p
      }),
    [products, branchStock]
  )

  const isAvailable = useCallback(
    (product) => stockFor(product) > 0,
    [stockFor]
  )

  const updateStock = (productId, delta) => {
    setProducts(prev => prev.map(p => p.product_id === productId ? { ...p, stock_quantity: Math.max(0, (p.stock_quantity ?? p.stock ?? 0) + delta) } : p))
  }

  const setStock = (productId, value) => {
    const num = parseInt(value, 10)
    if (isNaN(num) || num < 0) return
    setProducts(prev => prev.map(p => p.product_id === productId ? { ...p, stock_quantity: num } : p))
  }

  const restock = (productId, qty) => {
    setProducts(prev => prev.map(p => p.product_id === productId ? { ...p, stock_quantity: (p.stock_quantity ?? 0) + qty } : p))
  }

  const addProduct = (product) => {
    const newProduct = { product_id: Date.now().toString(), stock_quantity: 100, weight: '1 kg', image: '/images/farm-chicken.jpg', category: 'Chicken', ...product }
    setProducts(prev => [...prev, newProduct])
  }

  const deleteProduct = (productId) => {
    setProducts(prev => prev.filter(p => p.product_id !== productId))
  }

  const resetProducts = () => {
    setProducts(initialProducts)
    localStorage.removeItem('products')
  }

  const getProductById = (id) => products.find(p => p.product_id === id)

  return (
    <ProductContext.Provider value={{
      products: branchProducts,
      getStatus,
      stockFor,
      isAvailable,
      branchId,
      currentBranch,
      branchStock,
      refreshBranchStock: loadBranchStock,
      updateStock,
      setStock,
      restock,
      addProduct,
      deleteProduct,
      resetProducts,
      getProductById: (id) => branchProducts.find(p => p.product_id === id),
    }}>
      {children}
    </ProductContext.Provider>
  )
}

export function useProducts() {
  const ctx = useContext(ProductContext)
  if (!ctx) throw new Error('useProducts must be used within ProductProvider')
  return ctx
}
