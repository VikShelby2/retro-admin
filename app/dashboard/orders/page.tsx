// app/(dashboard)/dashboard/orders/page.tsx
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

import { db } from "@/lib/firebase"
import { collection, getDocs, query } from "firebase/firestore"
import type React from "react"

import { OrdersTableWithSearch } from "@/components/orders-data-table"
import type { OrderRow } from "@/components/orders-table"

// Server-safe fetch of minimal fields for the table
async function getOrders(): Promise<OrderRow[]> {
  const qRef = query(collection(db, "orders"))
  const snap = await getDocs(qRef)

  const rows: OrderRow[] = snap.docs.map((doc) => {
    const o: any = doc.data()
    const id = String(doc.id)
    const orderNumber = String(o.orderNumber ?? id)
    const status = String(o.status ?? "pending")
    const itemsCount = Array.isArray(o.items) ? o.items.length : 0
    const total = Number(o?.pricing?.total ?? 0)

    return {
      id,
      orderNumber,
      itemsCount,
      status,
      total,
    }
  })

  return rows
}

export default async function Page() {
  const orders = await getOrders()

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
        <SiteHeader name="Orders" />
        <OrdersTableWithSearch orders={orders} />
      </SidebarInset>
    </SidebarProvider>
  )
}
