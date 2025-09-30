  "use client"
  import { useEffect, useState } from "react"
  import type React from "react"
  import '../../../ai-theme.css'
  import { Button } from "@/components/ui/button"
  import { Input } from "@/components/ui/input"
  import { Label } from "@/components/ui/label"
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
  import { Textarea } from "@/components/ai/textarea"
  import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ai/select"
  import { Checkbox } from "@/components/ui/checkbox"
  import { Badge } from "@/components/ai/badge"
  import { Upload, Package, Tag, Palette, Shirt, AlertCircle, CheckCircle2 } from "lucide-react"
  import { db, storage } from "@/lib/firebase"
  import { collection, addDoc } from "firebase/firestore"
  import { getDownloadURL, ref, uploadBytes } from "firebase/storage"
import { size } from "zod"
  type Uploaded = { url: string; key: string }
  export default function ProductAddPage() {
    const [form, setForm] = useState({
      name: "",
      stock: "",
      price: "",
      images: [],
      originalPrice: "",
      category: "",
      subcategory: "",
      era: "",
      sizes: "",
      color: "",
      condition: "",
       isSale: true,      // ✅ default ON
      noStock: false, 
      description: "",
    })
    
    const [imageFiles, setImageFiles] = useState<File[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const [success, setSuccess] = useState(false)
  const [previewUrls, setPreviewUrls] = useState<string[]>([])

// Build previews whenever imageFiles changes, and clean up object URLs
useEffect(() => {
  const urls = imageFiles.map((f) => URL.createObjectURL(f))
  setPreviewUrls(urls)
  return () => {
    urls.forEach((u) => URL.revokeObjectURL(u))
  }
}, [imageFiles])

function handleFiles(selected: FileList | File[]) {
  const incoming = Array.from(selected).filter((f) => f.type.startsWith("image/"))
  if (incoming.length === 0) return
  let next = [...imageFiles, ...incoming]
  if (next.length > 6) {
    next = next.slice(0, 6)
    setError("You can upload up to 6 images.")
  }
  setImageFiles(next)
}

function removeImage(index: number) {
  const next = [...imageFiles]
  next.splice(index, 1)
  setImageFiles(next)
}

   const MAX_MB = 10
  const MAX_BYTES = MAX_MB * 1024 * 1024

  // 🔄 Replaces uploadDirect(files) → uploads directly to Firebase Storage
  async function uploadToFirebase(files: File[]) {
    if (!files || files.length === 0) return [] as Uploaded[]

    // Validate sizes and types
    for (const f of files) {
      if (f.size > MAX_BYTES) {
        throw new Error(`"${f.name}" exceeds ${MAX_MB}MB limit`)
      }
      if (!f.type.startsWith("image/")) {
        throw new Error(`"${f.name}" is not an image`)
      }
    }

    // Upload all in parallel
    const uploads = await Promise.all(
      files.map(async (file) => {
        const key = `products/${Date.now()}-${crypto.randomUUID()}-${file.name.replace(/\s+/g, "_")}`
        const fileRef = ref(storage, key)
        await uploadBytes(fileRef, file, {
          contentType: file.type || "application/octet-stream",
        })
        const url = await getDownloadURL(fileRef)
        return { key, url }
      })
    )

    return uploads
  }


  

function parseSizes(input: string): string[] {
  return Array.from(new Set(
    input.split(",").map(s => s.trim()).filter(Boolean).map(s => s.toLowerCase())
  ))
}


  
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError("")
    setSuccess(false)

    try {
      const uploaded = await uploadToFirebase(imageFiles)
      const photoUrls = uploaded.map(u => u.url)
      const imageKeys = uploaded.map(u => u.key)
      
      const sizesArray = parseSizes(form.sizes)
      const placeholder = "/placeholder.svg?height=400&width=300"

      const product = {
        name: form.name,
        stock: form.stock,
        price: `${form.price}`,
        images: photoUrls,               // may be []
        imageKeys,                       // may be []
        originalPrice: form.originalPrice ? `$${form.originalPrice}` : '',
        image: photoUrls[0] ,
        category: form.category || "Uncategorized",
        subcategory: form.subcategory || "",
        era: form.era || "",
        sizes: sizesArray,               // parsed array
        color: form.color || "N/A",
        condition: form.condition || "",
        isSale: !!form.isSale,
        noStock: !!form.noStock,
        isNew: false,
        rating: 4,
        reviews: 0,
        description: form.description,
      }

      await addDoc(collection(db, "products"), product)

      // reset
      setForm({
        name: "",
        stock: "",
        price: "",
        images: [],
        originalPrice: "",
        category: "",
        subcategory: "",
        era: "",
        sizes: "",
        color: "",
        condition: "",
        isSale: false,
        noStock: false,
        description: "",
      })
      setImageFiles([])
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: any) {
      console.error(err)
      setError(err?.message || "Failed to add product. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value, type } = e.target
    const checked = (e.target as HTMLInputElement).checked
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }))
  }

  function handleSelectChange(name: string, value: string) {
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }))
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
            <h1 className="text-3xl font-bold text-foreground">Add New Product</h1>
          </div>
          <div className="flex gap-2 mb-2">
            <Button variant="outline" onClick={() => window.location.href = '/dashboard'}>
              ← Go Back to Dashboard
            </Button>
          </div>
          <p className="text-muted-foreground text-lg">
            Create a new product listing with detailed information and media
          </p>
        </div>

        {/* Success/Error Messages */}
        {success && (
          <Card className="mb-6 border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
            <CardContent className="">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">Product added successfully!</span>
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
              <CardDescription>Essential product details and identification</CardDescription>
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
                  <Select value={form.category} onValueChange={(value) => handleSelectChange("category", value)}>
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
                  <Select value={form.era} onValueChange={(value) => handleSelectChange("era", value)}>
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
              <CardDescription>Set pricing and manage stock levels</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="price" className="text-sm font-medium">
                    Price *
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
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
                  <Label htmlFor="originalPrice" className="text-sm font-medium">
                    Original Price
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
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
                    checked={form.isSale}
                    onCheckedChange={(checked) => handleSelectChange("isSale", checked.toString())}
                  />
                  <Label htmlFor="isSale" className="text-sm font-medium cursor-pointer">
                    On Sale
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="noStock"
                    checked={form.noStock}
                    onCheckedChange={(checked) => handleSelectChange("noStock", checked.toString())}
                  />
                  <Label htmlFor="noStock" className="text-sm font-medium cursor-pointer">
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
              <CardDescription>Specific attributes and characteristics</CardDescription>
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
                <Select value={form.condition} onValueChange={(value) => handleSelectChange("condition", value)}>
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

          {/* Media Upload */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-primary" />
                Product Images
              </CardTitle>
              <CardDescription>Upload high-quality images of your product</CardDescription>
            </CardHeader>
            <CardContent>
  <div className="space-y-4">
    {/* Dropzone / picker */}
    <div
      className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        if (imageFiles.length >= 6) return
        handleFiles(e.dataTransfer.files)
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
          PNG, JPG, GIF up to 10MB each — <span className="font-medium">max 6 images</span>
        </p>
      </div>
      <Input
        id="images"
        type="file"
        multiple
        accept="image/*"
        disabled={imageFiles.length >= 6}
        onChange={(e) => {
          if (!e.target.files) return
          if (imageFiles.length >= 6) return
          handleFiles(e.target.files)
          // reset input so selecting the same file again works
          e.currentTarget.value = ""
        }}
        className="hidden"
      />
    </div>

    {/* Thumbnails grid (3 per row) */}
    {previewUrls.length > 0 && (
      <div className="space-y-2">
        <Label className="text-sm font-medium">
          Selected Images ({previewUrls.length}/6)
        </Label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {previewUrls.map((url, i) => (
            <div key={i} className="relative aspect-square overflow-hidden rounded-md border">
              {/* Thumb */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`preview-${i + 1}`}
                className="h-full w-full object-cover"
              />
              {/* Remove button */}
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

    {/* Fallback file badges (optional; remove if you don’t want it) */}
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
            <Button type="submit" disabled={loading} size="lg" className="px-8 h-12 font-medium">
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Adding Product...
                </>
              ) : (
                <>
                  <Package className="h-4 w-4 mr-2" />
                  Add Product
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
