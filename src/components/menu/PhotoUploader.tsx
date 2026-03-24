'use client'

import { useState, useCallback, useRef } from 'react'
import { Upload, X, Crop as CropIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

interface PhotoUploaderProps {
  onUpload: (file: File) => Promise<void>
  isUploading: boolean
}

type CropPreset = '16:9' | '1:1' | 'free'

interface CropState {
  file: File
  previewUrl: string
  preset: CropPreset
  cropX: number
  cropY: number
  cropWidth: number
  cropHeight: number
}

async function compressToWebP(file: File, maxWidth: number = 1200): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      let width = img.width
      let height = img.height

      // Scale down if too large
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width)
        width = maxWidth
      }

      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Could not get canvas context'))
        return
      }
      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Could not create blob'))
            return
          }
          const webpFile = new File(
            [blob],
            file.name.replace(/\.[^.]+$/, '.webp'),
            { type: 'image/webp' }
          )
          resolve(webpFile)
        },
        'image/webp',
        0.85
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    }

    img.src = url
  })
}

async function cropImage(
  file: File,
  cropX: number,
  cropY: number,
  cropWidth: number,
  cropHeight: number,
): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      canvas.width = cropWidth
      canvas.height = cropHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Could not get canvas context'))
        return
      }
      ctx.drawImage(img, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight)

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Could not create blob'))
            return
          }
          resolve(new File([blob], file.name, { type: file.type }))
        },
        file.type,
        0.92
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    }

    img.src = url
  })
}

export function PhotoUploader({ onUpload, isUploading }: PhotoUploaderProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cropState, setCropState] = useState<CropState | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)

  const validateFile = useCallback((file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return 'Invalid file type. Please use JPEG, PNG, WebP, or GIF.'
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size is 5MB.`
    }
    return null
  }, [])

  const openCropper = useCallback((file: File) => {
    const previewUrl = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      setCropState({
        file,
        previewUrl,
        preset: '16:9',
        cropX: 0,
        cropY: 0,
        cropWidth: img.width,
        cropHeight: Math.round(img.width * (9 / 16)),
      })
    }
    img.src = previewUrl
  }, [])

  const handleFiles = useCallback(
    (files: FileList | null) => {
      setError(null)
      if (!files || files.length === 0) return
      const file = files[0]
      const validationError = validateFile(file)
      if (validationError) {
        setError(validationError)
        return
      }
      openCropper(file)
    },
    [validateFile, openCropper]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      handleFiles(e.dataTransfer.files)
    },
    [handleFiles]
  )

  const handleUploadCropped = useCallback(async () => {
    if (!cropState) return
    try {
      setError(null)
      const cropped = await cropImage(
        cropState.file,
        cropState.cropX,
        cropState.cropY,
        cropState.cropWidth,
        cropState.cropHeight
      )
      const compressed = await compressToWebP(cropped)
      await onUpload(compressed)
      URL.revokeObjectURL(cropState.previewUrl)
      setCropState(null)
    } catch (err) {
      setError('Failed to process image. Please try again.')
    }
  }, [cropState, onUpload])

  const handleUploadOriginal = useCallback(async () => {
    if (!cropState) return
    try {
      setError(null)
      const compressed = await compressToWebP(cropState.file)
      await onUpload(compressed)
      URL.revokeObjectURL(cropState.previewUrl)
      setCropState(null)
    } catch (err) {
      setError('Failed to upload image. Please try again.')
    }
  }, [cropState, onUpload])

  const handleCancelCrop = useCallback(() => {
    if (cropState) {
      URL.revokeObjectURL(cropState.previewUrl)
    }
    setCropState(null)
  }, [cropState])

  const handlePresetChange = useCallback(
    (preset: CropPreset) => {
      if (!cropState || !imageRef.current) return
      const img = imageRef.current
      let width = img.naturalWidth
      let height: number

      switch (preset) {
        case '16:9':
          height = Math.round(width * (9 / 16))
          if (height > img.naturalHeight) {
            height = img.naturalHeight
            width = Math.round(height * (16 / 9))
          }
          break
        case '1:1':
          width = Math.min(img.naturalWidth, img.naturalHeight)
          height = width
          break
        case 'free':
        default:
          height = img.naturalHeight
          break
      }

      setCropState({
        ...cropState,
        preset,
        cropX: Math.round((img.naturalWidth - width) / 2),
        cropY: Math.round((img.naturalHeight - height) / 2),
        cropWidth: width,
        cropHeight: height,
      })
    },
    [cropState]
  )

  // Crop preview mode
  if (cropState) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">Crop Photo</span>
          <button
            type="button"
            onClick={handleCancelCrop}
            className="p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Preset pills */}
        <div className="flex gap-2">
          {(['16:9', '1:1', 'free'] as const).map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => handlePresetChange(preset)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                cropState.preset === preset
                  ? 'border-[#007AFF] bg-[#007AFF]/10 text-[#007AFF]'
                  : 'border-border text-muted-foreground'
              )}
            >
              {preset === 'free' ? 'Free' : preset}
            </button>
          ))}
        </div>

        {/* Image preview */}
        <div className="relative overflow-hidden rounded-lg bg-muted">
          <img
            ref={imageRef}
            src={cropState.previewUrl}
            alt="Crop preview"
            className="w-full h-auto max-h-[200px] object-contain"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={handleUploadCropped}
            disabled={isUploading}
            className="flex-1"
          >
            <CropIcon className="size-3.5 mr-1" />
            {isUploading ? 'Uploading...' : 'Crop & Upload'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleUploadOriginal}
            disabled={isUploading}
          >
            Upload Original
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* Drag and drop area */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragOver(true)
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={cn(
          'flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors cursor-pointer',
          isDragOver
            ? 'border-[#007AFF] bg-[#007AFF]/5'
            : 'border-border hover:border-border'
        )}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="size-8 text-muted-foreground/40 mb-2" strokeWidth={1.5} />
        <p className="text-sm font-medium text-foreground">
          Drop photo here or click to browse
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          JPEG, PNG, WebP, or GIF. Max 5MB.
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        onChange={(e) => handleFiles(e.target.files)}
        className="hidden"
      />

      {error && (
        <p className="text-xs font-medium text-destructive">{error}</p>
      )}
    </div>
  )
}
