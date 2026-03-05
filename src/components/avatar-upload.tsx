"use client"

import { useCallback, useRef, useState } from "react"
import { Camera, Loader2, Trash2, Upload } from "lucide-react"

import { supabase } from "@/lib/supabase"
import { useToast } from "@/components/toast-provider"

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"]
const MAX_SIZE = 2 * 1024 * 1024 // 2MB

export function AvatarUpload({
  userId,
  currentUrl,
  onUploaded,
}: {
  userId: string
  currentUrl: string
  onUploaded: (publicUrl: string) => void
}) {
  const { showToast } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState(currentUrl)
  const [dragOver, setDragOver] = useState(false)

  const upload = useCallback(
    async (file: File) => {
      if (!ALLOWED_TYPES.includes(file.type)) {
        showToast("JPG, PNG, GIF, WebP만 업로드할 수 있습니다.", "error")
        return
      }
      if (file.size > MAX_SIZE) {
        showToast("파일 크기는 2MB 이하여야 합니다.", "error")
        return
      }

      setUploading(true)

      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg"
      const path = `${userId}/avatar.${ext}`

      const { error } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type })

      if (error) {
        showToast("업로드에 실패했습니다: " + error.message, "error")
        setUploading(false)
        return
      }

      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(path)

      const publicUrl = urlData.publicUrl + "?t=" + Date.now()
      setPreview(publicUrl)
      onUploaded(publicUrl)
      showToast("아바타가 업로드되었습니다!", "success")
      setUploading(false)
    },
    [userId, onUploaded, showToast],
  )

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) upload(file)
      if (inputRef.current) inputRef.current.value = ""
    },
    [upload],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const file = e.dataTransfer.files?.[0]
      if (file) upload(file)
    },
    [upload],
  )

  const handleRemove = useCallback(async () => {
    setPreview("")
    onUploaded("")
  }, [onUploaded])

  return (
    <div className="flex items-center gap-5">
      {/* 원형 프리뷰 / 드래그앤드롭 */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        disabled={uploading}
        className={[
          "relative grid size-24 shrink-0 place-items-center overflow-hidden rounded-full border-2 transition-all duration-200",
          dragOver
            ? "border-fuchsia-400 bg-fuchsia-400/10 shadow-[0_0_24px_rgba(236,72,153,0.3)]"
            : "border-fuchsia-400/30 bg-white/5 hover:border-fuchsia-400/50 hover:shadow-[0_0_16px_rgba(236,72,153,0.15)]",
          uploading ? "cursor-wait opacity-70" : "cursor-pointer",
        ].join(" ")}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="아바타"
            className="size-full object-cover"
          />
        ) : (
          <Camera className="size-8 text-zinc-600" />
        )}

        {uploading && (
          <div className="absolute inset-0 grid place-items-center bg-black/60">
            <Loader2 className="size-6 animate-spin text-fuchsia-400" />
          </div>
        )}

        {/* 호버 오버레이 */}
        {!uploading && (
          <div className="absolute inset-0 grid place-items-center bg-black/50 opacity-0 transition hover:opacity-100">
            <Upload className="size-5 text-fuchsia-300" />
          </div>
        )}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="space-y-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-fuchsia-400/30 bg-fuchsia-400/10 px-3 py-1.5 text-xs font-medium text-fuchsia-300 transition hover:bg-fuchsia-400/20 disabled:opacity-50"
        >
          <Upload className="size-3.5" />
          {uploading ? "업로드 중…" : "이미지 선택"}
        </button>

        {preview && (
          <button
            type="button"
            onClick={handleRemove}
            className="flex items-center gap-1 text-[11px] text-zinc-500 transition hover:text-red-400"
          >
            <Trash2 className="size-3" />
            삭제
          </button>
        )}

        <p className="text-[10px] text-zinc-600">
          JPG, PNG, GIF, WebP &middot; 최대 2MB
        </p>
      </div>
    </div>
  )
}
