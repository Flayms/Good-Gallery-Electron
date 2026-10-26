import { createFileRoute } from '@tanstack/react-router'
import { APP_HEADER_HEIGHT, AppHeader, scrollbarInset } from '@/components/app-header'
import { GeneralSettings } from '@/components/general-settings'
import { LibrarySettings } from '@/components/library-settings'
import { SidebarTrigger } from '@/components/ui/sidebar'

export const Route = createFileRoute('/settings')({ component: SettingsPage })

function SettingsPage() {
  return (
    <div className="relative min-h-0 flex-1">
      <AppHeader>
        <SidebarTrigger className="no-drag" />
        <h1 className="font-semibold">Settings</h1>
      </AppHeader>
      <div
        className="h-full overflow-y-auto"
        style={{ paddingTop: APP_HEADER_HEIGHT, ...scrollbarInset(APP_HEADER_HEIGHT) }}
      >
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 p-6">
          <LibrarySettings />
          <GeneralSettings />
        </div>
      </div>
    </div>
  )
}
