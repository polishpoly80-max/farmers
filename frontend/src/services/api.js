// Fetch-based API client - uses Vite proxy: VITE_API_URL || '/api' -> http://localhost:8080
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

async function request(endpoint, { method = 'GET', body, params, headers = {} } = {}) {
  let url = `${API_BASE_URL}${endpoint}`
  if (params && Object.keys(params).length > 0) {
    const qs = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => {
      if (v !== null && v !== undefined && v !== '') qs.append(k, v)
    })
    const str = qs.toString()
    if (str) url += `?${str}`
  }
  const config = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  }
  // attach JWT if present
  try {
    const token = localStorage.getItem('token') || JSON.parse(localStorage.getItem('user') || 'null')?.token || JSON.parse(localStorage.getItem('user') || 'null')?.access_token
    if (token) config.headers.Authorization = `Bearer ${token}`
  } catch {}

  if (body !== undefined && body !== null) {
    config.body = JSON.stringify(body)
  }

  let response
  try {
    response = await fetch(url, config)
  } catch (networkError) {
    throw new Error(networkError.message || 'Network error - is backend running on http://localhost:8080 ?')
  }

  let data
  const text = await response.text()
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    data = { message: text }
  }

  if (!response.ok) {
    let msg = data?.message
    if (!msg && data?.detail) {
      if (Array.isArray(data.detail)) {
        msg = data.detail.map((e) => e.msg || `${e.loc?.join('.')}: ${e.type}`).join('; ')
      } else if (typeof data.detail === 'string') {
        msg = data.detail
      } else {
        msg = JSON.stringify(data.detail)
      }
    }
    msg = msg || `Request failed: ${response.status} ${response.statusText}`
    if (typeof msg !== 'string') msg = JSON.stringify(msg)
    throw new Error(msg)
  }
  return data
}

const api = {
  get: (endpoint, opts = {}) => request(endpoint, { method: 'GET', ...opts }),
  post: (endpoint, data, opts = {}) => request(endpoint, { method: 'POST', body: data, ...opts }),
  put: (endpoint, data, opts = {}) => request(endpoint, { method: 'PUT', body: data, ...opts }),
  delete: (endpoint, opts = {}) => request(endpoint, { method: 'DELETE', ...opts }),
  request,
}

// ---- Products API ----
export const getProducts = async (category = null) => {
  const params = category ? { category } : {}
  return api.get('/products/', { params })
}
export const getProduct = async (productId) => api.get(`/products/${productId}`)
export const createProduct = async (productData) => api.post('/products/', productData)

// ---- Users API ----
export const registerUser = async (userData) => api.post('/users/register', userData)
export const loginUser = async (credentials) => api.post('/users/login', credentials)
export const getMe = async () => api.get('/users/me')
export const listUsers = async () => api.get('/users/')
export const updateUserRole = async (userId, data) => api.put(`/users/${userId}/role`, data)
export const updateUserProfile = async (data) => api.put('/users/me', data)

// ---- Tenants API ----
export const listTenants = async () => api.get('/tenants/')
export const getTenant = async (id) => api.get(`/tenants/${id}`)
export const createTenant = async (data) => api.post('/tenants/', data)
export const updateTenant = async (id, data) => api.put(`/tenants/${id}`, data)
export const deleteTenant = async (id) => api.delete(`/tenants/${id}`)

// ---- Admin API ----
export const getAdminStats = async () => api.get('/admin/stats')
export const getAdminUsers = async () => api.get('/admin/users')

// ---- Super API ----
export const getSuperStats = async () => api.get('/super/stats')
export const getSuperUsers = async () => api.get('/super/users')
export const getSuperTenants = async () => api.get('/super/tenants')

// ---- Orders API ----
export const createOrder = async (orderData) => api.post('/orders/', orderData)
export const getOrders = async () => api.get('/orders/')
export const getOrder = async (orderId) => api.get(`/orders/${orderId}`)

// ---- Cart API ----
export const getCart = async (userId) => api.get(`/cart/${userId}`)
export const addToCart = async (userId, item) => api.post(`/cart/${userId}/add`, item)
export const updateCartItem = async (userId, item) => api.put(`/cart/${userId}/update`, item)
export const removeFromCart = async (userId, productId) => api.delete(`/cart/${userId}/remove/${productId}`)
export const clearCart = async (userId) => api.delete(`/cart/${userId}/clear`)

export default api
export { request }
