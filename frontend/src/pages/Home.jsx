import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FaShieldAlt, FaCheckCircle, FaMoneyBillWave, FaTruck, FaStar, FaQuoteLeft, FaLeaf, FaAward, FaPhoneAlt, FaArrowRight } from 'react-icons/fa'
import { toast } from 'react-toastify'
import { useProducts } from '../context/ProductContext'

const categories = [
  { name: 'Chicken', count: '12 Products', image: 'https://cdn.pixabay.com/photo/2017/11/11/21/41/chicken-2939480_640.jpg', link: '/products?category=Chicken' },
  { name: 'Eggs', count: '8 Products', image: 'https://cdn.pixabay.com/photo/2016/07/23/15/55/eggs-1536990_640.jpg', link: '/products?category=Eggs' },
  { name: 'Duck', count: '5 Products', image: 'https://cdn.pixabay.com/photo/2019/10/22/17/03/duck-4569327_640.jpg', link: '/products?category=Duck' },
  { name: 'Turkey', count: '4 Products', image: 'https://cdn.pixabay.com/photo/2021/11/22/19/36/turkey-6817284_640.jpg', link: '/products?category=Turkey' },
]

const features = [
  { icon: FaShieldAlt, title: 'Farm Fresh', desc: 'Sourced directly from our farm within 24 hours' },
  { icon: FaCheckCircle, title: 'Quality Assured', desc: 'Veterinary inspected, antibiotic-free poultry' },
  { icon: FaMoneyBillWave, title: 'Flexible Payment', desc: 'COD, Card, UPI & Bank Transfer accepted' },
  { icon: FaTruck, title: 'Reliable Delivery', desc: 'Free delivery over $50 • Same-day before 2PM' }
]

const processSteps = [
  { step: '01', title: 'Raised Naturally', desc: 'Free-range on open pastures with natural feed, no hormones or antibiotics.' },
  { step: '02', title: 'Quality Checked', desc: 'Every bird veterinary-inspected and quality graded before dispatch.' },
  { step: '03', title: 'Delivered Fresh', desc: 'Cold-chain delivery to your doorstep within hours of processing.' },
]

