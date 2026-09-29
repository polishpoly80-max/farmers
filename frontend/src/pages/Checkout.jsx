import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FaLock, FaTruck, FaShieldAlt, FaStore, FaTag } from 'react-icons/fa'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import { useBranch } from '../context/BranchContext'
import { toast } from 'react-toastify'
import { createOrder } from '../services/api'
import { notifyOrderPlaced, preparePushNotifications } from '../services/push'
import BranchSelector from '../components/BranchSelector'

function Checkout() {
  const { cartItems, clearCart } = useCart()
  const { user } = useAuth()
  const { currentBranch, branchId, delivery } = useBranch()
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

  // Delivery rules come from the selected branch, not a hard-coded $9.99/$50.
  const subtotal = cartItems.reduce((total, item) => total + (item.price * item.quantity), 0)
  const shipping = deliveryMode === 'pickup'
    ? 0
    : (subtotal >= delivery.freeThreshold ? 0 : delivery.fee)
  const promoDiscount = discount > 0 ? subtotal * discount : 0
  const total = subtotal - promoDiscount + shipping
  const branchClosed = currentBranch?.is_accepting_orders === false

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  // The rates below mirror the server's PROMO_CODES table and exist only to
  // preview the saving. The server re-applies the code itself and returns the
  // real discount, which is what the confirmation page shows.
  const applyPromo = () => {
    const code = promo.trim().toUpperCase()
    if (code === 'FARM10') { setDiscount(0.1); toast.success('Promo applied: 10% off!') }
    else if (code === 'FRESH5') { setDiscount(0.05); toast.success('Promo applied: 5% off!') }
    else if (code === '') { toast.error('Enter a promo code') }
    else { setDiscount(0); toast.error('Invalid promo code. Try FARM10 or FRESH5') }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (branchClosed) {
      toast.error(`${currentBranch?.name} is not accepting orders right now`)
      return
    }
    if (formData.cardNumber.replace(/\s/g,'').length < 12) {
      toast.error('Please enter a valid card number')
      return
    }
    // Ask for browser permission during the checkout click, then subscribe automatically.
    preparePushNotifications().catch(() => {})
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
        // Only the code is sent as an instruction. The server re-prices every
        // item from the catalogue and recomputes the discount, so these totals
        // are display values rather than what actually gets charged.
        promo_code: promo || null,
        promo_discount: promoDiscount,
        // the branch that will physically fulfil this order
        branch_id: branchId || undefined,
      }
      const result = await createOrder(orderData)
      notifyOrderPlaced(result.order_id).catch(() => {})
      // The server recomputes prices and the promo discount from the catalogue,
      // so its numbers are the real ones. Show those rather than our local
      // estimate, in case a price or code changed since the page loaded.
      const finalTotal = typeof result.total === 'number' ? result.total : total
      const finalDiscount = result.promo_discount ?? promoDiscount
      toast.success('Order placed successfully! Confirmation email sent.')
      clearCart()
      navigate('/order-confirmation', {
        state: {
          total: finalTotal,
          deliveryMode,
          promoDiscount: finalDiscount,
          orderId: result.order_id,
          branchName: result.branch_name || currentBranch?.name,
        },
      })
    } catch (error) {
      // A 409 means this branch can no longer cover part of the order.
      const unavailable = error?.detail?.unavailable
      if (Array.isArray(unavailable) && unavailable.length) {
        const summary = unavailable
          .map((u) => `${u.name} (${u.available} left, you wanted ${u.requested})`)
          .join(', ')
        toast.error(`${currentBranch?.name || 'This branch'} is out of stock: ${summary}`)
      } else {
        toast.error(error.message || 'Failed to place order. Please try again.')
      }
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
        <header className="checkout-header">
          <div>
            <span className="checkout-eyebrow"><FaLock /> Secure checkout</span>
            <h1>Complete your order</h1>
            <p>Choose delivery, enter your details, and place your order securely.</p>
          </div>
          <div className="checkout-progress" aria-label="Checkout progress">
            <span className="active"><b>1</b> Cart</span>
            <i />
            <span className="active"><b>2</b> Details</span>
            <i />
            <span><b>3</b> Confirmation</span>
          </div>
        </header>

        <div className="checkout-meta">
          <Link to="/cart">← Back to cart</Link>
          <span>{cartItems.reduce((s, i) => s + i.quantity, 0)} items</span>
          <span><FaShieldAlt /> SSL encrypted</span>
        </div>

        {/* Which farm branch fulfils this order */}
        <div className="branch-context-banner">
          <span className="branch-banner-icon"><FaStore /></span>
          <span className="branch-context-copy">
            <strong>{currentBranch?.name || 'No branch selected'}</strong>
            <span>
              {currentBranch
                ? [currentBranch.address, currentBranch.city].filter(Boolean).join(', ') ||
                  'Pickup point for this order'
                : 'Choose a branch to see its stock and delivery terms'}
            </span>
            {branchClosed && (
              <span className="branch-unavailable-note">
                This branch is not accepting orders right now — pick another branch.
              </span>
            )}
          </span>
          <BranchSelector />
        </div>

        <form onSubmit={handleSubmit}>
          <div className="checkout-grid">
            <div className="checkout-form">
              <div className="delivery-options">
                {[
                  {
                    id: 'delivery',
                    label: 'Delivery',
                    icon: FaTruck,
                    desc: delivery.fee > 0
                      ? `1–3 days • $${Number(delivery.fee).toFixed(2)} (Free over $${Number(delivery.freeThreshold).toFixed(0)})`
                      : '1–3 days • Free delivery',
                  },
                  {
                    id: 'pickup',
                    label: 'Farm Pickup',
                    icon: FaStore,
                    desc: currentBranch?.opening_hours
                      ? `Free • ${currentBranch.opening_hours}${currentBranch.address ? ` • ${currentBranch.address}` : ''}`
                      : `Free • ${currentBranch?.address || 'Farm counter'}`,
                  },
                ].map(method => (
                  <button
                    key={method.id}
                    type="button"
                    className={`delivery-option ${deliveryMode === method.id ? 'active' : ''}`}
                    onClick={() => setDeliveryMode(method.id)}
                  >
                    <span className="delivery-option-title"><method.icon /> {method.label}</span>
                    <span className="delivery-option-description">{method.desc}</span>
                  </button>
                ))}
              </div>

              <h2 className="checkout-section-title"><span>01</span> Shipping Information</h2>

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

              <div className="form-row form-row-address">
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
                  className="checkout-textarea"
                />
              </div>

              <h2 className="checkout-section-title"><span>02</span> Payment Information</h2>
              <p className="payment-security-note"><FaLock /> Encrypted and processed securely. We never store full card numbers.</p>

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
              <div className="cash-delivery-note">
                <FaShieldAlt /> Cash on delivery available — select at delivery if you prefer.
              </div>
            </div>

            <div className="order-summary checkout-summary">
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

              <div className="promo-code-row">
                <input
                  type="text"
                  placeholder="Promo code (FARM10)"
                  value={promo}
                  onChange={e => setPromo(e.target.value)}
                />
                <button type="button" onClick={applyPromo} className="btn btn-outline"><FaTag /> Apply</button>
              </div>
              <p className="promo-hint">Try <strong>FARM10</strong> for 10% off or <strong>FRESH5</strong> for 5% off.</p>

              <div className="summary-row">
                <span>Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>

              {promoDiscount >0 && (
                <div className="summary-row promo-discount-row">
                  <span>Promo discount ({(discount * 100).toFixed(0)}%)</span>
                  <span>-${promoDiscount.toFixed(2)}</span>
                </div>
              )}

              <div className="summary-row">
                <span><FaTruck /> {deliveryMode==='pickup' ? 'Pickup' : 'Shipping'}</span>
                <span>{shipping === 0 ? 'Free' : `$${shipping.toFixed(2)}`}</span>
              </div>

              <div className="summary-row">
                <span><FaStore /> Fulfilled by</span>
                <span>{currentBranch?.name || '—'}</span>
              </div>

              <div className="summary-row total">
                <span>Total</span>
                <span>${total.toFixed(2)}</span>
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-block place-order-button"
                disabled={submitting || branchClosed}
              >
                <FaLock /> {submitting ? 'Processing...' : `Place Order — $${total.toFixed(2)}`}
              </button>

              <p className="secure-text">
                <FaLock /> Your payment is secure and encrypted
              </p>
              <p className="checkout-legal">
                By placing your order, you agree to our <Link to="/terms">Terms</Link> and <Link to="/privacy">Privacy Policy</Link>.
              </p>
              <div className="next-steps-card">
                <strong>What happens next?</strong>
                <span>Confirmation email instantly</span>
                <span>Packed fresh & dispatched cold-chain</span>
                <span>Tracking via SMS/email • Support: +1 (555) 123-4567</span>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

export default Checkout
