import type { ThirdPartyComicImageDto } from '@libs/content/work/content/dto/content.dto'
import type { UploadConfigInterface } from '@libs/platform/config'
import type { UploadDeleteTarget } from '@libs/platform/modules/upload/upload.type'
import type { LookupAddress } from 'node:dns'
import type { IncomingMessage, RequestOptions } from 'node:http'
import type { LookupFunction } from 'node:net'
import type {
  DownloadedRemoteImage,
  RemoteImageImportFailureContext,
  RemoteImageImportSuccessHandler,
  SafeRemoteImageUrl,
} from '../third-party-comic-import.type'
import { Buffer } from 'node:buffer'
import { lookup } from 'node:dns/promises'
import { promises as fs } from 'node:fs'
import { request as httpsRequest } from 'node:https'
import { isIP } from 'node:net'
import { basename, extname, join } from 'node:path'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { UploadService } from '@libs/platform/modules/upload/upload.service'
import { ConfigReader } from '@libs/system-config/config-reader'
import { HttpException, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { v4 as uuidv4 } from 'uuid'
import { ThirdPartyResourceThrottleService } from './third-party-resource-throttle.service'

const MAX_REMOTE_IMAGE_BYTES = 10 * 1024 * 1024
const MAX_REMOTE_IMAGE_COUNT = 200
const REMOTE_IMAGE_DOWNLOAD_TIMEOUT_MS = 300000
const COPY_MANGA_IMAGE_HOST_PATTERN = /^[a-z0-9-]+\.mangafunb\.fun$/i

@Injectable()
export class RemoteImageImportService {
  private readonly uploadConfig: UploadConfigInterface
  private readonly maxDiagnosticDepth = 3
  private readonly maxDiagnosticArrayLength = 10
  private readonly maxDiagnosticObjectKeys = 20

  // 注入统一上传服务，远程图片落地后仍复用现有上传策略。
  constructor(
    private readonly uploadService: UploadService,
    private readonly configReader: ConfigReader,
    private readonly configService: ConfigService,
    private readonly throttle: ThirdPartyResourceThrottleService,
  ) {
    this.uploadConfig = this.configService.get<UploadConfigInterface>('upload')!
  }

  // 下载并上传单张第三方图片，失败时保持业务异常语义。
  async importImage(url: string, objectKeySegments: string[]) {
    const downloadedFile = await this.downloadToTemp(url)
    try {
      return await this.uploadService.uploadLocalFileWithDeleteTarget({
        localPath: downloadedFile.localPath,
        objectKeySegments,
        originalName: this.resolveOriginalName(url),
      })
    } finally {
      await fs
        .rm(downloadedFile.tempDir, { force: true, recursive: true })
        .catch(() => undefined)
    }
  }

  // 按三方顺序批量导入图片，并限制单次导入规模。
  async importImages(
    images: ThirdPartyComicImageDto[],
    objectKeySegments: string[],
    onImported?: RemoteImageImportSuccessHandler,
  ) {
    if (images.length > MAX_REMOTE_IMAGE_COUNT) {
      throw this.remoteImageError('远程图片数量超过限制')
    }

    const filePaths: string[] = []
    for (const [index, image] of images.entries()) {
      const imageIndex = index + 1
      const safeSourceUrl = this.toSafeSourceUrl(image.url)
      try {
        const importedFile = await this.importImage(
          image.url,
          objectKeySegments,
        )
        filePaths.push(importedFile.upload.filePath)
        await onImported?.({
          image,
          imageIndex,
          imageTotal: images.length,
          safeSourceUrl,
          filePath: importedFile.upload.filePath,
          deleteTarget: importedFile.deleteTarget,
          fileSize: importedFile.upload.fileSize,
          mimeType: importedFile.upload.mimeType,
        })
      } catch (error) {
        throw this.withImageFailureContext(
          error,
          this.buildRemoteImageFailureContext(
            image,
            imageIndex,
            images.length,
            safeSourceUrl,
          ),
        )
      }
    }
    return filePaths
  }

  // 删除导入时上传的图片。
  async deleteImportedFile(target: UploadDeleteTarget) {
    return this.uploadService.deleteUploadedFile(target)
  }

  // 将远程图片下载到临时文件，默认固定已校验 DNS 结果。
  private async downloadToTemp(url: string) {
    const safeRemote = await this.assertSafeUrl(url)
    await this.throttle.waitForImageSlot()
    const response = await this.downloadRemoteImage(safeRemote)

    const contentType = response.contentType
    if (!contentType.toLowerCase().startsWith('image/')) {
      throw this.remoteImageError('远程资源不是图片')
    }

    const buffer = response.buffer
    if (buffer.length > MAX_REMOTE_IMAGE_BYTES) {
      throw this.remoteImageError('远程图片大小超过限制')
    }

    await fs.mkdir(this.uploadConfig.tmpDir, { recursive: true })
    const tempDir = await fs.mkdtemp(
      join(this.uploadConfig.tmpDir, 'third-party-comic-'),
    )
    try {
      const fileName = `${uuidv4()}${this.resolveExtension(safeRemote.url, contentType)}`
      const localPath = join(tempDir, fileName)
      await fs.writeFile(localPath, buffer)
      return {
        tempDir,
        localPath,
      }
    } catch (error) {
      await fs
        .rm(tempDir, { force: true, recursive: true })
        .catch(() => undefined)
      throw error
    }
  }

  // 校验 URL、域名和 DNS 结果；系统安全配置关闭地址防护时只保留基础 URL 约束。
  private async assertSafeUrl(url: string): Promise<SafeRemoteImageUrl> {
    let parsedUrl: URL
    try {
      parsedUrl = new URL(url)
    } catch {
      throw this.remoteImageError('远程图片地址不合法')
    }

    if (parsedUrl.protocol !== 'https:') {
      throw this.remoteImageError('远程图片必须使用 HTTPS')
    }
    if (!COPY_MANGA_IMAGE_HOST_PATTERN.test(parsedUrl.hostname)) {
      throw this.remoteImageError('远程图片域名不在允许范围内')
    }

    if (!this.isAddressGuardEnabled()) {
      return {
        url: parsedUrl,
      }
    }

    const addresses = await lookup(parsedUrl.hostname, { all: true })
    if (
      addresses.length === 0 ||
      addresses.some((address) => this.isUnsafeAddress(address.address))
    ) {
      throw this.remoteImageError('远程图片解析到不安全地址')
    }

    return {
      url: parsedUrl,
      address: addresses[0],
    }
  }

  // 读取系统安全配置，决定是否启用 DNS 内网地址防护。
  private isAddressGuardEnabled() {
    return this.configReader.getRemoteImageImportSecurityConfig()
      .enableAddressGuard
  }

  // 下载远程图片并在原生请求层保持无重定向、超时、大小限制和 DNS pinning。
  private async downloadRemoteImage(
    safeRemote: SafeRemoteImageUrl,
  ): Promise<DownloadedRemoteImage> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = []
      let totalBytes = 0
      const requestOptions: RequestOptions = {
        headers: {
          accept: 'image/*',
        },
        method: 'GET',
      }
      if (safeRemote.address) {
        requestOptions.lookup = this.createPinnedLookup(
          safeRemote.url.hostname,
          safeRemote.address,
        )
      }
      const request = httpsRequest(
        safeRemote.url,
        requestOptions,
        (response) => {
          if (!this.isSuccessfulImageResponse(response)) {
            response.resume()
            reject(this.remoteImageError('远程图片下载失败'))
            return
          }

          response.on('data', (chunk: Buffer) => {
            totalBytes += chunk.length
            if (totalBytes > MAX_REMOTE_IMAGE_BYTES) {
              request.destroy(this.remoteImageError('远程图片大小超过限制'))
              return
            }
            chunks.push(chunk)
          })
          response.on('end', () => {
            resolve({
              buffer: Buffer.concat(chunks),
              contentType: String(response.headers['content-type'] || ''),
            })
          })
          response.on('error', (error) => {
            reject(this.wrapRemoteImageDownloadError(error))
          })
        },
      )

      request.setTimeout(REMOTE_IMAGE_DOWNLOAD_TIMEOUT_MS, () => {
        request.destroy(
          new Error(
            `timeout of ${REMOTE_IMAGE_DOWNLOAD_TIMEOUT_MS}ms exceeded`,
          ),
        )
      })
      request.on('error', (error) => {
        reject(this.wrapRemoteImageDownloadError(error))
      })
      request.end()
    })
  }

  // 将底层下载错误收敛为业务异常，避免原生 Error 绕过业务错误语义。
  private wrapRemoteImageDownloadError(error: unknown) {
    if (error instanceof BusinessException) {
      return error
    }

    return this.remoteImageError('远程图片下载失败', {
      transportError: this.toSafeDiagnosticValue(error),
    })
  }

  // 只接受 2xx 响应，原生请求不会自动跟随重定向。
  private isSuccessfulImageResponse(response: IncomingMessage) {
    const statusCode = response.statusCode ?? 0
    return statusCode >= 200 && statusCode < 300
  }

  // 为原生请求固定已验证地址，避免校验后再次进行不受控 DNS 解析。
  private createPinnedLookup(
    expectedHostname: string,
    address: LookupAddress,
  ): LookupFunction {
    return (hostname, options, callback) => {
      if (hostname !== expectedHostname) {
        callback(
          Object.assign(new Error('远程图片请求域名与校验域名不一致'), {
            code: 'ERR_REMOTE_IMAGE_HOST_CHANGED',
          }),
          '',
          0,
        )
        return
      }

      if (options.all) {
        callback(null, [address])
        return
      }

      callback(null, address.address, address.family)
    }
  }

  // 判断 DNS 地址是否落入内网、环回、链路本地、多播或保留地址段。
  private isUnsafeAddress(address: string) {
    switch (isIP(address)) {
      case 4:
        return this.isUnsafeIpv4Address(address)
      case 6:
        return this.isUnsafeIpv6Address(address)
      default:
        return true
    }
  }

  // 判断 IPv4 地址是否属于不允许服务端访问的地址段。
  private isUnsafeIpv4Address(address: string) {
    const parts = address.split('.').map((part) => Number(part))
    if (
      parts.length !== 4 ||
      parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
    ) {
      return true
    }

    const [a, b, c] = parts
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0 && c === 0) ||
      (a === 192 && b === 0 && c === 2) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 198 && b === 51 && c === 100) ||
      (a === 203 && b === 0 && c === 113) ||
      a >= 224
    )
  }

  // 判断 IPv6 地址是否属于不允许服务端访问的地址段。
  private isUnsafeIpv6Address(address: string) {
    const normalizedAddress = address.toLowerCase()
    const mappedIpv4 = normalizedAddress.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
    if (mappedIpv4) {
      return this.isUnsafeIpv4Address(mappedIpv4[1])
    }

    return (
      normalizedAddress === '::' ||
      normalizedAddress === '::1' ||
      normalizedAddress.startsWith('fe8') ||
      normalizedAddress.startsWith('fe9') ||
      normalizedAddress.startsWith('fea') ||
      normalizedAddress.startsWith('feb') ||
      normalizedAddress.startsWith('fc') ||
      normalizedAddress.startsWith('fd') ||
      normalizedAddress.startsWith('ff') ||
      normalizedAddress.startsWith('2001:db8')
    )
  }

  // 从原始 URL 中提取上传展示用文件名。
  private resolveOriginalName(url: string) {
    const parsedUrl = new URL(url)
    const name = basename(parsedUrl.pathname)
    return name || 'remote-image'
  }

  // 优先沿用路径扩展名，缺省时根据响应 MIME 推导图片扩展名。
  private resolveExtension(url: URL, contentType: string) {
    const pathExtension = extname(url.pathname)
    if (pathExtension) {
      return pathExtension
    }
    if (contentType.includes('png')) {
      return '.png'
    }
    if (contentType.includes('webp')) {
      return '.webp'
    }
    return '.jpg'
  }

  // 统一远程图片导入失败的业务异常码。
  private remoteImageError(message: string, cause?: Record<string, unknown>) {
    if (cause === undefined) {
      return new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        message,
      )
    }

    return new BusinessException(
      BusinessErrorCode.OPERATION_NOT_ALLOWED,
      message,
      {
        cause,
      },
    )
  }

  // 构建单张远程图片失败上下文，避免把 query token 写入任务错误。
  private buildRemoteImageFailureContext(
    image: ThirdPartyComicImageDto,
    imageIndex: number,
    imageTotal: number,
    safeSourceUrl: string,
  ): RemoteImageImportFailureContext {
    return {
      stage: 'remote-image-import',
      safeSourceUrl,
      providerImageId: image.providerImageId,
      imageIndex,
      imageTotal,
    }
  }

  // 包装单张图片失败，保留原始业务码或 HTTP status。
  private withImageFailureContext(
    error: unknown,
    context: RemoteImageImportFailureContext,
  ) {
    const failureContext = this.attachOriginalErrorContext(error, context)
    if (error instanceof BusinessException) {
      return new BusinessException(error.code, error.message, {
        cause: failureContext,
      })
    }
    if (error instanceof HttpException) {
      return new HttpException(error.getResponse(), error.getStatus(), {
        cause: failureContext,
      })
    }
    if (error instanceof Error) {
      const wrappedError = new Error(error.message, { cause: failureContext })
      wrappedError.name = error.name
      return wrappedError
    }
    return new Error(this.stringifyUnknownError(error), {
      cause: failureContext,
    })
  }

  // 把原始错误的安全摘要挂到图片上下文中，供后台任务错误序列化。
  private attachOriginalErrorContext(
    error: unknown,
    context: RemoteImageImportFailureContext,
  ): RemoteImageImportFailureContext {
    if (error instanceof BusinessException) {
      return {
        ...context,
        originalName: error.name,
        originalMessage: this.toSafeDiagnosticString(error.message),
        originalCode: error.code,
      }
    }
    if (error instanceof HttpException) {
      return this.compactDiagnosticObject({
        ...context,
        originalName: error.name,
        originalMessage: this.toSafeDiagnosticString(error.message),
        originalCode: error.getStatus(),
        originalCause: this.toSafeDiagnosticValue(error.cause),
      }) as RemoteImageImportFailureContext
    }
    if (error instanceof Error) {
      return {
        ...context,
        originalName: error.name,
        originalMessage: this.toSafeDiagnosticString(error.message),
      }
    }
    return {
      ...context,
      originalMessage: this.toSafeDiagnosticString(
        this.stringifyUnknownError(error),
      ),
    }
  }

  // 输出不带 query/hash 的图片 URL，保留定位所需的来源路径。
  private toSafeSourceUrl(url: string) {
    try {
      const parsedUrl = new URL(url)
      parsedUrl.username = ''
      parsedUrl.password = ''
      parsedUrl.search = ''
      parsedUrl.hash = ''
      return parsedUrl.toString()
    } catch {
      return '[invalid-url]'
    }
  }

  // 将非 Error 异常收敛为短文本，避免丢失诊断入口。
  private stringifyUnknownError(error: unknown) {
    if (typeof error === 'string') {
      return error
    }
    try {
      return JSON.stringify(error)
    } catch {
      return 'unknown error'
    }
  }

  // 递归收敛第三方异常 cause，只保留可落库的脱敏诊断。
  private toSafeDiagnosticValue(value: unknown, depth = 0): unknown {
    if (value === undefined) {
      return undefined
    }
    if (value === null) {
      return null
    }
    if (typeof value === 'string') {
      return this.toSafeDiagnosticString(value)
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return value
    }
    if (typeof value === 'bigint') {
      return value.toString()
    }
    if (Array.isArray(value)) {
      if (depth >= this.maxDiagnosticDepth) {
        return '[Array]'
      }
      return value
        .slice(0, this.maxDiagnosticArrayLength)
        .map((item) => this.toSafeDiagnosticValue(item, depth + 1))
    }
    if (value instanceof Date) {
      return value.toISOString()
    }
    if (value instanceof Error) {
      const nestedCause =
        depth >= this.maxDiagnosticDepth
          ? undefined
          : this.toSafeDiagnosticValue(value.cause, depth + 1)
      return this.compactDiagnosticObject({
        name: value.name,
        message: this.toSafeDiagnosticString(value.message),
        cause: nestedCause,
      })
    }
    if (this.isPlainObject(value)) {
      if (depth >= this.maxDiagnosticDepth) {
        return '[Object]'
      }

      const safeObject: Record<string, unknown> = {}
      for (const [key, nestedValue] of Object.entries(value).slice(
        0,
        this.maxDiagnosticObjectKeys,
      )) {
        if (this.isSensitiveDiagnosticKey(key)) {
          continue
        }
        const safeValue = this.toSafeDiagnosticValue(nestedValue, depth + 1)
        if (safeValue !== undefined) {
          safeObject[key] = safeValue
        }
      }
      return this.compactDiagnosticObject(safeObject)
    }

    return this.toSafeDiagnosticString(String(value))
  }

  // 删除 undefined 和空对象，避免失败上下文出现无效诊断字段。
  private compactDiagnosticObject(value: Record<string, unknown>) {
    const compacted: Record<string, unknown> = {}
    for (const [key, nestedValue] of Object.entries(value)) {
      if (nestedValue === undefined) {
        continue
      }
      if (
        this.isPlainObject(nestedValue) &&
        Object.keys(nestedValue).length === 0
      ) {
        continue
      }
      compacted[key] = nestedValue
    }
    return compacted
  }

  // 判断对象是否是普通 JSON 对象，避免把请求流或复杂实例写入任务错误。
  private isPlainObject(value: unknown): value is Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return false
    }
    const prototype = Object.getPrototypeOf(value)
    return prototype === Object.prototype || prototype === null
  }

  // 跳过可能携带凭据、请求体或底层请求配置的诊断字段。
  private isSensitiveDiagnosticKey(key: string) {
    return /authorization|cookie|headers|body|form|config|request|password|secret|token/i.test(
      key,
    )
  }

  // 遮蔽错误摘要中的常见凭据片段，避免 progress/detail 或任务错误泄露。
  private toSafeDiagnosticString(value: string) {
    return value
      .replace(
        /"(?:token|authorization|cookie|password|secret)"[ \t]{0,20}:[ \t]{0,20}"[^"]*"/gi,
        '"[REDACTED]"',
      )
      .replace(
        /(?:token|authorization|cookie|password|secret)[ \t]{0,20}=[ \t]{0,20}[^"',\s;}]+/gi,
        '[REDACTED]',
      )
      .replace(
        /(?:token|authorization|cookie|password|secret)[ \t]{0,20}:[ \t]{0,20}[^"',\s;}]+/gi,
        '[REDACTED]',
      )
      .replace(/\bBearer\s+[^,\s;}]+/gi, 'Bearer [REDACTED]')
  }
}
