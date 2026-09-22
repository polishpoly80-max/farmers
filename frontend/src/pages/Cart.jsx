import { Link } from 'react-router-dom'
import { FaTrash, FaMinus, FaPlus, FaShoppingCart, FaTruck, FaShieldAlt, FaLeaf, FaArrowRight } from 'react-icons/fa'
import { useCart } from '../context/CartContext'

const recommended = [
  { product_id: '12', name: 'Brown Farm Eggs (12)', price: 4.49, category: 'Eggs', weight: '12 pcs', image: 'https://cdn.pixabay.com/photo/2016/07/23/15/55/eggs-1536990_640.jpg' },
  { product_id: '5', name: 'Chicken Wings (Pack)', price: 8.99, category: 'Chicken', weight: '1 kg', image: 'https://cdn.pixabay.com/photo/2015/03/26/09/39/chicken-wings-690221_640.jpg' },
]

function Cart() {
  const { cartItems, removeFromCart, updateQuantity, addToCart } = useCart()

  const subtotal = cartItems.reduce((total, item) => total + (item.price * item.quantity), 0)
  const shipping = subtotal > 50 ? 0 : 9.99
  const total = subtotal + shipping
  const freeShippingProgress = Math.min(100, (subtotal / 50) * 100)

  if (cartItems.length === 0) {
    return (
      <div className="cart-page">
        <div className="container">
          <h1>Your Cart</h1>
          <div className="empty-cart">
            <FaShoppingCart size={64} />
            <h2>Your cart is empty</h2>
            <p>Looks like you haven't added any items to your cart yet. Browse our farm-fresh poultry.</p>
            <div style={{display:'flex', gap:12, justifyContent:'center', marginBottom:24}}>
              <Link to="/products" className="btn btn-primary">
                Start Shopping
              </Link>
              <Link to="/products?category=Chicken" className="btn btn-outline">
                Shop Chicken
              </Link>
            </div>
            <div style={{maxWidth:560, margin:'0 auto', textAlign:'left', background:'#f9f8f6', padding:20, borderRadius:12}}>
              <h4 style={{marginBottom:10}}>Why shop with us?</h4>
              <ul style={{fontSize:14, color:'#666', display:'grid', gap:6, paddingLeft:18}}>
                <li>Farm direct — processed within 24 hours</li>
                <li>Free delivery over $50 • Same-day before 2PM</li>
                <li>Veterinary inspected • Antibiotic-free</li>
              </ul>
              <p style={{fontSize:13, color:'#777', marginTop:12}}>Need help? <Link to="/contact" style={{color:'#2d5016', textDecoration:'underline'}}>Contact us</Link> or <a href="https://wa.me/15551234567" target="_blank" rel="noopener noreferrer" style={{color:'#2d5016', textDecoration:'underline'}}>WhatsApp</a></p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="cart-page">
      <div className="container">
        <h1>Your Cart ({cartItems.reduce((s,i)=>s+i.quantity,0)} items)</h1>

        <div style={{background:'white', borderRadius:12, padding:'12px 16px', marginBottom:16, border:'1px solid #e8e5df'}}>
          <div style={{display:'flex', justifyContent:'space-between', fontSize:12, color:'#666', marginBottom:6}}>
            <span>Subtotal: ${subtotal.toFixed(2)}</span>
            <span>{shipping===0 ? '🎉 Free shipping unlocked!' : `Add $${(50-subtotal).toFixed(2)} for free shipping`}</span>
          </div>
          <div style={{height:8, background:'#f0f0f0', borderRadius:10, overflow:'hidden'}}>
            <div style={{height:'100%', width: `${freeShippingProgress}%`, background: shipping===0 ? '#28a745' : '#c9a227', transition:'width 0.3s'}} />
          </div>
        </div>

        <div className="cart-content">
          <div>
            <div className="cart-items">
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
            </div>

            <div style={{background:'white', borderRadius:12, padding:20, marginTop:16, border:'1px solid #e8e5df'}}>
              <h3 style={{fontSize:15, marginBottom:12}}>You might also like</h3>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
                {recommended.map(r=> (
                  <div key={r.product_id} style={{display:'flex', gap:12, alignItems:'center', border:'1px solid #e8e5df', borderRadius:8, padding:10}}>
                    <img src={r.image} alt={r.name} style={{width:64, height:64, objectFit:'cover', borderRadius:8}} />
                    <div style={{flex:1}}>
                      <div style={{fontSize:13, fontWeight:600}}>{r.name}</div>
                      <div style={{fontSize:12, color:'#777'}}>{r.category} • {r.weight}</div>
                      <div style={{fontWeight:700, color:'#2d5016', fontSize:13}}>${r.price}</div>
                    </div>
                    <button className="btn btn-outline" style={{padding:'6px 12px', fontSize:12}} onClick={()=>addToCart(r,1)}>Add</button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="cart-summary">
            <h2>Order Summary</h2>

            <div className="summary-row">
              <span>Subtotal ({cartItems.reduce((s,i)=>s+i.quantity,0)} items)</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>

            <div className="summary-row">
              <span><FaTruck style={{marginRight:6}} /> Shipping</span>
              <span>{shipping === 0 ? 'Free' : `$${shipping}`}</span>
            </div>

            {shipping > 0 && (
              <p className="shipping-note">
                Add ${(50 - subtotal).toFixed(2)} more for free shipping!
              </p>
            )}

            <div className="summary-row total">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>

            <Link to="/checkout" className="btn btn-primary btn-block" style={{marginTop:8}}>
              Proceed to Checkout <FaArrowRight />
            </Link>

            <Link to="/products" className="continue-shopping">
              Continue Shopping
            </Link>

            <div style={{marginTop:18, paddingTop:16, borderTop:'1px solid #e8e5df', display:'grid', gap:8, fontSize:12, color:'#666'}}>
              <span style={{display:'flex', alignItems:'center', gap:8}}><FaShieldAlt color="#2d5016" /> Secure checkout • SSL encrypted</span>
              <span style={{display:'flex', alignItems:'center', gap:8}}><FaLeaf color="#2d5016" /> Antibiotic-free • Veterinary inspected</span>
              <span style={{display:'flex', alignItems:'center', gap:8}}><FaTruck color="#2d5016" /> Delivery 1-3 days • Same-day before 2PM</span>
              <span style={{fontSize:11}}>Questions? <Link to="/contact" style={{color:'#2d5016', textDecoration:'underline'}}>Contact support</Link> • <Link to="/terms" style={{color:'#2d5016', textDecoration:'underline'}}>Returns</Link></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Cart
