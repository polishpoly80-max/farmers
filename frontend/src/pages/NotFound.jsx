import { Link } from 'react-router-dom'
import { FaHome, FaShoppingBag, FaPhone, FaSearch } from 'react-icons/fa'

function NotFound() {
  return (
    <div className="not-found-page">
      <div className="container">
        <div className="not-found-content" style={{textAlign:'center', padding:'80px 0'}}>
          <span className="not-found-number" style={{fontSize:96, fontWeight:800, color:'#e8e5df', display:'block'}}>404</span>
          <h1 style={{margin:'12px 0 8px'}}>Page Not Found</h1>
          <p style={{color:'#777', maxWidth:480, margin:'0 auto 24px', lineHeight:1.6}}>Oops! The page you're looking for doesn't exist, has been moved, or you mistyped the address. Try our most visited pages below.</p>
          <div className="not-found-actions" style={{display:'flex', gap:12, justifyContent:'center', marginBottom:32}}>
            <Link to="/" className="btn btn-primary">
              <FaHome /> Go Home
            </Link>
            <Link to="/products" className="btn btn-outline">
              <FaShoppingBag /> Browse Products
            </Link>
          </div>
          <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:16, maxWidth:700, margin:'0 auto', textAlign:'left'}}>
            {[
              { icon: FaShoppingBag, title:'Shop', desc:'Browse 12 fresh poultry products', link:'/products', label:'View Shop' },
              { icon: FaSearch, title:'About', desc:'Learn about our farm since 1985', link:'/about', label:'Our Story' },
              { icon: FaPhone, title:'Contact', desc:'Need help? We reply within 4 hours', link:'/contact', label:'Contact Us' },
            ].map(c=> (
              <Link key={c.title} to={c.link} style={{background:'white', border:'1px solid #e8e5df', borderRadius:12, padding:20, display:'block'}}>
                <c.icon color="#2d5016" style={{marginBottom:8}} />
                <h4 style={{fontSize:15, marginBottom:4}}>{c.title}</h4>
                <p style={{fontSize:12, color:'#777', marginBottom:8}}>{c.desc}</p>
                <span style={{fontSize:12, color:'#2d5016', fontWeight:600}}>{c.label} →</span>
              </Link>
            ))}
          </div>
          <p style={{fontSize:12, color:'#999', marginTop:24}}>Error code: 404 • If you believe this is a mistake, <Link to="/contact" style={{color:'#2d5016', textDecoration:'underline'}}>contact support</Link>.</p>
        </div>
      </div>
    </div>
  )
}

export default NotFound
