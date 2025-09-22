// ProductTableWithSearch.tsx
'use client'

import { useMemo, useState } from "react"
import { DataTable, ProductRow } from "./data-table"
import { PlusCircle } from "lucide-react"
import { Input } from "./ui/input"
import { Button } from "./ui/button"
import Link from "next/link"

export function ProductTableWithSearch({ products }: { products: ProductRow[] }) {
  const [search, setSearch] = useState("")

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return products
    return products.filter((p) => {
      const title  = (p.title ?? "").toString().toLowerCase()
      const price  = (p.price ?? "").toString().toLowerCase()
      const stock  = (p.stock ?? "").toString().toLowerCase()
      const rating = (p.rating ?? "").toString().toLowerCase()
      return (
        title.includes(q) ||
        price.includes(q) ||
        stock.includes(q) ||
        rating.includes(q)
      )
    })
  }, [products, search])
  console.log("Filtered products:", products  )
  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col mx-4 lg:mx-7 gap-2">
        <div className="flex items-center justify-between gap-4 py-4 md:gap-6 md:py-6">
          {/* Search bar */}
          <Input
            type="text"
            placeholder="Search products..."
            className="border rounded px-3 py-2 w-full max-w-xs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {/* Add Product button */}
          <Link href="/dashboard/products/add">
            <Button className="inline-flex items-center gap-2">
              Add product <PlusCircle className="size-4" />
            </Button>
          </Link>
        </div>

        <div className="flex flex-col gap-4">
          <DataTable data={filtered} />
        </div>
      </div>
    </div>
  )
}
