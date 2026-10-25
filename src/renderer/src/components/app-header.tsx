import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Height of the app header, which is also the height of the window's title bar (`TITLE_BAR_HEIGHT` in main). */
export const APP_HEADER_HEIGHT = 48

/**
 * Glass bar over the top of a page that doubles as the window's title bar: its empty areas move the window, and the
 * native window controls' area stays free. The page content scrolls underneath it, so pages pad their content by
 * `APP_HEADER_HEIGHT`. Interactive children need `no-drag`.
 */
export function AppHeader({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <header
      className={cn(
        'drag-region glass-bar titlebar-pad-right absolute inset-x-0 top-0 z-20 flex items-center gap-2 pl-3',
        // With the sidebar hidden, macOS's window controls sit on the left of the header.
        'group-has-data-[state=collapsed]/sidebar-wrapper:titlebar-pad-left',
        className,
      )}
      style={{ height: APP_HEADER_HEIGHT }}
    >
      {children}
    </header>
  )
}
