import type { UploadConfig } from '@/config/upload.config'
import fs from 'node:fs'
import path, { join } from 'node:path'
import { v4 as uuidv4 } from 'uuid'

export function sanitizeScene(scene?: string): string {
  const fallback = 'shared'
  if (!scene)
{ return fallback }
  let s = String(scene).replace(/[/\\]/g, '-').replace(/\.+/g, '-').trim().toLowerCase()
  if (!s)
{ return fallback }
  s = s.replace(/[^a-z0-9._-]/g, '-')
  if (s.length > 64)
{ s = s.slice(0, 64) }
  return s || fallback
}

export function sanitizeOriginalName(name: string): string {
  let n = String(name).replace(/[\r\n]/g, ' ').trim()
  if (n.length > 128)
{ n = n.slice(0, 128) }
  return n
}

export function generateFilePath(uploadPath: string, fileType: string, scene: string): string {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  const dateStr = `${year}-${month}-${day}`
  return join(uploadPath, dateStr, fileType, scene)
}

export function generateFinalFilename(
  originalName: string,
  ext: string,
  strategy: UploadConfig['filenameStrategy'],
  hash: string,
): string {
  const base = (() => {
    const e = path.extname(originalName)
    const raw = originalName.slice(0, originalName.length - e.length)
    let b = sanitizeOriginalName(raw).toLowerCase().replace(/[^a-z0-9._-]/g, '-')
    if (b.length > 32)
{ b = b.slice(0, 32) }
    if (!b)
{ b = 'file' }
    return b
  })()

  switch (strategy) {
    case 'uuid':
      return `${uuidv4()}${ext}`
    case 'uuid_original': {
      const shortUuid = uuidv4().slice(0, 8)
      return `${base}-${shortUuid}${ext}`
    }
    case 'hash':
      return `${hash}${ext}`
    case 'hash_original': {
      const shortHash = hash.slice(0, 8)
      return `${base}-${shortHash}${ext}`
    }
    default:
      return `${uuidv4()}${ext}`
  }
}

export function toPublicPath(fullPath: string, uploadPath: string): string {
  const relative = fullPath.replace(uploadPath, '').replace(/^[/\\]/, '')
  return `/uploads/${relative.replace(/\\/g, '/')}`
}

export function ensureUploadDirectory(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
}
