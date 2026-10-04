import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { FaSearch, FaLeaf } from 'react-icons/fa'
import ProductCard from '../components/ProductCard'
import { RevealGroup } from '../components/Reveal'
import { SkeletonCard } from '../components/Skeleton'
import { useProducts } from '../context/ProductContext'

function Products() {
  const { products: allProducts, loading } = useProducts()
  const [searchParams, setSearchParams] = useSearchParams()
  const [products, setProducts] = useState(allProducts)
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || 'all')
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState('featured')

  const categories = ['all', 'Chicken', 'Duck', 'Turkey', 'Eggs']

  useEffect(() => {
    const category = searchParams.get('category')
    if (category) {
      setSelectedCategory(category)
    }
  }, [searchParams])

  useEffect(() => {
    let filtered = allProducts

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(p => p.category === selectedCategory)
    }

    if (searchTerm) {
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.description.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    if (sortBy === 'price-low') {
      filtered = [...filtered].sort((a, b) => a.price - b.price)
    } else if (sortBy === 'price-high') {
      filtered = [...filtered].sort((a, b) => b.price - a.price)
    } else if (sortBy === 'name') {
      filtered = [...filtered].sort((a, b) => a.name.localeCompare(b.name))
    }

    setProducts(filtered)
  }, [selectedCategory, searchTerm, sortBy, allProducts])

  const handleCategoryChange = (category) => {
    setSelectedCategory(category)
    if (category === 'all') {
      setSearchParams({})
    } else {
      setSearchParams({ category })
    }
  }

  return (
    <div className="products-page">
      {/* Page Header */}
      <div className="shop-header">
        <div className="container">
          <div className="breadcrumb">
            <Link to="/">Home</Link>
            <span>&gt;</span>
            <span>Shop</span>
            {selectedCategory !== 'all' && <><span>&gt;</span><span>{selectedCategory}</span></>}
          </div>
          <h1>{selectedCategory === 'all' ? 'Shop Fresh Poultry' : selectedCategory}</h1>
          <p>{products.length} products • Antibiotic-free • Veterinary inspected • Farm direct</p>
        </div>
      </div>

      <div className="container">
        {/* Trust bar */}
        <div style={{display:'flex', gap:16, flexWrap:'wrap', fontSize:12, color:'#666', background:'white', padding:'12px 16px', borderRadius:8, marginTop:16, border:'1px solid #e8e5df'}}>
          <span><FaLeaf color="#2d5016" /> Free-range • Natural feed</span>
          <span>• Cold-chain delivery 1-3 days</span>
          <span>• Free shipping over $50</span>
          <span>• <Link to="/contact" style={{color:'#2d5016', textDecoration:'underline'}}>Need help? Contact us</Link></span>
        </div>

        {/* Filter Bar */}
        <div className="filter-bar">
          <div className="category-tabs">
            {categories.map(category => (
              <button
                key={category}
                className={`tab-btn ${selectedCategory === category ? 'active' : ''}`}
                onClick={() => handleCategoryChange(category)}
              >
                {category === 'all' ? 'All' : category}
              </button>
            ))}
          </div>

          <div className="filter-right">
            <div className="search-box">
              <FaSearch className="search-icon" />
              <input
                type="text"
                placeholder="Search poultry..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="sort-box">
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="featured">Featured</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="name">Name: A-Z</option>
              </select>
            </div>
          </div>
        </div>

        <div style={{fontSize:13, color:'#777', marginBottom:14}}>
          {loading
            ? 'Loading the current harvest...'
            : <>Showing {products.length} of {allProducts.length} products {searchTerm && <>for "<strong>{searchTerm}</strong>"</>}</>}
        </div>

        {/* Products Grid */}
        {loading ? (
          <div className="shop-grid">
            {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : (
          <RevealGroup className="shop-grid" step={60}>
            {products.map(product => (
              <ProductCard key={product.product_id} product={product} />
            ))}
          </RevealGroup>
        )}

        {products.length === 0 && (
          <div className="no-products" style={{background:'white', borderRadius:12, padding:'60px 24px', marginTop:16}}>
            <p style={{fontSize:18, fontWeight:600, marginBottom:8}}>No products found</p>
            <p style={{marginBottom:16}}>Try adjusting your search or browse all categories.</p>
            <button onClick={() => { setSearchTerm(''); setSelectedCategory('all'); setSearchParams({}) }} className="btn btn-primary">Clear Filters</button>
          </div>
        )}

        {/* Category footer */}
        <div style={{background:'white', borderRadius:12, padding:'24px', marginTop:32, border:'1px solid #e8e5df'}}>
          <h3 style={{fontSize:16, marginBottom:8}}>Why Premium Poultry?</h3>
          <p style={{fontSize:14, color:'#666', lineHeight:1.7}}>All poultry is raised on open pastures with natural feed, no antibiotics or hormones, and daily veterinary checks. Need bulk pricing for restaurants or events? <Link to="/contact" style={{color:'#2d5016', fontWeight:600, textDecoration:'underline'}}>Contact our sales team</Link> for a custom quote.</p>
        </div>
      </div>
    </div>
  )
}

export default Products
