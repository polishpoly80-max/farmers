import { Link } from 'react-router-dom'
import { FaTrash, FaMinus, FaPlus, FaShoppingCart, FaTruck, FaShieldAlt, FaLeaf, FaArrowRight, FaStore, FaExclamationTriangle } from 'react-icons/fa'
import { useCart } from '../context/CartContext'
import { useBranch } from '../context/BranchContext'
import BranchSelector from '../components/BranchSelector'

const recommended = [
  { product_id: '12', name: 'Brown Farm Eggs (12)', price: 4.49, category: 'Eggs', weight: '12 pcs', image: '/images/cart-eggs.jpg' },
  { product_id: '5', name: 'Chicken Wings (Pack)', price: 8.99, category: 'Chicken', weight: '1 kg', image: '/images/cart-chicken-wings.jpg' },
]

function Cart() {
  const { cartItems, removeFromCart, updateQuantity, addToCart } = useCart()
  const { currentBranch, delivery } = useBranch()

  const subtotal = cartItems.reduce((total, item) => total + (item.price * item.quantity), 0)
  // Delivery terms belong to the selected branch.
  const shipping = subtotal >= delivery.freeThreshold ? 0 : delivery.fee
  const total = subtotal + shipping
  const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0)
  const freeShippingProgress = Math.min(100, (subtotal / delivery.freeThreshold) * 100)
  const amountToFreeShipping = Math.max(0, delivery.freeThreshold - subtotal)
  const branchClosed = currentBranch?.is_accepting_orders === false

  if (cartItems.length === 0) {
    return (
      <div className="cart-page">
        <div className="container">
          <header className="cart-header">
            <div>
              <span className="cart-eyebrow"><FaShoppingCart /> Basket</span>
              <h1>Your cart</h1>
              <p>Review your farm-fresh selection before checkout.</p>
            </div>
            <Link to="/products" className="btn btn-outline">Continue shopping <FaArrowRight /></Link>
          </header>

          <div className="empty-cart">
            <div className="empty-cart-icon"><FaShoppingCart /></div>
            <h2>Your cart is empty</h2>
            <p>Looks like you haven't added any items yet. Browse our farm-fresh poultry.</p>
            <div className="empty-cart-actions">
              <Link to="/products" className="btn btn-primary">Start shopping</Link>
              <Link to="/products?category=Chicken" className="btn btn-outline">Shop chicken</Link>
            </div>
            <div className="cart-empty-benefits">
              <h3>Why shop with us?</h3>
              <ul>
                <li>Farm direct — processed within 24 hours</li>
                <li>Free delivery over $50 • Same-day before 2PM</li>
                <li>Veterinary inspected • Antibiotic-free</li>
              </ul>
              <p>Need help? <Link to="/contact">Contact us</Link> or <a href="https://wa.me/15551234567" target="_blank" rel="noopener noreferrer">WhatsApp</a></p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="cart-page">
      <div className="container">
        <header className="cart-header">
          <div>
            <span className="cart-eyebrow"><FaShoppingCart /> Basket</span>
            <h1>Your cart <span>({itemCount} {itemCount === 1 ? 'item' : 'items'})</span></h1>
            <p>Review your items and delivery total before checkout.</p>
          </div>
          <Link to="/products" className="btn btn-outline">Continue shopping <FaArrowRight /></Link>
        </header>

        <div className="branch-context-banner">
          <span className="branch-banner-icon"><FaStore /></span>
          <span className="branch-context-copy">
            <strong>{currentBranch?.name || 'No branch selected'}</strong>
            <span>
              {currentBranch
                ? [currentBranch.address, currentBranch.city].filter(Boolean).join(', ') ||
                  'Stock and delivery shown for this branch'
                : 'Choose a branch to see its stock and delivery terms'}
            </span>
            {branchClosed && (
              <span className="branch-unavailable-note">
                Not accepting orders right now — switch branch to check out.
              </span>
            )}
          </span>
          <BranchSelector />
        </div>

        <div className="cart-shipping-progress">
          <div className="cart-shipping-copy">
            <span>Subtotal: <strong>${subtotal.toFixed(2)}</strong></span>
            <span className={shipping === 0 ? 'free-shipping-unlocked' : ''}>
              {shipping === 0
                ? '🎉 Free shipping unlocked!'
                : `Add $${amountToFreeShipping.toFixed(2)} for free shipping`}
            </span>
          </div>
          <div className="cart-progress-track"><span className={shipping === 0 ? 'free' : ''} style={{ width: `${freeShippingProgress}%` }} /></div>
        </div>

        <div className="cart-content">
          <div>
            <section className="cart-items">
              <div className="cart-items-header">
                <div>
                  <h2>Items in your cart</h2>
                  <p>{itemCount} {itemCount === 1 ? 'item' : 'items'} selected</p>
                </div>
                <span className="cart-items-secure"><FaShieldAlt /> Secure checkout</span>
              </div>
              {cartItems.map(item => (
                <div key={item.product_id} className="cart-item">
                  <Link to={`/products/${item.product_id}`} className="cart-item-image">
                    {item.image ? (
                      <img src={item.image} alt={item.name} />
                    ) : (
                      <div className="cart-item-placeholder">{item.name.charAt(0)}</div>
                    )}
                  </Link>

                  <div className="cart-item-details">
                    <h3><Link to={`/products/${item.product_id}`} style={{color:'#1a1a1a'}}>{item.name}</Link></h3>
                    <p>{item.category} • {item.weight}</p>
                    <p className="item-price">${item.price} each</p>
                    {item.stock_quantity !== undefined && item.stock_quantity < 30 && item.stock_quantity >0 && (
                      <p style={{color:'#c0392b', fontSize:11, fontWeight:600}}>Only {item.stock_quantity} left!</p>
                    )}
                  </div>

                  <div className="cart-item-actions">
                    <div className="quantity-controls">
                      <button onClick={() => updateQuantity(item.product_id, item.quantity - 1)}>
                        <FaMinus />
                      </button>
                      <span>{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.product_id, item.quantity + 1)}>
                        <FaPlus />
                      </button>
                    </div>

                    <div className="item-total">
                      ${(item.price * item.quantity).toFixed(2)}
                    </div>

                    <button
                      className="remove-btn"
                      onClick={() => removeFromCart(item.product_id)}
                      title="Remove"
                    >
                      <FaTrash />
                    </button>
                  </div>
                </div>
              ))}
            </section>

            <section className="cart-recommendations">
              <h3>You might also like</h3>
              <div className="cart-recommendations-grid">
                {recommended.map(r => (
                  <article className="cart-recommendation" key={r.product_id}>
                    <img src={r.image} alt={r.name} />
                    <div className="cart-recommendation-details">
                      <strong>{r.name}</strong>
                      <span>{r.category} • {r.weight}</span>
                      <b>${r.price}</b>
                    </div>
                    <button className="btn btn-outline btn-small" onClick={() => addToCart(r, 1)}>Add</button>
                  </article>
                ))}
              </div>
            </section>
          </div>

          <div className="cart-summary">
            <h2>Order Summary</h2>

            <div className="summary-row">
              <span>Subtotal ({itemCount} {itemCount === 1 ? 'item' : 'items'})</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>

            <div className="summary-row">
              <span><FaTruck /> Shipping</span>
              <span>{shipping === 0 ? 'Free' : `$${shipping.toFixed(2)}`}</span>
            </div>

            {shipping > 0 && (
              <p className="shipping-note">
                Add ${amountToFreeShipping.toFixed(2)} more for free delivery from {currentBranch?.name}!
              </p>
            )}

            <div className="summary-row">
              <span><FaStore /> Fulfilled by</span>
              <span>{currentBranch?.name || '—'}</span>
            </div>

            {branchClosed && (
              <p className="branch-unavailable-note" style={{ marginTop: 0, marginBottom: 12 }}>
                <FaExclamationTriangle /> {currentBranch?.name} is not accepting orders — please switch branch.
              </p>
            )}

            <div className="summary-row total">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>

            {branchClosed ? (
              <button className="btn btn-primary btn-block cart-checkout-button" disabled>
                Branch closed for orders
              </button>
            ) : (
              <Link to="/checkout" className="btn btn-primary btn-block cart-checkout-button">
                Proceed to Checkout <FaArrowRight />
              </Link>
            )}

            <Link to="/products" className="continue-shopping">
              Continue Shopping
            </Link>

            <div className="cart-summary-trust">
              <span><FaShieldAlt /> Secure checkout • SSL encrypted</span>
              <span><FaLeaf /> Antibiotic-free • Veterinary inspected</span>
              <span><FaTruck /> Delivery 1–3 days • Same-day before 2PM</span>
              <small>Questions? <Link to="/contact">Contact support</Link> • <Link to="/terms">Returns</Link></small>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Cart
