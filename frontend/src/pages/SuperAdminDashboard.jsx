import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { FaBuilding, FaUsers, FaMoneyBillWave, FaBox, FaPlus, FaTrash, FaEdit, FaChartLine, FaShieldAlt, FaCheck, FaEye } from 'react-icons/fa'
import { toast } from 'react-toastify'
import { getSuperStats, getSuperUsers, getSuperTenants, listTenants, createTenant, updateTenant, deleteTenant, updateUserRole } from '../services/api'
import { useAuth } from '../context/AuthContext'

export default function SuperAdminDashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState(null)
  const [users, setUsers] = useState([])
  const [tenants, setTenants] = useState([])
  const [activeTab, setActiveTab] = useState('overview')
  const [newTenant, setNewTenant] = useState({ name: '', owner_email: '', phone: '', address: '' })
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const [statsResult, usersResult, tenantsResult] = await Promise.allSettled([
      getSuperStats(),
      getSuperUsers(),
      getSuperTenants().catch(() => listTenants()),
    ])

    if (statsResult.status === 'fulfilled') setStats(statsResult.value)
    else toast.error(`Stats unavailable: ${statsResult.reason?.message || 'backend error'}`)

    if (usersResult.status === 'fulfilled') setUsers(usersResult.value.users || [])
    else toast.error(`Users unavailable: ${usersResult.reason?.message || 'backend error'}`)

    if (tenantsResult.status === 'fulfilled') setTenants(tenantsResult.value.tenants || [])
    else toast.error(`Tenants unavailable: ${tenantsResult.reason?.message || 'backend error'}`)

    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleCreateTenant = async (e) => {
    e.preventDefault()
    if (!newTenant.name.trim()) { toast.error('Tenant name required'); return }
    try {
      await createTenant({ name: newTenant.name, owner_email: newTenant.owner_email, phone: newTenant.phone, address: newTenant.address })
      toast.success('Tenant created')
      setNewTenant({ name: '', owner_email: '', phone: '', address: '' })
      load()
    } catch (err) { toast.error(err.message) }
  }

  const handleDeleteTenant = async (id) => {
    if (!confirm(`Delete branch ${id}? Its inventory, orders, notifications, and push subscriptions will also be removed. User accounts will be kept.`)) return
    try {
      const result = await deleteTenant(id, true)
      toast.success(`${result.message || 'Branch deleted'}${result.cleanup ? ' — operational data cleaned up' : ''}`)
      load()
    } catch (err) { toast.error(err.message) }
  }

  const handleToggleTenantStatus = async (t) => {
    const newStatus = t.status === 'active' ? 'inactive' : 'active'
    try {
      await updateTenant(t.tenant_id, { status: newStatus })
      toast.success(`Tenant ${t.name} ${newStatus}`)
      load()
    } catch (err) { toast.error(err.message) }
  }

  const handleRoleChange = async (u, newRole) => {
    if (!confirm(`Change ${u.email} to ${newRole}?`)) return
    try {
      await updateUserRole(u.user_id || u.email, { role: newRole, tenant_id: u.tenant_id })
      toast.success('Role updated')
      load()
    } catch (err) { toast.error(err.message) }
  }

  if (loading) return <div className="container super-loading">Loading Super Admin...</div>

  return (
    <div className="dashboard-page">
      <div className="container">
        <header className="super-dashboard-header">
          <div>
            <span className="super-role-badge"><FaShieldAlt /> Platform owner</span>
            <h1>Super Admin Dashboard</h1>
            <p>Full platform control across tenants, users, analytics, and system health.</p>
          </div>
          <div className="super-header-actions">
            <Link to="/admin" className="btn btn-primary"><FaBuilding /> Admin view</Link>
            <Link to="/dashboard" className="btn btn-outline">User dashboard</Link>
          </div>
        </header>

        <div className="dashboard-layout">
          <div className="dashboard-sidebar">
            <nav className="sidebar-nav">
              {[
                { id:'overview', label:'Platform Overview', icon:FaChartLine },
                { id:'tenants', label:`Tenants (${tenants.length})`, icon:FaBuilding },
                { id:'users', label:`All Users (${users.length})`, icon:FaUsers },
                { id:'analytics', label:'Analytics', icon:FaMoneyBillWave },
                { id:'system', label:'System', icon:FaShieldAlt },
              ].map(item=> (
                <button key={item.id} className={activeTab===item.id ? 'active' : ''} onClick={()=>setActiveTab(item.id)}>
                  <item.icon /> {item.label}
                </button>
              ))}
            </nav>
            <div className="super-platform-card">
              <strong>Platform totals</strong>
              <span>Users <b>{stats?.totals?.users ?? users.length}</b></span>
              <span>Tenants <b>{stats?.totals?.tenants ?? tenants.length}</b></span>
              <span>Revenue <b>${stats?.totals?.revenue ?? 45230}</b></span>
              <Link to="/admin">Switch to Admin <FaChartLine /></Link>
            </div>
          </div>

          <div className="dashboard-content">
            {activeTab==='overview' && (
              <div>
                <h2>Platform Overview</h2>
                <div className="overview-stats">
                  <div className="overview-stat"><FaBuilding /><div><span className="stat-value">{stats?.totals?.tenants ?? tenants.length}</span><span className="stat-label">Tenants</span></div></div>
                  <div className="overview-stat"><FaUsers /><div><span className="stat-value">{stats?.totals?.users ?? users.length}</span><span className="stat-label">Total Users</span></div></div>
                  <div className="overview-stat"><FaMoneyBillWave /><div><span className="stat-value">${stats?.totals?.revenue ?? 45230}</span><span className="stat-label">Revenue (mock)</span></div></div>
                  <div className="overview-stat"><FaBox /><div><span className="stat-value">{stats?.totals?.products ?? tenants.length*12}</span><span className="stat-label">Products</span></div></div>
                </div>

                <div className="super-overview-grid">
                  <section className="super-insight-card">
                    <h3>Role breakdown</h3>
                    <div className="super-role-list">
                      <div><span>Customers</span><strong>{stats?.role_breakdown?.customer ?? users.filter(u => u.role === 'customer').length}</strong></div>
                      <div><span>Branch admins</span><strong>{stats?.role_breakdown?.admin ?? users.filter(u => u.role === 'admin').length}</strong></div>
                      <div><span>Workers</span><strong>{stats?.role_breakdown?.worker ?? users.filter(u => u.role === 'worker').length}</strong></div>
                      <div><span>Super admins</span><strong>{stats?.role_breakdown?.super_admin ?? users.filter(u => u.role === 'super_admin').length}</strong></div>
                    </div>
                  </section>
                  <section className="super-insight-card super-tenant-insight">
                    <h3>Users by tenant</h3>
                    <div className="super-tenant-list">
                      {(stats?.per_tenant || tenants.map(t => ({ name: t.name, users: users.filter(u => u.tenant_id === t.tenant_id).length, status: t.status }))).map(pt => (
                        <div key={pt.tenant_id || pt.name}>
                          <span>{pt.name} <small className={pt.status === 'active' ? 'text-success' : 'text-danger'}>{pt.status}</small></span>
                          <strong>{pt.users} users</strong>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>

                <h3>Tenants quick view</h3>
                <div className="super-table-wrap">
                  <div className="super-table super-quick-table">
                    <div className="super-table-row super-table-head"><span>Name</span><span>ID</span><span>Status</span><span>Action</span></div>
                    {tenants.slice(0, 5).map(t => (
                      <div className="super-table-row" key={t.tenant_id}>
                        <strong>{t.name}</strong>
                        <span>{t.tenant_id}</span>
                        <span className={`order-status ${t.status}`}>{t.status}</span>
                        <Link to="#" onClick={e => { e.preventDefault(); setActiveTab('tenants') }}>Manage</Link>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab==='tenants' && (
              <div>
                <h2>Tenant Management</h2>
                <div className="super-create-card">
                  <h3><FaPlus /> Create new tenant</h3>
                  <form onSubmit={handleCreateTenant} className="super-tenant-form">
                    <div className="super-form-grid">
                      <input placeholder="Tenant Name * e.g. North Branch" value={newTenant.name} onChange={e => setNewTenant({ ...newTenant, name: e.target.value })} required />
                      <input placeholder="Owner Email" type="email" value={newTenant.owner_email} onChange={e => setNewTenant({ ...newTenant, owner_email: e.target.value })} />
                    </div>
                    <div className="super-form-grid">
                      <input placeholder="Phone" value={newTenant.phone} onChange={e => setNewTenant({ ...newTenant, phone: e.target.value })} />
                      <input placeholder="Address" value={newTenant.address} onChange={e => setNewTenant({ ...newTenant, address: e.target.value })} />
                    </div>
                    <button type="submit" className="btn btn-primary"><FaPlus /> Create tenant</button>
                    <p>Slug is auto-generated from the name. Create an admin for the tenant afterward in User management.</p>
                  </form>
                </div>

                <h3>All tenants ({tenants.length})</h3>
                <div className="super-table-wrap">
                  <div className="super-table super-tenant-table">
                    <div className="super-table-row super-table-head"><span>Tenant</span><span>Owner</span><span>Status</span><span>Actions</span></div>
                    {tenants.map(t => (
                      <div className="super-table-row" key={t.tenant_id}>
                        <div><strong>{t.name}</strong><small>{t.tenant_id} • {t.slug}</small></div>
                        <span>{t.owner_email || '—'}</span>
                        <span><span className={`order-status ${t.status}`}>{t.status}</span></span>
                        <div className="super-row-actions">
                          <button onClick={() => handleToggleTenantStatus(t)}>{t.status === 'active' ? 'Deactivate' : 'Activate'}</button>
                          <button className="danger" onClick={() => handleDeleteTenant(t.tenant_id)} aria-label={`Delete ${t.name}`}><FaTrash /></button>
                        </div>
                      </div>
                    ))}
                    {tenants.length === 0 && <div className="super-empty-row">No tenants yet. Create the first one above.</div>}
                  </div>
                </div>
              </div>
            )}

            {activeTab==='users' && (
              <div>
                <h2>All users ({users.length})</h2>
                <p className="super-section-note">Full Super Control: assign customers to workers, appoint branch admins, or grant platform access. Branch admins can also promote customers to workers inside their own branch.</p>
                <div className="super-table-wrap">
                  <div className="super-table super-users-table">
                    <div className="super-table-row super-table-head"><span>User</span><span>Role</span><span>Tenant</span><span>Change role</span></div>
                    {users.map(u => (
                      <div className="super-table-row" key={u.user_id || u.email}>
                        <div><strong>{u.full_name}</strong><small>{u.email}</small></div>
                        <span className={`super-role-badge ${u.role}`}>{u.role}</span>
                        <span>{u.tenant_name || u.tenant_id || '—'}</span>
                        <select value={u.role} onChange={e => handleRoleChange(u, e.target.value)}>
                          <option value="customer">customer</option>
                          <option value="worker">worker</option>
                          <option value="admin">branch admin</option>
                          <option value="super_admin">super admin</option>
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab==='analytics' && (
              <div>
                <h2>Analytics (mock)</h2>
                <div className="super-analytics-grid">
                  <section className="super-analytics-card">
                    <h3>Revenue by tenant <small>Last 30 days</small></h3>
                    <div className="super-revenue-list">
                      {tenants.map(t => {
                        const rev = Math.floor(5000 + Math.random() * 10000)
                        const pct = Math.min(100, (rev / 15000) * 100)
                        return (
                          <div key={t.tenant_id}>
                            <div><span>{t.name}</span><strong>${rev}</strong></div>
                            <div className="super-revenue-track"><span style={{ width: `${pct}%` }} /></div>
                          </div>
                        )
                      })}
                      {tenants.length === 0 && <p>No data — create tenants first.</p>}
                    </div>
                  </section>
                  <section className="super-analytics-card">
                    <h3>Top products <small>Mock data</small></h3>
                    <ul className="super-product-list">
                      <li><span>Farm Chicken</span><strong>342 sold</strong></li>
                      <li><span>Farm Fresh Eggs</span><strong>298 sold</strong></li>
                      <li><span>Chicken Breast</span><strong>210 sold</strong></li>
                      <li><span>Farm Turkey</span><strong>89 sold</strong></li>
                    </ul>
                  </section>
                </div>
                <div className="super-info-note"><strong>Note:</strong> Wire this view to real orders for live analytics. Current totals come from <code>/api/super/stats</code>.</div>
              </div>
            )}

            {activeTab==='system' && (
              <div>
                <h2>System</h2>
                <div className="super-system-grid">
                  <section className="super-system-card">
                    <h3>Platform health</h3>
                    <ul className="super-health-list">
                      <li><FaCheck /> API v2.0.0 multi-tenant</li>
                      <li><FaCheck /> AstraDB connected • {tenants.length} tenants</li>
                      <li><FaCheck /> Auth: JWT HS256 • Argon2id</li>
                      <li><FaCheck /> CORS configured for local development</li>
                    </ul>
                  </section>
                  <section className="super-system-card">
                    <h3>Super powers</h3>
                    <ul className="super-power-list">
                      <li>Create, deactivate, or delete tenants</li>
                      <li>Promote users to worker, branch admin, or super admin</li>
                      <li>Access <Link to="/admin">/admin</Link> and manage tenant data</li>
                      <li>View platform totals and tenant breakdowns</li>
                    </ul>
                  </section>
                </div>
                <div className="super-demo-card">
                  <div><strong>Seed demo</strong><p>Create a demo tenant in one click for testing.</p></div>
                  <button onClick={async () => {
                    try {
                      const t = await createTenant({ name: `Demo ${Date.now().toString().slice(-4)}`, owner_email: `demo${Date.now()}@example.com` })
                      toast.success(`Tenant ${t.tenant.name} created`)
                      load()
                    } catch (e) { toast.error(e.message) }
                  }} className="btn btn-primary btn-small">Quick create demo tenant</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
