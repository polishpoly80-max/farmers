import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FaLock, FaTruck, FaShieldAlt, FaStore, FaTag } from 'react-icons/fa'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import { toast } from 'react-toastify'
import { createOrder } from '../services/api'

function Checkout() {
  const { cartItems, clearCart } = useCart()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [promo, setPromo] = useState('')
  const [discount, setDiscount] = useState(0)
  const [deliveryMode, setDeliveryMode] = useState('delivery')
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    firstName: user?.full_name?.split(' ')[0] || '',
    lastName: user?.full_name?.split(' ').slice(1).join(' ') || '',
    email: user?.email || '',
    phone: user?.phone || '',
    address: user?.address || '',
    city: '',
    state: '',
    zipCode: '',
    notes: '',
    cardNumber: '',
    cardName: '',
    expiry: '',
    cvv: ''
  })

  const subtotal = cartItems.reduce((total, item) => total + (item.price * item.quantity), 0)
  const shipping = deliveryMode === 'pickup' ? 0 : (subtotal > 50 ? 0 : 9.99)
  const promoDiscount = discount > 0 ? subtotal * discount : 0
  const total = subtotal - promoDiscount + shipping

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const applyPromo = () => {
    const code = promo.trim().toUpperCase()
    if (code === 'FARM10') { setDiscount(0.1); toast.success('Promo applied: 10% off!') }
    else if (code === 'FRESH5') { setDiscount(0.05); toast.success('Promo applied: 5% off!') }
    else if (code === '') { toast.error('Enter a promo code') }
    else { setDiscount(0); toast.error('Invalid promo code. Try FARM10 or FRESH5') }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (formData.cardNumber.replace(/\s/g,'').length < 12) {
      toast.error('Please enter a valid card number')
      return
    }
    setSubmitting(true)
    try {
      const shippingAddress = `${formData.address}, ${formData.city}, ${formData.state} ${formData.zipCode}`
      const orderData = {
        items: cartItems.map(item => ({
          product_id: item.product_id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          weight: item.weight,
          image: item.image,
        })),
        total: total,
        delivery_mode: deliveryMode,
        shipping_address: shippingAddress,
        phone: formData.phone,
        notes: formData.notes,
        payment_method: 'card',
        promo_code: promo || null,
        promo_discount: promoDiscount,
      }
      const result = await createOrder(orderData)
      toast.success('Order placed successfully! Confirmation email sent.')
      clearCart()
      navigate('/order-confirmation', { state: { total, deliveryMode, promoDiscount, orderId: result.order_id } })
    } catch (error) {
      toast.error(error.message || 'Failed to place order. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (cartItems.length === 0) {
    return (
      <div className="checkout-page">
        <div className="container">
          <h1>Checkout</h1>
          <div className="empty-cart" style={{background:'white', borderRadius:12, padding:'60px 24px', textAlign:'center'}}>
            <h2>Your cart is empty</h2>
            <p style={{color:'#777', margin:'10px 0 20px'}}>Add some items to your cart before checking out.</p>
            <Link to="/products" className="btn btn-primary">
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="checkout-page">
      <div className="container">
        <h1>Checkout</h1>
        <div style={{fontSize:13, color:'#666', marginBottom:16}}>
          <Link to="/cart" style={{color:'#2d5016', textDecoration:'underline'}}>Back to cart</Link> • {cartItems.reduce((s,i)=>s+i.quantity,0)} items • Secure SSL checkout
        </div>

        <form onSubmit={handleSubmit}>
          <div className="checkout-grid">
            <div className="checkout-form">
              <div style={{display:'flex', gap:12, marginBottom:20}}>
                {[
                  { id:'delivery', label:'Delivery', icon:FaTruck, desc:'1-3 days • $9.99 (Free over $50)' },
                  { id:'pickup', label:'Farm Pickup', icon:FaStore, desc:'Free • Sat 9AM-1PM • 123 Farm Road' }
                ].map(m=> (
                  <button key={m.id} type="button" onClick={()=>setDeliveryMode(m.id)} style={{flex:1, border: deliveryMode===m.id ? '2px solid #2d5016' : '1px solid #e8e5df', background: deliveryMode===m.id ? '#f0f7ee' : 'white', borderRadius:12, padding:14, textAlign:'left'}}>
                    <div style={{display:'flex', alignItems:'center', gap:8, fontWeight:700, fontSize:14}}><m.icon color="#2d5016" /> {m.label}</div>
                    <div style={{fontSize:12, color:'#666', marginTop:4}}>{m.desc}</div>
                  </button>
                ))}
              </div>

              <h2>Shipping Information</h2>

              <div className="form-row">
                <div className="form-group">
                  <label>First Name *</label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    required
                    placeholder="Jane"
                  />
                </div>
                <div className="form-group">
                  <label>Last Name *</label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    required
                    placeholder="Doe"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Email *</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    placeholder="jane@example.com"
                  />
                </div>
                <div className="form-group">
                  <label>Phone *</label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    required
                    placeholder="+1 (555) 000-0000"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Address *</label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  required
                  placeholder="123 Farm Road"
                />
              </div>

              <div className="form-row" style={{gridTemplateColumns:'2fr 1fr 1fr'}}>
                <div className="form-group">
                  <label>City *</label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    required
                    placeholder="Countryside"
                  />
                </div>
                <div className="form-group">
                  <label>State *</label>
                  <input
                    type="text"
                    name="state"
                    value={formData.state}
                    onChange={handleChange}
                    required
                    placeholder="CA"
                  />
                </div>
                <div className="form-group">
                  <label>ZIP Code *</label>
                  <input
                    type="text"
                    name="zipCode"
                    value={formData.zipCode}
                    onChange={handleChange}
                    required
                    placeholder="95123"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Order Notes (optional)</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  placeholder="Delivery instructions, gate code, halal request, etc."
                  rows="3"
                  style={{width:'100%', padding:'12px 14px', border:'1px solid #e8e5df', borderRadius:8, fontSize:14, background:'#f9f8f6'}}
                />
              </div>

              <h2>Payment Information</h2>
              <p style={{fontSize:12, color:'#777', marginBottom:14}}><FaLock style={{marginRight:6}} /> Encrypted and processed securely. We never store full card numbers.</p>

              <div className="form-group">
                <label>Card Number *</label>
                <input
                  type="text"
                  name="cardNumber"
                  value={formData.cardNumber}
                  onChange={handleChange}
                  placeholder="1234 5678 9012 3456"
                  required
                />
              </div>

              <div className="form-group">
                <label>Name on Card *</label>
                <input
                  type="text"
                  name="cardName"
                  value={formData.cardName}
                  onChange={handleChange}
                  required
                  placeholder="Jane Doe"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Expiry Date *</label>
                  <input
                    type="text"
                    name="expiry"
                    value={formData.expiry}
                    onChange={handleChange}
                    placeholder="MM/YY"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>CVV *</label>
                  <input
                    type="text"
                    name="cvv"
                    value={formData.cvv}
                    onChange={handleChange}
                    placeholder="123"
                    required
                  />
                </div>
              </div>
              <div style={{display:'flex', gap:8, fontSize:12, color:'#666', alignItems:'center', marginTop:8}}>
                <FaShieldAlt color="#2d5016" /> Cash on delivery available — select at delivery if you prefer.
              </div>
            </div>

            <div className="order-summary">
              <h2>Order Summary</h2>

              <div className="order-items">
                {cartItems.map(item => (
                  <div key={item.product_id} className="order-item">
                    <div className="order-item-info">
                      <h4>{item.name}</h4>
                      <p>Qty: {item.quantity} • {item.weight}</p>
                    </div>
                    <span>${(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div style={{display:'flex', gap:8, marginBottom:16}}>
                <input
                  type="text"
                  placeholder="Promo code (FARM10)"
                  value={promo}
                  onChange={e=>setPromo(e.target.value)}
                  style={{flex:1, padding:'10px 12px', border:'1px solid #e8e5df', borderRadius:8, fontSize:13}}
                />
                <button type="button" onClick={applyPromo} className="btn btn-outline" style={{padding:'10px 16px'}}><FaTag /> Apply</button>
              </div>
              <div style={{fontSize:12, color:'#777', marginBottom:12}}>Try <strong>FARM10</strong> for 10% off or <strong>FRESH5</strong> for 5% off.</div>

              <div className="summary-row">
                <span>Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>

              {promoDiscount >0 && (
                <div className="summary-row" style={{color:'#1a7f37'}}>
                  <span>Promo discount ({(discount*100).toFixed(0)}%)</span>
                  <span>-${promoDiscount.toFixed(2)}</span>
                </div>
              )}

              <div className="summary-row">
                <span><FaTruck /> {deliveryMode==='pickup' ? 'Pickup' : 'Shipping'}</span>
                <span>{shipping === 0 ? 'Free' : `$${shipping}`}</span>
              </div>

              <div className="summary-row total">
                <span>Total</span>
                <span>${total.toFixed(2)}</span>
              </div>

              <button type="submit" className="btn btn-primary btn-block" style={{marginTop:12}} disabled={submitting}>
                <FaLock /> {submitting ? 'Processing...' : `Place Order — $${total.toFixed(2)}`}
              </button>

              <p className="secure-text">
                <FaLock /> Your payment is secure and encrypted
              </p>
              <p style={{fontSize:11, color:'#777', textAlign:'center', marginTop:8}}>
                By placing your order, you agree to our <Link to="/terms" style={{color:'#2d5016', textDecoration:'underline'}}>Terms</Link> and <Link to="/privacy" style={{color:'#2d5016', textDecoration:'underline'}}>Privacy Policy</Link>.
              </p>
              <div style={{background:'#f9f8f6', borderRadius:8, padding:12, marginTop:16, fontSize:12, lineHeight:1.6, color:'#666'}}>
                <strong>What happens next?</strong><br/>
                • Confirmation email instantly<br/>
                • Packed fresh & dispatched cold-chain<br/>
                • Tracking via SMS/email • Support: +1 (555) 123-4567
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

export default Checkout
