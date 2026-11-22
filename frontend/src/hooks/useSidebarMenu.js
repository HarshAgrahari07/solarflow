import { useCallback, useEffect, useState } from 'react'

export default function useSidebarMenu() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const toggleSidebar = useCallback(() => setSidebarOpen((open) => !open), [])
  const closeSidebar = useCallback(() => setSidebarOpen(false), [])

  useEffect(() => {
    const desktopViewport = window.matchMedia('(min-width: 961px)')
    const closeOnDesktop = (event) => {
      if (event.matches) closeSidebar()
    }

    if (desktopViewport.addEventListener) {
      desktopViewport.addEventListener('change', closeOnDesktop)
      return () => desktopViewport.removeEventListener('change', closeOnDesktop)
    }

    desktopViewport.addListener(closeOnDesktop)
    return () => desktopViewport.removeListener(closeOnDesktop)
  }, [closeSidebar])

  useEffect(() => {
    if (!sidebarOpen) return undefined
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') closeSidebar()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [closeSidebar, sidebarOpen])

  return { sidebarOpen, toggleSidebar, closeSidebar }
}
