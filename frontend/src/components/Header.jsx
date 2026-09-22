import { Link } from 'react-router-dom'
import { FaShoppingCart, FaCog, FaShieldAlt } from 'react-icons/fa'
import { useAuth } from '../context/AuthContext'

function Header() {
  const { user, logout, isAdmin, isSuperAdmin } = useAuth()

  return (
    <header className="header">
      <div className="container header-inner">
        <Link to="/" className="logo">
          <div className="logo-icon-wrapper">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="#2d5a27"/>
              <path d="M16 6C14 6 12 8 12 11C12 14 14 16 16 18C18 16 20 14 20 11C20 8 18 6 16 6Z" fill="#4a8c3f"/>
              <path d="M16 18C16 18 10 20 10 24C10 26 12 28 16 28C20 28 22 26 22 24C22 20 16 18 16 18Z" fill="#6ab55f"/>
              <circle cx="16" cy="12" r="2" fill="white"/>
            </svg>
          </div>
          <div className="logo-text">
            <span className="logo-name">Premium Poultry Farm</span>
            <span className="logo-subtitle">FRESH FROM FARM {user?.tenant_name ? `• ${user.tenant_name}` : ''}</span>
          </div>
        </Link>

        <nav className="main-nav">
          <Link to="/">Home</Link>
          <Link to="/products">Shop</Link>
          <Link to="/about">About Us</Link>
          <Link to="/contact">Contact</Link>
          {isAdmin && <Link to="/admin" style={{display:'inline-flex', alignItems:'center', gap:6, color:'#2d5016', fontWeight:700}}><FaCog /> Admin</Link>}
          {isSuperAdmin && <Link to="/super" style={{display:'inline-flex', alignItems:'center', gap:6, color:'#1a3009', fontWeight:700, background:'#c9a227', padding:'6px 10px', borderRadius:6, fontSize:12}}><FaShieldAlt /> Super</Link>}
        </nav>

        <div className="header-actions">
          <Link to="/products" className="btn-shop-now">Shop Now</Link>
          <Link to="/cart" className="cart-link">
            <FaShoppingCart />
          </Link>

          {user ? (
            <>
              <span style={{fontSize:12, color:'#666', display:'none'}}>{user.role}</span>
              <Link to="/dashboard" className="btn-signin">My Account</Link>
              <button onClick={logout} className="btn-signup">Logout</button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn-signin">Sign In</Link>
              <Link to="/register" className="btn-signup">Sign Up</Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

export default Header
