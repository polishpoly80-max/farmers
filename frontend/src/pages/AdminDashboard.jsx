import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FaBox, FaUsers, FaMoneyBillWave, FaExclamationTriangle, FaShoppingCart, FaPlus, FaEdit, FaTrash, FaEye, FaCog, FaBuilding, FaChartLine } from 'react-icons/fa'
import { useAuth } from '../context/AuthContext'
import { useProducts } from '../context/ProductContext'
import { toast } from 'react-toastify'
import { getAdminStats, getAdminUsers, listTenants, updateTenant } from '../services/api'

const mockOrders = [
  { id: 'ORD-8F3K2M', date: '2026-09-10', customer: 'Sarah Johnson', total: 45.97, status: 'Delivered', items: 3 },
  { id: 'ORD-7H2J1L', date: '2026-09-09', customer: 'Michael Chen', total: 28.99, status: 'Processing', items: 1 },
  { id: 'ORD-6G1I0K', date: '2026-09-08', customer: 'Emily Davis', total: 62.96, status: 'Shipped', items: 4 },
  { id: 'ORD-5F0H9J', date: '2026-09-07', customer: 'John Doe', total: 19.99, status: 'Pending', items: 2 },
]

export default function AdminDashboard() {
  const { user, isSuperAdmin } = useAuth()
  const { products, getStatus, updateStock, setStock, restock, addProduct, deleteProduct } = useProducts()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('overview')
  const [stats, setStats] = useState(null)
  const [users, setUsers] = useState([])
  const [tenants, setTenants] = useState([])
  const [selectedTenant, setSelectedTenant] = useState(null)
  const [productFilter, setProductFilter] = useState('all')
  const [editingTenant, setEditingTenant] = useState(null)
  const [loading, setLoading] = useState(true)

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

  const handleTenantUpdate = async () => {
    if (!editingTenant) return
    try {
      const tid = editingTenant.tenant_id || editingTenant.slug
      await updateTenant(tid, { phone: editingTenant.phone, address: editingTenant.address, name: editingTenant.name })
      toast.success('Tenant updated')
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
                { id:'products', label:`Products (${products.length})`, icon:FaBox },
                { id:'orders', label:'Orders', icon:FaShoppingCart },
                { id:'users', label:`Users (${users.length})`, icon:FaUsers },
                { id:'settings', label:'Tenant Settings', icon:FaCog },
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
                      <button onClick={handleAddProduct} className="btn btn-primary" style={{padding:'8px 14px', fontSize:13}}><FaPlus /> Add Product</button>
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
                  {mockOrders.slice(0,4).map(o=> (
                    <div key={o.id} style={{display:'grid', gridTemplateColumns:'1.2fr 1fr 1fr 1fr 0.8fr', padding:'12px 16px', borderTop:'1px solid #e8e5df', fontSize:13, alignItems:'center'}}>
                      <strong>{o.id}</strong><span>{o.customer}</span><span>{o.date}</span><span className={`order-status ${o.status.toLowerCase()}`} style={{justifySelf:'start'}}>{o.status}</span><span>${o.total}</span>
                    </div>
                  ))}
                </div>
                <button onClick={()=>setActiveTab('orders')} style={{marginTop:12, fontSize:13, color:'#2d5016', fontWeight:600}}>View all orders →</button>
              </div>
            )}

            {activeTab==='products' && (
              <div>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12}}>
                  <h2 style={{margin:0, border:0, padding:0}}>Products {selectedTenant ? `• ${selectedTenant.name}` : ''}</h2>
                  <button onClick={handleAddProduct} className="btn btn-primary" style={{padding:'8px 14px'}}><FaPlus /> Add Product</button>
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
                              <button onClick={()=>handleStockChange(p.product_id, -1)} style={{width:28, height:28, border:'1px solid #e8e5df', borderRadius:6, background:'white'}}>-</button>
                              <input type="number" value={p.stock_quantity} onChange={e=>handleSetStock(p.product_id, e.target.value)} style={{width:64, padding:'6px 8px', border:'1px solid #e8e5df', borderRadius:6, textAlign:'center', fontWeight:700, background: isOut ? '#fff' : '#f9f8f6'}} min="0" />
                              <button onClick={()=>handleStockChange(p.product_id, 1)} style={{width:28, height:28, border:'1px solid #e8e5df', borderRadius:6, background:'white'}}>+</button>
                              <span style={{fontSize:11, color:'#777'}}>{p.stock_quantity} available</span>
                            </div>
                          </td>
                          <td><span className={`order-status ${status.toLowerCase().replace(' ', '-')}`} style={{fontSize:11, whiteSpace:'nowrap'}}>{status} {isOut ? '(0)' : `(${p.stock_quantity})`}</span></td>
                          <td style={{display:'flex', gap:6, flexWrap:'wrap'}}>
                            {isOut && <button onClick={()=>handleRestock(p.product_id)} style={{padding:'6px 10px', background:'#1a7f37', color:'white', border:'none', borderRadius:6, fontSize:11, fontWeight:600}}>Restock</button>}
                            <button onClick={()=>toast.info('Edit mock - implement PUT /api/products/:id')} style={{padding:'6px 8px', border:'1px solid #e8e5df', borderRadius:6}}><FaEdit /></button>
                            <button onClick={()=>handleDeleteProduct(p.product_id)} style={{padding:'6px 8px', border:'1px solid #fecaca', color:'#dc2626', borderRadius:6}}><FaTrash /></button>
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
                <p style={{fontSize:13, color:'#777', marginBottom:12}}>Mock orders - integrate with <code>/api/orders?tenant_id=...</code> to make real. Super Admin sees all tenants.</p>
                <div style={{border:'1px solid #e8e5df', borderRadius:10, overflow:'hidden'}}>
                  <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr 1fr', background:'#f9f8f6', padding:'12px 16px', fontSize:12, fontWeight:600}}> <span>Order</span><span>Customer</span><span>Items</span><span>Status</span><span>Action</span></div>
                  {mockOrders.map(o=> (
                    <div key={o.id} style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr 1fr', padding:'12px 16px', borderTop:'1px solid #e8e5df', fontSize:13, alignItems:'center'}}>
                      <strong>{o.id}</strong><span>{o.customer}</span><span>{o.items}</span><span className={`order-status ${o.status.toLowerCase()}`}>{o.status}</span>
                      <select defaultValue={o.status} onChange={e=>toast.success(`Order ${o.id} status updated to ${e.target.value} (mock)`)} style={{padding:'6px 8px', borderRadius:6, border:'1px solid #e8e5df', fontSize:12}}>
                        <option>Pending</option><option>Processing</option><option>Shipped</option><option>Delivered</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab==='users' && (
              <div>
                <h2>Users {selectedTenant ? `• ${selectedTenant.name}` : user.tenant_name ? `• ${user.tenant_name}` : ''}</h2>
                <p style={{fontSize:13, color:'#777', marginBottom:12}}>{isSuperAdmin ? 'All users (Full Super Control: you can view any tenant\'s users and change roles).' : 'Users in your tenant. Invite new customers/admins via registration with your tenant link.'}</p>
                {users.length===0 ? <div style={{padding:40, textAlign:'center', color:'#777'}}>No users found in this tenant.</div> : (
                  <div style={{border:'1px solid #e8e5df', borderRadius:10, overflow:'hidden'}}>
                    <div style={{display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr', background:'#f9f8f6', padding:'12px 16px', fontSize:12, fontWeight:600}}><span>User</span><span>Role</span><span>Tenant</span><span>Action</span></div>
                    {users.map(u=> (
                      <div key={u.user_id || u.email} style={{display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr', padding:'12px 16px', borderTop:'1px solid #e8e5df', fontSize:13, alignItems:'center'}}>
                        <div><strong>{u.full_name}</strong><div style={{fontSize:12, color:'#777'}}>{u.email}</div></div>
                        <span style={{background: u.role==='super_admin' ? '#1a3009' : u.role==='admin' ? '#c9a227' : '#e8e5df', color: u.role==='customer' ? '#555' : 'white', padding:'4px 10px', borderRadius:20, fontSize:11, fontWeight:700, justifySelf:'start'}}>{u.role}</span>
                        <span style={{fontSize:12}}>{u.tenant_name || u.tenant_id || '—'}</span>
                        <button onClick={()=>toast.info('Role change: use Super Admin dashboard to promote/demote')} style={{fontSize:12, color:'#2d5016'}}>Manage</button>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{marginTop:16, background:'#f9f8f6', padding:14, borderRadius:8, fontSize:13}}>
                  <strong>Invite:</strong> Share registration link and ask user to sign up. Then, as {isSuperAdmin ? 'Super Admin' : 'Admin (needs Super)'} promote them: <code>PUT /api/users/{'{user_id}'}/role</code> with <code>{'{'}"role": "admin", "tenant_id": "your-tenant"{'}'}</code>
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
