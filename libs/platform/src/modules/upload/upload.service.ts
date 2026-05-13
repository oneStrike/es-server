import type { UploadConfigInterface } from '@libs/platform/config'
import type { FastifyRequest } from 'fastify'
import type {
  MultipartFieldLike,
  PreparedUploadFile,
  StoredUploadNameResult,
  UploadConfigProvider,
  UploadDeleteTarget,
  UploadFileCategory,
  UploadFileOptions,
  UploadLocalFileOptions,
  UploadResponseCarrier,
  UploadResult,
  UploadStoredFileResult,
  UploadSystemConfig,
} from './upload.type'
import { Buffer as NodeBuffer } from 'node:buffer'
import { createWriteStream, promises as fs } from 'node:fs'
import { basename, extname, join, posix } from 'node:path'
import { PassThrough, pipeline } from 'node:stream'
import { promisify } from 'node:util'
import { UPLOAD_CUSTOM_MIME_BY_EXT } from '@libs/platform/config'
import { formatDateOnlyInAppTimeZone } from '@libs/platform/utils'
import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
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
import { resolveImageDimensionsFromFile } from './upload-image-dimension.util'
import { UPLOAD_CONFIG_PROVIDER, UploadProviderEnum } from './upload.type'

const pump = promisify(pipeline)
const DEFAULT_UPLOAD_SCENE = 'shared'
const SCENE_NAME_REGEX = /^[\w-]+$/
const PATH_SEGMENT_REGEX = /^[\w.-]+$/
const LEADING_DOT_REGEX = /^\./
const TRAILING_EXTENSION_REGEX = /\.[^.]+$/
const TRAILING_DIMENSION_SUFFIX_REGEX = /[-_]\d+x\d+$/
const RESERVED_PATH_SEGMENTS = new Set(['.', '..'])

