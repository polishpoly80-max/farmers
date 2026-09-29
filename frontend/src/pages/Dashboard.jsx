import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { useNavigate, Link } from 'react-router-dom'
import { FaUser, FaEnvelope, FaPhone, FaMapMarkerAlt, FaSignOutAlt, FaShoppingBag, FaBox, FaChevronRight, FaTrash, FaEdit, FaCheck, FaTruck, FaBell, FaBellSlash, FaComments } from 'react-icons/fa'
import { toast } from 'react-toastify'
import { getOrders } from '../services/api'
import { getPushStatus, enablePushNotifications, disablePushNotifications, sendTestPushNotification } from '../services/push'

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
  const [pushStatus, setPushStatus] = useState({ supported: false, permission: 'default', subscribed: false, loading: true })
  const [pushBusy, setPushBusy] = useState(false)

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

  useEffect(() => {
    getPushStatus()
      .then(status => setPushStatus({ ...status, loading: false }))
      .catch(() => setPushStatus({ supported: false, permission: 'unsupported', subscribed: false, loading: false }))
  }, [])

  const handlePushToggle = async () => {
    setPushBusy(true)
    try {
      if (pushStatus.subscribed) {
        await disablePushNotifications()
        setPushStatus(previous => ({ ...previous, subscribed: false }))
        toast.success('Push notifications disabled')
      } else {
        await enablePushNotifications()
        setPushStatus(previous => ({ ...previous, subscribed: true, permission: 'granted' }))
        toast.success('Push notifications enabled')
      }
    } catch (error) {
      toast.error(error.message || 'Unable to update push notifications')
    } finally {
      setPushBusy(false)
    }
  }

  const handleTestPush = async () => {
    setPushBusy(true)
    try {
      const result = await sendTestPushNotification()
      toast.success(result.sent ? 'Test notification sent' : 'No active push subscription found')
    } catch (error) {
      toast.error(error.message || 'Unable to send test notification')
    } finally {
      setPushBusy(false)
    }
  }

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
        <header className="dashboard-header">
          <div>
            <span className="dashboard-eyebrow"><FaUser /> Account center</span>
            <h1>Welcome, {(user.full_name || user.email || 'there').split(' ')[0]}</h1>
            <p>Manage your orders, saved items, profile, and delivery details.</p>
          </div>
          <Link to="/products" className="btn btn-primary dashboard-shop-button">
            <FaShoppingBag /> Shop fresh products
          </Link>
        </header>

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

            <div className="sidebar-help">
              <strong>Need help?</strong>
              <span><FaEnvelope /> info@premiumpoultry.com</span>
              <span><FaPhone /> +1 (555) 123-4567</span>
              <Link to="/contact">Contact support <FaChevronRight /></Link>
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

                <div className="account-summary-grid">
                  <section className="account-summary-card">
                    <h3 className="account-card-title"><span className="account-card-icon"><FaUser /></span> Profile</h3>
                    <div className="account-details">
                      <span><FaEnvelope />{user.email}</span>
                      <span><FaPhone />{user.phone || 'Not set'}</span>
                      <span><FaMapMarkerAlt />{user.address || 'Not set'}</span>
                    </div>
                    <button className="account-text-button" onClick={() => setActiveTab('profile')}>
                      Edit profile <FaChevronRight />
                    </button>
                  </section>

                  <section className="account-summary-card account-delivery-card">
                    <h3 className="account-card-title"><span className="account-card-icon"><FaTruck /></span> Delivery information</h3>
                    <p>Free shipping over $50. Same-day dispatch before 2PM within a 50-mile radius.</p>
                    <div className="account-card-actions">
                      <Link to="/products" className="btn btn-primary btn-small">Shop now</Link>
                      <Link to="/contact" className="account-text-button">Ask a question <FaChevronRight /></Link>
                    </div>
                  </section>
                </div>

                <section className="push-notification-card">
                  <div className="push-notification-icon"><FaBell /></div>
                  <div className="push-notification-copy">
                    <h3>Order updates on your phone</h3>
                    <p>Get a push notification when your order is received and its status changes.</p>
                    {!pushStatus.supported && <small>Push notifications are not supported in this browser.</small>}
                    {pushStatus.supported && pushStatus.permission === 'denied' && <small>Notifications are blocked in your browser settings.</small>}
                  </div>
                  <div className="push-notification-actions">
                    <button className={`btn ${pushStatus.subscribed ? 'btn-outline' : 'btn-primary'} btn-small`} onClick={handlePushToggle} disabled={pushBusy || !pushStatus.supported || pushStatus.permission === 'denied'}>
                      {pushStatus.subscribed ? <><FaBellSlash /> Disable</> : <><FaBell /> Enable</>}
                    </button>
                    {pushStatus.subscribed && <button className="account-text-button push-test-button" onClick={handleTestPush} disabled={pushBusy}>Send test</button>}
                  </div>
                </section>

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
                  <Link to="/care-chat" className="quick-action">
                    <FaComments /> Get Help
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
                  <div className="empty-state">
                    <FaBox />
                    <h3>No orders yet</h3>
                    <p>When you place an order, its status, delivery details, and invoice will appear here.</p>
                    <Link to="/products" className="btn btn-primary">Browse products</Link>
                  </div>
                ) : (
                  <div className="orders-list">
                    {orders.map(order => (
                      <article className="order-card" key={order.order_id}>
                        <div className="order-card-header">
                          <div>
                            <strong>{order.order_id}</strong>
                            <span>Placed on {formatDate(order.created_at)} • {order.shipping_address || 'Delivery address not provided'}</span>
                          </div>
                          <span className={`order-status ${getStatusClass(order.status)}`}>{order.status}</span>
                        </div>
                        <div className="order-card-body">
                          <span>{order.items?.length || 0} item(s) • {order.status === 'delivered' ? 'Delivered' : order.delivery_mode === 'pickup' ? 'Farm Pickup' : 'Estimated 3–5 days'}</span>
                          <span className="order-total">${order.total.toFixed(2)}</span>
                        </div>
                        {order.items && order.items.length > 0 && (
                          <p className="order-card-products">
                            {order.items.map((item, index) => (
                              <span key={index}>{item.name} (×{item.quantity}){index < order.items.length - 1 ? ', ' : ''}</span>
                            ))}
                          </p>
                        )}
                        <div className="order-card-actions">
                          <button className="btn btn-outline btn-small" onClick={() => toast.info('Invoice will be emailed to you')}>View invoice</button>
                          <button className="btn btn-outline btn-small" onClick={() => toast.info(`Tracking: ${order.status} — you will receive an SMS update`)}>Track order</button>
                        </div>
                      </article>
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
                  <div className="wishlist-list">
                    {wishlist.map(item => (
                      <article className="wishlist-item" key={item.product_id}>
                        <Link to={`/products/${item.product_id}`} className="wishlist-image">
                          <img src={item.image} alt={item.name} />
                        </Link>
                        <div className="wishlist-details">
                          <strong>{item.name}</strong>
                          <span>{item.category} • ${item.price}</span>
                        </div>
                        <div className="wishlist-actions">
                          <Link to={`/products/${item.product_id}`} className="btn btn-primary btn-small">View</Link>
                          <button onClick={() => removeWishlist(item.product_id)} className="remove-btn" aria-label={`Remove ${item.name} from wishlist`}><FaTrash /></button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'profile' && (
              <div className="dashboard-profile">
                <h2>Edit Profile</h2>
                <p style={{fontSize:13, color:'#777', marginBottom:16}}>Update your personal details. Password change coming soon — contact support if needed.</p>
                <div className="profile-form">
                  <div className="form-row">
                    <div className="form-group">
                      <label>Full Name *</label>
                      <input type="text" value={editForm.full_name} onChange={e => setEditForm({ ...editForm, full_name: e.target.value })} placeholder="Your full name" />
                    </div>
                    <div className="form-group">
                      <label>Email *</label>
                      <input type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} placeholder="you@example.com" />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Phone</label>
                      <input type="tel" value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} placeholder="+1 (555) 000-0000" />
                    </div>
                    <div className="form-group">
                      <label>Address</label>
                      <input type="text" value={editForm.address} onChange={e => setEditForm({ ...editForm, address: e.target.value })} placeholder="123 Farm Road, Countryside, CA" />
                    </div>
                  </div>
                  <div className="profile-form-footer">
                    <button onClick={handleSaveProfile} disabled={saving} className="btn btn-primary">
                      <FaCheck /> {saving ? 'Saving...' : 'Save changes'}
                    </button>
                    <p>Your details are only used for order updates and delivery.</p>
                  </div>
                </div>

                <section className="account-security">
                  <h3>Account security</h3>
                  <ul>
                    <li><FaCheck /> Passwords are securely hashed and never stored as plain text.</li>
                    <li><FaCheck /> Repeated failed sign-in attempts are automatically rate-limited.</li>
                    <li><FaCheck /> You are currently signed in as {user.email}.</li>
                  </ul>
                </section>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
