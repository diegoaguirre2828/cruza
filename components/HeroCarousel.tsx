'use client'

import { useRef, useState, useEffect, type ReactNode } from 'react'
import { useLang } from '@/lib/LangContext'

// Swipeable hero container. Hosts multiple high-value slides in the
// same vertical space at the top of the home page, letting users
// choose what to look at first via native horizontal swipe.
//
// Why this exists: before this, the home page either showed
// HeroLiveDelta (signed-in users) OR LiveActivityTicker (guests),
// never both. Signed-in users lost visibility into community
// reporting, and the one-at-a-time layout wasted the slot.
//
// Implementation uses CSS scroll-snap + overflow-x-auto for zero-JS
// swipe behavior that works identically on touch and mouse/trackpad.
// Scroll position is tracked on the container to update the active
// dot indicator, and clicking a dot scrolls to that slide.

interface Slide {
  key: string
  labelEs: string
  labelEn: string
  content: ReactNode
}

interface Props {
  slides: Slide[]
}

export function HeroCarousel({ slides }: Props) {
  const { lang } = useLang()
  const es = lang === 'es'
  const containerRef = useRef<HTMLDivElement>(null)
  const [activeIdx, setActiveIdx] = useState(0)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleScroll = () => {
      const width = container.clientWidth
      if (width === 0) return
      const idx = Math.round(container.scrollLeft / width)
      setActiveIdx(Math.min(idx, slides.length - 1))
    }

    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => container.removeEventListener('scroll', handleScroll)
  }, [slides.length])

  function scrollTo(idx: number) {
    const container = containerRef.current
    if (!container) return
    container.scrollTo({ left: idx * container.clientWidth, behavior: 'smooth' })
  }

  if (slides.length === 0) return null

  return (
    <div className="mt-3">
      <div
        ref={containerRef}
        className="flex overflow-x-auto snap-x snap-mandatory"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <style jsx>{`
          div::-webkit-scrollbar { display: none; }
        `}</style>
        {slides.map((slide) => (
          <div key={slide.key} className="snap-start flex-shrink-0 w-full">
            {slide.content}
          </div>
        ))}
      </div>

      {/* Tab indicators — clickable dots with active-slide label */}
      <div className="flex items-center justify-center gap-3 mt-2">
        <div className="flex items-center gap-1.5">
          {slides.map((slide, idx) => (
            <button
              key={slide.key}
              onClick={() => scrollTo(idx)}
              aria-label={`Go to ${es ? slide.labelEs : slide.labelEn}`}
              className={`h-1.5 rounded-full transition-all ${
                idx === activeIdx
                  ? 'w-8 bg-blue-600 dark:bg-blue-400'
                  : 'w-1.5 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500'
              }`}
            />
          ))}
        </div>
        <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          {es ? slides[activeIdx].labelEs : slides[activeIdx].labelEn}
        </span>
      </div>
    </div>
  )
}
