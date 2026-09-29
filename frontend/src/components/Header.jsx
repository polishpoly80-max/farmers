import { Link, useLocation } from 'react-router-dom'
import { FaShoppingCart, FaCog, FaShieldAlt, FaComments } from 'react-icons/fa'
import { useAuth } from '../context/AuthContext'
import { useState, useEffect } from 'react'
import BranchSelector from './BranchSelector'
import NotificationBell from './NotificationBell'

function Header() {
  const { user, logout, isSuperAdmin, isBranchStaff } = useAuth()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location])

  const toggleMobileMenu = () => setMobileMenuOpen(!mobileMenuOpen)

  return (
    <header className={`header ${scrolled ? 'scrolled' : ''}`}>
      <div className="header-inner">
        <Link to="/" className="logo" aria-label="Premium Poultry Farm - Home">
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

        {/* Mobile menu toggle - animated hamburger morph */}
        <button 
          className={`mobile-menu-toggle ${mobileMenuOpen ? 'is-open' : ''}`} 
          onClick={toggleMobileMenu}
          aria-expanded={mobileMenuOpen}
          aria-controls="main-nav"
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
        >
          <span className="hamburger" aria-hidden="true">
            <span></span>
            <span></span>
            <span></span>
          </span>
        </button>

        {/* Main Navigation - Desktop: inline, Mobile: collapsible */}
        <nav 
          id="main-nav" 
          className={`main-nav ${mobileMenuOpen ? 'mobile-open' : ''}`}
          role="navigation"
          aria-label="Main navigation"
        >
          <Link to="/" className={location.pathname === '/' ? 'active' : ''} onClick={() => setMobileMenuOpen(false)}>Home</Link>
          <Link to="/products" className={location.pathname.startsWith('/products') ? 'active' : ''} onClick={() => setMobileMenuOpen(false)}>Shop</Link>
          <Link to="/about" className={location.pathname === '/about' ? 'active' : ''} onClick={() => setMobileMenuOpen(false)}>About Us</Link>
          <Link to="/contact" className={location.pathname === '/contact' ? 'active' : ''} onClick={() => setMobileMenuOpen(false)}>Contact</Link>
          {isBranchStaff && <Link to="/admin" className={location.pathname === '/admin' ? 'active' : ''} onClick={() => setMobileMenuOpen(false)} style={{display:'inline-flex', alignItems:'center', gap:6, color:'#2d5016', fontWeight:700}}><FaCog /> {user?.role === 'worker' ? 'Worker' : 'Admin'}</Link>}
           {user && <Link to="/care-chat" className={location.pathname === '/care-chat' ? 'active' : ''} onClick={() => setMobileMenuOpen(false)} style={{display:'inline-flex', alignItems:'center', gap:6, color:'#2d5016', fontWeight:700}}><FaComments /> Live Care</Link>}
          {isSuperAdmin && <Link to="/super" className={location.pathname === '/super' ? 'active' : ''} onClick={() => setMobileMenuOpen(false)} style={{display:'inline-flex', alignItems:'center', gap:6, color:'#1a3009', fontWeight:700, background:'#c9a227', padding:'6px 10px', borderRadius:6, fontSize:12}}><FaShieldAlt /> Super</Link>}

          {/* Branch picker for mobile, where the header slot is hidden */}
          <div className="mobile-nav-branch">
            <BranchSelector />
          </div>
        </nav>

        {/* Mobile backdrop - always rendered, controlled by CSS */}
        <div className={`mobile-nav-backdrop ${mobileMenuOpen ? 'active' : ''}`} onClick={() => setMobileMenuOpen(false)} aria-hidden="true" />

        <div className="header-actions">
          <Link to="/products" className="btn-shop-now">Shop Now</Link>

          <div className="header-branch-slot">
            <BranchSelector compact />
          </div>

          <Link to="/cart" className="cart-link" aria-label="Shopping Cart">
            <FaShoppingCart />
          </Link>

          {user && <NotificationBell />}

          {user ? (
            <>
              <span style={{fontSize:12, color:'#666', display:'none'}}>{user.role}</span>
              <Link to="/dashboard" className="btn-signin" onClick={() => setMobileMenuOpen(false)}>My Account</Link>
              <button
                className="btn-signup"
                onClick={() => {
                  setMobileMenuOpen(false)
                  logout()
                }}
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn-signin" onClick={() => setMobileMenuOpen(false)}>Sign In</Link>
              <Link to="/register" className="btn-signup" onClick={() => setMobileMenuOpen(false)}>Sign Up</Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

export default Header
