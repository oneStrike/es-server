import type { UploadConfig } from '@/config/upload.config'
import fs from 'node:fs'
import path, { join } from 'node:path'
import { Injectable } from '@nestjs/common'
import { v4 as uuidv4 } from 'uuid'

/**
 * 文件路径和名称管理服务
 * 负责处理文件路径生成、文件名生成、路径规范化等功能
 */
@Injectable()
export class UploadPathService {
  /**
   * 规范化上传场景字符串，防止路径穿越与非法字符
   * @param scene 场景字符串
   * @returns 规范化后的场景
   */
  sanitizeScene(scene?: string): string {
    const fallback = 'shared'
    if (!scene) {
      return fallback
    }
    // 去除控制字符，替换分隔符，限制字符集与长度
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

  /**
   * 规范化原始文件名用于日志/返回，避免控制字符与过长
   * @param name 文件名
   * @returns 规范化后的文件名
   */
  sanitizeOriginalName(name: string): string {
    let n = String(name)
      .replace(/[\r\n]/g, ' ')
      .trim()
    if (n.length > 128) {
      n = n.slice(0, 128)
    }
    return n
  }

  /**
   * 生成文件保存路径
   * @param uploadPath 基础上传路径
   * @param fileType 文件类型
   * @param scene 场景
   * @returns 文件保存路径
   */
  generateFilePath(
    uploadPath: string,
    fileType: string,
    scene: string,
  ): string {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0') // 月份从0开始
    const day = String(today.getDate()).padStart(2, '0')
    const dateStr = `${year}-${month}-${day}` // 按服务器本地时区
    return join(uploadPath, dateStr, fileType, scene)
  }

  /**
   * 生成最终安全文件名
   * @param originalName 原始文件名
   * @param ext 扩展名
   * @param strategy 文件名生成策略
   * @param hash 文件哈希值
   * @returns 最终文件名
   */
  generateFinalFilename(
    originalName: string,
    ext: string,
    strategy: UploadConfig['filenameStrategy'],
    hash: string,
  ): string {
    const base = (() => {
      const e = path.extname(originalName)
      const raw = originalName.slice(0, originalName.length - e.length)
      // 复用原名清洗，但只取基名，限制长度与字符集
      let b = this.sanitizeOriginalName(raw)
        .toLowerCase()
        .replace(/[^a-z0-9._-]/g, '-')
      if (b.length > 32) {
        b = b.slice(0, 32)
      }
      if (!b) {
        b = 'file'
      }
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

  /**
   * 将绝对磁盘路径转换为可公开访问的 URL 路径（/uploads/...）
   * @param fullPath 绝对路径
   * @param uploadPath 基础上传路径
   * @returns 公开访问路径
   */
  toPublicPath(fullPath: string, uploadPath: string): string {
    const relative = fullPath.replace(uploadPath, '').replace(/^[/\\]/, '')
    return `/uploads/${relative.replace(/\\/g, '/')}`
  }

  /**
   * 确保上传目录存在
   * @param dirPath 目录路径
   */
  ensureUploadDirectory(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true })
    }
  }
}
