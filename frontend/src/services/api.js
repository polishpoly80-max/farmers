// Where the API lives.
//
// In development the default '/api' works because the Vite dev server proxies it
// to http://localhost:8080 (see vite.config.js). That proxy only exists for
// `npm run dev` - it is NOT part of a production build, so deploying dist/
// as static files with the default would send every request to the frontend's
// own origin and 404.
//
// For production, build with an absolute URL:
//   VITE_API_URL=https://api.your-domain.com/api npm run build
// or set it in the .env file at the project root.
//
// window.__API_BASE_URL__ is an escape hatch for hosts where the built assets
// are deployed without a rebuild: a small inline script in index.html can set it
// before the bundle loads.
const API_BASE_URL =
  (typeof window !== 'undefined' && window.__API_BASE_URL__) ||
  import.meta.env.VITE_API_URL ||
  '/api'

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
        // FastAPI validation errors -> "field: message; field: message"
        msg = data.detail.map((e) => e.msg || `${e.loc?.join('.')}: ${e.type}`).join('; ')
      } else if (typeof data.detail === 'string') {
        msg = data.detail
        // Keep the body attached: some endpoints (login rate limiting) return a
        // human message under `message` plus machine-readable counters.
        const error = new Error(msg)
        error.status = response.status
        error.detail = data.detail
        error.body = data
        throw error
      } else if (typeof data.detail === 'object') {
        // Structured business error (e.g. branch stock conflict).
        // Keep the human sentence, and expose the list on error.unavailable.
        msg = data.detail.message || 'Request failed'
        const error = new Error(msg)
        error.status = response.status
        error.detail = data.detail
        throw error
      } else {
        msg = JSON.stringify(data.detail)
      }
    }
    msg = msg || `Request failed: ${response.status} ${response.statusText}`
    if (typeof msg !== 'string') msg = JSON.stringify(msg)
    const error = new Error(msg)
    error.status = response.status
    throw error
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
export const getProducts = async (category = null, branchId = null) => {
  const params = {}
  if (category) params.category = category
  if (branchId) params.branch_id = branchId
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
export const deleteTenant = async (id, cascade = false) => api.delete(`/tenants/${id}`, { params: { cascade } })

// ---- Branches API (farm locations) ----
export const listBranches = async (includeInactive = false) =>
  api.get('/branches/', { params: includeInactive ? { include_inactive: true } : {} })
export const getBranch = async (id) => api.get(`/branches/${id}`)
export const getMyBranch = async () => api.get('/branches/mine')
export const selectBranch = async (branchId) => api.post('/branches/select', { branch_id: branchId })
export const getBranchInventory = async (branchId) => api.get(`/branches/${branchId}/inventory`)
export const updateBranchInventory = async (branchId, productId, data) =>
  api.put(`/branches/${branchId}/inventory/${productId}`, data)
export const updateBranchSettings = async (branchId, data) =>
  api.put(`/branches/${branchId}/settings`, data)

// ---- Customer care live chat ----
export const createCareSession = async (data) => api.post('/care/sessions', data)
export const getCareSessions = async (params = {}) =>
  api.get('/care/sessions', { params: { status: 'all', ...params } })
export const getCareUnreadCount = async () => api.get('/care/unread-count')
export const getCareSession = async (id) => api.get(`/care/sessions/${id}`)
export const sendCareMessage = async (id, body) =>
  api.post(`/care/sessions/${id}/messages`, { body })
export const markCareSessionRead = async (id) => api.put(`/care/sessions/${id}/read`, {})
export const updateCareSessionStatus = async (id, status, note = null) =>
  api.put(`/care/sessions/${id}/status`, { status, note })

// ---- Notifications API (in-app centre) ----
export const getNotifications = async (limit = 40, unreadOnly = false) =>
  api.get('/notifications/', { params: { limit, ...(unreadOnly ? { unread_only: true } : {}) } })
export const getUnreadCount = async () => api.get('/notifications/unread-count')
export const markNotificationRead = async (id) => api.post(`/notifications/${id}/read`, {})
export const markAllNotificationsRead = async () => api.post('/notifications/read-all', {})
export const broadcastNotification = async (data) => api.post('/notifications/broadcast', data)

// ---- Admin API ----
export const getAdminStats = async () => api.get('/admin/stats')
export const getAdminUsers = async () => api.get('/admin/users')

// ---- Super API ----
export const getSuperStats = async () => api.get('/super/stats')
export const getSuperUsers = async () => api.get('/super/users')
export const getSuperTenants = async () => api.get('/super/tenants')

// ---- Orders API ----
export const createOrder = async (orderData) => api.post('/orders/', orderData)
export const getOrders = async (branchId = null) => api.get('/orders/', { params: branchId ? { branch_id: branchId } : {} })
export const getOrder = async (orderId) => api.get(`/orders/${orderId}`)
export const updateOrderStatus = async (orderId, status, note = null) =>
  api.put(`/orders/${orderId}/status`, { status, note })

// NOTE: the cart is intentionally client-side only (see context/CartContext.jsx).
// There is no /api/cart backend - the cart lives in localStorage and is turned
// into an order by POST /api/orders/. The old cart endpoints were removed rather
// than left here calling routes that do not exist.

export default api
export { request }
