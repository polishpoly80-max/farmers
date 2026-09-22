import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { FaEnvelope, FaLock, FaExclamationTriangle } from 'react-icons/fa'

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [lockTimer, setLockTimer] = useState(0)
  const { login, loading, isLocked, remainingTime, loginAttempts, maxAttempts } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (isLocked && remainingTime > 0) {
      setLockTimer(Math.ceil(remainingTime / 1000))
      const interval = setInterval(() => {
        setLockTimer(prev => {
          if (prev <= 1) {
            clearInterval(interval)
            return 0
          }
          return prev - 1
        })
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [isLocked, remainingTime])

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    const result = await login(email, password)
    if (result.success) {
      if (result.role === 'super_admin') navigate('/super')
      else if (result.role === 'admin') navigate('/admin')
      else navigate('/dashboard')
    } else {
      setError(result.error)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-left">
          <div className="auth-left-content">
            <svg width="48" height="48" viewBox="0 0 32 32" fill="none" style={{margin: '0 auto 20px'}}>
              <rect width="32" height="32" rx="8" fill="rgba(255,255,255,0.2)"/>
              <path d="M16 6C14 6 12 8 12 11C12 14 14 16 16 18C18 16 20 14 20 11C20 8 18 6 16 6Z" fill="rgba(255,255,255,0.5)"/>
              <path d="M16 18C16 18 10 20 10 24C10 26 12 28 16 28C20 28 22 26 22 24C22 20 16 18 16 18Z" fill="rgba(255,255,255,0.7)"/>
              <circle cx="16" cy="12" r="2" fill="white"/>
            </svg>
            <h2>Premium Poultry</h2>
            <p>Fresh, healthy and carefully raised poultry delivered from our farm to your doorstep.</p>
          </div>
        </div>
        <div className="auth-right">
          <div className="auth-form">
            <h1>Welcome Back</h1>
            <p className="auth-subtitle">Sign in to continue shopping</p>

            {isLocked && (
              <div className="lock-warning">
                <FaExclamationTriangle />
                <div>
                  <strong>Account Temporarily Locked</strong>
                  <p>Too many failed attempts. Try again in {formatTime(lockTimer)}</p>
                </div>
              </div>
            )}

            {error && <div className="error-message">{error}</div>}

            {!isLocked && loginAttempts.count > 0 && (
              <div className="attempts-warning">
                Failed attempts: {loginAttempts.count}/{maxAttempts}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Email Address</label>
                <div className="input-icon">
                  <FaEnvelope />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    required
                    disabled={isLocked}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Password</label>
                <div className="input-icon">
                  <FaLock />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    disabled={isLocked}
                  />
                </div>
              </div>

              <div className="form-options">
                <label className="remember-me">
                  <input type="checkbox" />
                  <span>Remember me</span>
                </label>
                <a href="#" className="forgot-password">Forgot password?</a>
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-block"
                disabled={loading || isLocked}
              >
                {loading ? 'Signing in...' : isLocked ? `Locked (${formatTime(lockTimer)})` : 'Sign In'}
              </button>
            </form>

            <div className="auth-divider">
              <span>or</span>
            </div>

            <button className="btn btn-google" disabled={isLocked}>
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>

            <div style={{background:'#f9f8f6', padding:12, borderRadius:8, marginTop:12, fontSize:12, lineHeight:1.6}}>
              <strong>Demo Logins:</strong><br/>
              Customer: any registered email<br/>
              Admin: <code>admin@premiumpoultry.com / Admin123!</code> (after seeding)<br/>
              Super: <code>super@premiumpoultry.com / Super123!</code>
            </div>
            <p className="auth-footer">
              Don't have an account? <Link to="/register">Sign up</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login
