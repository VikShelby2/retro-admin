"use client";

import { useEffect, useMemo, useState } from "react";
import type React from "react";
import "../../../../ai-theme.css";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ai/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ai/badge";
import {
  Upload,
  Tag,
  Image as ImageIcon,
  AlertCircle,
  CheckCircle2,
  PlusCircle,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";

import { db, storage } from "@/lib/firebase";
import { doc, getDoc, updateDoc, serverTimestamp, collection, getDocs, query } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes, deleteObject } from "firebase/storage";
import { useRouter } from "next/navigation";

type Uploaded = { url: string; key: string };
type ProductLite = { id: string; name: string };

const MAX_MB = 10;
const MAX_BYTES = MAX_MB * 1024 * 1024;
const MAX_FILES = 1;

// Fallback: derive a storage-ish key from URL path if older doc lacks imageKey
const keyFromUrl = (url: string) => {
  try {
    const u = new URL(url);
    return decodeURIComponent(u.pathname.replace(/^\//, ""));
  } catch {
    return "";
  }
};

export default function CollectionEditPage({ params }: { params: { id: string } }) {
  const id = params.id;
  const router = useRouter();

  // ---------- form state ----------
  const [form, setForm] = useState({
    name: "",
    description: "",
    photoCaption: "",
    publishingChannels: [] as string[],
    photoUrl: "", // existing photo url
  });

  // products
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [allProducts, setAllProducts] = useState<ProductLite[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productSearch, setProductSearch] = useState("");

  // image handling
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [existingKey, setExistingKey] = useState<string | null>(null);

  // ui state
  const [initialLoading, setInitialLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  // ---------- maps & derived ----------
  const productNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of allProducts) m.set(p.id, p.name);
    return m;
  }, [allProducts]);

  const selectedNames = useMemo(
    () => selectedProductIds.map((pid) => productNameById.get(pid) || pid),
    [selectedProductIds, productNameById]
  );

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return allProducts;
    return allProducts.filter((p) => p.name.toLowerCase().includes(q));
  }, [productSearch, allProducts]);

  // ---------- load collection ----------
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "collections", id));
        if (!snap.exists()) {
          setError("Collection not found.");
          return;
        }
        const c: any = snap.data();
        if (!mounted) return;

        const photo = c.photo || null;
        const storedKey: string | null =
          typeof c.imageKey === "string" && c.imageKey.length > 0
            ? c.imageKey
            : photo?.url
            ? keyFromUrl(photo.url)
            : null;

        setForm({
          name: String(c.name ?? ""),
          description: String(c.description ?? ""),
          photoCaption: String(photo?.caption ?? ""),
          publishingChannels: Array.isArray(c.publishingChannels) ? c.publishingChannels : [],
          photoUrl: String(photo?.url ?? ""),
        });

        const existingProducts: string[] = Array.isArray(c.products) ? c.products.map(String) : [];
        setSelectedProductIds(existingProducts);
        setExistingKey(storedKey);
      } catch (e) {
        setError("Failed to load collection.");
      } finally {
        setInitialLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id]);

  // ---------- load all products (id + name) ----------
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const qRef = query(collection(db, "products"));
        const snap = await getDocs(qRef);
        if (!mounted) return;
        const list: ProductLite[] = snap.docs.map((doc) => {
          const d: any = doc.data();
          const name = String(d.name ?? d.title ?? "Untitled");
          return { id: doc.id, name };
        });
        setAllProducts(list);
      } catch (e) {
        // keep page usable even if product fetch fails
      } finally {
        if (mounted) setProductsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // ---------- image previews ----------
  useEffect(() => {
    const urls = imageFiles.map((f) => URL.createObjectURL(f));
    setPreviewUrls(urls);
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [imageFiles]);

  // ---------- file handlers ----------
  function handleFiles(selected: FileList | File[]) {
    const incoming = Array.from(selected).filter((f) => f.type.startsWith("image/"));
    if (incoming.length === 0) return;

    for (const f of incoming) {
      if (!f.type.startsWith("image/")) {
        setError(`"${f.name}" is not an image`);
        return;
      }
      if (f.size > MAX_BYTES) {
        setError(`"${f.name}" exceeds ${MAX_MB}MB limit`);
        return;
      }
    }

    let next = [...imageFiles, ...incoming];
    if (next.length > MAX_FILES) {
      next = next.slice(0, MAX_FILES);
      setError(`You can upload up to ${MAX_FILES} image.`);
    }
    setImageFiles(next);
  }

  function removeSelectedImage(index: number) {
    const next = [...imageFiles];
    next.splice(index, 1);
    setImageFiles(next);
  }

  // ---------- upload / delete ----------
  async function uploadToFirebase(files: File[]): Promise<Uploaded[]> {
    if (!files?.length) return [];
    for (const f of files) {
      if (f.size > MAX_BYTES) throw new Error(`"${f.name}" exceeds ${MAX_MB}MB limit`);
      if (!f.type.startsWith("image/")) throw new Error(`"${f.name}" is not an image`);
    }
    const uploads = await Promise.all(
      files.map(async (file) => {
        const key = `collections/${Date.now()}-${crypto.randomUUID()}-${file.name.replace(/\s+/g, "_")}`;
        const fileRef = ref(storage, key);
        await uploadBytes(fileRef, file, { contentType: file.type || "application/octet-stream" });
        const url = await getDownloadURL(fileRef);
        return { key, url };
      })
    );
    return uploads;
  }

  async function deleteOldImage(key: string | null) {
    if (!key) return;
    try {
      const r = ref(storage, key);
      await deleteObject(r);
    } catch {
      // best-effort
    }
  }

  // ---------- handlers ----------
  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function toggleChannel(value: string, checked: boolean) {
    setForm((prev) => {
      const set = new Set(prev.publishingChannels);
      if (checked) set.add(value);
      else set.delete(value);
      return { ...prev, publishingChannels: Array.from(set) };
    });
  }

  function toggleProduct(id: string, checked: boolean) {
    setSelectedProductIds((prev) => {
      const set = new Set(prev);
      if (checked) set.add(id);
      else set.delete(id);
      return Array.from(set);
    });
  }

  // ---------- submit ----------
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      let nextPhotoUrl = form.photoUrl;
      let nextKey = existingKey;

      if (imageFiles.length > 0) {
        const [uploaded] = await uploadToFirebase(imageFiles);
        if (uploaded) {
          nextPhotoUrl = uploaded.url;
          nextKey = uploaded.key;
        }
      }

      await updateDoc(doc(db, "collections", id), {
        name: form.name,
        description: form.description,
        products: selectedProductIds, // <<==== save selected product ids
        publishingChannels: form.publishingChannels,
        photo: nextPhotoUrl ? { url: nextPhotoUrl, caption: form.photoCaption } : null,
        imageKey: nextKey || null,
        updatedAt: serverTimestamp(),
      } as any);

      if (imageFiles.length > 0 && existingKey && existingKey !== nextKey) {
        await deleteOldImage(existingKey);
        setImageFiles([]);
      }

      setForm((prev) => ({ ...prev, photoUrl: nextPhotoUrl }));
      setExistingKey(nextKey || null);

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to update collection. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (initialLoading) {
    return (
      <div className="ai-theme min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading collection…</div>
      </div>
    );
  }

  return (
    <div className="ai-theme min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Tag className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-3xl font-bold text-foreground">Edit Collection</h1>
          </div>
          <div className="flex gap-2 mb-2">
            <Button variant="outline" onClick={() => router.push("/dashboard")}>
              ← Go Back to Dashboard
            </Button>
            <Button variant="secondary" onClick={() => router.push("/dashboard/collections")}>
              Collections List
            </Button>
          </div>
          <p className="text-muted-foreground text-lg">Update collection details, products, and cover image.</p>
        </div>

        {/* Success/Error */}
        {success && (
          <Card className="mb-6 border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
            <CardContent>
              <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">Collection updated successfully!</span>
              </div>
            </CardContent>
          </Card>
        )}
        {error && (
          <Card className="mb-6 border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800">
            <CardContent>
              <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
                <AlertCircle className="h-5 w-5" />
                <span className="font-medium">{error}</span>
              </div>
            </CardContent>
          </Card>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Basic Info + Add products button */}
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Tag className="h-5 w-5 text-primary" />
                  Basic Information
                </CardTitle>
                <CardDescription>Edit the name, description, and products</CardDescription>
              </div>

              {/* Add products (modal) */}
              <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogTrigger asChild>
                  <Button variant="secondary" className="inline-flex items-center gap-2">
                    <PlusCircle className="h-4 w-4" />
                    Add products
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Select products</DialogTitle>
                    <DialogDescription>Search and choose products for this collection.</DialogDescription>
                  </DialogHeader>

                  {/* Search */}
                  <div className="mb-3">
                    <Input
                      placeholder="Search products by name…"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                    />
                  </div>

                  {/* List */}
                  <div className="max-h-[50vh] overflow-y-auto rounded border">
                    {productsLoading ? (
                      <div className="p-4 text-sm text-muted-foreground">Loading products…</div>
                    ) : filteredProducts.length === 0 ? (
                      <div className="p-4 text-sm text-muted-foreground">No products found.</div>
                    ) : (
                      <ul className="divide-y">
                        {filteredProducts.map((p) => {
                          const checked = selectedProductIds.includes(p.id);
                          return (
                            <li key={p.id} className="flex items-center justify-between gap-3 p-3">
                              <span className="truncate">{p.name}</span>
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(v) => toggleProduct(p.id, Boolean(v))}
                                aria-label={`Select ${p.name}`}
                              />
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>

                  <DialogFooter className="mt-4">
                    <DialogClose asChild>
                      <Button type="button" variant="outline">Close</Button>
                    </DialogClose>
                    <DialogClose asChild>
                      <Button type="button">Done</Button>
                    </DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Selected products preview (top 3) */}
              {selectedProductIds.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Selected products</Label>
                  <div className="flex flex-wrap gap-2">
                    {selectedNames.slice(0, 3).map((name, i) => (
                      <Badge key={i} variant="secondary" className="px-3 py-1">
                        {name}
                      </Badge>
                    ))}
                    {selectedProductIds.length > 3 && (
                      <Badge variant="outline" className="px-3 py-1">
                        +{selectedProductIds.length - 3} more
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium">Collection Name *</Label>
                <Input
                  id="name"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  required
                  placeholder="e.g., Summer Essentials"
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm font-medium">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  placeholder="Describe this collection..."
                  className="min-h-[100px] resize-none"
                />
              </div>
            </CardContent>
          </Card>

          {/* Publishing Channels */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5 text-primary" />
                Publishing Channels
              </CardTitle>
              <CardDescription>Where this collection is available</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { id: "online", label: "Online Store" },
                { id: "retail", label: "Retail" },
                { id: "social", label: "Social" },
                { id: "marketplace", label: "Marketplace" },
              ].map((ch) => (
                <div key={ch.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`ch-${ch.id}`}
                    checked={form.publishingChannels.includes(ch.id)}
                    onCheckedChange={(checked) => toggleChannel(ch.id, Boolean(checked))}
                  />
                  <Label htmlFor={`ch-${ch.id}`} className="cursor-pointer">{ch.label}</Label>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Cover Image */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-primary" />
                Cover Image
              </CardTitle>
              <CardDescription>Replace the cover image (optional)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Existing image if no new selection */}
                {previewUrls.length === 0 && form.photoUrl && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Current Image</Label>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={form.photoUrl} alt="current" className="h-40 w-40 object-cover rounded border" />
                  </div>
                )}

                {/* Dropzone */}
                <div
                  className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (imageFiles.length >= MAX_FILES) return;
                    handleFiles(e.dataTransfer.files);
                  }}
                >
                  <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <div className="space-y-2">
                    <Label
                      htmlFor="image"
                      className="text-lg font-medium cursor-pointer hover:text-primary transition-colors"
                    >
                      Choose file or drag & drop (optional)
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      PNG, JPG, GIF up to {MAX_MB}MB — <span className="font-medium">max {MAX_FILES} image</span>
                    </p>
                  </div>
                  <Input
                    id="image"
                    type="file"
                    accept="image/*"
                    multiple={false}
                    disabled={imageFiles.length >= MAX_FILES}
                    onChange={(e) => {
                      if (!e.target.files) return;
                      if (imageFiles.length >= MAX_FILES) return;
                      handleFiles(e.target.files);
                      e.currentTarget.value = "";
                    }}
                    className="hidden"
                  />
                </div>

                {/* New selection preview */}
                {previewUrls.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Selected Image</Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {previewUrls.map((url, i) => (
                        <div key={i} className="relative aspect-square overflow-hidden rounded-md border">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt={`preview-${i + 1}`} className="h-full w-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removeSelectedImage(i)}
                            className="absolute top-1 right-1 rounded-md bg-black/60 px-2 py-1 text-xs text-white hover:bg-black/80"
                            aria-label={`Remove image ${i + 1}`}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Filename badge */}
                {imageFiles.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {imageFiles.map((file, idx) => (
                        <Badge key={idx} variant="secondary" className="px-3 py-1">
                          {file.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Caption */}
                <div className="space-y-2">
                  <Label htmlFor="photoCaption" className="text-sm font-medium">Image Caption (optional)</Label>
                  <Input
                    id="photoCaption"
                    name="photoCaption"
                    value={form.photoCaption}
                    onChange={handleChange}
                    placeholder="e.g., Summer Collection 2025"
                    className="h-11"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="flex justify-end pt-6">
            <Button type="submit" disabled={loading} size="lg" className="px-8 h-12 font-medium">
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Updating Collection...
                </>
              ) : (
                <>Update Collection</>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