function Home() {
  const { products } = useProducts()
  const featuredProducts = products.slice(0, 4)
  const [email, setEmail] = useState('')

  const handleNewsletter = (e) => {
    e.preventDefault()
    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email address')
      return
    }
    toast.success('Subscribed! Check your inbox for 10% off.')
    setEmail('')
  }

  return (
    <div className="home">
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-bg">
          <img src="https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?w=1600&q=80" alt="Chickens" />
          <div className="hero-overlay"></div>
        </div>
        <div className="container hero-content">
          <div className="hero-left">
            <div className="hero-subtitle">
              <span className="subtitle-line"></span>
              <span>FRESH FROM OUR FARM</span>
            </div>
            <h1>
              Quality Poultry,<br />
              <span className="gold">Raised With</span><br />
              Care.
            </h1>
            <p>Fresh, healthy and carefully raised poultry delivered from our farm to your doorstep. Trusted by 1,200+ families since 1985.</p>
            <div className="hero-buttons">
              <Link to="/products" className="btn-gold">Shop Poultry <FaArrowRight style={{marginLeft:8}} /></Link>
              <Link to="/about" className="btn-outline-white">Explore Our Farm</Link>
            </div>
            <div style={{display:'flex', gap:18, marginTop:22, fontSize:13, color:'rgba(255,255,255,0.85)'}}>
              <span style={{display:'flex',alignItems:'center',gap:6}}><FaAward color="#c9a227" /> Since 1985</span>
              <span style={{display:'flex',alignItems:'center',gap:6}}><FaLeaf color="#c9a227" /> Antibiotic-Free</span>
              <span style={{display:'flex',alignItems:'center',gap:6}}><FaPhoneAlt color="#c9a227" /> +1 (555) 123-4567</span>
            </div>
          </div>
          <div className="hero-right">
            <div className="stats-panel">
              <div className="stat">
                <span className="stat-number">35+</span>
                <span className="stat-label">Years Experience</span>
              </div>
              <div className="stat">
                <span className="stat-number">1,200+</span>
                <span className="stat-label">Happy Customers</span>
              </div>
              <div className="stat">
                <span className="stat-number">5,000+</span>
                <span className="stat-label">Birds Monthly</span>
              </div>
              <div className="stat">
                <span className="stat-number">100%</span>
                <span className="stat-label">Farm Direct</span>
              </div>
            </div>
          </div>
        </div>
        <div className="scroll-indicator">
          <span>SCROLL</span>
          <div className="scroll-line"></div>
        </div>
      </section>

      {/* Features Bar */}
      <section className="features-bar">
        <div className="container">
          <div className="features-bar-grid">
            {features.map((feature, index) => (
              <div className="feature-bar-item" key={index}>
                <div className="feature-bar-icon">
                  <feature.icon />
                </div>
                <div className="feature-bar-text">
                  <h4>{feature.title}</h4>
                  <p>{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Shop by Category */}
      <section style={{background:'white', padding:'70px 0'}}>
        <div className="container">
          <div className="section-header">
            <span className="section-label">CATEGORIES</span>
            <h2>Shop by Category</h2>
            <p>Everything from broilers to free-range eggs, raised naturally.</p>
          </div>
          <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:20}}>
            {categories.map(cat => (
              <Link key={cat.name} to={cat.link} className="shop-card">
                <div className="shop-card-image" style={{height:180}}>
                  <img src={cat.image} alt={cat.name} />
                  <div style={{position:'absolute', inset:0, background:'linear-gradient(to top, rgba(0,0,0,0.55), transparent)'}} />
                  <div style={{position:'absolute', bottom:14, left:16, color:'white'}}>
                    <h3 style={{fontSize:18, marginBottom:2}}>{cat.name}</h3>
                    <span style={{fontSize:12, opacity:0.85}}>{cat.count}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Our Products Section */}
      <section className="our-products">
        <div className="container">
          <div className="section-header">
            <span className="section-label">OUR PRODUCTS</span>
            <h2>Our Poultry Selection</h2>
            <p>Choose from our carefully raised selection of quality poultry. All products are inspected daily.</p>
          </div>

          <div className="home-shop-grid">
            {featuredProducts.map(product => (
              <Link to={`/products/${product.product_id}`} key={product.product_id} className="shop-card">
                <div className="shop-card-image">
                  <img src={product.image} alt={product.name} />
                  {product.badge && (
                    <span className={`card-badge ${product.badge === 'PREMIUM' ? 'premium' : 'best-seller'}`}>
                      {product.badge}
                    </span>
                  )}
                  {product.stock_quantity === 0 && (
                    <div className="out-of-stock-overlay">
                      <span>Out of Stock</span>
                    </div>
                  )}
                </div>
                <div className="shop-card-info">
                  <span className="shop-card-category">{product.category} • {product.weight}</span>
                  <h3 className="shop-card-name">{product.name}</h3>
                  <span style={{color:'#2d5016', fontWeight:700, fontSize:15}}>${product.price}</span>
                </div>
              </Link>
            ))}
          </div>

          <div style={{ textAlign: 'center', marginTop: '50px' }}>
            <Link to="/products" className="btn-gold">View All Products <FaArrowRight style={{marginLeft:8}} /></Link>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section style={{background:'white', padding:'70px 0', borderTop:'1px solid #e8e5df', borderBottom:'1px solid #e8e5df'}}>
        <div className="container">
          <div className="section-header">
            <span className="section-label">HOW IT WORKS</span>
            <h2>From Farm to Your Table</h2>
            <p>Three simple steps to get fresh poultry delivered.</p>
          </div>
          <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:28, textAlign:'center'}}>
            {processSteps.map(s => (
              <div key={s.step} style={{background:'#f9f8f6', padding:'32px 24px', borderRadius:12}}>
                <div style={{fontSize:40, fontWeight:800, color:'#c9a227', opacity:0.35, lineHeight:1}}>{s.step}</div>
                <h3 style={{margin:'12px 0 8px', fontSize:18}}>{s.title}</h3>
                <p style={{fontSize:14, color:'#777', lineHeight:1.6}}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="about">
        <div className="container">
          <div className="about-content">
            <div className="about-text">
              <span className="section-label" style={{display:'inline-block'}}>SINCE 1985</span>
              <h2>About Our Farm</h2>
              <p>
                For over three generations, our family has been dedicated to raising
                premium quality poultry. We believe in sustainable farming practices
                that prioritize both animal welfare and environmental responsibility.
              </p>
              <p>
                Our chickens roam freely on open pastures, eating natural feed and
                living stress-free lives. This results in healthier, tastier products
                that you can feel good about serving to your family.
              </p>
              <ul style={{listStyle:'none', padding:0, margin:'14px 0 22px', display:'grid', gap:8, fontSize:14, color:'#444'}}>
                <li>✓ Certified antibiotic-free & hormone-free</li>
                <li>✓ Veterinary inspected daily • Cold-chain delivery</li>
                <li>✓ Open farm visits — see how we raise our birds</li>
              </ul>
              <Link to="/about" className="btn-gold">Learn More About Us</Link>
            </div>
            <div className="about-image">
              <img src="https://cdn.pixabay.com/photo/2016/03/05/19/02/hen-1238714_640.jpg" alt="Farm" />
            </div>
          </div>
        </div>
      </section>

      {/* Certifications */}
      <section style={{background:'#1a3009', color:'white', padding:'28px 0'}}>
        <div className="container" style={{display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:18, fontSize:13}}>
          <span style={{display:'flex', alignItems:'center', gap:8}}><FaShieldAlt color="#c9a227" /> Veterinary Inspected</span>
          <span style={{display:'flex', alignItems:'center', gap:8}}><FaLeaf color="#c9a227" /> Sustainably Raised</span>
          <span style={{display:'flex', alignItems:'center', gap:8}}><FaAward color="#c9a227" /> Premium Quality Grade A</span>
          <span style={{display:'flex', alignItems:'center', gap:8}}><FaTruck color="#c9a227" /> 1-3 Day Delivery • 50-mile radius</span>
          <span style={{opacity:0.7}}>Questions? <Link to="/contact" style={{color:'#c9a227', textDecoration:'underline'}}>Contact us</Link></span>
        </div>
      </section>

      {/* Testimonials */}
      <section className="testimonials">
        <div className="container">
          <div className="section-header">
            <span className="section-label">TESTIMONIALS</span>
            <h2>What Our Customers Say</h2>
            <p>Trusted by hundreds of happy families across the region.</p>
          </div>

          <div className="testimonials-grid">
            <div className="testimonial-card">
              <div className="testimonial-stars">
                <FaStar /><FaStar /><FaStar /><FaStar /><FaStar />
              </div>
              <FaQuoteLeft className="quote-icon" />
              <p>"The best chicken I've ever tasted. You can really tell the difference when it's farm fresh. My family loves it!"</p>
              <div className="testimonial-author">
                <div className="author-avatar">S</div>
                <div>
                  <strong>Sarah Johnson</strong>
                  <span>Regular Customer • 2 years</span>
                </div>
              </div>
            </div>

            <div className="testimonial-card">
              <div className="testimonial-stars">
                <FaStar /><FaStar /><FaStar /><FaStar /><FaStar />
              </div>
              <FaQuoteLeft className="quote-icon" />
              <p>"Fast delivery and excellent quality. The eggs are always fresh and the chicken is top notch. Highly recommend!"</p>
              <div className="testimonial-author">
                <div className="author-avatar">M</div>
                <div>
                  <strong>Michael Chen</strong>
                  <span>Verified Buyer • 18 orders</span>
                </div>
              </div>
            </div>

            <div className="testimonial-card">
              <div className="testimonial-stars">
                <FaStar /><FaStar /><FaStar /><FaStar /><FaStar />
              </div>
              <FaQuoteLeft className="quote-icon" />
              <p>"Finally found a poultry farm I can trust. Great prices, amazing quality, and wonderful customer service."</p>
              <div className="testimonial-author">
                <div className="author-avatar">E</div>
                <div>
                  <strong>Emily Davis</strong>
                  <span>Weekly Subscriber</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Newsletter */}
      <section className="newsletter">
        <div className="container">
          <form onSubmit={handleNewsletter} className="newsletter-content">
            <div className="newsletter-text">
              <h2>Stay Updated — Get 10% Off</h2>
              <p>Subscribe for exclusive offers, farm updates, and seasonal recipes. No spam, unsubscribe anytime.</p>
            </div>
            <div className="newsletter-form">
              <input type="email" placeholder="Enter your email address" value={email} onChange={e=>setEmail(e.target.value)} required />
              <button type="submit" className="btn btn-primary">Subscribe</button>
            </div>
          </form>
        </div>
      </section>
    </div>
  )
}

export default Home
