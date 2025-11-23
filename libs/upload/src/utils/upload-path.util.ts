import fs from 'node:fs'
import { join } from 'node:path'
import { v4 as uuidv4 } from 'uuid'

export function sanitizeScene(scene?: string): string {
  const fallback = 'shared'
  if (!scene) {
    return fallback
  }
  let s = String(scene)
    .replace(/[/\\]/g, '-')
    .replace(/\.+/g, '-')
    .trim()
    .toLowerCase()
  if (!s) {
    return fallback
  }
  s = s.replace(/[^a-z0-9._-]/g, '-')
  if (s.length > 64) {
    s = s.slice(0, 64)
  }
  return s || fallback
}

export function sanitizeOriginalName(name: string): string {
  let n = String(name)
    .replace(/[\r\n]/g, ' ')
    .trim()
  if (n.length > 128) {
    n = n.slice(0, 128)
  }
  return n
}

export function generateFilePath(
  uploadPath: string,
  fileType: string,
  scene: string,
): string {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  const dateStr = `${year}-${month}-${day}`
  return join(uploadPath, dateStr, fileType, scene)
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
