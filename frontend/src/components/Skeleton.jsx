/**
 * Loading placeholders.
 *
 * The app had no loading state at all on its data-heavy screens, so a page
 * either sat blank or flashed empty content while requests were in flight. A
 * skeleton keeps the layout stable and signals progress without the jump of a
 * spinner, which reads as a broken page.
 *
 * Shapes mirror the real layout (image block, two text lines) so nothing shifts
 * when the data lands. No icon or emoji is used for decoration.
 */

export function Skeleton({ className = '', style, ...rest }) {
  return <span className={`skeleton ${className}`.trim()} style={style} aria-hidden="true" {...rest} />
}

export function SkeletonText({ lines = 3, lastLine = 'medium' }) {
  const widths = ['full', 'full', 'full', 'medium', 'short']
  return (
    <div className="skeleton-stack" aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className="skeleton-text"
          style={{ width: i === lines - 1 ? `var(--skeleton-last, ${lastLine === 'short' ? 45 : 70}%)` : '100%' }}
        />
      ))}
    </div>
  )
}

export function SkeletonCard() {
  return (
    <div className="skeleton skeleton-product-card" aria-hidden="true" />
  )
}

export function SkeletonProductGrid({ count = 8 }) {
  return (
    <div
      className="products-grid"
      role="status"
      aria-live="polite"
      aria-label="Loading products"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-card-wrap">
          <SkeletonCard />
        </div>
      ))}
    </div>
  )
}

export function SkeletonRows({ count = 4, height = 64 }) {
  return (
    <div className="skeleton-stack" role="status" aria-live="polite" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} style={{ height: `${height}px`, borderRadius: 'var(--radius-sm)' }} />
      ))}
    </div>
  )
}

export function SkeletonStats({ count = 4 }) {
  return (
    <div className="overview-stats" role="status" aria-live="polite" aria-label="Loading statistics">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="overview-stat" style={{ pointerEvents: 'none' }}>
          <Skeleton className="skeleton-circle" style={{ width: 28, height: 28 }} />
          <div style={{ flex: 1 }}>
            <Skeleton className="skeleton-title" style={{ width: '60%' }} />
            <Skeleton className="skeleton-text skeleton-line-short" />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Small inline spinner for buttons and short waits. */
export function Spinner({ large = false }) {
  return (
    <span
      className={`spinner${large ? ' spinner-lg' : ''}`}
      role="status"
      aria-label={large ? 'Loading' : undefined}
    />
  )
}

/**
 * A button that shows a spinner while an action is in flight and blocks repeat
 * submits. Returns a real <button> so it inherits whatever classes the caller
 * passes instead of restating button styles.
 */
export function PendingButton({ pending, children, disabled, className = '', ...rest }) {
  return (
    <button className={className} disabled={pending || disabled} aria-busy={pending || undefined} {...rest}>
      {pending && <Spinner />}
      <span>{children}</span>
    </button>
  )
}
