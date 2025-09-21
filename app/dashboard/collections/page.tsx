// app/(dashboard)/dashboard/collections/page.tsx
import type React from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

import { db } from "@/lib/firebase"
import { collection, getDocs, query } from "firebase/firestore"

import { CollectionTableWithSearch } from "@/components/collections-data-table"
import type { CollectionRow } from "@/components/collections-table"

async function getCollections(): Promise<CollectionRow[]> {
  const q = query(collection(db, "collections"))
  const snapshot = await getDocs(q)

  const rows: CollectionRow[] = snapshot.docs.map((doc) => {
    const c: any = doc.data()
    const productsCount = Array.isArray(c.products) ? c.products.length : Number(c.productsCount ?? 0)
    return {
      id: String(doc.id),
      name: String(c.name ?? "Untitled Collection"),
      productsCount: productsCount,
    }
  })

  return rows
}

export default async function Page() {
  const collections = await getCollections()

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
        <SiteHeader name="Collections" />
        <CollectionTableWithSearch collections={collections} />
      </SidebarInset>
    </SidebarProvider>
  )
}
