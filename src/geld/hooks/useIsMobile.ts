import { useEffect, useState } from 'react'

export function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(window.innerWidth < breakpoint)
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < breakpoint)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [breakpoint])
  return isMobile
}
