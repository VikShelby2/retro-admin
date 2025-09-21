// components/collections-data-table.tsx
'use client'

import { useMemo, useState } from "react"
import Link from "next/link"
import { PlusCircle } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import type { CollectionRow } from "./collections-table"
import { CollectionsTable } from "./collections-table"

export function CollectionTableWithSearch({ collections }: { collections: CollectionRow[] }) {
  const [search, setSearch] = useState("")

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return collections
    return collections.filter((c) => {
      const name = (c.name ?? "").toString().toLowerCase()
      const count = (c.productsCount ?? "").toString().toLowerCase()
      return name.includes(q) || count.includes(q)
    })
  }, [collections, search])

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col mx-4 lg:mx-7 gap-2">
        <div className="flex items-center justify-between gap-4 py-4 md:gap-6 md:py-6">
          {/* Search */}
          <Input
            type="text"
            placeholder="Search collections..."
            className="border rounded px-3 py-2 w-full max-w-xs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {/* Add Collection */}
          <Link href="/dashboard/collections/add">
            <Button className="inline-flex items-center gap-2">
              Add collection <PlusCircle className="size-4" />
            </Button>
          </Link>
        </div>

        <div className="flex flex-col gap-4">
          <CollectionsTable data={filtered} />
        </div>
      </div>
    </div>
  )
}
