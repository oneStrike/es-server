import type { FastifyRequest } from 'fastify'
import type { UploadConfig } from '@/config/upload.config'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  renameSync,
  unlinkSync,
} from 'node:fs'
import { extname, join } from 'node:path'
import { pipeline, Transform } from 'node:stream'
import { promisify } from 'node:util'
import { BadRequestException, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { v4 as uuidv4 } from 'uuid'
import { UploadResponseDto } from '@/common/dto/upload.dto'
import { LoggerFactoryService } from '@/common/module/logger/logger-factory.service'
import { CustomLoggerService } from '@/common/module/logger/logger.service'

const pump = promisify(pipeline)

@Injectable()
export class UploadService {
  private readonly logger: CustomLoggerService
  private uploadPath: string

  private uploadConfig: UploadConfig | null = null
  private mimeTypeMap: Map<string, string> = new Map()

  constructor(
    private configService: ConfigService,
    private loggerFactory: LoggerFactoryService,
  ) {
    this.logger = this.loggerFactory.createGlobalLogger('UploadService')
    this.uploadPath = this.getUploadConfig().uploadDir
  }

  /**
   * 初始化MIME类型映射表（性能优化：避免重复数组查找）
   */
  private initializeMimeTypeMap(): void {
    if (this.mimeTypeMap.size > 0) {
      return // 已经初始化过了
    }

    const config = this.getUploadConfig()
    const typeCategories = [
      { category: 'image', types: config.imageType.mimeTypes },
      { category: 'audio', types: config.audioType.mimeTypes },
      { category: 'video', types: config.videoType.mimeTypes },
      { category: 'document', types: config.documentType.mimeTypes },
      { category: 'archive', types: config.archiveType.mimeTypes },
    ]

    typeCategories.forEach(({ category, types }) => {
      types.forEach((mimeType) => {
        this.mimeTypeMap.set(mimeType, category)
      })
    })
  }

  private getUploadConfig(): UploadConfig {
    // 缓存配置以避免重复获取
    if (!this.uploadConfig) {
      this.uploadConfig = this.configService.get<UploadConfig>('upload')!
    }
    return this.uploadConfig
  }

  /**
   * 规范化上传场景字符串，防止路径穿越与非法字符
   */
  private sanitizeScene(scene?: string): string {
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
   */
  private sanitizeOriginalName(name: string): string {
    let n = String(name)
      .replace(/[\r\n]/g, ' ')
      .trim()
    if (n.length > 128) {
      n = n.slice(0, 128)
    }
    return n
  }

  /**
   * 确保上传目录存在
   * @param dirPath 目录路径
   */
  private ensureUploadDirectory(dirPath: string) {
    if (!existsSync(dirPath)) {
      mkdirSync(dirPath, { recursive: true })
    }
  }

  /**
   * 根据MIME类型获取文件类型分类（性能优化：使用Map查找）
   * @param mimeType MIME类型
   * @returns 文件类型分类
   */
  private getFileTypeCategory(mimeType: string): string {
    // 确保MIME类型映射表已初始化
    this.initializeMimeTypeMap()
    return this.mimeTypeMap.get(mimeType) || 'other'
  }

  /**
   * 生成文件保存路径
   * @param fileType 文件类型
   * @param scene 场景
   * @returns 文件保存路径
   */
  private generateFilePath(fileType: string, scene: string): string {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0') // 月份从0开始
    const day = String(today.getDate()).padStart(2, '0')
    const dateStr = `${year}-${month}-${day}` // 按服务器本地时区
    return join(this.uploadPath, dateStr, fileType, scene)
  }

  /**
   * 生成最终安全文件名
   */
  private generateFinalFilename(
    originalName: string,
    ext: string,
    strategy: UploadConfig['filenameStrategy'],
    hash: string,
  ): string {
    const base = (() => {
      const e = extname(originalName)
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
   */
  private toPublicPath(fullPath: string): string {
    const relative = fullPath.replace(this.uploadPath, '').replace(/^[/\\]/, '')
    return `/uploads/${relative.replace(/\\/g, '/')}`
  }

  /**
   * 验证文件类型和大小
   * @param file 文件对象
   * @param config 上传配置
   */
  private validateFile(file: any, config: UploadConfig): void {
    // 验证MIME类型
    if (!config.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `文件 ${file.filename} 类型不支持: ${file.mimetype}`,
      )
    }

    // 验证文件扩展名
    const ext = extname(file.filename).toLowerCase()
    if (!config.allowedExtensions.includes(ext)) {
      throw new BadRequestException(
        `文件 ${file.filename} 扩展名不支持: ${ext}`,
      )
    }

    // 扩展名与MIME类型一致性检查（按类别）
    const category = this.getFileTypeCategory(file.mimetype)
    const categoryExtsMap: Record<string, string[]> = {
      image: config.imageType.extensions,
      audio: config.audioType.extensions,
      video: config.videoType.extensions,
      document: config.documentType.extensions,
      archive: config.archiveType.extensions,
      other: [],
    }
    const exts = categoryExtsMap[category] || []
    if (exts.length > 0 && !exts.includes(ext)) {
      throw new BadRequestException(
        `文件扩展名与类型不匹配: ${file.mimetype} 不应为 ${ext}`,
      )
    }

    // 验证文件大小（注意：在流式处理中，我们需要在处理过程中检查大小）
    // 这里我们先做一个基本检查，实际大小检查在流处理中进行
  }

  /**
   * 创建文件处理流（包含大小监控和哈希计算）
   * @param config 上传配置
   * @param filename 文件名
   * @returns 转换流和状态对象
   */
  private createFileProcessingStream(config: UploadConfig, filename: string) {
    let totalSize = 0
    const hash = createHash('md5')

    const processingStream = new Transform({
      transform(chunk: any, encoding: any, callback: any) {
        totalSize += chunk.length

        // 实时检查文件大小，超过限制立即停止
        if (totalSize > config.maxFileSize) {
          const error = new BadRequestException(
            `文件 ${filename} 大小超出限制 ${config.maxFileSize} 字节`,
          )
          return callback(error)
        }

        hash.update(chunk)
        callback(null, chunk)
      },
    })

    return {
      stream: processingStream,
      getSize: () => totalSize,
      getHash: () => hash.digest('hex'),
    }
  }

  /**
   * 创建文件签名检测流：对常见类型做魔数校验，防止伪造Content-Type
   */
  private createSignatureCheckStream(
    mimetype: string,
    ext: string,
    filename: string,
  ): Transform {
    const requiredBytes = 16 // 足够用于常见类型的魔数检测
    let head = Buffer.alloc(0)
    let validated = false

    const match = (buf: Buffer, sig: number[] | Buffer, offset = 0) => {
      const s = Buffer.isBuffer(sig) ? sig : Buffer.from(sig)
      if (buf.length < offset + s.length) {
        return false
      }
      return buf.slice(offset, offset + s.length).equals(s)
    }

    const validateByMagic = (buf: Buffer) => {
      // 图片
      if (mimetype === 'image/jpeg' && ['.jpg', '.jpeg'].includes(ext)) {
        return match(buf, [0xFF, 0xD8, 0xFF], 0)
      }
      if (mimetype === 'image/png' && ext === '.png') {
        return match(
          buf,
          Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
          0,
        )
      }
      if (mimetype === 'image/gif' && ['.gif'].includes(ext)) {
        return (
          match(buf, Buffer.from('GIF87a')) || match(buf, Buffer.from('GIF89a'))
        )
      }
      if (mimetype === 'image/webp' && ext === '.webp') {
        // RIFF....WEBP
        return (
          match(buf, Buffer.from('RIFF'), 0) &&
          match(buf, Buffer.from('WEBP'), 8)
        )
      }
      // 文档/归档
      if (mimetype === 'application/pdf' && ext === '.pdf') {
        return match(buf, Buffer.from('%PDF-'), 0)
      }
      if (
        (mimetype === 'application/zip' && ext === '.zip') ||
        mimetype.includes('openxmlformats') // docx/xlsx/pptx 等OOXML
      ) {
        return match(buf, Buffer.from('PK\x03\x04'), 0)
      }
      if (mimetype === 'application/gzip' && ext === '.gz') {
        return match(buf, Buffer.from([0x1F, 0x8B]), 0)
      }
      // 音视频（部分弱校验）
      if (mimetype === 'video/mp4' && ext === '.mp4') {
        // 粗略：前12字节中存在 ftyp 标记
        return buf.includes(Buffer.from('ftyp'))
      }
      if (mimetype === 'audio/ogg' && ext === '.ogg') {
        return match(buf, Buffer.from('OggS'), 0)
      }
      if (mimetype === 'video/webm' && ext === '.webm') {
        // EBML 头部
        return match(buf, Buffer.from([0x1A, 0x45, 0xDF, 0xA3]), 0)
      }
      // 其他类型不强制魔数校验
      return true
    }

    return new Transform({
      transform(chunk: any, _encoding: any, callback: any) {
        if (!validated) {
          head = Buffer.concat([head, Buffer.from(chunk)])
          if (head.length >= requiredBytes) {
            if (!validateByMagic(head)) {
              const error = new BadRequestException(
                `文件签名与声明类型不匹配: ${filename}`,
              )
              return callback(error)
            }
            validated = true
            // 将累计的头部一次性写出
            this.push(head)
            return callback()
          }
          // 先不写出，等足够字节后统一校验与写出
          return callback()
        }
        // 已验证，直接透传
        callback(null, chunk)
      },
      flush(callback: any) {
        if (!validated) {
          // 文件过小但仍需校验
          if (!validateByMagic(head)) {
            const error = new BadRequestException(
              `文件签名与声明类型不匹配: ${filename}`,
            )
            return callback(error)
          }
          this.push(head)
        }
        callback()
      },
    })
  }

  /**
   * 上传多个文件（性能优化：并行处理，内联文件处理逻辑）
   * @param data Fastify multipart数据
   * @param scene 场景
   * @returns 上传结果数组
   */
  async uploadMultipleFiles(
    data: FastifyRequest,
    scene?: string,
  ): Promise<UploadResponseDto[]> {
    const config = this.getUploadConfig()
    const files = data.files()
    const filePromises: Promise<UploadResponseDto | null>[] = []
    const errors: Error[] = []

    scene = this.sanitizeScene(scene)

    // 收集所有文件处理任务
    for await (const file of files) {
      // 内联文件处理逻辑以提高性能
      const filePromise = (async (): Promise<UploadResponseDto | null> => {
        const startTime = Date.now()

        try {
          // 验证文件
          this.validateFile(file, config)

          // 获取文件类型分类
          const fileType = this.getFileTypeCategory(file.mimetype)

          // 生成保存路径
          const savePath = this.generateFilePath(fileType, scene)
          this.ensureUploadDirectory(savePath)

          // 生成文件名（保留原扩展，规范化小写）
          const ext = extname(file.filename).toLowerCase()
          const tempName = `.${uuidv4()}.uploading`
          const tempPath = join(savePath, tempName)
          const writeStream = createWriteStream(tempPath)

          // 创建文件处理流
          const {
            stream: processingStream,
            getSize,
            getHash,
          } = this.createFileProcessingStream(config, file.filename)

          // 签名校验流（防伪造 Content-Type）
          const signatureStream = this.createSignatureCheckStream(
            file.mimetype,
            ext,
            file.filename,
          )

          try {
            // 使用管道流式处理文件
            await pump(
              file.file,
              signatureStream,
              processingStream,
              writeStream,
            )

            // 检查文件是否被截断（超出大小限制）
            if (file.file.truncated) {
              // 删除已写入的部分文件
              try {
                if (existsSync(tempPath)) {
                  unlinkSync(tempPath)
                  this.logger.warn(
                    `文件 ${file.filename} 超出大小限制，已删除磁盘残留文件: ${tempPath}`,
                  )
                }
              } catch (deleteError) {
                this.logger.error(
                  `删除超限文件时出错: ${deleteError.message}`,
                  deleteError.stack,
                )
              }
              throw new BadRequestException(
                `文件 ${file.filename} 超出大小限制 ${config.maxFileSize} 字节`,
              )
            }

            const processingTime = Date.now() - startTime
            const fileSize = getSize()
            const fileHash = getHash()

            // 二次验证文件大小（防止流处理过程中的边界情况）
            if (fileSize > config.maxFileSize) {
              // 删除已写入的文件
              try {
                if (existsSync(tempPath)) {
                  unlinkSync(tempPath)
                  this.logger.warn(
                    `文件 ${file.filename} 实际大小超限，已删除: ${tempPath}`,
                  )
                }
              } catch (deleteError) {
                this.logger.error(
                  `删除超限文件时出错: ${deleteError.message}`,
                  deleteError.stack,
                )
              }
              throw new BadRequestException(
                `文件 ${file.filename} 大小 ${fileSize} 字节超出限制 ${config.maxFileSize} 字节`,
              )
            }

            // 生成最终文件名并重命名临时文件
            let finalName = this.generateFinalFilename(
              file.filename,
              ext,
              config.filenameStrategy,
              fileHash,
            )
            let finalPath = join(savePath, finalName)
            try {
              // 若发生同名冲突（如重复上传同 hash），添加短 uuid 后缀
              if (existsSync(finalPath)) {
                const altName = `${finalName.replace(ext, '')}-${uuidv4().slice(0, 6)}${ext}`
                const altPath = join(savePath, altName)
                renameSync(tempPath, altPath)
                this.logger.warn(`目标文件已存在，已改名为: ${altName}`)
                finalName = altName
                finalPath = altPath
              } else {
                renameSync(tempPath, finalPath)
              }
            } catch (renameError: any) {
              // 重命名失败则清理临时文件并抛出错误
              try {
                if (existsSync(tempPath)) {
                  unlinkSync(tempPath)
                }
              } catch {}
              throw renameError
            }

            this.logger.log(
              `文件上传成功: ${file.filename} -> ${finalName} (${fileSize} bytes, ${processingTime}ms, hash: ${fileHash})`,
            )
            // 计算公开路径（相对于 uploads 静态前缀）
            const filePath = this.toPublicPath(finalPath)

            return {
              filename: finalName,
              originalName: this.sanitizeOriginalName(file.filename),
              filePath,
              fileSize,
              mimeType: file.mimetype,
              fileType,
              scene,
              uploadTime: new Date(),
            }
          } catch (error) {
            // 如果上传失败，尝试删除已创建的文件
            try {
              if (existsSync(tempPath)) {
                unlinkSync(tempPath)
                this.logger.warn(`上传失败，已删除残留文件: ${tempPath}`)
              }
            } catch (deleteError) {
              this.logger.error(
                `删除失败文件时出错: ${deleteError.message}`,
                deleteError.stack,
              )
            }
            throw error
          }
        } catch (error) {
          errors.push(error as Error)
          return null
        }
      })()

      filePromises.push(filePromise)
    }

    if (filePromises.length === 0) {
      throw new BadRequestException('没有有效的文件被上传')
    }

    // 并行处理所有文件
    const results = await Promise.all(filePromises)

    // 过滤掉失败的文件
    const successResults = results.filter((result) => result != null)

    // 如果有错误且没有成功的文件，抛出第一个错误
    if (errors.length > 0 && successResults.length === 0) {
      throw errors[0]
    }

    // 如果有部分失败，记录警告
    if (errors.length > 0) {
      this.logger.warn(
        `${errors.length} 个文件上传失败，${successResults.length} 个文件上传成功`,
      )
    }

    return successResults
  }
}
