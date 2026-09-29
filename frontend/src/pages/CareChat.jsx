import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  FaArrowLeft, FaComments, FaCopy, FaExternalLinkAlt, FaHeadset,
  FaPaperPlane, FaPhone, FaShieldAlt, FaVideo, FaCircle,
} from 'react-icons/fa'
import { toast } from 'react-toastify'
import { useAuth } from '../context/AuthContext'
import { useBranch } from '../context/BranchContext'
import {
  createCareSession, getCareSessions, getCareSession, sendCareMessage,
  markCareSessionRead, updateCareSessionStatus,
} from '../services/api'

const POLL_MS = 5000
const STATUS_LABELS = {
  waiting: 'Waiting for staff',
  accepted: 'In progress',
  resolved: 'Resolved',
  closed: 'Closed',
}
const FILTERS = [
  { id: 'open', label: 'Open' },
  { id: 'waiting', label: 'Waiting' },
  { id: 'all', label: 'All' },
]

function roleLabel(role) {
  if (role === 'super_admin') return 'Super Admin'
  if (role === 'worker') return 'Worker'
  if (role === 'admin') return 'Branch Admin'
  return 'Customer'
}

export default function CareChat() {
  const { user, role, isBranchStaff, isSuperAdmin } = useAuth()
  const { branches, currentBranch } = useBranch()

  const [sessions, setSessions] = useState([])
  const [filter, setFilter] = useState('open')
  const [activeId, setActiveId] = useState(null)
  const [active, setActive] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [draft, setDraft] = useState('')
  const [roomOpen, setRoomOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  // New request form (customers)
  const [topic, setTopic] = useState('Order help')
  const [branchId, setBranchId] = useState(currentBranch?.branch_id || '')
  const [message, setMessage] = useState('')
  const [requesting, setRequesting] = useState(false)

  const threadRef = useRef(null)
  const displayName = user?.full_name || user?.email || 'Guest'

  // ---- data loading -------------------------------------------------------
  const loadSessions = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true)
    try {
      const params = filter === 'open' ? { status: 'open' } : { status: filter }
      const data = await getCareSessions(params)
      setSessions(data.sessions || [])
    } catch (e) {
      if (!quiet) toast.error(e.message || 'Could not load care conversations')
    } finally {
      if (!quiet) setLoading(false)
    }
  }, [filter])

  const loadActive = useCallback(async (id, { quiet = false } = {}) => {
    if (!id) {
      setActive(null)
      return
    }
    try {
      const data = await getCareSession(id)
      setActive(data.session || null)
      markCareSessionRead(id).catch(() => {})
    } catch (e) {
      if (!quiet) toast.error(e.message || 'Could not open that conversation')
    }
  }, [])

  useEffect(() => { loadSessions() }, [loadSessions])

  useEffect(() => { loadActive(activeId) }, [activeId, loadActive])

  // Light polling so replies show up without a manual refresh.
  useEffect(() => {
    const tick = () => {
      loadSessions({ quiet: true })
      if (activeId) loadActive(activeId, { quiet: true })
    }
    const id = window.setInterval(tick, POLL_MS)
    return () => window.clearInterval(id)
  }, [loadSessions, loadActive, activeId])

  // Keep the thread pinned to the newest message.
  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight
  }, [active?.messages?.length, activeId])

  // ---- actions ------------------------------------------------------------
  const handleRequest = async (e) => {
    e.preventDefault()
    if (message.trim().length < 5) {
      toast.error('Tell us a little more so staff can help')
      return
    }
    setRequesting(true)
    try {
      const res = await createCareSession({
        branch_id: branchId || currentBranch?.branch_id || undefined,
        topic,
        message: message.trim(),
      })
      setMessage('')
      await loadSessions()
      if (res?.session?.session_id) setActiveId(res.session.session_id)
      toast.success('Support request sent — branch staff were notified')
    } catch (err) {
      toast.error(err.message || 'Could not send your request')
    } finally {
      setRequesting(false)
    }
  }

  const handleSend = async (e) => {
    e.preventDefault()
    const text = draft.trim()
    if (!text || !activeId) return
    setSending(true)
    try {
      const res = await sendCareMessage(activeId, text)
      setDraft('')
      if (res?.session) setActive(res.session)
      loadSessions({ quiet: true })
    } catch (err) {
      toast.error(err.message || 'Message not sent')
    } finally {
      setSending(false)
    }
  }

  const handleStatus = async (status) => {
    if (!activeId) return
    try {
      const res = await updateCareSessionStatus(activeId, status)
      if (res?.session) setActive(res.session)
      loadSessions()
      toast.success(`Conversation marked ${status}`)
    } catch (err) {
      toast.error(err.message || 'Could not update the conversation')
    }
  }

  const copyRoom = async () => {
    if (!active?.room_url) return
    try {
      await navigator.clipboard?.writeText(active.room_url)
    } catch {
      /* clipboard blocked outside a secure context - the link is shown anyway */
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  // ---- derived ------------------------------------------------------------
  const counts = useMemo(() => {
    const waiting = sessions.filter(s => s.status === 'waiting').length
    const unread = sessions.reduce((sum, s) => sum + (s.viewer_unread || 0), 0)
    return { waiting, unread }
  }, [sessions])

  const canAct = isBranchStaff

  return (
    <div className="care-chat-page">
      <div className="container">
        <Link to={canAct ? '/admin' : '/dashboard'} className="back-link">
          <FaArrowLeft /> Back to dashboard
        </Link>

        <header className="care-chat-header">
          <div>
            <span className="care-chat-eyebrow"><FaHeadset /> Customer care</span>
            <h1>{canAct ? 'Branch support desk' : 'Get help from the farm'}</h1>
            <p>
              {canAct
                ? 'Answer customers with live video, voice, and a written thread.'
                : 'Ask a question and your branch team replies here, with optional live video.'}
            </p>
          </div>
          <div className="care-chat-role">
            <FaShieldAlt /> {roleLabel(role)}
            {counts.unread > 0 && <span className="care-unread-badge">{counts.unread}</span>}
          </div>
        </header>

        <div className="care-chat-layout">
          {/* ---------------- conversation list ---------------- */}
          <section className="care-chat-panel care-chat-queue">
            <div className="care-chat-panel-heading">
              <div>
                <h2>{canAct ? 'Care queue' : 'My conversations'}</h2>
                <p>
                  {canAct
                    ? `${counts.waiting} waiting for a reply at ${user?.tenant_name || 'your branch'}.`
                    : 'Every request you send to the farm team.'}
                </p>
              </div>
              <FaComments />
            </div>

            <div className="care-chat-filters">
              {FILTERS.map(f => (
                <button
                  key={f.id}
                  className={filter === f.id ? 'active' : ''}
                  onClick={() => setFilter(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="care-chat-thread-list">
              {loading && <p className="care-chat-hint">Loading conversations...</p>}
              {!loading && sessions.length === 0 && (
                <p className="care-chat-hint">
                  {canAct ? 'No open requests. New ones appear here instantly.' : 'No conversations yet.'}
                </p>
              )}
              {sessions.map(s => (
                <button
                  key={s.session_id}
                  className={`care-thread-item ${activeId === s.session_id ? 'active' : ''}`}
                  onClick={() => { setActiveId(s.session_id); setRoomOpen(false) }}
                >
                  <div className="care-thread-item-top">
                    <strong>{canAct ? (s.customer_name || s.customer_email) : s.topic}</strong>
                    {s.viewer_unread > 0 && <span className="care-unread-dot">{s.viewer_unread}</span>}
                  </div>
                  <div className="care-thread-item-meta">
                    <span className={`care-status ${s.status}`}>{STATUS_LABELS[s.status] || s.status}</span>
                    <span>{s.branch_name || 'Branch'}</span>
                  </div>
                  <p>{s.last_message || s.topic}</p>
                </button>
              ))}
            </div>
          </section>

          {/* ---------------- active conversation ---------------- */}
          <section className="care-chat-panel care-chat-conversation">
            {!active ? (
              <div className="care-chat-empty">
                <FaHeadset />
                <h2>{canAct ? 'Pick a request to answer' : 'Select a conversation'}</h2>
                <p>Each conversation has its own private live room and message history.</p>
              </div>
            ) : (
              <>
                <div className="care-chat-panel-heading">
                  <div>
                    <h2>{active.topic}</h2>
                    <p>
                      <span className={`care-status ${active.status}`}>{STATUS_LABELS[active.status]}</span>
                      {' • '}{active.branch_name || 'Branch'}
                      {active.order_id && <> {' • '}Order {active.order_id}</>}
                    </p>
                  </div>
                  <span className="care-session-id">{active.session_id}</span>
                </div>

                {canAct && (
                  <div className="care-customer-card">
                    <div>
                      <strong>{active.customer_name || 'Customer'}</strong>
                      <span>{active.customer_email}</span>
                    </div>
                    {active.assigned_name && <span className="care-assigned">Handled by {active.assigned_name}</span>}
                  </div>
                )}

                <div className="care-thread" ref={threadRef}>
                  {active.messages.map(m => (
                    <div
                      key={m.message_id}
                      className={`care-bubble ${m.sender_role === 'customer' ? 'from-customer' : 'from-staff'}`}
                    >
                      <div className="care-bubble-head">
                        <strong>{m.sender_name || 'Guest'}</strong>
                        <span>{roleLabel(m.sender_role === 'staff' ? 'admin' : 'customer')}</span>
                      </div>
                      <p>{m.body}</p>
                      <time>{String(m.created_at || '').replace('T', ' ').slice(0, 16)}</time>
                    </div>
                  ))}
                </div>

                {canAct && (
                  <div className="care-staff-actions">
                    {active.status === 'waiting' && (
                      <button className="btn btn-primary btn-small" onClick={() => handleStatus('accepted')}>
                        <FaCircle /> Accept request
                      </button>
                    )}
                    {active.status !== 'resolved' && active.status !== 'closed' && (
                      <button className="btn btn-outline btn-small" onClick={() => handleStatus('resolved')}>
                        Mark resolved
                      </button>
                    )}
                    <button className="btn btn-outline btn-small" onClick={() => setRoomOpen(v => !v)}>
                      <FaVideo /> {roomOpen ? 'Hide video room' : 'Start live video'}
                    </button>
                    <button className="btn btn-outline btn-small" onClick={copyRoom}>
                      <FaCopy /> {copied ? 'Copied' : 'Copy invite link'}
                    </button>
                    {active.room_url && (
                      <a className="btn btn-outline btn-small" href={active.room_url} target="_blank" rel="noreferrer">
                        <FaExternalLinkAlt /> Open Jitsi
                      </a>
                    )}
                  </div>
                )}

                {roomOpen && active.room_url && (
                  <div className="care-chat-room">
                    <iframe
                      title={`${active.branch_name || 'Branch'} customer care room`}
                      src={active.room_url}
                      allow="camera; microphone; fullscreen; display-capture; autoplay"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                )}

                <form className="care-composer" onSubmit={handleSend}>
                  <textarea
                    rows="2"
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    placeholder={canAct ? 'Reply to the customer...' : 'Write a message to the farm team...'}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) handleSend(e) }}
                  />
                  <button type="submit" className="btn btn-primary" disabled={sending || !draft.trim()}>
                    <FaPaperPlane /> Send
                  </button>
                </form>
                {!canAct && (
                  <button className="care-video-cta" onClick={() => setRoomOpen(v => !v)}>
                    <FaVideo /> {roomOpen ? 'Hide live video' : 'Talk to staff live (video)'}
                  </button>
                )}
              </>
            )}
          </section>
        </div>

        {/* ---------------- new request (customers) ---------------- */}
        {!canAct && (
          <section className="care-new-request">
            <h2><FaHeadset /> Start a new support request</h2>
            <form onSubmit={handleRequest}>
              <div className="care-form-row">
                <label>
                  Branch
                  <select value={branchId || currentBranch?.branch_id || ''} onChange={e => setBranchId(e.target.value)}>
                    {branches.map(b => (
                      <option key={b.branch_id} value={b.branch_id}>{b.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Topic
                  <select value={topic} onChange={e => setTopic(e.target.value)}>
                    <option>Order help</option>
                    <option>Delivery question</option>
                    <option>Bulk pricing</option>
                    <option>Product quality</option>
                    <option>Something else</option>
                  </select>
                </label>
              </div>
              <label>
                How can we help?
                <textarea
                  rows="3"
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Describe your question and include an order number if you have one."
                />
              </label>
              <button type="submit" className="btn btn-primary btn-large" disabled={requesting}>
                <FaPaperPlane /> {requesting ? 'Sending...' : 'Send request'}
              </button>
            </form>
            <p className="care-hint"><FaPhone /> Prefer a voice call? The branch team can start a live video room from any conversation.</p>
          </section>
        )}
      </div>
    </div>
  )
}
