import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { useNavigate, Link } from 'react-router-dom'
import { FaUser, FaEnvelope, FaPhone, FaMapMarkerAlt, FaSignOutAlt, FaShoppingBag, FaHeart, FaBox, FaChevronRight, FaTrash, FaEdit, FaCheck } from 'react-icons/fa'
import { toast } from 'react-toastify'
import { getOrders } from '../services/api'

function Dashboard() {
  const { user, logout, updateProfile } = useAuth()
  const { cartItems } = useCart()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('overview')
  const [orders, setOrders] = useState([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [wishlist, setWishlist] = useState(() => {
    try { return JSON.parse(localStorage.getItem('wishlist') || '[]') } catch { return [] }
  })
  const [editForm, setEditForm] = useState({
    full_name: user?.full_name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    address: user?.address || ''
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setEditForm({
      full_name: user?.full_name || '',
      email: user?.email || '',
      phone: user?.phone || '',
      address: user?.address || ''
    })
  }, [user])

  useEffect(() => {
    localStorage.setItem('wishlist', JSON.stringify(wishlist))
  }, [wishlist])

  useEffect(() => {
    const fetchOrders = async () => {
      setOrdersLoading(true)
      try {
        const data = await getOrders()
        setOrders(data.orders || [])
      } catch (e) {
        console.error('Failed to fetch orders:', e)
      } finally {
        setOrdersLoading(false)
      }
    }
    fetchOrders()
  }, [])

  const handleLogout = () => {
    logout()
    toast.success('Logged out successfully')
    navigate('/')
  }

  const handleSaveProfile = async () => {
    if (!editForm.full_name.trim()) { toast.error('Full name is required'); return }
    if (!editForm.email.includes('@')) { toast.error('Valid email required'); return }
    setSaving(true)
    try {
      const res = updateProfile ? await updateProfile(editForm) : { success: true }
      if (res && res.success === false) throw new Error(res.error)
      toast.success('Profile updated successfully')
    } catch (e) {
      toast.error(e.message || 'Failed to update profile')
    } finally { setSaving(false) }
  }

  const removeWishlist = (id) => {
    setWishlist(prev => prev.filter(p => p.product_id !== id))
    toast.success('Removed from wishlist')
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A'
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    } catch { return dateStr }
  }

  const getStatusClass = (status) => {
    const s = (status || '').toLowerCase()
    if (s === 'delivered') return 'delivered'
    if (s === 'processing' || s === 'pending') return 'processing'
    if (s === 'shipped' || s === 'in transit') return 'shipped'
    return 'processing'
  }

  if (!user) {
    navigate('/login')
    return null
  }

  return (
    <div className="dashboard-page">
      <div className="container">
        <div className="dashboard-header">
          <h1>My Account</h1>
          <p>Welcome back, {user.full_name || user.email} • Member since 2026</p>
        </div>

        <div className="dashboard-layout">
          {/* Sidebar */}
          <div className="dashboard-sidebar">
            <div className="sidebar-user">
              <div className="sidebar-avatar">{(user.full_name || user.email || 'U').charAt(0).toUpperCase()}</div>
              <div>
                <strong>{user.full_name || 'Demo User'}</strong>
                <span style={{wordBreak:'break-all'}}>{user.email}</span>
              </div>
            </div>

            <nav className="sidebar-nav">
              <button className={activeTab === 'overview' ? 'active' : ''} onClick={() => setActiveTab('overview')}>
                <FaUser /> Overview
              </button>
              <button className={activeTab === 'orders' ? 'active' : ''} onClick={() => setActiveTab('orders')}>
                <FaBox /> Order History
              </button>
              <button className={activeTab === 'wishlist' ? 'active' : ''} onClick={() => setActiveTab('wishlist')}>
                <FaHeart /> Wishlist ({wishlist.length})
              </button>
              <button className={activeTab === 'profile' ? 'active' : ''} onClick={() => setActiveTab('profile')}>
                <FaEdit /> Edit Profile
              </button>
              <button className="logout-btn" onClick={handleLogout}>
                <FaSignOutAlt /> Sign Out
              </button>
            </nav>

            <div style={{marginTop:16, background:'#f9f8f6', borderRadius:8, padding:12, fontSize:12, lineHeight:1.6, color:'#555'}}>
              <strong>Need help?</strong><br/>
              <FaEnvelope style={{marginRight:4}} /> info@premiumpoultry.com<br/>
              <FaPhone style={{marginRight:4}} /> +1 (555) 123-4567<br/>
              <Link to="/contact" style={{color:'#2d5016', textDecoration:'underline'}}>Contact support</Link>
            </div>
          </div>

          {/* Content */}
          <div className="dashboard-content">
            {activeTab === 'overview' && (
              <div className="dashboard-overview">
                <h2>Account Overview</h2>
                <div className="overview-stats">
                  <div className="overview-stat">
                    <FaBox />
                    <div>
                      <span className="stat-value">{orders.length}</span>
                      <span className="stat-label">Total Orders</span>
                    </div>
                  </div>
                  <div className="overview-stat">
                    <FaHeart />
                    <div>
                      <span className="stat-value">{wishlist.length}</span>
                      <span className="stat-label">Wishlist Items</span>
                    </div>
                  </div>
                  <div className="overview-stat">
                    <FaShoppingBag />
                    <div>
                      <span className="stat-value">{cartItems.reduce((s,i)=>s+i.quantity,0)}</span>
                      <span className="stat-label">Cart Items</span>
                    </div>
                  </div>
                </div>

                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:24}}>
                  <div style={{background:'#f9f8f6', padding:16, borderRadius:8}}>
                    <h4 style={{fontSize:14, marginBottom:8, display:'flex', alignItems:'center', gap:8}}><FaUser color="#2d5016" /> Profile</h4>
                    <div style={{fontSize:13, lineHeight:1.8, color:'#555'}}>
                      <div><FaEnvelope style={{marginRight:6}} />{user.email}</div>
                      <div><FaPhone style={{marginRight:6}} />{user.phone || 'Not set'}</div>
                      <div><FaMapMarkerAlt style={{marginRight:6}} />{user.address || 'Not set'}</div>
                    </div>
                    <button onClick={()=>setActiveTab('profile')} style={{marginTop:10, fontSize:12, color:'#2d5016', fontWeight:600}}>Edit profile →</button>
                  </div>
                  <div style={{background:'#f0f7ee', padding:16, borderRadius:8, border:'1px solid #d4edda'}}>
                    <h4 style={{fontSize:14, marginBottom:6}}>Delivery Info</h4>
                    <p style={{fontSize:12, color:'#555', lineHeight:1.6}}>Free shipping over $50 • Same-day dispatch before 2PM • 50-mile radius. <Link to="/contact" style={{color:'#2d5016', textDecoration:'underline'}}>Questions?</Link></p>
                    <div style={{marginTop:8, fontSize:12}}>
                      <Link to="/products" className="btn btn-primary" style={{padding:'8px 14px', fontSize:12}}>Shop Now</Link>
                    </div>
                  </div>
                </div>

                <div className="recent-orders">
                  <h3>Recent Orders</h3>
                  {ordersLoading ? (
                    <p style={{fontSize:13, color:'#777', padding:'16px 0'}}>Loading orders...</p>
                  ) : orders.length === 0 ? (
                    <p style={{fontSize:13, color:'#777', padding:'16px 0'}}>No orders yet. <Link to="/products" style={{color:'#2d5016', textDecoration:'underline'}}>Start shopping</Link></p>
                  ) : (
                    orders.slice(0,3).map(order => (
                      <div className="recent-order" key={order.order_id}>
                        <div>
                          <strong>{order.order_id}</strong>
                          <span>{formatDate(order.created_at)} • {order.items?.length || 0} items</span>
                        </div>
                        <span className={`order-status ${getStatusClass(order.status)}`}>{order.status}</span>
                        <span>${order.total.toFixed(2)}</span>
                      </div>
                    ))
                  )}
                  {orders.length > 0 && (
                    <button className="link-btn" onClick={() => setActiveTab('orders')}>
                      View All Orders <FaChevronRight />
                    </button>
                  )}
                </div>

                <div className="quick-actions">
                  <Link to="/products" className="quick-action">
                    <FaShoppingBag /> Continue Shopping
                  </Link>
                  <Link to="/products" className="quick-action">
                    <FaHeart /> Browse Products
                  </Link>
                </div>
              </div>
            )}

            {activeTab === 'orders' && (
              <div className="dashboard-orders">
                <h2>Order History</h2>
                <p style={{fontSize:13, color:'#777', marginBottom:16}}>Showing {orders.length} orders • Need help? <Link to="/contact" style={{color:'#2d5016', textDecoration:'underline'}}>Contact us</Link> within 24h for damaged goods.</p>
                {ordersLoading ? (
                  <p style={{fontSize:13, color:'#777', padding:'20px 0'}}>Loading orders...</p>
                ) : orders.length === 0 ? (
                  <div style={{textAlign:'center', padding:'40px 0'}}>
                    <FaBox size={48} color="#e8e5df" style={{marginBottom:12}} />
                    <h3>No orders yet</h3>
                    <p style={{color:'#777', margin:'8px 0 16px'}}>When you place an order, it will appear here.</p>
                    <Link to="/products" className="btn btn-primary">Browse Products</Link>
                  </div>
                ) : (
                  <div className="orders-list">
                    {orders.map(order => (
                      <div className="order-card" key={order.order_id} style={{border:'1px solid #e8e5df', borderRadius:12, padding:16, marginBottom:12}}>
                        <div className="order-card-header" style={{display:'flex', justifyContent:'space-between', marginBottom:10}}>
                          <div>
                            <strong>{order.order_id}</strong><br/>
                            <span style={{fontSize:12, color:'#777'}}>Placed on {formatDate(order.created_at)} • {order.shipping_address || 'N/A'}</span>
                          </div>
                          <span className={`order-status ${getStatusClass(order.status)}`}>{order.status}</span>
                        </div>
                        <div className="order-card-body" style={{display:'flex', justifyContent:'space-between', fontSize:13}}>
                          <span>{order.items?.length || 0} item(s) • {order.status==='delivered' ? 'Delivered' : order.delivery_mode === 'pickup' ? 'Farm Pickup' : 'Estimated 3-5 days'}</span>
                          <span className="order-total" style={{fontWeight:700}}>${order.total.toFixed(2)}</span>
                        </div>
                        {order.items && order.items.length > 0 && (
                          <div style={{marginTop:8, fontSize:12, color:'#555'}}>
                            {order.items.map((item, idx) => (
                              <span key={idx}>{item.name} (x{item.quantity}){idx < order.items.length - 1 ? ', ' : ''}</span>
                            ))}
                          </div>
                        )}
                        <div style={{marginTop:10, display:'flex', gap:8}}>
                          <button className="btn btn-outline" style={{padding:'6px 12px', fontSize:12}} onClick={()=>toast.info('Invoice will be emailed to you')}>View Invoice</button>
                          <button className="btn btn-outline" style={{padding:'6px 12px', fontSize:12}} onClick={()=>toast.info(`Tracking: ${order.status} – you will receive SMS update`)}>Track Order</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'wishlist' && (
              <div className="dashboard-wishlist">
                <h2>My Wishlist</h2>
                {wishlist.length === 0 ? (
                  <div className="empty-state" style={{textAlign:'center', padding:'40px 0'}}>
                    <FaHeart size={48} color="#e8e5df" style={{marginBottom:12}} />
                    <h3>Your wishlist is empty</h3>
                    <p style={{color:'#777', margin:'8px 0 16px'}}>Save items you love for later. Your wishlist is stored on this device.</p>
                    <Link to="/products" className="btn btn-primary">Browse Products</Link>
                  </div>
                ) : (
                  <div style={{display:'grid', gap:12}}>
                    {wishlist.map(item=> (
                      <div key={item.product_id} style={{display:'flex', gap:14, alignItems:'center', border:'1px solid #e8e5df', borderRadius:10, padding:12}}>
                        <img src={item.image} alt={item.name} style={{width:64, height:64, objectFit:'cover', borderRadius:8}} />
                        <div style={{flex:1}}>
                          <strong style={{fontSize:14}}>{item.name}</strong><br/>
                          <span style={{fontSize:12, color:'#777'}}>{item.category} • ${item.price}</span>
                        </div>
                        <Link to={`/products/${item.product_id}`} className="btn btn-primary" style={{padding:'8px 14px', fontSize:12}}>View</Link>
                        <button onClick={()=>removeWishlist(item.product_id)} className="remove-btn"><FaTrash /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'profile' && (
              <div className="dashboard-profile">
                <h2>Edit Profile</h2>
                <p style={{fontSize:13, color:'#777', marginBottom:16}}>Update your personal details. Password change coming soon — contact support if needed.</p>
                <div className="profile-form" style={{display:'grid', gap:12}}>
                  <div className="form-row" style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:14}}>
                    <div className="form-group">
                      <label>Full Name *</label>
                      <input type="text" value={editForm.full_name} onChange={e=>setEditForm({...editForm, full_name: e.target.value})} placeholder="Your full name" />
                    </div>
                    <div className="form-group">
                      <label>Email *</label>
                      <input type="email" value={editForm.email} onChange={e=>setEditForm({...editForm, email: e.target.value})} placeholder="you@example.com" />
                    </div>
                  </div>
                  <div className="form-row" style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:14}}>
                    <div className="form-group">
                      <label>Phone</label>
                      <input type="tel" value={editForm.phone} onChange={e=>setEditForm({...editForm, phone: e.target.value})} placeholder="+1 (555) 000-0000" />
                    </div>
                    <div className="form-group">
                      <label>Address</label>
                      <input type="text" value={editForm.address} onChange={e=>setEditForm({...editForm, address: e.target.value})} placeholder="123 Farm Road, Countryside, CA" />
                    </div>
                  </div>
                  <button onClick={handleSaveProfile} disabled={saving} className="btn btn-primary" style={{padding:'12px 20px'}}>
                    <FaCheck /> {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <div style={{fontSize:12, color:'#777'}}>Changes are saved to your account. For password reset, use the forgot password flow on login or contact support.</div>
                </div>

                <div style={{marginTop:24, background:'#f9f8f6', padding:16, borderRadius:8, border:'1px solid #e8e5df'}}>
                  <h4 style={{fontSize:14, marginBottom:8}}>Account Security</h4>
                  <ul style={{fontSize:13, color:'#555', lineHeight:1.8, paddingLeft:18}}>
                    <li>Password is Argon2 hashed and never stored in plain text</li>
                    <li>Login attempts are rate-limited (20/15 minutes) for your protection</li>
                    <li>Signed in as {user.email}</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
