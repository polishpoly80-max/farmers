import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { FaShoppingCart, FaArrowLeft, FaStar, FaStarHalfAlt, FaRegStar, FaThumbsUp, FaUser, FaTruck, FaShieldAlt, FaLeaf, FaClock } from 'react-icons/fa'
import { useCart } from '../context/CartContext'
import { useProducts } from '../context/ProductContext'
import { toast } from 'react-toastify'

function ProductDetail() {
  const { id } = useParams()
  const { addToCart } = useCart()
  const { products: allProducts, getProductById } = useProducts()
  const [quantity, setQuantity] = useState(1)
  const [activeTab, setActiveTab] = useState('description')
  const [reviewHelpful, setReviewHelpful] = useState({})

  const product = getProductById(id)

  if (!product) {
    return (
      <div className="container" style={{padding:'80px 0', textAlign:'center'}}>
        <h1>Product not found</h1>
        <p style={{margin:'12px 0 20px', color:'#777'}}>The product you're looking for doesn't exist.</p>
        <Link to="/products" className="btn btn-primary">Back to Products</Link>
      </div>
    )
  }

  const handleAddToCart = () => {
    if (product.stock_quantity === 0) { toast.error('Out of stock — restock in Admin Dashboard'); return }
    addToCart(product, quantity)
    toast.success(`${product.name} × ${quantity} added to cart!`)
  }

  const related = allProducts.filter(p => p.category === product.category && p.product_id !== product.product_id).slice(0,4)

  const reviews = [
    { id: 1, name: 'Sarah J.', rating: 5, date: '2026-08-28', verified: true, comment: 'Excellent quality! The chicken was fresh and delivered on time. Will definitely order again. Meat was tender and flavourful.', helpful: 12 },
    { id: 2, name: 'Michael C.', rating: 4, date: '2026-08-25', verified: true, comment: 'Great taste and texture. My family loved it. Only minor issue was delivery took a bit longer than expected but support was great.', helpful: 8 },
    { id: 3, name: 'Emily D.', rating: 5, date: '2026-08-20', verified: false, comment: 'Best poultry I have ever bought online. You can really taste the difference with farm-fresh products. Highly recommend!', helpful: 15 },
  ]

  const renderStars = (rating) => {
    const stars = []
    for (let i = 1; i <= 5; i++) {
      if (i <= rating) stars.push(<FaStar key={i} color="#c9a227" />)
      else if (i - 0.5 <= rating) stars.push(<FaStarHalfAlt key={i} color="#c9a227" />)
      else stars.push(<FaRegStar key={i} color="#c9a227" />)
    }
    return stars
  }

  const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
  const stock = product.stock_quantity ?? product.stock ?? 0
  const nutrition = product.nutrition || { protein: '23g / 100g', fat: '8g', calories: '165 kcal', origin: 'Countryside, CA' }
  const storage = product.storage || 'Keep refrigerated at 0-4°C. Use within 3 days or freeze at -18°C for up to 6 months.'

  return (
    <div className="product-detail">
      <div className="container">
        <Link to="/products" className="back-link">
          <FaArrowLeft /> Back to Products
        </Link>

        <div className="product-detail-grid">
          <div className="product-detail-image">
            <img src={product.image} alt={product.name} />
            {product.badge && (
              <span className={`detail-badge ${product.badge === 'PREMIUM' ? 'premium' : 'best-seller'}`}>
                {product.badge}
              </span>
            )}
            {stock === 0 && <div style={{position:'absolute', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:700}}>Out of Stock — {stock} available</div>}
          </div>

          <div className="product-detail-info">
            <span className="product-category">{product.category} • {product.weight} {stock>0 && stock < 30 && <span style={{color:'#c0392b'}}>• Low stock ({stock})</span>} {stock===0 && <span style={{color:'#dc2626'}}>• Out of stock</span>}</span>
            <h1>{product.name}</h1>
            <div style={{display:'flex', alignItems:'center', gap:10, margin:'6px 0'}}>
              <span className="product-price">${product.price}</span>
              {product.originalPrice && <span style={{textDecoration:'line-through', color:'#999', fontSize:14}}>${product.originalPrice}</span>}
              {product.originalPrice && <span style={{background:'#d4edda', color:'#1a7f37', padding:'2px 8px', borderRadius:20, fontSize:12, fontWeight:600}}>Save ${(product.originalPrice - product.price).toFixed(2)}</span>}
            </div>
            <p className="product-weight">Weight: {product.weight}</p>

            <span className={`stock-status ${stock > 0 ? 'in-stock' : 'out-of-stock'}`}>
              {stock > 0 ? `In Stock (${stock} available)` : `Out of Stock (0 available) — Restock in Admin`}
            </span>

            <div style={{display:'flex', gap:12, fontSize:12, color:'#666', margin:'14px 0', flexWrap:'wrap'}}>
              <span style={{display:'flex',alignItems:'center',gap:6}}><FaTruck color="#2d5016" /> Free shipping over $50</span>
              <span style={{display:'flex',alignItems:'center',gap:6}}><FaShieldAlt color="#2d5016" /> Veterinary inspected</span>
              <span style={{display:'flex',alignItems:'center',gap:6}}><FaLeaf color="#2d5016" /> Antibiotic-free</span>
              <span style={{display:'flex',alignItems:'center',gap:6}}><FaClock color="#2d5016" /> Same-day dispatch before 2PM</span>
            </div>

            <div className="product-detail-tabs">
              {['description','nutrition','storage','shipping'].map(tab => (
                <button
                  key={tab}
                  className={activeTab === tab ? 'active' : ''}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>

            {activeTab==='description' && <p className="description">{product.description}</p>}
            {activeTab==='nutrition' && (
              <div style={{background:'#f9f8f6', padding:16, borderRadius:8, fontSize:13, lineHeight:1.8}}>
                <strong>Nutrition (approx):</strong><br/>
                Protein: {nutrition.protein} • Fat: {nutrition.fat} • Calories: {nutrition.calories}<br/>
                Origin: {nutrition.origin} • Processed daily in certified facility.
              </div>
            )}
            {activeTab==='storage' && (
              <div style={{background:'#f9f8f6', padding:16, borderRadius:8, fontSize:13, lineHeight:1.7}}>
                <strong>Storage & Handling:</strong><br/>{storage}<br/>
                <span style={{color:'#777'}}>Always store raw poultry separate from ready-to-eat foods. Cook to internal 74°C.</span>
              </div>
            )}
            {activeTab==='shipping' && (
              <div style={{background:'#f9f8f6', padding:16, borderRadius:8, fontSize:13, lineHeight:1.7}}>
                <strong>Shipping:</strong><br/>Cold-chain delivery within 50-mile radius. 1-3 business days. Same-day if ordered before 2PM. Free shipping over $50, otherwise $9.99.
              </div>
            )}

            <div className="quantity-selector">
              <label>Quantity:</label>
              <div className="quantity-controls">
                <button onClick={() => setQuantity(Math.max(1, quantity - 1))}>-</button>
                <span>{quantity}</span>
                <button onClick={() => setQuantity(Math.min(Math.max(1, stock), quantity + 1))} disabled={stock===0}>+</button>
              </div>
              <span style={{fontSize:12, color: stock===0 ? '#dc2626' : '#777'}}>{stock===0 ? '0 available — out of stock' : `${stock} available • Total: $${(product.price * quantity).toFixed(2)}`}</span>
            </div>

            <div className="product-actions">
              <button
                onClick={handleAddToCart}
                className="btn btn-primary btn-large"
                disabled={stock === 0}
                style={{width:'100%', opacity: stock===0 ? 0.6 : 1}}
              >
                <FaShoppingCart /> {stock===0 ? 'Out of Stock' : 'Add to Cart'}
              </button>
              {stock===0 && <div style={{fontSize:12, color:'#dc2626', textAlign:'center', marginTop:6}}>This product is currently out of stock. Admin can restock in <Link to="/admin" style={{color:'#2d5016', textDecoration:'underline'}}>Admin Dashboard → Products → Restock</Link></div>}
              <div style={{fontSize:12, color:'#777', textAlign:'center', marginTop:8}}>Secure checkout • 24h return if damaged <Link to="/terms" style={{color:'#2d5016', textDecoration:'underline'}}>Terms</Link></div>
            </div>

            <div className="product-features">
              <h3>Product Features</h3>
              <ul>
                <li>✓ 100% Farm Fresh — processed within 24h</li>
                <li>✓ No Hormones or Antibiotics — natural feed only</li>
                <li>✓ Free-Range Raised — open pasture access</li>
                <li>✓ Veterinary Inspected — Grade A quality</li>
              </ul>
            </div>
          </div>
        </div>

        {related.length >0 && (
          <div className="related-products-section">
            <h3>Related Products</h3>
            <div className="related-products-grid">
              {related.map(p => (
                <Link key={p.product_id} to={`/products/${p.product_id}`} className="shop-card">
                  <div className="shop-card-image"><img src={p.image} alt={p.name} /> {(p.stock_quantity ?? p.stock) === 0 && <div className="out-of-stock-overlay"><span>Out of Stock</span></div>}</div>
                  <div className="shop-card-info"><span className="shop-card-category">{p.category}</span><h3 className="shop-card-name">{p.name}</h3><span className="related-product-price">${p.price}</span> <span className="related-product-stock">• {(p.stock_quantity ?? 0)} available</span></div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Reviews Section */}
        <div className="reviews-section" style={{marginTop:24}}>
          <div className="reviews-header">
            <div className="reviews-summary">
              <h2>Customer Reviews</h2>
              <div className="reviews-rating">
                <div className="stars">{renderStars(Math.round(avgRating))}</div>
                <span>{avgRating.toFixed(1)} out of 5 ({reviews.length} reviews) • {avgRating >=4.5 ? 'Highly Rated' : 'Well Rated'}</span>
              </div>
            </div>
          </div>

          <div className="reviews-list">
            {reviews.map(review => (
              <div className="review-card" key={review.id}>
                <div className="review-top">
                  <div className="review-author">
                    <div className="review-avatar"><FaUser /></div>
                    <div>
                      <strong>{review.name} {review.verified && <span style={{fontSize:11, background:'#d4edda', color:'#1a7f37', padding:'2px 6px', borderRadius:10}}>Verified</span>}</strong>
                      <span>{review.date}</span>
                    </div>
                  </div>
                  <div className="review-stars">{renderStars(review.rating)}</div>
                </div>
                <p className="review-comment">{review.comment}</p>
                <div className="review-actions">
                  <button className="helpful-btn" onClick={()=> {
                    if(!reviewHelpful[review.id]) { setReviewHelpful({...reviewHelpful, [review.id]:true}); toast.success('Thanks for your feedback!')
                    } else { toast.info('You already marked this helpful') }
                  }}>
                    <FaThumbsUp /> Helpful ({review.helpful + (reviewHelpful[review.id]?1:0)})
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="write-review">
            <h3>Write a Review</h3>
            <form className="review-form" onSubmit={e=>{
              e.preventDefault();
              const form = e.target;
              const text = form.querySelector('textarea').value.trim();
              if(text.length < 10) { toast.error('Please write at least 10 characters'); return; }
              toast.success('Review submitted! It will appear after moderation.')
              form.reset();
            }}>
              <div className="form-group">
                <label>Your Rating</label>
                <div className="rating-input">
                  {[1,2,3,4,5].map(n => (
                    <FaStar key={n} className="rating-star" style={{color:'#c9a227'}} />
                  ))}
                  <span style={{marginLeft:8, fontSize:13, color:'#777'}}>Click to rate</span>
                </div>
              </div>
              <div className="form-group">
                <label>Your Review</label>
                <textarea placeholder="Share your experience with this product... What did you like? How was the taste and freshness?" rows="4" required />
              </div>
              <button type="submit" className="btn btn-primary">Submit Review</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProductDetail
