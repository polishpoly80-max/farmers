import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children, require = 'customer' }) {
  const { user, loading, isAdmin, isBranchStaff, isSuperAdmin } = useAuth()

  if (loading) return <div className="container" style={{padding:80, textAlign:'center'}}>Loading...</div>
  if (!user) return <Navigate to="/login" replace />

  if (require === 'branch_staff' && !isBranchStaff) {
    return <Navigate to="/dashboard" replace />
  }
  if (require === 'admin' && !isAdmin) {
    return <Navigate to="/dashboard" replace />
  }
  if (require === 'super_admin' && !isSuperAdmin) {
    return <Navigate to={isAdmin ? "/admin" : "/dashboard"} replace />
  }

  return children
}
