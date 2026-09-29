import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
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
