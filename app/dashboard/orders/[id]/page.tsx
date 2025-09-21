// app/(dashboard)/dashboard/orders/[id]/page.tsx
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import type React from "react"

import { db } from "@/lib/firebase"
import { doc, getDoc } from "firebase/firestore"

import { OrderDetailClient } from "@/components/order-detail-client"

// Server fetch of a single order
async function getOrder(orderId: string) {
  const snap = await getDoc(doc(db, "orders", orderId))
  if (!snap.exists()) return null
  const data: any = snap.data()
  return {
    id: snap.id,
    orderNumber: String(data.orderNumber ?? snap.id),
    status: String(data.status ?? "pending"),
    currency: String(data.currency ?? "LEK"),
    pricing: {
      subtotal: Number(data?.pricing?.subtotal ?? 0),
      shipping: Number(data?.pricing?.shipping ?? 0),
      total: Number(data?.pricing?.total ?? 0),
    },
    shippingInfo: data?.shippingInfo ?? null,
    items: Array.isArray(data?.items) ? data.items : [],
    createdAt: data?.meta?.createdAt ?? null,
  }
}

export default async function Page({ params }: { params: { id: string } }) {
  const order = await getOrder(params.id)

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
        <SiteHeader name="Order Detail" />
        <div className="mx-auto max-w-5xl p-4 md:p-8">
          {!order ? (
            <div className="text-muted-foreground">Order not found.</div>
          ) : (
            <OrderDetailClient order={order} />
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
