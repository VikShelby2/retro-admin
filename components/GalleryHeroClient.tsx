"use client"

import { useEffect, useState } from "react"
import { v4 as uuid } from "uuid"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Upload, Image as ImageIcon, CheckCircle2, AlertCircle } from "lucide-react"

import { db, storage } from "@/lib/firebase"
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore"
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage"

const HERO_DOC_ID = "hero"
const MAX_MB = 10
const MAX_BYTES = MAX_MB * 1024 * 1024

type HeroDoc = { url: string; key: string; caption?: string; updatedAt?: any }

export function GalleryHeroClient() {
  const [existing, setExisting] = useState<HeroDoc | null>(null)
  const [caption, setCaption] = useState("")
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  // Load existing
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const snap = await getDoc(doc(db, "gallery", HERO_DOC_ID))
        if (!mounted) return
        if (snap.exists()) {
          const d = snap.data() as HeroDoc
          setExisting({ url: d.url, key: d.key, caption: d.caption, updatedAt: d.updatedAt })
          setCaption(d.caption ?? "")
        }
      } catch (e) {
        setError("Failed to load hero image.")
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  // Preview
  useEffect(() => {
    if (!imageFile) {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(imageFile)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [imageFile])

  function handleFiles(list: FileList | null) {
    if (!list?.length) return
    const f = list[0]
    if (!f.type.startsWith("image/")) return setError(`"${f.name}" is not an image`)
    if (f.size > MAX_BYTES) return setError(`"${f.name}" exceeds ${MAX_MB}MB limit`)
    setError("")
    setImageFile(f)
  }

  async function saveHero() {
    if (!imageFile && caption === (existing?.caption ?? "")) {
      setError("Please choose an image or change the caption.")
      setSuccess(false)
      return
    }

    setSaving(true)
    setError("")
    setSuccess(false)

    try {
      let nextUrl = existing?.url || ""
      let nextKey = existing?.key || ""

      if (imageFile) {
        const key = `gallery/${Date.now()}-${uuid()}-${imageFile.name.replace(/\s+/g, "_")}`
        const fileRef = ref(storage, key)
        await uploadBytes(fileRef, imageFile, { contentType: imageFile.type || "application/octet-stream" })
        const url = await getDownloadURL(fileRef)
        nextUrl = url
        nextKey = key
      }

      await setDoc(
        doc(db, "gallery", HERO_DOC_ID),
        { url: nextUrl, key: nextKey, caption: caption || "", updatedAt: serverTimestamp() },
        { merge: true }
      )

      // Delete old image IF we uploaded a new one
      if (imageFile && existing?.key && existing.key !== nextKey) {
        try {
          await deleteObject(ref(storage, existing.key))
        } catch {
          // ignore deletion errors
        }
      }

      setExisting({ url: nextUrl, key: nextKey, caption })
      setImageFile(null)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 1500)
    } catch (e: any) {
      console.error(e)
      setError(e?.message || "Failed to save hero image.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="text-muted-foreground">Loading…</div>
  }

  return (
    <div className="space-y-6">
      {/* Alerts */}
      {success && (
        <Card className="border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
          <CardContent className="py-3">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">Saved!</span>
            </div>
          </CardContent>
        </Card>
      )}
      {error && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800">
          <CardContent className="py-3">
            <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
              <AlertCircle className="h-5 w-5" />
              <span className="font-medium">{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Current hero */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-primary" />
            Current Hero Image
          </CardTitle>
          <CardDescription>Shown on your site’s hero section</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-hidden rounded-md border">
            {existing?.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={existing.url} alt="Current hero" className="h-64 w-full object-cover" />
            ) : (
              <div className="flex h-64 w-full items-center justify-center bg-muted text-muted-foreground">
                No hero image — add one below
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="caption">Caption (optional)</Label>
            <Input
              id="caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="e.g., Fall Collection 2025"
            />
          </div>
        </CardContent>
      </Card>

      {/* Uploader */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Replace Hero Image
          </CardTitle>
          <CardDescription>PNG/JPG up to {MAX_MB}MB — only one image</CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              handleFiles(e.dataTransfer.files)
            }}
          >
            <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <div className="space-y-2">
              <Label htmlFor="image" className="text-lg font-medium cursor-pointer hover:text-primary transition-colors">
                Choose file or drag & drop
              </Label>
              <p className="text-sm text-muted-foreground">Max {MAX_MB}MB — one image</p>
            </div>
            <Input
              id="image"
              type="file"
              accept="image/*"
              multiple={false}
              onChange={(e) => handleFiles(e.target.files)}
              className="hidden"
            />
          </div>

          {/* Preview */}
          {previewUrl && (
            <div className="mt-4 space-y-2">
              <Label className="text-sm font-medium">Selected Image (preview)</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="relative aspect-square overflow-hidden rounded-md border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={previewUrl} alt="preview" className="h-full w-full object-cover" />
                </div>
              </div>
              {imageFile && (
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="px-3 py-1">
                    {imageFile.name}
                  </Badge>
                </div>
              )}
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <Button disabled={saving} onClick={saveHero}>
              {saving ? "Saving…" : "Save Hero Image"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
