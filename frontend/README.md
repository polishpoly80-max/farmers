# Premium Poultry Farm - Frontend

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start development server:
```bash
npm run dev
```

3. Access the app at: http://localhost:4000

## Features

- **Home Page**: Hero section, featured products, about section
- **Products Page**: Browse all products with category filtering
- **Product Detail**: View product details and add to cart
- **Cart**: Manage cart items with quantity controls
- **Checkout**: Complete purchase with shipping and payment form
- **User Auth**: Login and registration pages

## Tech Stack

- React 18
- React Router DOM
- React Icons
- React Toastify
- Vite

## Project Structure

```
frontend/
├── src/
│   ├── components/     # Reusable components
│   │   ├── Header.jsx
│   │   ├── Footer.jsx
│   │   └── ProductCard.jsx
│   ├── pages/         # Page components
│   │   ├── Home.jsx
│   │   ├── Products.jsx
│   │   ├── ProductDetail.jsx
│   │   ├── Cart.jsx
│   │   ├── Checkout.jsx
│   │   ├── Login.jsx
│   │   └── Register.jsx
│   ├── context/       # React Context
│   │   ├── CartContext.jsx
│   │   └── AuthContext.jsx
│   ├── services/      # API services
│   │   └── api.js
│   ├── App.jsx
│   └── main.jsx
└── package.json
```

## Backend Integration

The frontend is configured to proxy API requests to the backend at `http://localhost:8000`. Update the proxy settings in `vite.config.js` if your backend runs on a different port.
