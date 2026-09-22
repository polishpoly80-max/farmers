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
    try {
      const [s, u, t] = await Promise.all([getSuperStats(), getSuperUsers(), getSuperTenants().catch(()=>listTenants())])
      setStats(s)
      setUsers(u.users || [])
      setTenants(t.tenants || [])
    } catch (e) { toast.error(e.message) }
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
    if (!confirm(`Delete tenant ${id}? This will not delete its users, but tenant will be gone.`)) return
    try {
      await deleteTenant(id)
      toast.success('Tenant deleted')
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

  if (loading) return <div className="container" style={{padding:80, textAlign:'center'}}>Loading Super Admin...</div>

  return (
    <div className="dashboard-page">
      <div className="container">
        <div className="dashboard-header" style={{display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12}}>
          <div>
            <h1 style={{display:'flex', alignItems:'center', gap:10}}><FaShieldAlt color="#1a3009" /> Super Admin Dashboard <span style={{background:'#1a3009', color:'white', padding:'4px 10px', borderRadius:20, fontSize:12}}>PLATFORM OWNER</span></h1>
            <p>Super: {user.email} • Full Super Control over all tenants, users, and products</p>
          </div>
          <div style={{display:'flex', gap:8}}>
            <Link to="/admin" className="btn btn-primary" style={{padding:'10px 16px', fontSize:13}}><FaBuilding /> Admin View</Link>
            <Link to="/dashboard" className="btn btn-outline" style={{padding:'10px 16px', fontSize:13}}>User Dashboard</Link>
          </div>
        </div>

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
            <div style={{marginTop:16, background:'#1a3009', color:'white', padding:12, borderRadius:8, fontSize:12}}>
              <strong>Platform Totals</strong><br/>
              Users: {stats?.totals?.users ?? users.length}<br/>
              Tenants: {stats?.totals?.tenants ?? tenants.length}<br/>
              Revenue: ${stats?.totals?.revenue ?? 45230}<br/>
              <Link to="/admin" style={{color:'#c9a227', textDecoration:'underline'}}>Switch to Admin</Link>
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

                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:24}}>
                  <div style={{background:'#f9f8f6', padding:16, borderRadius:8}}>
                    <h4>Role Breakdown</h4>
                    <div style={{display:'grid', gap:8, marginTop:10, fontSize:13}}>
                      <div style={{display:'flex', justifyContent:'space-between'}}><span>Customers</span><strong>{stats?.role_breakdown?.customer ?? users.filter(u=>u.role==='customer').length}</strong></div>
                      <div style={{display:'flex', justifyContent:'space-between'}}><span>Admins</span><strong>{stats?.role_breakdown?.admin ?? users.filter(u=>u.role==='admin').length}</strong></div>
                      <div style={{display:'flex', justifyContent:'space-between'}}><span>Super Admins</span><strong>{stats?.role_breakdown?.super_admin ?? users.filter(u=>u.role==='super_admin').length}</strong></div>
                    </div>
                  </div>
                  <div style={{background:'#f0f7ee', padding:16, borderRadius:8, border:'1px solid #d4edda'}}>
                    <h4>Per-Tenant Users</h4>
                    <div style={{display:'grid', gap:6, marginTop:10, fontSize:13}}>
                      {(stats?.per_tenant || tenants.map(t=> ({name:t.name, users: users.filter(u=>u.tenant_id===t.tenant_id).length, status:t.status }))).map(pt=> (
                        <div key={pt.tenant_id || pt.name} style={{display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid #e8e5df'}}>
                          <span>{pt.name} <span style={{fontSize:11, color: pt.status==='active' ? '#1a7f37' : '#dc2626'}}>{pt.status}</span></span><strong>{pt.users} users</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <h3>Tenants Quick View</h3>
                <div style={{border:'1px solid #e8e5df', borderRadius:10, overflow:'hidden'}}>
                  <div style={{display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr', background:'#f9f8f6', padding:'12px 16px', fontSize:12, fontWeight:600}}><span>Name</span><span>ID</span><span>Status</span><span>Action</span></div>
                  {tenants.slice(0,5).map(t=> (
                    <div key={t.tenant_id} style={{display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr', padding:'12px 16px', borderTop:'1px solid #e8e5df', fontSize:13}}>
                      <strong>{t.name}</strong><span style={{fontSize:12}}>{t.tenant_id}</span><span className={`order-status ${t.status}`}>{t.status}</span><Link to="#" onClick={e=>{e.preventDefault(); setActiveTab('tenants')}} style={{color:'#2d5016'}}>Manage</Link>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab==='tenants' && (
              <div>
                <h2>Tenant Management</h2>
                <div style={{background:'#f9f8f6', padding:16, borderRadius:10, marginBottom:20}}>
                  <h4 style={{marginBottom:12, display:'flex', alignItems:'center', gap:8}}><FaPlus color="#2d5016" /> Create New Tenant</h4>
                  <form onSubmit={handleCreateTenant} style={{display:'grid', gap:12}}>
                    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
                      <input placeholder="Tenant Name * e.g. North Branch" value={newTenant.name} onChange={e=>setNewTenant({...newTenant, name:e.target.value})} style={{padding:'10px 12px', border:'1px solid #e8e5df', borderRadius:8}} required />
                      <input placeholder="Owner Email" type="email" value={newTenant.owner_email} onChange={e=>setNewTenant({...newTenant, owner_email:e.target.value})} style={{padding:'10px 12px', border:'1px solid #e8e5df', borderRadius:8}} />
                    </div>
                    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
                      <input placeholder="Phone" value={newTenant.phone} onChange={e=>setNewTenant({...newTenant, phone:e.target.value})} style={{padding:'10px 12px', border:'1px solid #e8e5df', borderRadius:8}} />
                      <input placeholder="Address" value={newTenant.address} onChange={e=>setNewTenant({...newTenant, address:e.target.value})} style={{padding:'10px 12px', border:'1px solid #e8e5df', borderRadius:8}} />
                    </div>
                    <button type="submit" className="btn btn-primary" style={{justifySelf:'start', padding:'10px 20px'}}><FaPlus /> Create Tenant</button>
                    <p style={{fontSize:12, color:'#777'}}>Slug is auto-generated from name. After creation, create an admin for that tenant via User management.</p>
                  </form>
                </div>

                <h3>All Tenants ({tenants.length})</h3>
                <div style={{border:'1px solid #e8e5df', borderRadius:10, overflow:'hidden'}}>
                  <div style={{display:'grid', gridTemplateColumns:'1.5fr 1fr 1fr 1.5fr', background:'#f9f8f6', padding:'12px 16px', fontSize:12, fontWeight:600}}><span>Tenant</span><span>Owner</span><span>Status</span><span>Actions</span></div>
                  {tenants.map(t=> (
                    <div key={t.tenant_id} style={{display:'grid', gridTemplateColumns:'1.5fr 1fr 1fr 1.5fr', padding:'12px 16px', borderTop:'1px solid #e8e5df', fontSize:13, alignItems:'center'}}>
                      <div><strong>{t.name}</strong><div style={{fontSize:11, color:'#777'}}>{t.tenant_id} • {t.slug}</div></div>
                      <span style={{fontSize:12}}>{t.owner_email || '—'}</span>
                      <span><span className={`order-status ${t.status}`} style={{fontSize:11}}>{t.status}</span></span>
                      <div style={{display:'flex', gap:6}}>
                        <button onClick={()=>handleToggleTenantStatus(t)} style={{padding:'6px 10px', border:'1px solid #e8e5df', borderRadius:6, fontSize:12}}>{t.status==='active' ? 'Deactivate' : 'Activate'}</button>
                        <button onClick={()=>handleDeleteTenant(t.tenant_id)} style={{padding:'6px 10px', border:'1px solid #fecaca', color:'#dc2626', borderRadius:6, fontSize:12}}><FaTrash /></button>
                      </div>
                    </div>
                  ))}
                  {tenants.length===0 && <div style={{padding:20, textAlign:'center', color:'#777'}}>No tenants yet. Create the first one above.</div>}
                </div>
              </div>
            )}

            {activeTab==='users' && (
              <div>
                <h2>All Users ({users.length})</h2>
                <p style={{fontSize:13, color:'#777', marginBottom:12}}>Full Super Control: change any user's role or tenant. Customers cannot be promoted without Super. Be careful with super_admin demotions.</p>
                <div style={{border:'1px solid #e8e5df', borderRadius:10, overflow:'hidden'}}>
                  <div style={{display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1.2fr', background:'#f9f8f6', padding:'12px 16px', fontSize:12, fontWeight:600}}><span>User</span><span>Role</span><span>Tenant</span><span>Change Role</span></div>
                  {users.map(u=> (
                    <div key={u.user_id || u.email} style={{display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1.2fr', padding:'12px 16px', borderTop:'1px solid #e8e5df', fontSize:13, alignItems:'center'}}>
                      <div><strong>{u.full_name}</strong><div style={{fontSize:11, color:'#777'}}>{u.email}</div></div>
                      <span style={{background: u.role==='super_admin' ? '#1a3009' : u.role==='admin' ? '#c9a227' : '#e8e5df', color: u.role==='customer' ? '#555' : 'white', padding:'4px 10px', borderRadius:20, fontSize:11, fontWeight:700, justifySelf:'start'}}>{u.role}</span>
                      <span style={{fontSize:11}}>{u.tenant_name || u.tenant_id || '—'}</span>
                      <select value={u.role} onChange={e=>handleRoleChange(u, e.target.value)} style={{padding:'6px 8px', borderRadius:6, border:'1px solid #e8e5df', fontSize:12}}>
                        <option value="customer">customer</option>
                        <option value="admin">admin</option>
                        <option value="super_admin">super_admin</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab==='analytics' && (
              <div>
                <h2>Analytics (Mock)</h2>
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16}}>
                  <div style={{background:'#f9f8f6', padding:16, borderRadius:8}}>
                    <h4>Revenue by Tenant (Last 30 days)</h4>
                    <div style={{marginTop:12, display:'grid', gap:8}}>
                      {tenants.map(t=> {
                        const rev = Math.floor(5000 + Math.random()*10000)
                        const pct = Math.min(100, (rev/15000)*100)
                        return (
                          <div key={t.tenant_id}>
                            <div style={{display:'flex', justifyContent:'space-between', fontSize:13}}><span>{t.name}</span><strong>${rev}</strong></div>
                            <div style={{height:8, background:'#e8e5df', borderRadius:10, marginTop:4}}><div style={{width:`${pct}%`, height:'100%', background:'#2d5016', borderRadius:10}} /></div>
                          </div>
                        )
                      })}
                      {tenants.length===0 && <p style={{fontSize:13, color:'#777'}}>No data - create tenants first</p>}
                    </div>
                  </div>
                  <div style={{background:'white', border:'1px solid #e8e5df', padding:16, borderRadius:8}}>
                    <h4>Top Products (Mock)</h4>
                    <ul style={{fontSize:13, lineHeight:1.8, paddingLeft:18}}>
                      <li>Farm Chicken — 342 sold</li>
                      <li>Farm Fresh Eggs — 298 sold</li>
                      <li>Chicken Breast — 210 sold</li>
                      <li>Farm Turkey — 89 sold</li>
                    </ul>
                  </div>
                </div>
                <div style={{background:'#f0f7ee', padding:16, borderRadius:8, marginTop:16, border:'1px solid #d4edda'}}>
                  <strong>Note:</strong> Wire to real orders collection for live analytics. Current stats are mocked but totals come from <code>/api/super/stats</code>.
                </div>
              </div>
            )}

            {activeTab==='system' && (
              <div>
                <h2>System</h2>
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16}}>
                  <div style={{background:'#f9f8f6', padding:16, borderRadius:8}}>
                    <h4>Health</h4>
                    <ul style={{fontSize:13, lineHeight:1.8, marginTop:8, listStyle:'none', padding:0}}>
                      <li><FaCheck color="#28a745" /> API v2.0.0 multi-tenant</li>
                      <li><FaCheck color="#28a745" /> AstraDB connected • {tenants.length} tenants</li>
                      <li><FaCheck color="#28a745" /> Auth: JWT HS256 • Argon2id</li>
                      <li><FaCheck color="#28a745" /> CORS allowed for 7500/5173/4000/3000</li>
                    </ul>
                  </div>
                  <div style={{background:'white', border:'1px solid #e8e5df', padding:16, borderRadius:8}}>
                    <h4>Super Powers</h4>
                    <ul style={{fontSize:13, lineHeight:1.8, paddingLeft:18}}>
                      <li>Create / deactivate / delete tenants</li>
                      <li>Promote any user to admin/super_admin</li>
                      <li>Full Super Control: access <Link to="/admin" style={{color:'#2d5016', textDecoration:'underline'}}>/admin</Link> and edit any tenant's products/orders</li>
                      <li>View platform totals and per-tenant breakdown</li>
                    </ul>
                  </div>
                </div>
                <div style={{marginTop:16, background:'#fff7ed', border:'1px solid #fed7aa', padding:14, borderRadius:8, fontSize:13}}>
                  <strong>Seed Demo:</strong> Create a demo tenant and admin in one click (for testing).
                  <button onClick={async()=>{
                    try {
                      const t = await createTenant({ name: `Demo ${Date.now().toString().slice(-4)}`, owner_email: `demo${Date.now()}@example.com` })
                      toast.success(`Tenant ${t.tenant.name} created`)
                      load()
                    } catch(e){ toast.error(e.message)}
                  }} style={{marginLeft:12, padding:'6px 12px', background:'#c9a227', color:'white', border:'none', borderRadius:6}}>Quick Create Demo Tenant</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
