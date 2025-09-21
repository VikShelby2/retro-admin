"use client";

import { useEffect, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ai/select";
import { Checkbox } from "@/components/ui/checkbox"; // use the same Checkbox lib as Add page
import { Badge } from "@/components/ai/badge";
import {
  Upload,
  Package,
  Tag,
  Palette,
  Shirt,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

import { db, storage } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";

import { useRouter } from "next/navigation";

// --- types ---
type Uploaded = { url: string; key: string };

// --- helpers ---
const keyFromUrl = (url: string) => {
  try {
    const u = new URL(url);
    // If these were from a CDN (R2, etc.) you might not recover exact Firebase key.
    // We will prefer stored imageKeys; this is only a best-effort fallback.
    return decodeURIComponent(u.pathname.replace(/^\//, ""));
  } catch {
    return "";
  }
};

export default function ProductEditPage({
  params,
}: {
  params: { id: string };
}) {
  // --- params & router ---
  const id = params.id;
  const router = useRouter();

  // --- state ---
  const [form, setForm] = useState({
    name: "",
    stock: "",
    price: "",
    images: [] as string[], // public URLs
    originalPrice: "",
    category: "",
    subcategory: "",
    era: "",
    sizes: "",
    color: "",
    condition: "",
    isSale: false as boolean,
    noStock: false as boolean,
    description: "",
  });

  const [existing, setExisting] = useState<{ imageKeys: string[] }>({
    imageKeys: [], // Firebase Storage object keys aligned with form.images
  });

  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // ---------- previews for new selections ----------
  useEffect(() => {
    const urls = imageFiles.map((f) => URL.createObjectURL(f));
    setPreviewUrls(urls);
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [imageFiles]);

  // ---------- file handlers (match Add page UX) ----------
  const MAX_MB = 10;
  const MAX_BYTES = MAX_MB * 1024 * 1024;

  function handleFiles(selected: FileList | File[]) {
    const incoming = Array.from(selected).filter((f) =>
      f.type.startsWith("image/")
    );
    if (incoming.length === 0) return;

    // Basic validation first (type + size)
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
    if (next.length > 6) {
      next = next.slice(0, 6);
      setError("You can upload up to 6 images.");
    }
    setImageFiles(next);
  }

  function removeImage(index: number) {
    const next = [...imageFiles];
    next.splice(index, 1);
    setImageFiles(next);
  }

  // ---------- upload to Firebase Storage (parallel) ----------
  async function uploadToFirebase(files: File[]): Promise<Uploaded[]> {
    if (!files || files.length === 0) return [];

    // validate again defensively
    for (const f of files) {
      if (f.size > MAX_BYTES) {
        throw new Error(`"${f.name}" exceeds ${MAX_MB}MB limit`);
      }
      if (!f.type.startsWith("image/")) {
        throw new Error(`"${f.name}" is not an image`);
      }
    }

    const uploads = await Promise.all(
      files.map(async (file) => {
        const key = `products/${Date.now()}-${crypto
          .randomUUID()
          .toString()}-${file.name.replace(/\s+/g, "_")}`;
        const fileRef = ref(storage, key);
        await uploadBytes(fileRef, file, {
          contentType: file.type || "application/octet-stream",
        });
        const url = await getDownloadURL(fileRef);
        return { key, url };
      })
    );

    return uploads;
  }

  // ---------- delete old Firebase Storage objects ----------
  async function deleteOldFirebase(keys: string[]) {
    if (!keys?.length) return;
    await Promise.allSettled(
      keys.map(async (k) => {
        try {
          const r = ref(storage, k);
          await deleteObject(r);
        } catch {
          // swallow per-object errors to avoid blocking the user
        }
      })
    );
  }

  // --- Fetch existing product by ID ---
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "products", id));
        if (!snap.exists()) {
          setError("Product not found.");
          return;
        }
        const p: any = snap.data();
        if (!mounted) return;

        const images: string[] = Array.isArray(p.images) ? p.images : [];
        const keys: string[] = Array.isArray(p.imageKeys)
          ? p.imageKeys
          : images.map((u: string) => keyFromUrl(u)).filter(Boolean);

        setForm({
          name: String(p.name ?? p.title ?? ""),
          stock: String(p.stock ?? ""),
          price: String(p.price ?? ""),
          images,
          originalPrice: String(
            (p.originalPrice || "").toString().replace(/^\$/, "")
          ),
          category: String(p.category ?? ""),
          subcategory: String(p.subcategory ?? ""),
          era: String(p.era ?? ""),
          sizes: String(p.sizes ?? ""),
          color: String(p.color ?? ""),
          condition: String(p.condition ?? ""),
          isSale: Boolean(p.isSale),
          noStock: Boolean(p.noStock),
          description: String(p.description ?? ""),
        });
        setExisting({ imageKeys: keys });
      } catch (e) {
        setError("Failed to load product.");
      } finally {
        setInitialLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id]);

  // --- Submit: replace images if new files selected; otherwise keep existing ---
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      let nextImages = form.images;
      let nextKeys = existing.imageKeys;
      let oldKeysToDelete: string[] = [];

      if (imageFiles.length > 0) {
        // 1) Upload new to Firebase
        const uploaded = await uploadToFirebase(imageFiles);
        nextImages = uploaded.map((u) => u.url);
        nextKeys = uploaded.map((u) => u.key);
        // mark old keys for deletion AFTER Firestore succeeds
        oldKeysToDelete = existing.imageKeys.slice();
      }

      // 2) Update Firestore doc
      await updateDoc(doc(db, "products", id), {
        name: form.name,
        stock: form.stock,
        price: `${form.price}`,
        images: nextImages,
        imageKeys: nextKeys,
        image:
          nextImages[0] ?? "/placeholder.svg?height=400&width=300",
        category: form.category || "Uncategorized",
        subcategory: form.subcategory || "",
        era: form.era || "",
        sizes: form.sizes,
        color: form.color || "N/A",
        condition: form.condition || "",
        isSale: !!form.isSale,
        noStock: !!form.noStock,
        description: form.description,
      } as any);

      // 3) If we replaced images, delete the old ones now (Firebase)
      if (oldKeysToDelete.length) {
        await deleteOldFirebase(oldKeysToDelete);
        setImageFiles([]);
      }

      // 4) Sync local state
      setForm((prev) => ({ ...prev, images: nextImages }));
      setExisting({ imageKeys: nextKeys });

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to update product. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // --- change handlers ---
  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  function handleSelectChange(name: string, value: string | boolean) {
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  // --- loading guard ---
  if (initialLoading) {
    return (
      <div className="ai-theme min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading product…</div>
      </div>
    );
  }

  return (
    <div className="ai-theme min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Package className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-3xl font-bold text-foreground">Edit Product</h1>
          </div>
          <div className="flex gap-2 mb-2">
            <Button
              variant="outline"
              onClick={() => (window.location.href = "/dashboard")}
            >
              ← Go Back to Dashboard
            </Button>
            <Button
              variant="secondary"
              onClick={() => router.push("/dashboard/products")}
            >
              Products List
            </Button>
          </div>
          <p className="text-muted-foreground text-lg">
            Update product information and media
          </p>
        </div>

        {/* Success/Error Messages */}
        {success && (
          <Card className="mb-6 border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
            <CardContent className="">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">Product updated successfully!</span>
              </div>
            </CardContent>
          </Card>
        )}

        {error && (
          <Card className="mb-6 border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800">
            <CardContent className="">
              <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
                <AlertCircle className="h-5 w-5" />
                <span className="font-medium">{error}</span>
              </div>
            </CardContent>
          </Card>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Basic Information */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tag className="h-5 w-5 text-primary" />
                Basic Information
              </CardTitle>
              <CardDescription>
                Essential product details and identification
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-medium">
                    Product Name *
                  </Label>
                  <Input
                    id="name"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    required
                    placeholder="Enter product name"
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category" className="text-sm font-medium">
                    Category
                  </Label>
                  <Select
                    value={form.category}
                    onValueChange={(value) =>
                      handleSelectChange("category", value)
                    }
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="clothing">Clothing</SelectItem>
                      <SelectItem value="accessories">Accessories</SelectItem>
                      <SelectItem value="shoes">Shoes</SelectItem>
                      <SelectItem value="bags">Bags</SelectItem>
                      <SelectItem value="jewelry">Jewelry</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="subcategory" className="text-sm font-medium">
                    Subcategory
                  </Label>
                  <Input
                    id="subcategory"
                    name="subcategory"
                    value={form.subcategory}
                    onChange={handleChange}
                    placeholder="e.g., T-shirts, Dresses"
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="era" className="text-sm font-medium">
                    Era
                  </Label>
                  <Select
                    value={form.era}
                    onValueChange={(value) => handleSelectChange("era", value)}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select era" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vintage">Vintage</SelectItem>
                      <SelectItem value="retro">Retro</SelectItem>
                      <SelectItem value="modern">Modern</SelectItem>
                      <SelectItem value="contemporary">Contemporary</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm font-medium">
                  Description
                </Label>
                <Textarea
                  id="description"
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  placeholder="Detailed product description..."
                  className="min-h-[100px] resize-none"
                />
              </div>
            </CardContent>
          </Card>

          {/* Pricing & Inventory */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                Pricing & Inventory
              </CardTitle>
              <CardDescription>
                Set pricing and manage stock levels
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="price" className="text-sm font-medium">
                    Price *
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      $
                    </span>
                    <Input
                      id="price"
                      name="price"
                      type="number"
                      step="0.01"
                      value={form.price}
                      onChange={handleChange}
                      required
                      placeholder="0.00"
                      className="h-11 pl-8"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="originalPrice"
                    className="text-sm font-medium"
                  >
                    Original Price
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      $
                    </span>
                    <Input
                      id="originalPrice"
                      name="originalPrice"
                      type="number"
                      step="0.01"
                      value={form.originalPrice}
                      onChange={handleChange}
                      placeholder="0.00"
                      className="h-11 pl-8"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stock" className="text-sm font-medium">
                    Stock Quantity *
                  </Label>
                  <Input
                    id="stock"
                    name="stock"
                    type="number"
                    value={form.stock}
                    onChange={handleChange}
                    required
                    placeholder="0"
                    className="h-11"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-6">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="isSale"
                    checked={!!form.isSale}
                    onCheckedChange={(checked) =>
                      handleSelectChange("isSale", Boolean(checked))
                    }
                  />
                  <Label
                    htmlFor="isSale"
                    className="text-sm font-medium cursor-pointer"
                  >
                    On Sale
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="noStock"
                    checked={!!form.noStock}
                    onCheckedChange={(checked) =>
                      handleSelectChange("noStock", Boolean(checked))
                    }
                  />
                  <Label
                    htmlFor="noStock"
                    className="text-sm font-medium cursor-pointer"
                  >
                    Out of Stock
                  </Label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Product Details */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shirt className="h-5 w-5 text-primary" />
                Product Details
              </CardTitle>
              <CardDescription>
                Specific attributes and characteristics
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="color" className="text-sm font-medium">
                    Color
                  </Label>
                  <div className="flex items-center gap-2">
                    <Palette className="h-4 w-4 text-muted-foreground" />
                    <Input
                      id="color"
                      name="color"
                      value={form.color}
                      onChange={handleChange}
                      placeholder="e.g., Navy Blue, Red"
                      className="h-11"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sizes" className="text-sm font-medium">
                    Available Sizes
                  </Label>
                  <Input
                    id="sizes"
                    name="sizes"
                    value={form.sizes}
                    onChange={handleChange}
                    placeholder="e.g., S, M, L, XL"
                    className="h-11"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="condition" className="text-sm font-medium">
                  Condition
                </Label>
                <Select
                  value={form.condition}
                  onValueChange={(value) =>
                    handleSelectChange("condition", value)
                  }
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Select condition" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="like-new">Like New</SelectItem>
                    <SelectItem value="excellent">Excellent</SelectItem>
                    <SelectItem value="good">Good</SelectItem>
                    <SelectItem value="fair">Fair</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Media Upload (drag/drop + grid previews) */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-primary" />
                Product Images
              </CardTitle>
              <CardDescription>
                Upload high-quality images of your product
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Dropzone / picker */}
                <div
                  className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (imageFiles.length >= 6) return;
                    handleFiles(e.dataTransfer.files);
                  }}
                >
                  <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <div className="space-y-2">
                    <Label
                      htmlFor="images"
                      className="text-lg font-medium cursor-pointer hover:text-primary transition-colors"
                    >
                      Choose files or drag and drop
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      PNG, JPG, GIF up to 10MB each —{" "}
                      <span className="font-medium">max 6 images</span>
                    </p>
                  </div>
                  <Input
                    id="images"
                    type="file"
                    multiple
                    accept="image/*"
                    disabled={imageFiles.length >= 6}
                    onChange={(e) => {
                      if (!e.target.files) return;
                      if (imageFiles.length >= 6) return;
                      handleFiles(e.target.files);
                      // reset input so selecting the same file again works
                      e.currentTarget.value = "";
                    }}
                    className="hidden"
                  />
                </div>

                {/* Thumbnails grid (new selections) */}
                {previewUrls.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      Selected Images ({previewUrls.length}/6)
                    </Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {previewUrls.map((url, i) => (
                        <div
                          key={i}
                          className="relative aspect-square overflow-hidden rounded-md border"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url}
                            alt={`preview-${i + 1}`}
                            className="h-full w-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => removeImage(i)}
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

                {/* If no new files selected, show existing images */}
                {previewUrls.length === 0 && form.images?.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      Existing Images:
                    </Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {form.images.map((url, i) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={i}
                          src={url}
                          alt={`image-${i}`}
                          className="aspect-square object-cover rounded border"
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Fallback file badges (optional) */}
                {imageFiles.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {imageFiles.map((file, index) => (
                        <Badge key={index} variant="secondary" className="px-3 py-1">
                          {file.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="flex justify-end pt-6">
            <Button
              type="submit"
              disabled={loading}
              size="lg"
              className="px-8 h-12 font-medium"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Updating Product...
                </>
              ) : (
                <>
                  <Package className="h-4 w-4 mr-2" />
                  Update Product
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
