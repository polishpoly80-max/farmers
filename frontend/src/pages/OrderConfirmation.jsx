import { useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { FaCheckCircle, FaHome, FaShoppingBag, FaTruck, FaEnvelope, FaPhone, FaBox } from 'react-icons/fa'

function OrderConfirmation() {
  const location = useLocation()
  const orderId = location.state?.orderId
  const orderNumber = useMemo(() => orderId || ('ORD-' + Math.random().toString(36).substr(2, 9).toUpperCase()), [orderId])
  const deliveryDate = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate()+3)
    return d.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' })
  }, [])
  const total = location.state?.total
  const deliveryMode = location.state?.deliveryMode || 'delivery'

  return (
    <div className="confirmation-page">
      <div className="container">
        <div className="confirmation-card" style={{maxWidth:600}}>
          <div className="confirmation-icon">
            <FaCheckCircle />
          </div>
          <h1>Order Confirmed!</h1>
          <p className="confirmation-subtitle">Thank you for shopping with Premium Poultry Farm — your order is being processed.</p>

          <div className="order-details-box">
            <div className="order-detail-row">
              <span>Order Number</span>
              <strong>{orderNumber}</strong>
            </div>
            <div className="order-detail-row">
              <span>Status</span>
              <span className="status-badge" style={{background:'#d4edda', color:'#1a7f37'}}>Processing</span>
            </div>
            <div className="order-detail-row">
              <span>Delivery Method</span>
              <strong>{deliveryMode === 'pickup' ? 'Farm Pickup (Sat 9AM-1PM)' : 'Home Delivery'}</strong>
            </div>
            <div className="order-detail-row">
              <span>Estimated Delivery</span>
              <strong>{deliveryDate} (3-5 business days)</strong>
            </div>
            {total !== undefined && (
              <div className="order-detail-row">
                <span>Total Paid</span>
                <strong>${total.toFixed(2)}</strong>
              </div>
            )}
          </div>

          <div style={{background:'#f9f8f6', borderRadius:12, padding:16, textAlign:'left', marginBottom:20}}>
            <h3 style={{fontSize:15, marginBottom:10, display:'flex', alignItems:'center', gap:8}}><FaBox color="#2d5016" /> What happens next?</h3>
            <ol style={{fontSize:13, color:'#555', lineHeight:1.8, paddingLeft:18}}>
              <li><strong>Confirmation email sent</strong> — check your inbox (and spam folder) for order details and invoice.</li>
              <li><strong>We pack fresh</strong> — your poultry is prepared and packed cold-chain within 24 hours.</li>
              <li><strong>Out for delivery</strong> — you'll receive an SMS/email with tracking and delivery window.</li>
              <li><strong>Need help?</strong> — Contact us at <a href="mailto:orders@premiumpoultry.com" style={{color:'#2d5016'}}>orders@premiumpoultry.com</a> or <a href="tel:+15551234567" style={{color:'#2d5016'}}>+1 (555) 123-4567</a></li>
            </ol>
          </div>

          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, fontSize:12, color:'#666', marginBottom:20}}>
            <div style={{background:'white', border:'1px solid #e8e5df', borderRadius:10, padding:14, display:'flex', gap:10, alignItems:'center'}}>
              <FaEnvelope color="#2d5016" /> <span><strong>Email:</strong> info@premiumpoultry.com</span>
            </div>
            <div style={{background:'white', border:'1px solid #e8e5df', borderRadius:10, padding:14, display:'flex', gap:10, alignItems:'center'}}>
              <FaPhone color="#2d5016" /> <span><strong>Phone:</strong> +1 (555) 123-4567</span>
            </div>
          </div>

          <p className="confirmation-message">
            You can track your order status in your account dashboard. Perishable goods: please refrigerate at 0-4°C on arrival and see our <Link to="/terms" style={{color:'#2d5016', textDecoration:'underline'}}>return policy</Link> if anything arrives damaged — contact us within 24h with photos.
          </p>

          <div style={{background:'#1a3009', color:'white', borderRadius:10, padding:'12px 16px', fontSize:12, display:'flex', alignItems:'center', gap:8, marginBottom:20}}>
            <FaTruck color="#c9a227" /> Free shipping has been applied (or $9.99 for orders under $50). Save on next order with code <strong style={{color:'#c9a227'}}>FARM10</strong>.
          </div>

          <div className="confirmation-actions">
            <Link to="/" className="btn btn-primary">
              <FaHome /> Back to Home
            </Link>
            <Link to="/products" className="btn btn-outline">
              <FaShoppingBag /> Continue Shopping
            </Link>
          </div>

          <div style={{marginTop:16}}>
            <Link to="/dashboard" style={{fontSize:13, color:'#2d5016', textDecoration:'underline'}}>Go to My Account → Order History</Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default OrderConfirmation
