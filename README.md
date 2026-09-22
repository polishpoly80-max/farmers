# Premium Poultry Farm - E-Commerce Website

A classic and mature poultry farm e-commerce website built with React frontend and FastAPI backend with AstraDB.

## Project Structure

```
farmers/
├── backend/              # FastAPI Backend
│   ├── app/
│   │   ├── core/         # Configuration and database
│   │   ├── models/       # Pydantic models
│   │   ├── routers/      # API routes
│   │   └── services/     # Business logic
│   ├── main.py           # FastAPI app entry
│   └── requirements.txt
│
├── frontend/             # React Frontend
│   ├── src/
│   │   ├── components/   # Reusable components
│   │   ├── pages/        # Page components
│   │   ├── context/      # React Context
│   │   └── services/     # API services
│   ├── package.json
│   └── vite.config.js
│
└── README.md
```

## Features

### Backend (FastAPI + AstraDB)
- RESTful API endpoints for products, users, orders, and cart
- AstraDB (Cassandra) integration for data storage
- JWT authentication support
- CORS configuration for frontend integration

### Frontend (React)
- Responsive design with classic poultry farm theme
- Product browsing with category filtering
- Shopping cart functionality
- User authentication (login/register)
- Checkout process with order summary
- Modern UI with custom styling

## Quick Start

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Install Python dependencies:
```bash
pip install -r requirements.txt
```

3. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your AstraDB credentials
```

4. Start the backend server:
```bash
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8080
```

The API will be available at: http://localhost:8080
API documentation: http://localhost:8080/docs

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install Node.js dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

The frontend will be available at: http://localhost:4000

## API Endpoints

### Products
- `GET /api/products/` - Get all products
- `GET /api/products/{id}` - Get product by ID
- `POST /api/products/` - Create a product
- `PUT /api/products/{id}` - Update a product
- `DELETE /api/products/{id}` - Delete a product

### Users
- `POST /api/users/register` - Register a new user
- `POST /api/users/login` - Login user
- `GET /api/users/` - Get all users

### Orders
- `POST /api/orders/` - Create an order
- `GET /api/orders/` - Get all orders
- `GET /api/orders/{id}` - Get order by ID

### Cart
- `GET /api/cart/{user_id}` - Get user's cart
- `POST /api/cart/{user_id}/add` - Add item to cart
- `PUT /api/cart/{user_id}/update` - Update cart item
- `DELETE /api/cart/{user_id}/remove/{product_id}` - Remove from cart

## Tech Stack

**Backend:**
- Python 3.9+
- FastAPI
- AstraDB (Cassandra)
- Pydantic
- python-jose (JWT)
- passlib (password hashing)

**Frontend:**
- React 18
- Vite
- React Router DOM
- Axios
- React Icons
- React Toastify

## Database Configuration (AstraDB)

1. Create an AstraDB account at https://astra.datastax.com
2. Create a new database
3. Generate an authentication token
4. Update `.env` file with your credentials:
   - ASTRA_DB_ID
   - ASTRA_DB_REGION
   - ASTRA_DB_PASSWORD (use the token)
   - ASTRA_DB_KEYSPACE

## Development

The project is set up with:
- Hot reload for both frontend and backend
- Proxy configuration for API calls
- Mock data for initial development
- Responsive design for all screen sizes

## License

MIT
