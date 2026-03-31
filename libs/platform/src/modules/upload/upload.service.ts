import type { UploadConfigInterface } from '@libs/platform/config'
import type { FastifyRequest } from 'fastify'
import type {
  PreparedUploadFile,
  UploadConfigProvider,
  UploadFileCategory,
  UploadLocalFileOptions,
  UploadResult,
  UploadSystemConfig,
} from './upload.types'
import { Buffer as NodeBuffer } from 'node:buffer'
import { createWriteStream, promises as fs } from 'node:fs'
import { basename, extname, join, posix } from 'node:path'
import { PassThrough, pipeline } from 'node:stream'
import { promisify } from 'node:util'
import {
  BadRequestException,
  Inject,
  Injectable,
  Optional,
  PayloadTooLargeException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { fileTypeFromBuffer, fileTypeFromFile } from 'file-type'
import mime from 'mime-types'
import { v4 as uuidv4 } from 'uuid'
import { LocalUploadProvider } from './local-upload.provider'
import { QiniuUploadProvider } from './qiniu-upload.provider'
import { SuperbedUploadProvider } from './superbed-upload.provider'
import { UPLOAD_CONFIG_PROVIDER, UploadProviderEnum } from './upload.types'

const pump = promisify(pipeline)
const DEFAULT_UPLOAD_SCENE = 'shared'
const SCENE_NAME_REGEX = /^[a-z0-9]+$/i
const PATH_SEGMENT_REGEX = /^[\w.-]+$/
const LEADING_DOT_REGEX = /^\./
const TRAILING_EXTENSION_REGEX = /\.[^.]+$/
const RESERVED_PATH_SEGMENTS = new Set(['.', '..'])

interface MultipartFieldLike {
  type?: unknown
  value?: unknown
}

@Injectable()
export class UploadService {
  private readonly uploadConfig: UploadConfigInterface

  constructor(
    private readonly configService: ConfigService,
    private readonly localUploadProvider: LocalUploadProvider,
    private readonly qiniuUploadProvider: QiniuUploadProvider,
    private readonly superbedUploadProvider: SuperbedUploadProvider,
    @Optional()
    @Inject(UPLOAD_CONFIG_PROVIDER)
    private readonly uploadConfigProvider?: UploadConfigProvider,
  ) {
    this.uploadConfig = this.configService.get<UploadConfigInterface>('upload')!
  }

  async uploadFile(
    data: FastifyRequest,
    pathSegments?: string[],
  ): Promise<UploadResult> {
    const targetFile = await data.file()
    if (!targetFile) {
      throw new BadRequestException('上传文件不能为空')
    }

    const scene = this.extractScene(targetFile.fields.scene)
    if (!scene) {
      await this.consumeStream(targetFile.file)
      throw new BadRequestException('未知的上传场景')
    }

    const firstChunk = await this.readFirstChunk(targetFile.file)
    const detectedFileType = await fileTypeFromBuffer(firstChunk)
    const resolvedFileType = this.resolveFileType(
      detectedFileType?.ext,
      detectedFileType?.mime,
      targetFile.filename,
      targetFile.mimetype,
    )

    if (!resolvedFileType) {
      await this.consumeStream(targetFile.file)
      throw new BadRequestException('无法识别的文件类型')
    }

    const { ext, mime, fileCategory } = resolvedFileType
    if (!this.uploadConfig.allowMimeTypesFlat.includes(mime)) {
      await this.consumeStream(targetFile.file)
      throw new BadRequestException('不被允许的文件类型')
    }

    const finalName = `${uuidv4()}.${ext}`
    const objectKey = this.buildObjectKey(
      scene,
      fileCategory,
      finalName,
      pathSegments,
    )
    const tempPath = join(this.uploadConfig.tmpDir, `.${uuidv4()}.uploading`)

    await fs.mkdir(this.uploadConfig.tmpDir, { recursive: true })

    const detectionStream = new PassThrough()
    detectionStream.write(firstChunk)
    targetFile.file.pipe(detectionStream)

    try {
      await pump(detectionStream, createWriteStream(tempPath))
      if (targetFile.file.truncated) {
        throw new PayloadTooLargeException('文件大小超过限制')
      }

      const stats = await fs.stat(tempPath)
      const preparedFile: PreparedUploadFile = {
        tempPath,
        objectKey,
        finalName,
        originalName: targetFile.filename,
        mimeType: mime,
        ext,
        fileCategory,
        scene,
        fileSize: stats.size,
      }

      return await this.uploadPreparedFile(preparedFile)
    } catch (error: any) {
      if (error?.response?.message) {
        throw error
      }
      if (
        error instanceof BadRequestException ||
        error instanceof PayloadTooLargeException
      ) {
        throw error
      }
      throw new BadRequestException('上传文件失败')
    } finally {
      await fs.rm(tempPath, { force: true }).catch(() => undefined)
    }
  }

  /**
   * 将本地文件继续走统一上传 provider 流程。
   * 用于压缩包解压后的图片按既有上传配置决定最终落点。
   */
  async uploadLocalFile(
    options: UploadLocalFileOptions,
  ): Promise<UploadResult> {
    const detectedFileType = await fileTypeFromFile(options.localPath).catch(
      () => null,
    )
    const originalName = options.originalName ?? basename(options.localPath)
    const resolvedFileType = this.resolveFileType(
      detectedFileType?.ext,
      detectedFileType?.mime,
      originalName,
    )

    if (!resolvedFileType) {
      throw new BadRequestException('无法识别的文件类型')
    }

    const { ext, mime: resolvedMime, fileCategory } = resolvedFileType
    if (!this.uploadConfig.allowMimeTypesFlat.includes(resolvedMime)) {
      throw new BadRequestException('不被允许的文件类型')
    }

    const normalizedObjectKeySegments = this.normalizePathSegments(
      options.objectKeySegments,
    )
    if (normalizedObjectKeySegments.length === 0) {
      throw new BadRequestException('上传路径不合法')
    }

    const finalName = this.resolveFinalName(ext, options.finalName)
    const objectKey = posix.join(...normalizedObjectKeySegments, finalName)
    const stats = await fs.stat(options.localPath)
    const preparedFile: PreparedUploadFile = {
      tempPath: options.localPath,
      objectKey,
      finalName,
      originalName,
      mimeType: resolvedMime,
      ext,
      fileCategory,
      scene: normalizedObjectKeySegments[0] ?? DEFAULT_UPLOAD_SCENE,
      fileSize: stats.size,
    }

    return this.uploadPreparedFile(preparedFile)
  }

  private getSystemUploadConfig() {
    return (
      this.uploadConfigProvider?.getUploadConfig() ?? {
        provider: UploadProviderEnum.LOCAL,
        superbedNonImageFallbackToLocal: true,
        qiniu: {
          accessKey: '',
          secretKey: '',
          bucket: '',
          domain: '',
          region: '',
          pathPrefix: '',
          useHttps: true,
          tokenExpires: 3600,
        },
        superbed: {
          token: '',
          categories: '',
        },
      }
    )
  }

  private async uploadByProvider(
    provider: UploadProviderEnum,
    file: PreparedUploadFile,
    systemConfig: UploadSystemConfig,
  ) {
    switch (provider) {
      case UploadProviderEnum.QINIU:
        return this.qiniuUploadProvider.upload(file, systemConfig)
      case UploadProviderEnum.SUPERBED:
        return this.superbedUploadProvider.upload(file, systemConfig)
      case UploadProviderEnum.LOCAL:
      default:
        return this.localUploadProvider.upload(file)
    }
  }

  private resolveProvider(
    provider: UploadProviderEnum,
    fileCategory: UploadFileCategory,
    superbedNonImageFallbackToLocal: boolean,
  ) {
    if (
      provider === UploadProviderEnum.SUPERBED &&
      fileCategory !== 'image' &&
      superbedNonImageFallbackToLocal
    ) {
      return UploadProviderEnum.LOCAL
    }

    return provider
  }

  private async uploadPreparedFile(
    preparedFile: PreparedUploadFile,
  ) {
    this.assertFileSizeWithinLimit(preparedFile.fileSize)

    const systemUploadConfig = this.getSystemUploadConfig()
    const provider = this.resolveProvider(
      systemUploadConfig.provider,
      preparedFile.fileCategory,
      systemUploadConfig.superbedNonImageFallbackToLocal,
    )
    const result = await this.uploadByProvider(
      provider,
      preparedFile,
      systemUploadConfig,
    )

    return {
      filename: preparedFile.finalName,
      originalName: preparedFile.originalName,
      filePath: result.filePath,
      fileSize: preparedFile.fileSize,
      mimeType: preparedFile.mimeType,
      fileType: preparedFile.ext,
      scene: preparedFile.scene,
      uploadTime: new Date(),
    }
  }

  private buildObjectKey(
    scene: string,
    fileCategory: UploadFileCategory,
    finalName: string,
    pathSegments?: string[],
  ) {
    const normalizedSegments = this.normalizePathSegments(pathSegments)

    if (normalizedSegments.length > 0) {
      return posix.join(scene, ...normalizedSegments, finalName)
    }

    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    const dateStr = `${year}-${month}-${day}`

    return posix.join(scene, dateStr, fileCategory, finalName)
  }

  private normalizePathSegments(pathSegments?: string[]) {
    return (pathSegments ?? [])
      .map((segment) => segment.trim())
      .filter(Boolean)
      .map((segment) => {
        if (
          !PATH_SEGMENT_REGEX.test(segment)
          || RESERVED_PATH_SEGMENTS.has(segment)
        ) {
          throw new BadRequestException('上传路径不合法')
        }
        return segment
      })
  }

  private resolveFinalName(ext: string, finalName?: string) {
    if (!finalName) {
      return `${uuidv4()}.${ext}`
    }

    const trimmedName = finalName.trim()
    if (!trimmedName) {
      throw new BadRequestException('上传文件名不合法')
    }

    const nameWithoutExt = trimmedName.replace(TRAILING_EXTENSION_REGEX, '')
    if (
      !nameWithoutExt
      || !PATH_SEGMENT_REGEX.test(nameWithoutExt)
      || RESERVED_PATH_SEGMENTS.has(nameWithoutExt)
    ) {
      throw new BadRequestException('上传文件名不合法')
    }

    return `${nameWithoutExt}.${ext}`
  }

  private resolveFileType(
    detectedExt: string | undefined,
    detectedMime: string | undefined,
    originalName: string,
    requestMime?: string,
  ): { ext: string, mime: string, fileCategory: UploadFileCategory } | null {
    const filenameExt = extname(originalName)
      .replace(LEADING_DOT_REGEX, '')
      .toLowerCase()
    const ext = (detectedExt || filenameExt).toLowerCase()
    if (!ext) {
      return null
    }

    const fileCategory = this.getFileCategoryFromExt(ext)
    if (!fileCategory) {
      return null
    }

    const mime =
      detectedMime?.toLowerCase() ||
      (requestMime && requestMime !== 'application/octet-stream'
        ? requestMime.toLowerCase()
        : '') ||
        this.lookupMimeByExt(ext)

    if (!mime) {
      return null
    }

    return {
      ext,
      mime,
      fileCategory,
    }
  }

  private lookupMimeByExt(ext: string) {
    const lookupValue = mime.lookup(ext)
    return lookupValue ? String(lookupValue).toLowerCase() : ''
  }

  private getFileCategoryFromExt(ext: string) {
    const lowerExt = ext.toLowerCase()
    for (const type of Object.keys(
      this.uploadConfig.allowExtensions,
    ) as UploadFileCategory[]) {
      if (this.uploadConfig.allowExtensions[type].includes(lowerExt)) {
        return type
      }
    }
    return null
  }

  private extractScene(sceneField: unknown) {
    if (sceneField == null) {
      return DEFAULT_UPLOAD_SCENE
    }

    let scene: string | undefined

    if (typeof sceneField === 'string') {
      scene = sceneField
    } else if (
      sceneField &&
      typeof sceneField === 'object' &&
      'type' in sceneField &&
      'value' in sceneField
    ) {
      const field = sceneField as MultipartFieldLike
      if (field.type === 'field') {
        scene = String(field.value)
      }
    } else if (Array.isArray(sceneField)) {
      const firstField = sceneField[0] as MultipartFieldLike | undefined
      if (firstField?.type === 'field') {
        scene = String(firstField.value)
      }
    }

    const normalizedScene = scene?.trim()
    if (
      !normalizedScene
      || !SCENE_NAME_REGEX.test(normalizedScene)
      || normalizedScene.length > 20
    ) {
      return null
    }

    return normalizedScene
  }

  /**
   * 在 provider 执行前统一兜底文件大小限制。
   * 避免本地二次上传路径绕过 Fastify multipart 的请求级限流。
   */
  private assertFileSizeWithinLimit(fileSize: number) {
    if (fileSize > this.uploadConfig.maxFileSize) {
      throw new PayloadTooLargeException('文件大小超过限制')
    }
  }

  private async readFirstChunk(
    stream: NodeJS.ReadableStream & {
      read: (size?: number) => NodeBuffer | null
    },
  ): Promise<NodeBuffer> {
    const initialChunk = stream.read(4100) || stream.read()
    if (initialChunk) {
      return this.toBuffer(initialChunk)
    }

    return new Promise<NodeBuffer>((resolve, reject) => {
      let onEnd: () => void
      let onError: (error: Error) => void

      const onReadable = () => {
        stream.off('readable', onReadable)
        stream.off('end', onEnd)
        stream.off('error', onError)
        resolve(
          this.toBuffer(
            stream.read(4100) || stream.read() || NodeBuffer.alloc(0),
          ),
        )
      }
      onEnd = () => {
        stream.off('readable', onReadable)
        stream.off('end', onEnd)
        stream.off('error', onError)
        resolve(NodeBuffer.alloc(0))
      }
      onError = (error: Error) => {
        stream.off('readable', onReadable)
        stream.off('end', onEnd)
        stream.off('error', onError)
        reject(error)
      }
      stream.on('readable', onReadable)
      stream.on('end', onEnd)
      stream.on('error', onError)
    })
  }

  private toBuffer(chunk: string | NodeBuffer) {
    return typeof chunk === 'string' ? NodeBuffer.from(chunk) : chunk
  }

  private async consumeStream(stream: NodeJS.ReadableStream) {
    return new Promise((resolve) => {
      stream.on('end', resolve)
      stream.on('error', resolve)
      stream.resume()
    })
  }
}
