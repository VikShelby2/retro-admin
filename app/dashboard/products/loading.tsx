// app/dashboard/products/loading.tsx
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

export default function Loading() {
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader name="Products" />
        <div className="mx-4 lg:mx-7 mt-4 space-y-4">
          {/* search bar skeleton */}
          <div className="flex items-center justify-between gap-4 py-4">
            <div className="h-10 w-64 rounded-md bg-muted animate-pulse" />
            <div className="h-10 w-36 rounded-md bg-muted animate-pulse" />
          </div>
          {/* table skeleton: header + rows */}
          <div className="w-full rounded-xl border">
            <div className="h-12 border-b bg-muted/50 animate-pulse rounded-t-xl" />
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-12 border-b animate-pulse" />
            ))}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
