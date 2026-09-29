import { useEffect, useRef, useState } from 'react'
import { FaMapMarkerAlt, FaChevronDown, FaCheck, FaClock } from 'react-icons/fa'
import { useBranch } from '../context/BranchContext'

/**
 * Farm-branch picker. Shows the selected branch in the header and lets the
 * customer switch; stock, delivery fee and free-delivery threshold all follow
 * the chosen branch.
 */
export default function BranchSelector({ compact = false }) {
  const { branches, currentBranch, loading, selectBranch } = useBranch()
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  if (loading && !currentBranch) {
    return (
      <div className={`branch-selector ${compact ? 'compact' : ''} is-loading`} aria-busy="true">
        <FaMapMarkerAlt />
        <span className="branch-selector-label">Loading branches…</span>
      </div>
    )
  }

  if (!branches.length) return null

  const label = currentBranch
    ? currentBranch.city
      ? `${currentBranch.name} · ${currentBranch.city}`
      : currentBranch.name
    : 'Choose a branch'

  return (
    <div className={`branch-selector ${compact ? 'compact' : ''} ${open ? 'is-open' : ''}`} ref={rootRef}>
      <button
        type="button"
        className="branch-selector-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        title={currentBranch?.address || 'Select your farm branch'}
      >
        <FaMapMarkerAlt className="branch-selector-icon" />
        <span className="branch-selector-label">{label}</span>
        <FaChevronDown className="branch-selector-caret" />
      </button>

      {open && (
        <div className="branch-selector-panel" role="listbox" aria-label="Farm branches">
          <div className="branch-selector-heading">
            <strong>Fulfill from</strong>
            <span>Pick the farm branch nearest you</span>
          </div>

          <ul className="branch-selector-list">
            {branches.map((branch) => {
              const selected = currentBranch?.branch_id === branch.branch_id
              const closed = branch.is_accepting_orders === false
              return (
                <li key={branch.branch_id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={`branch-option ${selected ? 'is-selected' : ''} ${closed ? 'is-closed' : ''}`}
                    onClick={async () => {
                      await selectBranch(branch.branch_id)
                      setOpen(false)
                    }}
                  >
                    <span className="branch-option-main">
                      <span className="branch-option-name">
                        {branch.name}
                        {branch.code && <em className="branch-code">{branch.code}</em>}
                      </span>
                      <span className="branch-option-address">
                        {[branch.address, branch.city, branch.region].filter(Boolean).join(', ') || 'Address pending'}
                      </span>
                      <span className="branch-option-meta">
                        {closed ? (
                          <span className="branch-closed">Not accepting orders</span>
                        ) : (
                          <>
                            {branch.opening_hours && (
                              <span className="branch-hours"><FaClock /> {branch.opening_hours}</span>
                            )}
                            <span>
                              {branch.delivery_fee > 0
                                ? `$${Number(branch.delivery_fee).toFixed(2)} delivery · free over $${Number(branch.free_delivery_threshold).toFixed(0)}`
                                : 'Free delivery'}
                            </span>
                          </>
                        )}
                      </span>
                    </span>
                    {selected && <FaCheck className="branch-option-check" />}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
