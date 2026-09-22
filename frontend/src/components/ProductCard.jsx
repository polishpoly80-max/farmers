import { Link } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { toast } from 'react-toastify'

function ProductCard({ product }) {
  const { addToCart } = useCart()
  const isOutOfStock = product.stock_quantity === 0

  const handleAddToCart = (e) => {
    e.preventDefault()
    if (isOutOfStock) return
    addToCart(product)
    toast.success(`${product.name} added to cart!`)
  }

  return (
    <Link to={`/products/${product.product_id}`} className="shop-card">
      <div className="shop-card-image">
        <img src={product.image} alt={product.name} />
        {product.badge && (
          <span className={`card-badge ${product.badge === 'PREMIUM' ? 'premium' : 'best-seller'}`}>
            {product.badge}
          </span>
        )}
        {isOutOfStock && (
          <div className="out-of-stock-overlay">
            <span>Out of Stock</span>
          </div>
        )}
      </div>
      <div className="shop-card-info">
        <span className="shop-card-category">{product.category}</span>
        <h3 className="shop-card-name">{product.name}</h3>
      </div>
    </Link>
  )
}

export default ProductCard
