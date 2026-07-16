'use client'

import { useState, type ReactNode } from 'react'

interface CardImageProps {
  src: string | null
  alt: string
  className?: string
  width?: number
  height?: number
  loading?: 'lazy' | 'eager'
  /** Rendered when there is no src or the image fails to load. */
  fallback: ReactNode
}

// A card <img> that falls back to a placeholder instead of the browser's broken
// -image icon when the source is missing or 404s (our image proxy returns a
// non-OK status when upstream has no image). Client component so `onError`
// works even inside server-rendered pages.
export default function CardImage({
  src,
  alt,
  className,
  width,
  height,
  loading = 'lazy',
  fallback,
}: CardImageProps) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) return <>{fallback}</>
  return (
    // eslint-disable-next-line @next/next/no-img-element -- card art is served
    // through our own proxy/CDN; next/image would add config for no benefit here
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      loading={loading}
      className={className}
      onError={() => setFailed(true)}
    />
  )
}
