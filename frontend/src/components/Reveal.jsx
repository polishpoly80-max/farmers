import { Children, cloneElement, isValidElement, useEffect, useRef, useState } from 'react'

/**
 * Reveals children when they scroll into view.
 *
 * The repo already had IntersectionObserver hooks, but almost nothing called
 * them, so sections simply appeared. This wraps the pattern in a component so a
 * page can opt in with one attribute instead of wiring a ref per element.
 *
 * Accessibility: the content is hidden with opacity only until it is released.
 * If JavaScript or IntersectionObserver is unavailable the element is left
 * visible, and the reduced-motion stylesheet forces every target visible, so
 * content can never be stranded behind an animation that never runs.
 */
export default function Reveal({
  children,
  as: Tag = 'div',
  direction = 'up',
  delay = 0,
  threshold = 0.15,
  className = '',
  ...rest
}) {
  const ref = useRef(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const el = ref.current
    // No observer support: show the content rather than hide it forever.
    if (!el || typeof IntersectionObserver === 'undefined') {
      setShown(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true)
          observer.disconnect()
        }
      },
      { threshold, rootMargin: '0px 0px -60px 0px' }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold])

  return (
    <Tag
      ref={ref}
      data-reveal={direction}
      className={`${shown ? 'is-revealed' : ''} ${className}`.trim()}
      style={delay ? { '--reveal-delay': `${delay}ms` } : undefined}
      {...rest}
    >
      {children}
    </Tag>
  )
}

/**
 * Reveals a list with a per-item delay. Cheaper than mounting one observer per
 * card: a single observer watches the container and releases children in order.
 *
 * The reveal attributes are cloned onto the children rather than wrapping each
 * one in a div. Wrapping would insert an extra element between the grid and its
 * cards, which silently breaks any `grid > *` or `:nth-child` rule.
 */
export function RevealGroup({
  children,
  as: Tag = 'div',
  step = 70,
  maxStep = 6,
  className = '',
  ...rest
}) {
  const ref = useRef(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setShown(true)
      return
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true)
          observer.disconnect()
        }
      },
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <Tag ref={ref} className={className} {...rest}>
      {Children.map(children, (child, i) => {
        if (!isValidElement(child)) return child
        const delay = `${Math.min(i, maxStep) * step}ms`
        return cloneElement(child, {
          'data-reveal': child.props['data-reveal'] || 'up',
          className: [child.props.className, shown ? 'is-revealed' : '']
            .filter(Boolean)
            .join(' '),
          style: { ...child.props.style, '--reveal-delay': delay },
        })
      })}
    </Tag>
  )
}
