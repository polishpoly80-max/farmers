import { useNavigate } from 'react-router-dom'
import { useMemo } from 'react'
import {
  FaBell,
  FaCheck,
  FaCheckDouble,
  FaBoxOpen,
  FaTruck,
  FaExclamationTriangle,
  FaBullhorn,
  FaBellSlash,
} from 'react-icons/fa'
import { useNotifications } from '../context/NotificationContext'

const ICONS = {
  order_update: FaTruck,
  stock_alert: FaExclamationTriangle,
  announcement: FaBullhorn,
  test: FaBell,
  general: FaBell,
}

const LABELS = {
  processing: 'Processing',
  confirmed: 'Confirmed',
  packed: 'Packed',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

/** "2 min ago" / "3 h ago" / "12 Mar" */
function relativeTime(iso) {
  if (!iso) return ''
  const then = new Date(iso.endsWith('Z') || iso.includes('+') ? iso : `${iso}Z`).getTime()
  if (Number.isNaN(then)) return ''
  const diff = Math.max(0, Date.now() - then)
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} d ago`
  return new Date(then).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

export default function NotificationBell() {
  const navigate = useNavigate()
  const {
    notifications,
    unread,
    loading,
    open,
    push,
    togglePanel,
    closePanel,
    refresh,
    markRead,
    markAllRead,
    enablePush,
    disablePush,
    panelRef,
    buttonRef,
  } = useNotifications()

  const sorted = useMemo(
    () => [...notifications].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))),
    [notifications]
  )

  const handleOpen = (notification) => {
    markRead(notification)
    const target = notification.data?.url || (notification.type === 'order_update' ? '/dashboard' : '/')
    closePanel()
    navigate(target)
  }

  const handlePushToggle = async () => {
    const result = push.subscribed ? await disablePush() : await enablePush()
    if (!result.success && result.error) {
      // Surface the real reason (permission denied, insecure origin, etc).
      console.warn('Push toggle failed:', result.error)
    }
  }

  return (
    <div className="notification-bell">
      <button
        ref={buttonRef}
        type="button"
        className={`notification-trigger ${open ? 'is-open' : ''} ${unread > 0 ? 'has-unread' : ''}`}
        onClick={togglePanel}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
      >
        <FaBell />
        {unread > 0 && (
          <span className="notification-badge" aria-hidden="true">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="notification-panel" ref={panelRef} role="dialog" aria-label="Notifications">
          <div className="notification-panel-header">
            <div>
              <h3>Notifications</h3>
              <span className="notification-panel-sub">
                {unread > 0 ? `${unread} unread` : 'You are all caught up'}
              </span>
            </div>
            <div className="notification-panel-actions">
              <button type="button" onClick={refresh} title="Refresh" aria-label="Refresh notifications">
                ⟳
              </button>
              {unread > 0 && (
                <button type="button" onClick={markAllRead} title="Mark all as read">
                  <FaCheckDouble /> Mark all
                </button>
              )}
            </div>
          </div>

          {/* Web push opt-in */}
          <div className={`push-toggle-row ${push.subscribed ? 'is-on' : ''}`}>
            <div className="push-toggle-copy">
              <strong>{push.subscribed ? 'Browser alerts on' : 'Get browser alerts'}</strong>
              <span>
                {push.subscribed
                  ? 'Order updates arrive even when this tab is closed.'
                  : push.permission === 'denied'
                    ? 'Blocked in your browser settings.'
                    : 'Order updates and offers, even when this tab is closed.'}
              </span>
            </div>
            {push.permission !== 'denied' && (
              <button
                type="button"
                className={`btn ${push.subscribed ? 'btn-outline' : 'btn-primary'} btn-small push-toggle-btn`}
                onClick={handlePushToggle}
                disabled={push.loading || !push.supported}
              >
                {push.subscribed ? <><FaBellSlash /> Off</> : 'Turn on'}
              </button>
            )}
          </div>

          <div className="notification-list">
            {loading && sorted.length === 0 && <p className="notification-empty">Loading…</p>}

            {!loading && sorted.length === 0 && (
              <div className="notification-empty-state">
                <FaBoxOpen />
                <p>No notifications yet</p>
                <span>Order updates and farm announcements will appear here.</span>
              </div>
            )}

            {sorted.map((notification) => {
              const Icon = ICONS[notification.type] || FaBell
              const orderStatus = notification.data?.status
              return (
                <button
                  type="button"
                  key={notification.notification_id}
                  className={`notification-item ${notification.read ? 'is-read' : 'is-unread'}`}
                  onClick={() => handleOpen(notification)}
                >
                  <span className={`notification-item-icon type-${notification.type}`}>
                    <Icon />
                  </span>
                  <span className="notification-item-body">
                    <span className="notification-item-title">
                      {notification.title}
                      {notification.branch_id && orderStatus && LABELS[orderStatus] && (
                        <em className="notification-item-status">{LABELS[orderStatus]}</em>
                      )}
                    </span>
                    <span className="notification-item-text">{notification.body}</span>
                    <span className="notification-item-time">{relativeTime(notification.created_at)}</span>
                  </span>
                  {!notification.read && <span className="notification-item-dot" aria-label="Unread" />}
                </button>
              )
            })}
          </div>

          <div className="notification-panel-footer">
            <FaCheck /> Notifications are saved to your account
          </div>
        </div>
      )}
    </div>
  )
}
