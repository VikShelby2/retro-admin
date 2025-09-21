// components/collections-table.tsx
'use client'

import * as React from "react"
import Link from "next/link"
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core"
import { restrictToVerticalAxis } from "@dnd-kit/modifiers"
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

import {
  ColumnDef,
  Row,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"

import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Pencil, Trash2 } from "lucide-react"
import { IconGripVertical, IconChevronLeft, IconChevronRight, IconChevronsLeft, IconChevronsRight } from "@tabler/icons-react"
import { useState, useMemo } from "react"
import { db, storage } from "@/lib/firebase"
import { deleteDoc, doc } from "firebase/firestore"
import { deleteObject, ref as storageRef } from "firebase/storage"

// ==========================
// 1) Schema / Row type
// ==========================
export const collectionSchema = z.object({
  id: z.string(),
  name: z.string(),
  productsCount: z.union([z.string(), z.number()]),
  imageKey: z.string().nullable().optional(), // 👈 optional cover image key (for cleanup)
})
export type CollectionRow = z.infer<typeof collectionSchema>

// ==========================
// 2) Drag handle
// ==========================
function DragHandle({ id }: { id: UniqueIdentifier }) {
  const { attributes, listeners } = useSortable({ id })
  return (
    <Button
      {...attributes}
      {...listeners}
      variant="ghost"
      size="icon"
      className="text-muted-foreground size-7 hover:bg-transparent cursor-grab active:cursor-grabbing"
    >
      <IconGripVertical className="text-muted-foreground size-3" />
      <span className="sr-only">Drag to reorder</span>
    </Button>
  )
}

// ==========================
// 3) Sortable data row
// ==========================
function DraggableRow({ row }: { row: Row<CollectionRow> }) {
  const { transform, transition, setNodeRef, isDragging } = useSortable({ id: row.original.id })
  return (
    <TableRow
      data-dragging={isDragging}
      ref={setNodeRef}
      className="relative z-0 data-[dragging=true]:z-10 data-[dragging=true]:opacity-80"
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      {row.getVisibleCells().map((cell) => (
        <TableCell key={cell.id}>
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))}
    </TableRow>
  )
}

// ==========================
// 4) DataTable
// ==========================
export function CollectionsTable({ data: initialData }: { data: CollectionRow[] }) {
  // keep local copy for drag-reorder & optimistic delete
  const [data, setData] = useState<CollectionRow[]>(() => initialData)
  React.useEffect(() => setData(initialData), [initialData])

  const [sorting, setSorting] = useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 })
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Delete handler (doc + cover image cleanup)
  async function handleDeleteCollection(row: CollectionRow) {
    if (!confirm("Delete this collection? This cannot be undone.")) return
    setDeletingId(row.id)
    try {
      // 1) delete Firestore doc
      await deleteDoc(doc(db, "collections", row.id))

      // 2) delete cover image (if any)
      if (row.imageKey) {
        try {
          await deleteObject(storageRef(storage, row.imageKey))
        } catch (e) {
          console.warn("Failed to delete collection image:", e)
        }
      }

      // 3) optimistic UI
      setData((prev) => prev.filter((r) => r.id !== row.id))
    } catch (e: any) {
      alert(e?.message || "Failed to delete collection.")
    } finally {
      setDeletingId(null)
    }
  }

  // Sensors: small delay so horizontal scroll on touch still works
  const sensors = useSensors(
    useSensor(MouseSensor),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
    useSensor(KeyboardSensor)
  )

  const dataIds = useMemo<UniqueIdentifier[]>(
    () => (Array.isArray(data) ? data.map(({ id }) => id) : []),
    [data]
  )

  // Columns need access to deletingId + delete handler → define with useMemo
  const columns = useMemo<ColumnDef<CollectionRow>[]>(() => [
    {
      id: "drag",
      header: () => null,
      cell: ({ row }) => <DragHandle id={row.original.id} />,
      enableHiding: false,
      enableSorting: false,
    },
    {
      accessorKey: "name",
      header: "Collection Name",
      cell: ({ row }) => (
        <span className="font-medium truncate block max-w-[360px]">
          {String(row.original.name)}
        </span>
      ),
      enableHiding: false,
    },
    {
      accessorKey: "productsCount",
      header: "# Products",
      cell: ({ row }) => <span>{String(row.original.productsCount)}</span>,
    },
    {
      id: "actions",
      header: "Actions",
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => {
        const r = row.original
        const isDeleting = deletingId === r.id
        return (
          <div className="flex items-center gap-2">
            {/* Edit */}
            <Link href={`/dashboard/collections/edit/${r.id}`}>
              <Button variant="ghost" size="icon">
                <Pencil className="h-4 w-4" />
                <span className="sr-only">Edit</span>
              </Button>
            </Link>

            {/* Delete */}
            <Button
              variant="ghost"
              size="icon"
              disabled={isDeleting}
              onClick={() => handleDeleteCollection(r)}
            >
              {isDeleting ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <Trash2 className="h-4 w-4 text-red-500" />
              )}
              <span className="sr-only">Delete</span>
            </Button>
          </div>
        )
      },
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [deletingId]) // re-render buttons when a row is being deleted

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnVisibility, pagination },
    getRowId: (row) => row.id,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (active && over && active.id !== over.id) {
      setData((prev: CollectionRow[]) => {
        const oldIndex = dataIds.indexOf(active.id)
        const newIndex = dataIds.indexOf(over.id)
        return arrayMove(prev, oldIndex, newIndex)
      })
    }
  }

  return (
    <div className="w-full">
      <div className="rounded-lg border">
        {/* horizontal scroll wrapper to keep mobile safe */}
        <div className="overflow-x-auto w-full">
          <DndContext
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={handleDragEnd}
            sensors={sensors}
          >
            <Table className="min-w-[720px]">
              <TableHeader className="bg-muted sticky top-0 z-10">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id} colSpan={header.colSpan}>
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  <SortableContext items={dataIds} strategy={verticalListSortingStrategy}>
                    {table.getRowModel().rows.map((row) => (
                      <DraggableRow key={row.id} row={row} />
                    ))}
                  </SortableContext>
                ) : (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center">
                      No results.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </DndContext>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="hidden items-center gap-2 lg:flex">
          <Label htmlFor="rows-per-page" className="text-sm font-medium">Rows per page</Label>
          <Select
            value={`${table.getState().pagination.pageSize}`}
            onValueChange={(value) => table.setPageSize(Number(value))}
          >
            <SelectTrigger size="sm" className="w-20" id="rows-per-page">
              <SelectValue placeholder={table.getState().pagination.pageSize} />
            </SelectTrigger>
            <SelectContent side="top">
              {[10, 20, 30, 40, 50].map((n) => (
                <SelectItem key={n} value={`${n}`}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex w-fit items-center justify-center text-sm font-medium">
          Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
        </div>
        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          <Button
            variant="outline"
            className="hidden h-8 w-8 p-0 lg:flex"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
          >
            <span className="sr-only">First page</span>
            <IconChevronsLeft />
          </Button>
          <Button
            variant="outline"
            className="size-8"
            size="icon"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <span className="sr-only">Previous page</span>
            <IconChevronLeft />
          </Button>
          <Button
            variant="outline"
            className="size-8"
            size="icon"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <span className="sr-only">Next page</span>
            <IconChevronRight />
          </Button>
          <Button
            variant="outline"
            className="hidden size-8 lg:flex"
            size="icon"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
          >
            <span className="sr-only">Last page</span>
            <IconChevronsRight />
          </Button>
        </div>
      </div>
    </div>
  )
}
