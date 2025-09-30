// app/(dashboard)/dashboard/gallery/page.tsx
export const dynamic = 'force-dynamic';
import { unstable_noStore as noStore } from 'next/cache';
import type React from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { GalleryHeroClient } from "@/components/GalleryHeroClient"

export default function Page() {
  noStore()
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
        <SiteHeader name="Gallery (Hero Image)" />
        <div className="mx-auto max-w-4xl p-4 md:p-8">
          <GalleryHeroClient />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