/**
 * 上传服务。
 * 统一处理 multipart 上传、本地文件二次上传以及 provider 选择，保证文件校验与落库口径一致。
 */
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

  // 处理 multipart 上传，并支持单次 scene、文件分类和 provider 策略覆盖。
  async uploadFile(
    data: FastifyRequest,
    pathSegments?: string[],
    options: UploadFileOptions = {},
  ) {
    const targetFile = await data.file()
    if (!targetFile) {
      throw new BadRequestException('上传文件不能为空')
    }
    const scene = this.resolveUploadScene(targetFile.fields.scene, options)

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
    if (!this.isAllowedFileCategory(fileCategory, options)) {
      await this.consumeStream(targetFile.file)
      throw new BadRequestException('不被允许的文件类型')
    }

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
      const storedName = await this.resolveStoredFinalName(
        tempPath,
        ext,
        fileCategory,
      )
      const finalName = storedName.finalName
      const objectKey = this.buildObjectKey(
        scene,
        fileCategory,
        finalName,
        pathSegments,
      )
      const preparedFile = {
        tempPath,
        objectKey,
        finalName,
        originalName: targetFile.filename,
        mimeType: mime,
        ext,
        fileCategory,
        scene,
        fileSize: stats.size,
        width: storedName.width,
        height: storedName.height,
      }

      return await this.uploadPreparedFile(preparedFile, options)
    } catch (error) {
      const responseCarrier =
        typeof error === 'object' && error !== null
          ? (error as UploadResponseCarrier)
          : undefined
      if (responseCarrier && this.hasResponseMessage(responseCarrier)) {
        throw error
      }
      if (
        error instanceof BadRequestException ||
        error instanceof PayloadTooLargeException
      ) {
        throw error
      }
      throw new InternalServerErrorException('上传文件失败')
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
    return (await this.uploadLocalFileWithDeleteTarget(options)).upload
  }

  /**
   * 将本地文件继续走统一上传 provider 流程，并返回后台补偿所需的删除句柄。
   */
  async uploadLocalFileWithDeleteTarget(
    options: UploadLocalFileOptions,
  ): Promise<UploadStoredFileResult> {
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

    const storedName = await this.resolveStoredFinalName(
      options.localPath,
      ext,
      fileCategory,
      options.finalName,
    )
    const finalName = storedName.finalName
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
      width: storedName.width,
      height: storedName.height,
    }

    return this.uploadPreparedFileWithDeleteTarget(preparedFile)
  }

  /**
   * 按 provider 删除已上传文件。
   * 后台任务回滚必须只依赖上传时生成的删除句柄。
   */
  async deleteUploadedFile(target: UploadDeleteTarget) {
    switch (target.provider) {
      case UploadProviderEnum.QINIU:
        return this.qiniuUploadProvider.delete(
          target,
          this.getSystemUploadConfig(),
        )
      case UploadProviderEnum.SUPERBED:
        return this.superbedUploadProvider.delete(
          target,
          this.getSystemUploadConfig(),
        )
      case UploadProviderEnum.LOCAL:
      default:
        return this.deleteLocalFileByObjectKey(target.objectKey)
    }
  }

  /**
   * 读取当前系统上传配置。
   * 当未注入动态配置提供器时回退到本地 provider，避免后台初始化阶段直接失效。
   */
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

  private hasResponseMessage(error: UploadResponseCarrier) {
    if (!error.response) {
      return false
    }
    const { message } = error.response
    return (
      typeof message === 'string' ||
      (Array.isArray(message) &&
        message.some((item) => typeof item === 'string'))
    )
  }

  /** 根据系统配置选择实际上传 provider。 */
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

  /**
   * 解析最终使用的 provider。
   * superbed 对非图片资源可按配置回退到本地存储，避免不支持的资源类型直接失败。
   */
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

  /**
   * 执行统一上传流程并映射为标准响应结构。
   * 所有 provider 成功后都在这里收口返回字段，避免控制器感知底层差异。
   */
  private async uploadPreparedFile(
    preparedFile: PreparedUploadFile,
    options: UploadFileOptions = {},
  ) {
    return (
      await this.uploadPreparedFileWithDeleteTarget(preparedFile, options)
    ).upload
  }

  /**
   * 执行统一上传流程并返回删除句柄。
   * 删除句柄由 provider 在上传成功时一并产出，供后台补偿链直接消费。
   */
  private async uploadPreparedFileWithDeleteTarget(
    preparedFile: PreparedUploadFile,
    options: UploadFileOptions = {},
  ): Promise<UploadStoredFileResult> {
    this.assertFileSizeWithinLimit(preparedFile.fileSize)

    const systemUploadConfig = this.getSystemUploadConfig()
    const defaultProvider = this.resolveProvider(
      systemUploadConfig.provider,
      preparedFile.fileCategory,
      systemUploadConfig.superbedNonImageFallbackToLocal,
    )
    const provider =
      options.resolveProvider?.({
        file: preparedFile,
        systemConfig: systemUploadConfig,
        configuredProvider: systemUploadConfig.provider,
        defaultProvider,
      }) ?? defaultProvider
    const result = await this.uploadByProvider(
      provider,
      preparedFile,
      systemUploadConfig,
    )

    return {
      deleteTarget: result.deleteTarget,
      upload: {
        filename: preparedFile.finalName,
        originalName: preparedFile.originalName,
        filePath: result.filePath,
        fileSize: preparedFile.fileSize,
        mimeType: preparedFile.mimeType,
        fileType: preparedFile.ext,
        fileCategory: preparedFile.fileCategory,
        scene: preparedFile.scene,
        width: preparedFile.width,
        height: preparedFile.height,
        uploadTime: new Date(),
      },
    }
  }

  /**
   * 根据 object key 删除本地文件，缺失文件按幂等成功处理。
   */
  private async deleteLocalFileByObjectKey(objectKey?: string) {
    const normalizedSegments = this.normalizePathSegments(
      (objectKey ?? '').split('/'),
    )
    if (normalizedSegments.length === 0) {
      throw new BadRequestException('本地删除缺少对象 key')
    }

    await fs.rm(join(this.uploadConfig.localDir, ...normalizedSegments), {
      force: true,
    })
  }

  /** 构建最终 objectKey，未显式传路径时按文件分类和日期自动分桶。 */
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

    const dateStr = formatDateOnlyInAppTimeZone(new Date())

    return posix.join(scene, fileCategory, dateStr, finalName)
  }

  /** 规范化并校验上传路径片段，阻止非法路径段和目录穿越。 */
  private normalizePathSegments(pathSegments?: string[]) {
    return (pathSegments ?? [])
      .map((segment) => segment.trim())
      .filter(Boolean)
      .map((segment) => {
        if (
          !PATH_SEGMENT_REGEX.test(segment) ||
          RESERVED_PATH_SEGMENTS.has(segment)
        ) {
          throw new BadRequestException('上传路径不合法')
        }
        return segment
      })
  }

  /** 解析最终文件名；若调用方未指定则自动生成 UUID 文件名。 */
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
      !nameWithoutExt ||
      !PATH_SEGMENT_REGEX.test(nameWithoutExt) ||
      RESERVED_PATH_SEGMENTS.has(nameWithoutExt)
    ) {
      throw new BadRequestException('上传文件名不合法')
    }

    return `${nameWithoutExt}.${ext}`
  }

  /** 为图片文件拼接尺寸后缀；尺寸不可用时保持原始文件名。 */
  private async resolveStoredFinalName(
    tempPath: string,
    ext: string,
    fileCategory: UploadFileCategory,
    finalName?: string,
  ): Promise<StoredUploadNameResult> {
    const normalizedFinalName = this.resolveFinalName(ext, finalName)
    if (fileCategory !== 'image') {
      return { finalName: normalizedFinalName }
    }

    const imageDimensions = await resolveImageDimensionsFromFile(tempPath)
    if (!imageDimensions) {
      return { finalName: normalizedFinalName }
    }

    return {
      finalName: this.appendImageDimensionsToFinalName(
        normalizedFinalName,
        imageDimensions.width,
        imageDimensions.height,
      ),
      width: imageDimensions.width,
      height: imageDimensions.height,
    }
  }

  /** 将图片尺寸规范化为单个后缀，避免重复追加历史尺寸片段。 */
  private appendImageDimensionsToFinalName(
    finalName: string,
    width: number,
    height: number,
  ) {
    const extension = extname(finalName)
    const nameWithoutExt = finalName
      .replace(TRAILING_EXTENSION_REGEX, '')
      .replace(TRAILING_DIMENSION_SUFFIX_REGEX, '')

    return `${nameWithoutExt}-${width}x${height}${extension}`
  }

  /**
   * 解析文件扩展名、MIME 和业务分类。
   * 优先信任探测结果，再回退到原始文件名和请求头信息，避免仅凭客户端声明放行。
   */
  private resolveFileType(
    detectedExt: string | undefined,
    detectedMime: string | undefined,
    originalName: string,
    requestMime?: string,
  ) {
    const filenameExt = extname(originalName)
      .replace(LEADING_DOT_REGEX, '')
      .toLowerCase()
    const ext = this.resolvePreferredExtension(
      detectedExt?.toLowerCase(),
      filenameExt,
    )
    if (!ext) {
      return null
    }

    const fileCategory = this.getFileCategoryFromExt(ext)
    if (!fileCategory) {
      return null
    }

    const requestMimeValue =
      requestMime && requestMime !== 'application/octet-stream'
        ? requestMime.toLowerCase()
        : ''
    const mime =
      UPLOAD_CUSTOM_MIME_BY_EXT[ext] ||
      detectedMime?.toLowerCase() ||
      requestMimeValue ||
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

  /** 根据扩展名查找标准 MIME。 */
  private lookupMimeByExt(ext: string) {
    if (UPLOAD_CUSTOM_MIME_BY_EXT[ext]) {
      return UPLOAD_CUSTOM_MIME_BY_EXT[ext]
    }

    const lookupValue = mime.lookup(ext)
    return lookupValue ? String(lookupValue).toLowerCase() : ''
  }

  /**
   * 对安装包这类 zip 容器优先尊重原始扩展名。
   * 避免 `apk/ipa` 被 file-type 统一识别为 `zip` 后误判成压缩包。
   */
  private resolvePreferredExtension(
    detectedExt: string | undefined,
    filenameExt: string,
  ) {
    if (detectedExt === 'zip' && ['apk', 'ipa'].includes(filenameExt)) {
      return filenameExt
    }

    return detectedExt || filenameExt
  }

  /** 根据扩展名解析仓库内定义的文件分类。 */
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

  /**
   * 从 multipart 字段中提取上传场景。
   * 非法场景会返回 null，由上层统一转换为业务异常。
   */
  private extractScene<T>(sceneField: T) {
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
    return scene ? this.normalizeSceneName(scene) : null
  }

  // 解析单次上传场景；显式覆盖时忽略客户端 multipart scene。
  private resolveUploadScene<T>(
    sceneField: T,
    options: UploadFileOptions,
  ): string | null {
    if (options.sceneOverride !== undefined) {
      return this.normalizeSceneName(options.sceneOverride)
    }

    return this.extractScene(sceneField)
  }

  // 规范化场景名，复用 multipart scene 的同一值域。
  private normalizeSceneName(scene: string) {
    const normalizedScene = scene.trim()
    if (
      !normalizedScene ||
      !SCENE_NAME_REGEX.test(normalizedScene) ||
      normalizedScene.length > 20
    ) {
      return null
    }

    return normalizedScene
  }

  // 判断单次上传策略是否允许当前文件分类。
  private isAllowedFileCategory(
    fileCategory: UploadFileCategory,
    options: UploadFileOptions,
  ) {
    return (
      !options.allowedFileCategories ||
      options.allowedFileCategories.includes(fileCategory)
    )
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

  /** 读取流的首个数据块，供 MIME 探测复用，同时尽量不消费后续正文。 */
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

  /** 将字符串或 Buffer 输入统一转换为 Buffer。 */
  private toBuffer(chunk: string | NodeBuffer) {
    return typeof chunk === 'string' ? NodeBuffer.from(chunk) : chunk
  }

  /** 吞掉剩余流数据，避免提前失败时残留未消费流占用连接。 */
  private async consumeStream(stream: NodeJS.ReadableStream) {
    return new Promise((resolve) => {
      stream.on('end', resolve)
      stream.on('error', resolve)
      stream.resume()
    })
  }
}
