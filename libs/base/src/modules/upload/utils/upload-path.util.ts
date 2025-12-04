import fs from 'node:fs'
import { join } from 'node:path'

/**
 * 清理原始文件名，确保其安全有效
 * @param name 原始文件名
 * @returns 清理后的文件名
 */
export function sanitizeOriginalName(name: string): string {
  // 替换换行符为空格，移除控制字符，处理特殊情况
  let sanitized = String(name)
    // 替换换行符和回车符为空格
    .replace(/[\r\n]/g, ' ')
    // 压缩多个空格为单个
    .replace(/\s+/g, ' ')
    // 去除首尾空白
    .trim()

  // 处理空文件名情况
  if (!sanitized) {
    return 'unnamed-file'
  }

  // 长度限制
  if (sanitized.length > 128) {
    sanitized = sanitized.slice(0, 128)
  }

  return sanitized
}

/**
 * 生成文件保存路径
 * @param uploadPath 基础上传路径
 * @param fileType 文件类型分类
 * @param scene 场景名称
 * @returns 完整的文件保存路径
 */
export function generateFilePath(
  uploadPath: string,
  fileType: string,
  scene: string,
) {
  // 参数验证
  if (!uploadPath || !fileType) {
    throw new Error('上传失败')
  }

  // 使用现代日期处理方式生成日期字符串
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  const dateStr = `${year}-${month}-${day}`
  const savePath = join(uploadPath, dateStr, fileType, scene)
  if (!fs.existsSync(savePath)) {
    try {
      fs.mkdirSync(savePath, { recursive: true, mode: 0o755 })
    } catch {
      throw new Error(`上传失败`)
    }
  }
  // 安全地拼接路径
  return join(uploadPath, dateStr, fileType, scene)
}
