import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FaBox, FaUsers, FaMoneyBillWave, FaExclamationTriangle, FaShoppingCart, FaPlus, FaEdit, FaTrash, FaEye, FaCog, FaBuilding, FaChartLine, FaMapMarkerAlt, FaBullhorn, FaBell, FaComments } from 'react-icons/fa'
import { useAuth } from '../context/AuthContext'
import { useProducts } from '../context/ProductContext'
import { useNotifications } from '../context/NotificationContext'
import { toast } from 'react-toastify'
import {
  getAdminStats, getAdminUsers, listTenants, updateTenant, updateUserRole,
  getBranchInventory, updateBranchInventory, updateBranchSettings,
  getOrders, updateOrderStatus, broadcastNotification, listBranches,
} from '../services/api'

const ORDER_STATUSES = ['processing', 'confirmed', 'packed', 'out_for_delivery', 'delivered', 'cancelled']

export default function AdminDashboard() {
  const { user, isSuperAdmin } = useAuth()
  const canManageBranch = isSuperAdmin || user?.role === 'admin'
  const canManageUsers = canManageBranch
  const { products, getStatus, updateStock, setStock, restock, addProduct, deleteProduct, refreshBranchStock } = useProducts()
  const { refresh: refreshNotifications } = useNotifications()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('overview')
  const [stats, setStats] = useState(null)
  const [users, setUsers] = useState([])
  const [tenants, setTenants] = useState([])
  const [selectedTenant, setSelectedTenant] = useState(null)
  const [productFilter, setProductFilter] = useState('all')
  const [editingTenant, setEditingTenant] = useState(null)
  const [loading, setLoading] = useState(true)

  // --- branch state ---
  const [branches, setBranches] = useState([])
  const [manageBranchId, setManageBranchId] = useState(null)
  const [inventory, setInventory] = useState([])
  const [inventoryLoading, setInventoryLoading] = useState(false)
  const [stockDrafts, setStockDrafts] = useState({})
  const [savingProductId, setSavingProductId] = useState(null)
  const [branchForm, setBranchForm] = useState(null)
  const [announcement, setAnnouncement] = useState({ title: '', body: '', target: 'branch' })
  const [sending, setSending] = useState(false)
  const [broadcastResult, setBroadcastResult] = useState(null)

  // --- real orders (replaces the mock list) ---
  const [orders, setOrders] = useState([])
  const [updatingOrder, setUpdatingOrder] = useState(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const s = await getAdminStats()
        setStats(s.stats || s)
      } catch (e) { console.error(e); setStats({ users: 0, products: 12, orders: 0, revenue: 0 }) }
      try {
        const u = await getAdminUsers()
        setUsers(u.users || [])
      } catch (e) { console.error(e) }
      // Branch list for the "Branch & Stock" tab.
      try {
        const b = await listBranches(true)
        setBranches(b.branches || [])
      } catch (e) { console.error(e) }
      // Real orders for this branch (super admin sees all).
      try {
        const o = await getOrders()
        setOrders(o.orders || [])
      } catch (e) { console.error(e) }
      if (isSuperAdmin) {
        try {
          const t = await listTenants()
          setTenants(t.tenants || [])
          if (t.tenants?.length) setSelectedTenant(t.tenants[0])
        } catch (e) { console.error(e) }
      } else if (user?.tenant_id) {
        // admin own tenant
        try {
          const t = await listTenants()
          if (t.tenants?.length) setEditingTenant(t.tenants[0])
        } catch {}
      }
      setLoading(false)
    }
    load()
  }, [isSuperAdmin, user?.tenant_id])

  // Super admins can manage any branch; an admin is locked to their own.
  useEffect(() => {
    if (manageBranchId) return
    const fallback = isSuperAdmin ? selectedTenant?.tenant_id : user?.tenant_id
    if (fallback) setManageBranchId(fallback)
  }, [isSuperAdmin, selectedTenant?.tenant_id, user?.tenant_id, manageBranchId])

  const loadInventory = useCallback(async (branchId) => {
    if (!branchId) return
    setInventoryLoading(true)
    try {
      const data = await getBranchInventory(branchId)
      setInventory(data.items || [])
      setStockDrafts({})
      const doc = branches.find((b) => b.branch_id === branchId)
      setBranchForm(doc ? { ...doc } : null)
    } catch (e) {
      toast.error(e.message || 'Could not load branch inventory')
      setInventory([])
    } finally {
      setInventoryLoading(false)
    }
  }, [branches])

  useEffect(() => {
    if (manageBranchId) loadInventory(manageBranchId)
  }, [manageBranchId, loadInventory])

  const handleSaveStock = async (item) => {
    const raw = stockDrafts[item.product_id]
    const value = parseInt(raw ?? item.stock_quantity, 10)
    if (Number.isNaN(value) || value < 0) {
      toast.error('Enter a valid stock number')
      return
    }
    setSavingProductId(item.product_id)
    try {
      await updateBranchInventory(manageBranchId, item.product_id, { stock_quantity: value })
      setInventory((prev) =>
        prev.map((row) => (row.product_id === item.product_id ? { ...row, stock_quantity: value } : row))
      )
      setStockDrafts((prev) => {
        const next = { ...prev }
        delete next[item.product_id]
        return next
      })
      await refreshBranchStock()
      toast.success(`${item.name} stock set to ${value} at this branch`)
    } catch (e) {
      toast.error(e.message || 'Could not update stock')
    } finally {
      setSavingProductId(null)
    }
  }

  const handleSaveBranch = async () => {
    if (!branchForm) return
    try {
      await updateBranchSettings(manageBranchId, {
        name: branchForm.name,
        phone: branchForm.phone,
        address: branchForm.address,
        city: branchForm.city,
        region: branchForm.region,
        postal_code: branchForm.postal_code,
        opening_hours: branchForm.opening_hours,
        delivery_fee: Number(branchForm.delivery_fee),
        free_delivery_threshold: Number(branchForm.free_delivery_threshold),
        delivery_radius_km: branchForm.delivery_radius_km != null ? Number(branchForm.delivery_radius_km) : null,
        is_accepting_orders: branchForm.is_accepting_orders,
      })
      toast.success('Branch settings saved')
      const b = await listBranches(true)
      setBranches(b.branches || [])
    } catch (e) {
      toast.error(e.message || 'Could not save branch settings')
    }
  }

  const handleSendAnnouncement = async (e) => {
    e.preventDefault()
    if (!announcement.title.trim() || !announcement.body.trim()) {
      toast.error('Add a title and a message')
      return
    }
    setSending(true)
    setBroadcastResult(null)
    try {
      const result = await broadcastNotification({
        title: announcement.title.trim(),
        body: announcement.body.trim(),
        type: 'announcement',
        url: '/products',
        target: announcement.target,
        branch_id: announcement.target === 'branch' ? manageBranchId : undefined,
      })
      setBroadcastResult(result)
      setAnnouncement({ title: '', body: '', target: 'branch' })
      toast.success(`Sent to ${result.recipients} recipient(s) — ${result.pushed} pushed`)
      refreshNotifications()
    } catch (err) {
      toast.error(err.message || 'Could not send announcement')
    } finally {
      setSending(false)
    }
  }

  const handleOrderStatus = async (orderId, status) => {
    setUpdatingOrder(orderId)
    try {
      await updateOrderStatus(orderId, status)
      setOrders((prev) => prev.map((o) => (o.order_id === orderId ? { ...o, status } : o)))
      toast.success(`${orderId} → ${status.replace(/_/g, ' ')} (customer notified)`)
    } catch (e) {
      toast.error(e.message || 'Could not update order status')
    } finally {
      setUpdatingOrder(null)
    }
  }

  const handleRoleChange = async (target, role) => {
    if (!canManageUsers || role === target.role) return
    if (!confirm(`Change ${target.email} to ${role}?`)) return
    try {
      await updateUserRole(target.user_id || target.email, {
        role,
        tenant_id: role === 'super_admin' ? null : (target.tenant_id || user.tenant_id),
      })
      setUsers((prev) => prev.map((item) => (
        item.user_id === target.user_id || item.email === target.email
          ? { ...item, role, tenant_id: role === 'super_admin' ? null : (item.tenant_id || user.tenant_id) }
          : item
      )))
      toast.success(`${target.email} is now a ${role.replace(/_/g, ' ')}`)
    } catch (error) {
      toast.error(error.message || 'Could not update user role')
    }
  }

  const handleTenantUpdate = async () => {
    const tenant = selectedTenant || editingTenant
    if (!canManageBranch || !tenant) return
    try {
      const tid = tenant.tenant_id || tenant.slug
      const updated = await updateTenant(tid, { phone: tenant.phone, address: tenant.address, name: tenant.name, owner_email: tenant.owner_email, status: tenant.status })
      const next = updated.tenant || { ...tenant }
      if (isSuperAdmin) setSelectedTenant(next)
      else setEditingTenant(next)
      toast.success('Branch settings updated')
    } catch (e) { toast.error(e.message) }
  }

  const handleAddProduct = () => {
    const name = prompt('Product name?')
    if (!name) return
    addProduct({ name, category: 'Chicken', price: 9.99, stock_quantity: 100, weight: '1 kg', description: 'New product from admin' })
    toast.success('Product added — now visible in Shop and Home (shared inventory)')
  }
  const handleStockChange = (id, delta) => {
    updateStock(id, delta)
    // toast with new value handled by shared context
  }
  const handleSetStock = (id, value) => {
    setStock(id, value)
  }
  const handleRestock = (id) => {
    const qty = parseInt(prompt('Restock quantity?', '50'), 10)
    if (!qty || qty <= 0) return
    restock(id, qty)
    toast.success(`Restocked +${qty} units — reflected in Shop instantly`)
  }
  const handleDeleteProduct = (id) => {
    if (!confirm('Delete this product?')) return
    deleteProduct(id)
    toast.success('Product deleted — removed from Shop')
  }

  if (loading) return <div className="container" style={{padding:80, textAlign:'center'}}>Loading admin dashboard...</div>

  return (
    <div className="dashboard-page">
      <div className="container">
        <div className="dashboard-header" style={{display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12}}>
          <div>
            <h1 style={{display:'flex', alignItems:'center', gap:10}}><FaCog color="#2d5016" /> Admin Dashboard {isSuperAdmin && <span style={{background:'#c9a227', color:'white', padding:'4px 10px', borderRadius:20, fontSize:12}}>SUPER CONTROL</span>}</h1>
            <p>Welcome, {user.full_name} • {user.role} {user.tenant_name ? `• ${user.tenant_name}` : ''} {isSuperAdmin && '• Full access to all tenants'}</p>
          </div>
          <div style={{display:'flex', gap:8}}>
            <Link to="/super" style={{display: isSuperAdmin ? 'inline-flex' : 'none', alignItems:'center', gap:6, background:'#1a3009', color:'white', padding:'10px 16px', borderRadius:8, fontSize:13}}><FaBuilding /> Super Admin</Link>
            <Link to="/care-chat" className="btn btn-outline" style={{padding:'10px 16px', fontSize:13}}><FaComments /> Live Care</Link>
             <Link to="/dashboard" className="btn btn-outline" style={{padding:'10px 16px', fontSize:13}}>User Dashboard</Link>
          </div>
        </div>

        {isSuperAdmin && tenants.length > 1 && (
          <div style={{background:'#fff7ed', border:'1px solid #fed7aa', padding:14, borderRadius:10, marginBottom:20, display:'flex', alignItems:'center', gap:12}}>
            <FaBuilding color="#9a3412" />
            <div style={{flex:1}}>
              <strong style={{fontSize:13, color:'#9a3412'}}>Super Admin: Tenant Switcher (Full Super Control)</strong>
              <div style={{fontSize:12, color:'#7c2d12'}}>You are viewing all tenants. Select a tenant to filter products/users. You can edit any tenant's data.</div>
            </div>
            <select value={selectedTenant?.tenant_id || ''} onChange={e=> setSelectedTenant(tenants.find(t=>t.tenant_id===e.target.value))} style={{padding:'8px 12px', borderRadius:8, border:'1px solid #fed7aa'}}>
              {tenants.map(t=> <option key={t.tenant_id} value={t.tenant_id}>{t.name} ({t.tenant_id})</option>)}
            </select>
          </div>
        )}

        <div className="dashboard-layout">
          <div className="dashboard-sidebar">
            <nav className="sidebar-nav">
                {[
                { id:'overview', label:'Overview', icon:FaChartLine },
                { id:'branch', label:'Branch & Stock', icon:FaMapMarkerAlt },
                { id:'products', label:`Products (${products.length})`, icon:FaBox },
                { id:'orders', label:`Orders (${orders.length})`, icon:FaShoppingCart },
                { id:'users', label:`Users (${users.length})`, icon:FaUsers },
                ...(canManageBranch ? [{ id:'settings', label:'Tenant Settings', icon:FaCog }] : []),
              ].map(item=> (
                <button key={item.id} className={activeTab===item.id ? 'active' : ''} onClick={()=>setActiveTab(item.id)}>
                  <item.icon /> {item.label}
                </button>
              ))}
            </nav>
            <div style={{marginTop:16, background:'#f9f8f6', padding:12, borderRadius:8, fontSize:12, lineHeight:1.6}}>
              <strong>Tenant:</strong> {user.tenant_name || selectedTenant?.name || 'Platform'}<br/>
              <strong>Role:</strong> {user.role}<br/>
              <strong>ID:</strong> {user.tenant_id || 'none (super)'}<br/>
              <Link to="/contact" style={{color:'#2d5016', textDecoration:'underline'}}>Support</Link>
            </div>
          </div>

          <div className="dashboard-content">
            {activeTab==='overview' && (
              <div>
                <h2>Overview {selectedTenant ? `• ${selectedTenant.name}` : ''}</h2>
                <div className="overview-stats">
                  <div className="overview-stat"><FaMoneyBillWave /><div><span className="stat-value">${stats?.revenue ?? 12450}</span><span className="stat-label">Revenue (mock)</span></div></div>
                  <div className="overview-stat"><FaShoppingCart /><div><span className="stat-value">{stats?.orders ?? 87}</span><span className="stat-label">Orders</span></div></div>
                  <div className="overview-stat"><FaUsers /><div><span className="stat-value">{stats?.users ?? users.length}</span><span className="stat-label">Customers</span></div></div>
                  <div className="overview-stat"><FaExclamationTriangle color="#c9a227" /><div><span className="stat-value">{stats?.low_stock ?? 3}</span><span className="stat-label">Low Stock</span></div></div>
                </div>

                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:24}}>
                  <div style={{background:'#f9f8f6', padding:16, borderRadius:8}}>
                    <h4 style={{marginBottom:8}}>Quick Actions</h4>
                    <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
                      {canManageBranch && <button onClick={handleAddProduct} className="btn btn-primary" style={{padding:'8px 14px', fontSize:13}}><FaPlus /> Add Product</button>}
                      <button onClick={()=>setActiveTab('orders')} className="btn btn-outline" style={{padding:'8px 14px', fontSize:13}}><FaEye /> View Orders</button>
                      <Link to="/products" className="btn btn-outline" style={{padding:'8px 14px', fontSize:13}}>Storefront</Link>
                    </div>
                  </div>
                  <div style={{background:'#f0f7ee', padding:16, borderRadius:8, border:'1px solid #d4edda'}}>
                    <h4 style={{marginBottom:6}}>Store Health</h4>
                    <ul style={{fontSize:13, color:'#555', lineHeight:1.8, paddingLeft:18}}>
                      <li>Stock alerts: {products.filter(p=>p.stock_quantity===0).length} out of stock, {products.filter(p=>p.stock_quantity>0 && p.stock_quantity<30).length} low</li>
                      <li>Pending orders: {stats?.pending_orders ?? 8}</li>
                      <li>Last sync: just now • DB: connected</li>
                    </ul>
                  </div>
                </div>

                <h3>Recent Orders</h3>
                <div style={{border:'1px solid #e8e5df', borderRadius:10, overflow:'hidden'}}>
                  <div style={{display:'grid', gridTemplateColumns:'1.2fr 1fr 1fr 1fr 0.8fr', gap:0, background:'#f9f8f6', padding:'12px 16px', fontSize:12, fontWeight:600, color:'#666'}}>
                    <span>Order</span><span>Customer</span><span>Date</span><span>Status</span><span>Total</span>
                  </div>
                  {orders.slice(0, 4).map((o) => (
                    <div key={o.order_id} style={{display:'grid', gridTemplateColumns:'1.2fr 1fr 1fr 1fr 0.8fr', padding:'12px 16px', borderTop:'1px solid #e8e5df', fontSize:13, alignItems:'center'}}>
                      <strong>{o.order_id}</strong><span>{o.branch_name || user.tenant_name || 'Branch'}</span><span>{String(o.created_at || '').slice(0, 10) || '—'}</span><span className={`order-status ${String(o.status || '').toLowerCase()}`} style={{justifySelf:'start'}}>{String(o.status || 'processing').replace(/_/g, ' ')}</span><span>${Number(o.total || 0).toFixed(2)}</span>
                    </div>
                  ))}
                  {orders.length === 0 && <div style={{padding:20, textAlign:'center', color:'#777', fontSize:13}}>No orders yet.</div>}
                </div>
                <button onClick={()=>setActiveTab('orders')} style={{marginTop:12, fontSize:13, color:'#2d5016', fontWeight:600}}>View all orders →</button>
              </div>
            )}

            {activeTab==='branch' && (
              <div>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12, marginBottom:12}}>
                  <h2 style={{margin:0, border:0, padding:0}}><FaMapMarkerAlt /> Branch &amp; Stock</h2>
                  {isSuperAdmin ? (
                    <select
                      value={manageBranchId || ''}
                      onChange={e => setManageBranchId(e.target.value)}
                      style={{padding:'8px 12px', borderRadius:8, border:'1px solid #e8e5df'}}
                    >
                      {branches.map(b => <option key={b.branch_id} value={b.branch_id}>{b.name}</option>)}
                    </select>
                  ) : (
                    <span className="stock-pill ok">{user?.tenant_name || 'Your branch'}</span>
                  )}
                </div>

                <p style={{fontSize:13, color:'#777', marginBottom:16, lineHeight:1.6}}>
                  Each farm branch keeps its own stock. Changes here apply to this branch only and are
                  reflected in the storefront as soon as the customer selects it. Dropping to the
                  low-stock threshold raises an in-app alert for this branch&apos;s admins.
                </p>

                {/* ---- branch location & delivery rules ---- */}
                {canManageBranch && branchForm && (
                  <div style={{background:'#fff', border:'1px solid #e8e5df', borderRadius:12, padding:20, marginBottom:20}}>
                    <h3 style={{fontSize:15, marginBottom:12, display:'flex', alignItems:'center', gap:8}}>
                      <FaBuilding /> Branch details
                    </h3>
                    <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:12}}>
                      {[
                        { key:'name', label:'Branch name' },
                        { key:'phone', label:'Phone' },
                        { key:'address', label:'Street address' },
                        { key:'city', label:'City' },
                        { key:'region', label:'State / Region' },
                        { key:'postal_code', label:'Postal code' },
                        { key:'opening_hours', label:'Opening hours', placeholder:'Sat 9AM–1PM' },
                        { key:'delivery_fee', label:'Delivery fee ($)', type:'number' },
                        { key:'free_delivery_threshold', label:'Free delivery over ($)', type:'number' },
                        { key:'delivery_radius_km', label:'Delivery radius (km)', type:'number' },
                      ].map(field => (
                        <div key={field.key} className="form-group" style={{margin:0}}>
                          <label style={{fontSize:11, color:'#666'}}>{field.label}</label>
                          <input
                            type={field.type || 'text'}
                            value={branchForm[field.key] ?? ''}
                            placeholder={field.placeholder}
                            onChange={e => setBranchForm({ ...branchForm, [field.key]: e.target.value })}
                            style={{width:'100%', padding:'8px 10px', border:'1px solid #e8e5df', borderRadius:8, fontSize:13}}
                          />
                        </div>
                      ))}
                    </div>
                    <label style={{display:'flex', alignItems:'center', gap:8, marginTop:12, fontSize:13, cursor:'pointer'}}>
                      <input
                        type="checkbox"
                        checked={branchForm.is_accepting_orders !== false}
                        onChange={e => setBranchForm({ ...branchForm, is_accepting_orders: e.target.checked })}
                      />
                      Accepting online orders
                    </label>
                    <button className="btn btn-primary btn-small" style={{marginTop:14}} onClick={handleSaveBranch}>
                      Save branch settings
                    </button>
                  </div>
                )}
                {!canManageBranch && (
                  <div className="admin-readonly-notice">
                    You have read-only branch access. A branch admin manages delivery settings and inventory.
                  </div>
                )}

                {/* ---- per-branch inventory ---- */}
                <div style={{background:'#fff', border:'1px solid #e8e5df', borderRadius:12, padding:20, marginBottom:20}}>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8, marginBottom:12}}>
                    <h3 style={{fontSize:15, margin:0, display:'flex', alignItems:'center', gap:8}}>
                      <FaBox /> Stock at this branch
                    </h3>
                    <button className="btn btn-outline btn-small" onClick={() => loadInventory(manageBranchId)} disabled={inventoryLoading}>
                      {inventoryLoading ? 'Loading…' : 'Refresh'}
                    </button>
                  </div>

                  {inventory.length === 0 ? (
                    <p style={{fontSize:13, color:'#777'}}>
                      {inventoryLoading ? 'Loading inventory…' : 'No stock lines yet for this branch.'}
                    </p>
                  ) : (
                    <div style={{overflowX:'auto'}}>
                      <table style={{width:'100%', borderCollapse:'collapse', fontSize:13, minWidth:520}}>
                        <thead>
                          <tr style={{textAlign:'left', borderBottom:'1px solid #e8e5df', color:'#777', fontSize:11, textTransform:'uppercase', letterSpacing:0.5}}>
                            <th style={{padding:'8px 6px'}}>Product</th>
                            <th style={{padding:'8px 6px'}}>Category</th>
                            <th style={{padding:'8px 6px', textAlign:'center'}}>Stock</th>
                            <th style={{padding:'8px 6px', textAlign:'center'}}>Status</th>
                            <th style={{padding:'8px 6px'}} />
                          </tr>
                        </thead>
                        <tbody>
                          {inventory.map(item => {
                            const value = stockDrafts[item.product_id] ?? item.stock_quantity
                            const dirty = String(value) !== String(item.stock_quantity)
                            const low = item.stock_quantity > 0 && item.stock_quantity <= item.low_stock_threshold
                            const out = item.stock_quantity <= 0
                            return (
                              <tr
                                key={item.product_id}
                                className={`branch-inventory-row ${out ? 'is-out' : low ? 'is-low' : ''}`}
                                style={{borderBottom:'1px solid #f2f0ec'}}
                              >
                                <td style={{padding:'8px 6px', fontWeight:600}}>{item.name || item.product_id}</td>
                                <td style={{padding:'8px 6px', color:'#777'}}>{item.category || '—'}</td>
                                <td style={{padding:'8px 6px', textAlign:'center'}}>
                                  <input
                                    className="branch-stock-input"
                                    type="number"
                                    min="0"
                                    value={value}
                                    onChange={e => setStockDrafts({ ...stockDrafts, [item.product_id]: e.target.value })}
                                     disabled={!canManageBranch}
                                  />
                                </td>
                                <td style={{padding:'8px 6px', textAlign:'center'}}>
                                  <span className={`stock-pill ${out ? 'out' : low ? 'low' : 'ok'}`}>
                                    {out ? 'Out' : low ? 'Low' : 'In stock'}
                                  </span>
                                </td>
                                <td style={{padding:'8px 6px', textAlign:'right'}}>
                                  <button
                                    className="btn btn-outline btn-small"
                                    disabled={!canManageBranch || !dirty || savingProductId === item.product_id}
                                    onClick={() => handleSaveStock(item)}
                                  >
                                    {savingProductId === item.product_id ? 'Saving…' : 'Save'}
                                  </button>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* ---- announcements -> in-app + web push ---- */}
                {canManageBranch && (
                <form
                  onSubmit={handleSendAnnouncement}
                  style={{background:'#fff', border:'1px solid #e8e5df', borderRadius:12, padding:20}}
                >
                  <h3 style={{fontSize:15, marginBottom:6, display:'flex', alignItems:'center', gap:8}}>
                    <FaBullhorn /> Send an announcement
                  </h3>
                  <p style={{fontSize:12, color:'#777', marginBottom:12, lineHeight:1.6}}>
                    Delivers to the in-app notification centre for every recipient, and as a browser
                    push notification on any device they have enabled alerts on.
                  </p>

                  <div className="form-group" style={{marginBottom:10}}>
                    <label style={{fontSize:12}}>Audience</label>
                    <select
                      value={announcement.target}
                      onChange={e => setAnnouncement({ ...announcement, target: e.target.value })}
                      style={{width:'100%', padding:'9px 10px', border:'1px solid #e8e5df', borderRadius:8, fontSize:13}}
                    >
                      <option value="branch">Customers of this branch</option>
                      <option value="all_customers">All customers (every branch)</option>
                      {isSuperAdmin && <option value="all">Everyone, including staff</option>}
                    </select>
                  </div>

                  <div className="form-group" style={{marginBottom:10}}>
                    <label style={{fontSize:12}}>Title</label>
                    <input
                      value={announcement.title}
                      maxLength={120}
                      onChange={e => setAnnouncement({ ...announcement, title: e.target.value })}
                      placeholder="Weekend farm box is back"
                      style={{width:'100%', padding:'9px 10px', border:'1px solid #e8e5df', borderRadius:8, fontSize:13}}
                    />
                  </div>

                  <div className="form-group" style={{marginBottom:12}}>
                    <label style={{fontSize:12}}>Message</label>
                    <textarea
                      value={announcement.body}
                      maxLength={400}
                      rows={3}
                      onChange={e => setAnnouncement({ ...announcement, body: e.target.value })}
                      placeholder="Order by Thursday for Saturday pickup — 20% off bulk orders."
                      style={{width:'100%', padding:'9px 10px', border:'1px solid #e8e5df', borderRadius:8, fontSize:13, resize:'vertical'}}
                    />
                  </div>

                  <button type="submit" className="btn btn-primary" disabled={sending}>
                    <FaBell /> {sending ? 'Sending…' : 'Send notification'}
                  </button>

                  {broadcastResult && (
                    <div className="broadcast-result">
                      Delivered to {broadcastResult.stored} in-app notification(s)
                      {broadcastResult.pushed > 0 && ` and ${broadcastResult.pushed} browser push(es)`}
                      {broadcastResult.pushed === 0 && ' (no devices have push enabled yet)'}
                    </div>
                  )}
                </form>
                )}
              </div>
            )}

            {activeTab==='products' && (
              <div>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12}}>
                  <h2 style={{margin:0, border:0, padding:0}}>Products {selectedTenant ? `• ${selectedTenant.name}` : ''}</h2>
                  {canManageBranch && <button onClick={handleAddProduct} className="btn btn-primary" style={{padding:'8px 14px'}}><FaPlus /> Add Product</button>}
                </div>
                <p style={{fontSize:13, color:'#777', marginBottom:10}}>Manage catalog for {selectedTenant?.name || user.tenant_name || 'your tenant'}. {isSuperAdmin && 'As Super Admin you can edit any tenant.'} All stock levels are visible here — including <strong>out of stock (0)</strong>. Wire to <code>/api/products?tenant_id</code> to persist.</p>

                {/* Inventory summary */}
                <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:12, marginBottom:16}}>
                  <div style={{background:'#fff', border:'1px solid #e8e5df', borderRadius:8, padding:12, textAlign:'center'}}><div style={{fontSize:20, fontWeight:800}}>{products.length}</div><div style={{fontSize:11, color:'#777'}}>Total Products</div></div>
                  <div style={{background:'#d4edda', borderRadius:8, padding:12, textAlign:'center'}}><div style={{fontSize:20, fontWeight:800, color:'#1a7f37'}}>{products.filter(p=>p.stock_quantity>30).length}</div><div style={{fontSize:11, color:'#1a7f37'}}>In Stock</div></div>
                  <div style={{background:'#fef3cd', borderRadius:8, padding:12, textAlign:'center'}}><div style={{fontSize:20, fontWeight:800, color:'#856404'}}>{products.filter(p=>p.stock_quantity>0 && p.stock_quantity<30).length}</div><div style={{fontSize:11, color:'#856404'}}>Low Stock (&lt;30)</div></div>
                  <div style={{background:'#f8d7da', borderRadius:8, padding:12, textAlign:'center'}}><div style={{fontSize:20, fontWeight:800, color:'#dc2626'}}>{products.filter(p=>p.stock_quantity===0).length}</div><div style={{fontSize:11, color:'#dc2626'}}>Out of Stock (0)</div></div>
                </div>

                {/* Filter */}
                <div style={{display:'flex', gap:8, marginBottom:12, flexWrap:'wrap'}}>
                  {[
                    { id:'all', label:`All (${products.length})` },
                    { id:'in', label:`In Stock (${products.filter(p=>p.stock_quantity>30).length})` },
                    { id:'low', label:`Low Stock (${products.filter(p=>p.stock_quantity>0 && p.stock_quantity<30).length})` },
                    { id:'out', label:`Out of Stock (${products.filter(p=>p.stock_quantity===0).length})` },
                  ].map(f=> (
                    <button key={f.id} onClick={()=>setProductFilter(f.id)} style={{padding:'6px 14px', borderRadius:20, border: productFilter===f.id ? '2px solid #2d5016' : '1px solid #e8e5df', background: productFilter===f.id ? '#f0f7ee' : 'white', fontSize:12, fontWeight:600}}>{f.label}</button>
                  ))}
                </div>

                <div style={{overflowX:'auto', border:'1px solid #e8e5df', borderRadius:10}}>
                  <table style={{width:'100%', fontSize:13, borderCollapse:'collapse'}}>
                    <thead><tr style={{background:'#f9f8f6', textAlign:'left'}}><th style={{padding:'10px 12px'}}>Product</th><th>Category</th><th>Price</th><th>Available</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>
                      {products.filter(p=>{
                        if (productFilter==='in') return p.stock_quantity>30
                        if (productFilter==='low') return p.stock_quantity>0 && p.stock_quantity<30
                        if (productFilter==='out') return p.stock_quantity===0
                        return true
                      }).map(p=> {
                        const status = getStatus(p.stock_quantity)
                        const isOut = p.stock_quantity===0
                        return (
                        <tr key={p.product_id} style={{borderTop:'1px solid #e8e5df', background: isOut ? '#fef2f2' : 'white'}}>
                          <td style={{padding:'10px 12px', fontWeight:600}}>{p.name} {isOut && <span style={{fontSize:10, background:'#dc2626', color:'white', padding:'2px 6px', borderRadius:10, marginLeft:6}}>OUT</span>}</td>
                          <td>{p.category}</td>
                          <td>${p.price}</td>
                          <td>
                            <div style={{display:'flex', alignItems:'center', gap:6}}>
                              <button onClick={()=>handleStockChange(p.product_id, -1)} disabled={!canManageBranch} style={{width:28, height:28, border:'1px solid #e8e5df', borderRadius:6, background:'white'}}>-</button>
                              <input type="number" value={p.stock_quantity} onChange={e=>handleSetStock(p.product_id, e.target.value)} disabled={!canManageBranch} style={{width:64, padding:'6px 8px', border:'1px solid #e8e5df', borderRadius:6, textAlign:'center', fontWeight:700, background: isOut ? '#fff' : '#f9f8f6'}} min="0" />
                              <button onClick={()=>handleStockChange(p.product_id, 1)} disabled={!canManageBranch} style={{width:28, height:28, border:'1px solid #e8e5df', borderRadius:6, background:'white'}}>+</button>
                              <span style={{fontSize:11, color:'#777'}}>{p.stock_quantity} available</span>
                            </div>
                          </td>
                          <td><span className={`order-status ${status.toLowerCase().replace(' ', '-')}`} style={{fontSize:11, whiteSpace:'nowrap'}}>{status} {isOut ? '(0)' : `(${p.stock_quantity})`}</span></td>
                          <td style={{display:'flex', gap:6, flexWrap:'wrap'}}>
                            {isOut && canManageBranch && <button onClick={()=>handleRestock(p.product_id)} style={{padding:'6px 10px', background:'#1a7f37', color:'white', border:'none', borderRadius:6, fontSize:11, fontWeight:600}}>Restock</button>}
                            <button onClick={()=>toast.info('Edit mock - implement PUT /api/products/:id')} disabled={!canManageBranch} style={{padding:'6px 8px', border:'1px solid #e8e5df', borderRadius:6}}><FaEdit /></button>
                            <button onClick={()=>handleDeleteProduct(p.product_id)} disabled={!canManageBranch} style={{padding:'6px 8px', border:'1px solid #fecaca', color:'#dc2626', borderRadius:6}}><FaTrash /></button>
                          </td>
                        </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  {products.filter(p=>{
                    if (productFilter==='out') return p.stock_quantity===0
                    if (productFilter==='low') return p.stock_quantity>0 && p.stock_quantity<30
                    if (productFilter==='in') return p.stock_quantity>30
                    return true
                  }).length===0 && <div style={{padding:20, textAlign:'center', color:'#777', fontSize:13}}>No products in this filter.</div>}
                </div>
                <div style={{marginTop:10, fontSize:12, color:'#777'}}>
                  Tip: Out-of-stock items are <strong>fully accessible</strong> here with exact counts (0). Use <strong>+/-</strong> or type a number to update stock, or <strong>Restock</strong> to add inventory. Changes are mock until wired to <code>products_collection</code> with <code>tenant_id</code>.
                </div>
              </div>
            )}

            {activeTab==='orders' && (
              <div>
                <h2>Orders {selectedTenant ? `• ${selectedTenant.name}` : ''}</h2>
                <p style={{fontSize:13, color:'#777', marginBottom:12, lineHeight:1.6}}>
                  Live orders for {isSuperAdmin ? 'every branch' : 'your branch'}. Changing the status
                  sends the customer an in-app notification and a browser push.
                </p>
                {orders.length === 0 ? (
                  <div style={{border:'1px dashed #e8e5df', borderRadius:10, padding:28, textAlign:'center', color:'#777', fontSize:13}}>
                    No orders yet. Place a test order as a customer to see it appear here.
                  </div>
                ) : (
                  <div style={{border:'1px solid #e8e5df', borderRadius:10, overflowX:'auto'}}>
                    <div style={{display:'grid', gridTemplateColumns:'minmax(120px,1.2fr) 1fr 1fr 1fr minmax(150px,1fr)', background:'#f9f8f6', padding:'12px 16px', fontSize:12, fontWeight:600, minWidth:640}}>
                      <span>Order</span><span>Branch</span><span>Total</span><span>Status</span><span>Update</span>
                    </div>
                    {orders.map(o => (
                      <div
                        key={o.order_id}
                        style={{display:'grid', gridTemplateColumns:'minmax(120px,1.2fr) 1fr 1fr 1fr minmax(150px,1fr)', padding:'12px 16px', borderTop:'1px solid #e8e5df', fontSize:13, alignItems:'center', minWidth:640}}
                      >
                        <div>
                          <strong>{o.order_id}</strong>
                          <div style={{fontSize:11, color:'#999'}}>
                            {String(o.created_at || '').slice(0, 10)} • {(o.items || []).length} item(s)
                          </div>
                        </div>
                        <span>{o.branch_name || '—'}</span>
                        <strong>${Number(o.total || 0).toFixed(2)}</strong>
                        <span className={`order-status ${String(o.status).toLowerCase()}`}>
                          {String(o.status).replace(/_/g, ' ')}
                        </span>
                        <select
                          value={o.status}
                          disabled={updatingOrder === o.order_id}
                          onChange={e => handleOrderStatus(o.order_id, e.target.value)}
                          style={{padding:'6px 8px', borderRadius:6, border:'1px solid #e8e5df', fontSize:12}}
                        >
                          {ORDER_STATUSES.map(s => (
                            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab==='users' && (
              <div>
                <h2>Users {selectedTenant ? `• ${selectedTenant.name}` : user.tenant_name ? `• ${user.tenant_name}` : ''}</h2>
                <p style={{fontSize:13, color:'#777', marginBottom:12}}>
                  {isSuperAdmin
                    ? 'All users across every branch. You can assign branch roles and platform roles.'
                    : canManageUsers
                      ? 'Branch customers and staff. Promote a customer to worker when they join your team.'
                      : 'Branch customers and staff. Workers have view access; ask a branch admin to change roles.'}
                </p>
                {users.length===0 ? <div style={{padding:40, textAlign:'center', color:'#777'}}>No users found in this tenant.</div> : (
                  <div className="admin-users-table-wrap" style={{border:'1px solid #e8e5df', borderRadius:10, overflow:'hidden'}}>
                    <div className="admin-users-table">
                      <div className="admin-users-row admin-users-head"><span>User</span><span>Role</span><span>Tenant</span><span>Role action</span></div>
                      {users.map(u=> {
                        const canEditRole = canManageUsers && (isSuperAdmin || ['customer', 'worker'].includes(u.role)) && u.user_id !== user.user_id
                        return (
                          <div key={u.user_id || u.email} className="admin-users-row">
                            <div><strong>{u.full_name}</strong><div style={{fontSize:12, color:'#777'}}>{u.email}</div></div>
                            <span className={`admin-role-pill ${u.role}`}>{u.role}</span>
                            <span style={{fontSize:12}}>{u.tenant_name || u.tenant_id || '—'}</span>
                            {canEditRole ? (
                              <select value={u.role} onChange={e => handleRoleChange(u, e.target.value)} aria-label={`Change role for ${u.email}`}>
                                {isSuperAdmin && <option value="admin">admin</option>}
                                <option value="customer">customer</option>
                                <option value="worker">worker</option>
                                {isSuperAdmin && <option value="super_admin">super_admin</option>}
                              </select>
                            ) : (
                              <span className="admin-role-readonly">{u.user_id === user.user_id ? 'Current account' : 'View only'}</span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
                <div style={{marginTop:16, background:'#f9f8f6', padding:14, borderRadius:8, fontSize:13}}>
                  <strong>How to add staff:</strong> Ask the customer to register, then select <code>worker</code> in the Role action column. Only Super Admin can grant admin or super-admin access.
                </div>
              </div>
            )}

            {activeTab==='settings' && (
              <div>
                <h2>Tenant Settings</h2>
                {editingTenant || selectedTenant ? (
                  <div style={{display:'grid', gap:16}}>
                    <div style={{background:'#f9f8f6', padding:16, borderRadius:8, border:'1px solid #e8e5df'}}>
                      <h4 style={{marginBottom:12}}>Tenant Info {isSuperAdmin ? `(Editing ${selectedTenant?.name || editingTenant?.name})` : ''}</h4>
                      {(() => {
                        const t = selectedTenant || editingTenant
                        if (!t) return <p>No tenant data</p>
                        return (
                          <div style={{display:'grid', gap:12}}>
                            <div className="form-group"><label>Name</label><input value={t.name} onChange={e=> isSuperAdmin ? setSelectedTenant({...t, name:e.target.value}) : setEditingTenant({...t, name:e.target.value})} style={{width:'100%', padding:'10px 12px', border:'1px solid #e8e5df', borderRadius:8}} /></div>
                            <div className="form-group"><label>Slug (ID)</label><input value={t.tenant_id || t.slug} disabled style={{width:'100%', padding:'10px 12px', border:'1px solid #e8e5df', borderRadius:8, background:'#eee'}} /></div>
                            <div className="form-group"><label>Owner Email</label><input value={t.owner_email || ''} onChange={e=> (isSuperAdmin ? setSelectedTenant({...t, owner_email:e.target.value}) : setEditingTenant({...t, owner_email:e.target.value}))} style={{width:'100%', padding:'10px 12px', border:'1px solid #e8e5df', borderRadius:8}} /></div>
                            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
                              <div className="form-group"><label>Phone</label><input value={t.phone || ''} onChange={e=> (isSuperAdmin ? setSelectedTenant({...t, phone:e.target.value}) : setEditingTenant({...t, phone:e.target.value}))} style={{width:'100%', padding:'10px 12px', border:'1px solid #e8e5df', borderRadius:8}} /></div>
                              <div className="form-group"><label>Status</label><select value={t.status} onChange={e=> (isSuperAdmin ? setSelectedTenant({...t, status:e.target.value}) : setEditingTenant({...t, status:e.target.value}))} style={{width:'100%', padding:'10px 12px', border:'1px solid #e8e5df', borderRadius:8}}><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
                            </div>
                            <div className="form-group"><label>Address</label><input value={t.address || ''} onChange={e=> (isSuperAdmin ? setSelectedTenant({...t, address:e.target.value}) : setEditingTenant({...t, address:e.target.value}))} style={{width:'100%', padding:'10px 12px', border:'1px solid #e8e5df', borderRadius:8}} /></div>
                            <button onClick={handleTenantUpdate} className="btn btn-primary" style={{padding:'10px 16px'}}>Save Changes</button>
                            <p style={{fontSize:12, color:'#777'}}>Changes call <code>PUT /api/tenants/:id</code> {isSuperAdmin ? '— Super can edit any tenant.' : '— Admin can only edit own tenant.'}</p>
                          </div>
                        )
                      })()}
                    </div>
                  </div>
                ) : <p>No tenant assigned. Contact Super Admin.</p>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
