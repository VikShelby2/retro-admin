// components/orders-data-table.tsx
"use client"

import { useMemo, useState } from "react"
import { Input } from "./ui/input"
import { DataTable, type OrderRow } from "./orders-table"

export function OrdersTableWithSearch({ orders }: { orders: OrderRow[] }) {
  const [search, setSearch] = useState("")

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return orders
    return orders.filter((o) => {
      const id = (o.id ?? "").toString().toLowerCase()
      const number = (o.orderNumber ?? "").toString().toLowerCase()
      const status = (o.status ?? "").toString().toLowerCase()
      const items = (o.itemsCount ?? "").toString().toLowerCase()
      return id.includes(q) || number.includes(q) || status.includes(q) || items.includes(q)
    })
  }, [orders, search])

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col mx-4 lg:mx-7 gap-2">
        <div className="flex items-center justify-between gap-4 py-4 md:gap-6 md:py-6">
          <Input
            type="text"
            placeholder="Search orders by number, id, or status..."
            className="border rounded px-3 py-2 w-full max-w-xl"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {/* no add button for orders */}
        </div>

        <div className="flex flex-col gap-4">
          <DataTable data={filtered} />
        </div>
      </div>
    </div>
  )
}
