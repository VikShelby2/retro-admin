import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { db } from "@/lib/firebase"
import { collection, getDocs, query } from "firebase/firestore"
import { DataTable, ProductRow } from "@/components/data-table"

import { ProductTableWithSearch } from "@/components/products-data-table"

async function getProducts() {
  const q = query(collection(db, "products"));
  const snapshot = await getDocs(q);

  // Map to serializable, minimal fields the table expects
  const rows: ProductRow[] = snapshot.docs.map((doc) => {
    const p: any = doc.data();
    return {
      id: String(doc.id),
      title: String(p.title ?? p.name ?? "Untitled"),
      price: typeof p.price === "number" ? p.price : String(p.price ?? "0"),
      stock: typeof p.stock === "number" ? p.stock : String(p.stock ?? "0"),
      rating: typeof p.rating === "number" ? p.rating : String(p.rating ?? "0"),
    } satisfies ProductRow;
  });

  return rows;
}


export default async function Page() {
  const products = await getProducts()

  // Client-side search state and filter
  // This wrapper is needed because Next.js server components can't use state directly
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
        <ProductTableWithSearch products={products} />
      </SidebarInset>
    </SidebarProvider>
  )
}
