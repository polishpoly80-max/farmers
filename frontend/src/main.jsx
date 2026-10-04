import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
// Layout and brand colour live in index.css; motion, loading states and focus
// treatment live in styles/motion.css so the two can change independently;
// craft.css adds the type, hairline and texture layer last so it can refine
// what the other two establish.
import './index.css'
import './styles/motion.css'
import './styles/craft.css'
import { CartProvider } from './context/CartContext.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { ProductProvider } from './context/ProductContext.jsx'
import { BranchProvider } from './context/BranchContext.jsx'
import { NotificationProvider } from './context/NotificationContext.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      {/* BranchProvider must wrap ProductProvider so the catalogue can read
          per-branch stock for the selected farm location. */}
      <BranchProvider>
        <ProductProvider>
          <NotificationProvider>
            <CartProvider>
              <App />
            </CartProvider>
          </NotificationProvider>
        </ProductProvider>
      </BranchProvider>
    </AuthProvider>
  </React.StrictMode>,
)
