"use client"

import * as React from "react"
import { useState, useMemo } from "react"
import { doc, updateDoc, serverTimestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Package2, Truck, CreditCard } from "lucide-react"

type OrderItem = {
  productId?: string
  name?: string
  qty?: number
  size?: string | null
  image?: string | null
  unitPrice?: number
  lineTotal?: number
}

type OrderDetail = {
  id: string
  orderNumber: string
  status: string
  currency: string
  pricing: { subtotal: number; shipping: number; total: number }
  shippingInfo: any
  items: OrderItem[]
  createdAt: any // Timestamp | null
}

export function OrderDetailClient({ order }: { order: OrderDetail }) {
  const [status, setStatus] = useState(order.status)
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState("")

  const createdDate = useMemo(() => {
    try {
      // @ts-ignore
      if (order.createdAt?.toDate) return order.createdAt.toDate() as Date
      if (typeof order.createdAt?.seconds === "number") {
        return new Date(order.createdAt.seconds * 1000)
      }
    } catch {}
    return null
  }, [order.createdAt])

  function fmtCurrency(n: number) {
    return new Intl.NumberFormat("sq-AL", {
      style: "currency",
      currency: order.currency || "LEK",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(n || 0)
  }

  function StatusBadge({ value }: { value: string }) {
    const v = (value || "").toLowerCase()
    let variant: "secondary" | "default" | "destructive" | "outline" = "secondary"
    if (v === "paid" || v === "fulfilled") variant = "default"
    if (v === "cancelled") variant = "destructive"
    return <Badge variant={variant} className="capitalize">{value}</Badge>
  }

  async function updateStatus() {
    if (!status || status === order.status) return
    setSaving(true)
    try {
      await updateDoc(doc(db, "orders", order.id), {
        status,
        "meta.updatedAt": serverTimestamp(),
        ...(note ? { "meta.adminNote": note } : {}),
      })
    } catch (e: any) {
      console.error(e)
      alert(e?.message || "Failed to update status.")
    } finally {
      setSaving(false)
    }
  }

  const totalItems = order.items.reduce((s, it) => s + (Number(it.qty) || 0), 0)

  return (
    <div className="space-y-6 p-2 sm:p-4">
      {/* Header Summary */}
      <Card className="shadow-sm">
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-2xl">Order {order.orderNumber}</CardTitle>
            <CardDescription>
              {createdDate ? createdDate.toLocaleString() : "—"}
            </CardDescription>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <Label htmlFor="status" className="text-sm shrink-0">Change status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="status" className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="fulfilled">Fulfilled</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={updateStatus} disabled={saving || status === order.status} className="w-full sm:w-auto">
              {saving ? "Saving…" : "Update Status"}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Grid for main content */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column: Items */}
        <div className="lg:col-span-2">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package2 className="h-5 w-5" /> Items ({totalItems})
              </CardTitle>
              <CardDescription>Products in this order</CardDescription>
            </CardHeader>
            <CardContent>
              {/* MOBILE VIEW: LIST OF CARDS */}
              <div className="space-y-4 md:hidden">
                {order.items.length ? (
                  order.items.map((it, i) => (
                    <div key={i} className="flex items-start gap-4 rounded-lg border p-4">
                      {it.image && (
                        <img src={it.image} alt={it.name || "Product"} className="h-16 w-16 rounded object-cover" />
                      )}
                      <div className="flex-1 space-y-1">
                        <p className="font-medium">{it.name || it.productId || "—"}</p>
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>{it.size ? `Size: ${it.size}` : ''}</span>
                          <span>Qty: {it.qty ?? 0}</span>
                        </div>
                        <div className="text-right font-semibold">
                          {fmtCurrency(Number(it.lineTotal ?? 0))}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-muted-foreground">No items in this order.</p>
                )}
              </div>

              {/* DESKTOP VIEW: TABLE */}
              <div className="hidden rounded-md border md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50%]">Product</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead className="text-center">Qty</TableHead>
                      <TableHead className="text-right">Unit</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {order.items.length ? (
                      order.items.map((it, i) => (
                        <TableRow key={i}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              {it.image && (
                                <img src={it.image} alt={it.name || ""} className="h-10 w-10 rounded object-cover border" />
                              )}
                              <div>
                                <span className="font-medium">{it.name || it.productId || "—"}</span>
                                {it.productId && <span className="block text-xs text-muted-foreground">ID: {it.productId}</span>}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{it.size || "—"}</TableCell>
                          <TableCell className="text-center">{it.qty ?? 0}</TableCell>
                          <TableCell className="text-right">{fmtCurrency(Number(it.unitPrice ?? 0))}</TableCell>
                          <TableCell className="text-right">{fmtCurrency(Number(it.lineTotal ?? 0))}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">No items.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Shipping, Payment, Admin Note */}
        <div className="space-y-6 lg:col-span-1">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Truck className="h-5 w-5" /> Shipping</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {order.shippingInfo ? (
                <>
                  {order.shippingInfo.fullName && <div><span className="font-medium">Name: </span>{order.shippingInfo.fullName}</div>}
                  {order.shippingInfo.address && <div><span className="font-medium">Address: </span>{order.shippingInfo.address}</div>}
                  {order.shippingInfo.city && <div><span className="font-medium">City: </span>{order.shippingInfo.city}</div>}
                  {order.shippingInfo.phone && <div><span className="font-medium">Phone: </span>{order.shippingInfo.phone}</div>}
                  {order.shippingInfo.email && <div><span className="font-medium">Email: </span>{order.shippingInfo.email}</div>}
                </>
              ) : <div className="text-muted-foreground">No shipping info.</div>}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5" /> Payment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span>Subtotal</span><span className="font-medium">{fmtCurrency(order.pricing.subtotal)}</span></div>
              <div className="flex justify-between"><span>Shipping</span><span className="font-medium">{fmtCurrency(order.pricing.shipping)}</span></div>
              <Separator />
              <div className="flex justify-between text-base font-semibold"><span>Total</span><span>{fmtCurrency(order.pricing.total)}</span></div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Admin Note</CardTitle>
              <CardDescription>Save a note with the status update.</CardDescription>
            </CardHeader>
            <CardContent>
              <Input
                placeholder="e.g., Confirmed payment..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}