import type {
  PreparedUploadFile,
  SuperbedNativeTransportError,
  SuperbedPostBody,
  SuperbedPostOptions,
  SuperbedReadResponseOptions,
  UploadDeleteTarget,
  UploadExecutionResult,
  UploadSystemConfig,
} from './upload.type'
import { openAsBlob } from 'node:fs'
import { Injectable, InternalServerErrorException } from '@nestjs/common'
import { UploadProviderEnum } from './upload.type'

@Injectable()
export class SuperbedUploadProvider {
  private readonly uploadUrl = 'https://api.superbed.cn/upload'
  private readonly requestTimeoutMs = 300000
  private readonly maxDiagnosticStringLength = 500
  private readonly maxDiagnosticDepth = 2
  private readonly maxDiagnosticArrayLength = 5
  private readonly maxDiagnosticObjectKeys = 10
  private readonly safeSuperbedResponseKeys = new Set([
    'err',
    'msg',
    'message',
    'code',
    'error',
  ])

  // 上传文件到 Superbed，并在失败时保留安全 provider 诊断。
  async upload(
    file: PreparedUploadFile,
    systemConfig: UploadSystemConfig,
  ): Promise<UploadExecutionResult> {
    const config = systemConfig.superbed
    if (!config.token) {
      throw new InternalServerErrorException('Superbed 上传配置不完整')
    }
    const sensitiveValues = this.buildSensitiveDiagnosticValues(config.token)

    const form = new FormData()
    form.append('token', config.token)
    form.append(
      'file',
      await openAsBlob(file.tempPath, { type: file.mimeType }),
      file.finalName,
    )

    if (config.categories) {
      form.append('categories', config.categories)
    }
    this.appendOptionalBoolean(form, 'watermark', config.watermark)
    this.appendOptionalBoolean(form, 'compress', config.compress)
    this.appendOptionalBoolean(form, 'webp', config.webp)

    const startedAt = Date.now()
    try {
      const data = await this.postJson(this.uploadUrl, form, {
        timeoutMs: this.requestTimeoutMs,
      })

      if (data?.err !== 0 || !data?.url) {
        const message = this.toSafeDiagnosticString(
          data?.msg || 'Superbed 上传失败',
          sensitiveValues,
        )
        throw new InternalServerErrorException(message, {
          cause: this.buildSuperbedResponseCause(
            'upload',
            data,
            sensitiveValues,
            this.buildUploadFailureDiagnostics(file, startedAt),
          ),
        })
      }

      return {
        filePath: data.url,
        deleteTarget: {
          provider: UploadProviderEnum.SUPERBED,
          filePath: data.url,
        },
      }
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error
      }
      throw new InternalServerErrorException('Superbed 上传失败', {
        cause: this.buildFailureCause(
          'upload',
          error,
          sensitiveValues,
          this.buildUploadFailureDiagnostics(file, startedAt),
        ),
      })
    }
  }

  // 删除 Superbed 文件，失败时只保留删除接口的脱敏诊断。
  async delete(target: UploadDeleteTarget, systemConfig: UploadSystemConfig) {
    const config = systemConfig.superbed
    if (!config.token) {
      throw new InternalServerErrorException('Superbed 上传配置不完整')
    }
    const sensitiveValues = this.buildSensitiveDiagnosticValues(config.token)
    if (!target.filePath) {
      throw new InternalServerErrorException('Superbed 删除缺少文件地址')
    }

    try {
      const data = await this.postJson(
        this.uploadUrl.replace('/upload', '/delete'),
        {
          token: config.token,
          urls: [target.filePath],
        },
        {
          timeoutMs: this.requestTimeoutMs,
        },
      )
      if (data?.err !== 0) {
        const message = this.toSafeDiagnosticString(
          data?.msg || 'Superbed 删除失败',
          sensitiveValues,
        )
        throw new InternalServerErrorException(message, {
          cause: this.buildSuperbedResponseCause(
            'delete',
            data,
            sensitiveValues,
          ),
        })
      }
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error
      }
      throw new InternalServerErrorException('Superbed 删除失败', {
        cause: this.buildFailureCause('delete', error, sensitiveValues),
      })
    }
  }

  // 为 Superbed 业务失败响应生成脱敏诊断摘要。
  private buildSuperbedResponseCause(
    operation: 'upload' | 'delete',
    responseData: unknown,
    sensitiveValues: readonly string[],
    extraDiagnostics: Record<string, unknown> = {},
  ) {
    return this.compactDiagnosticObject({
      provider: UploadProviderEnum.SUPERBED,
      operation,
      ...this.buildSafeExtraDiagnostics(extraDiagnostics, sensitiveValues),
      responseData: this.pickSafeSuperbedResponseData(
        responseData,
        sensitiveValues,
      ),
    })
  }

  // 为请求异常生成脱敏诊断摘要，不保留底层请求配置或请求体。
  private buildFailureCause(
    operation: 'upload' | 'delete',
    error: unknown,
    sensitiveValues: readonly string[],
    extraDiagnostics: Record<string, unknown> = {},
  ) {
    const cause: Record<string, unknown> = {
      provider: UploadProviderEnum.SUPERBED,
      operation,
      ...this.buildSafeExtraDiagnostics(extraDiagnostics, sensitiveValues),
    }

    if (this.isNativeTransportError(error)) {
      cause.transportCode = this.toSafeDiagnosticValue(
        error.code,
        sensitiveValues,
      )
      cause.message = this.toSafeDiagnosticValue(error.message, sensitiveValues)
      cause.httpStatus = this.toSafeDiagnosticValue(
        error.httpStatus,
        sensitiveValues,
      )
      cause.statusText = this.toSafeDiagnosticValue(
        error.statusText,
        sensitiveValues,
      )
      cause.responseData = this.pickSafeSuperbedResponseData(
        error.responseData,
        sensitiveValues,
      )
      return this.compactDiagnosticObject(cause)
    }

    if (error instanceof Error) {
      cause.message = this.toSafeDiagnosticValue(error.message, sensitiveValues)
      return this.compactDiagnosticObject(cause)
    }

    cause.message = this.toSafeDiagnosticValue(error, sensitiveValues)
    return this.compactDiagnosticObject(cause)
  }

  // 生成上传失败时可安全落库的文件和耗时诊断。
  private buildUploadFailureDiagnostics(
    file: PreparedUploadFile,
    startedAt: number,
  ) {
    return {
      timeoutMs: this.requestTimeoutMs,
      elapsedMs: Math.max(0, Date.now() - startedAt),
      fileSize: file.fileSize,
      mimeType: file.mimeType,
      finalName: file.finalName,
      originalName: file.originalName,
      fileCategory: file.fileCategory,
      scene: file.scene,
    }
  }

  // 将额外诊断字段纳入同一脱敏管道，避免文件名等元数据绕过过滤。
  private buildSafeExtraDiagnostics(
    extraDiagnostics: Record<string, unknown>,
    sensitiveValues: readonly string[],
  ) {
    const safeDiagnostics = this.toSafeDiagnosticValue(
      extraDiagnostics,
      sensitiveValues,
    )
    return this.isPlainObject(safeDiagnostics) ? safeDiagnostics : {}
  }

  // 只保留 Superbed 响应中稳定且不会携带鉴权上下文的字段。
  private pickSafeSuperbedResponseData(
    responseData: unknown,
    sensitiveValues: readonly string[],
  ) {
    if (!this.isPlainObject(responseData)) {
      return undefined
    }

    const safeData: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(responseData)) {
      if (!this.safeSuperbedResponseKeys.has(key)) {
        continue
      }
      const safeValue = this.toSafeDiagnosticValue(value, sensitiveValues)
      if (safeValue !== undefined) {
        safeData[key] = safeValue
      }
    }

    return Object.keys(safeData).length > 0 ? safeData : undefined
  }

  // 递归转换为可写入 JSON 的短诊断值，并删除敏感键。
  private toSafeDiagnosticValue(
    value: unknown,
    sensitiveValues: readonly string[],
    depth = 0,
  ): unknown {
    if (value === null) {
      return null
    }
    if (typeof value === 'string') {
      return this.toSafeDiagnosticString(value, sensitiveValues)
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return value
    }
    if (value === undefined) {
      return undefined
    }
    if (Array.isArray(value)) {
      if (depth >= this.maxDiagnosticDepth) {
        return '[Array]'
      }
      return value
        .slice(0, this.maxDiagnosticArrayLength)
        .map((item) =>
          this.toSafeDiagnosticValue(item, sensitiveValues, depth + 1),
        )
    }
    if (value instanceof Date) {
      return value.toISOString()
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
        const safeValue = this.toSafeDiagnosticValue(
          nestedValue,
          sensitiveValues,
          depth + 1,
        )
        if (safeValue !== undefined) {
          safeObject[key] = safeValue
        }
      }
      return safeObject
    }

    return this.toSafeDiagnosticString(String(value), sensitiveValues)
  }

  // 收集当前请求中确定不可泄露的字面量凭据。
  private buildSensitiveDiagnosticValues(...values: string[]) {
    return Array.from(new Set(values.map((value) => value.trim()))).filter(
      Boolean,
    )
  }

  // 删除 undefined 和空对象，避免 cause 里出现无效字段。
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

  // 判断对象是否是普通 JSON 对象，避免序列化请求流或复杂实例。
  private isPlainObject(value: unknown): value is Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return false
    }
    const prototype = Object.getPrototypeOf(value)
    return prototype === Object.prototype || prototype === null
  }

  // 判断诊断字段名是否可能携带凭据、请求体或底层请求配置。
  private isSensitiveDiagnosticKey(key: string) {
    return /authorization|cookie|headers|body|form|config|request|password|secret|token/i.test(
      key,
    )
  }

  // 遮蔽诊断字符串中的已知凭据值和常见凭据片段。
  private toSafeDiagnosticString(
    value: string,
    sensitiveValues: readonly string[],
  ) {
    let redacted = value
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

    for (const sensitiveValue of sensitiveValues) {
      redacted = redacted.split(sensitiveValue).join('[REDACTED]')
    }

    return this.truncateDiagnosticString(redacted)
  }

  // 限制诊断字符串长度，避免第三方响应过大。
  private truncateDiagnosticString(value: string) {
    return value.length > this.maxDiagnosticStringLength
      ? `${value.slice(0, this.maxDiagnosticStringLength)}...`
      : value
  }

  // 追加 Superbed 可选图片处理开关。
  private appendOptionalBoolean(form: FormData, name: string, value?: boolean) {
    if (typeof value === 'boolean') {
      form.append(name, String(value))
    }
  }

  // 使用原生 fetch 发送 JSON 或 multipart POST，并统一 HTTP 失败诊断形状。
  private async postJson(
    url: string,
    body: SuperbedPostBody,
    options: SuperbedPostOptions = {},
  ) {
    const isMultipartBody = body instanceof FormData
    const requestBody = isMultipartBody ? body : JSON.stringify(body)
    const headers = isMultipartBody
      ? undefined
      : {
          'content-type': 'application/json',
        }
    const signal =
      options.timeoutMs === undefined
        ? undefined
        : AbortSignal.timeout(options.timeoutMs)

    const response = await fetch(url, {
      body: requestBody,
      headers,
      method: 'POST',
      signal,
    })
    const responseData = await this.readResponseJson(response, {
      allowInvalidJson: !response.ok,
    })
    if (!response.ok) {
      throw Object.assign(new Error(`HTTP ${response.status}`), {
        code: `HTTP_${response.status}`,
        httpStatus: response.status,
        responseData,
        statusText: response.statusText,
      } satisfies Partial<SuperbedNativeTransportError>)
    }
    return responseData
  }

  // 读取第三方 JSON 响应；畸形 JSON 按请求异常进入统一诊断。
  private async readResponseJson(
    response: Response,
    options: SuperbedReadResponseOptions = {},
  ) {
    try {
      return await response.json()
    } catch (error) {
      if (options.allowInvalidJson) {
        return undefined
      }
      throw Object.assign(new Error('Superbed 响应不是合法 JSON'), {
        code: 'INVALID_JSON',
        cause: error,
        httpStatus: response.status,
        statusText: response.statusText,
      } satisfies Partial<SuperbedNativeTransportError>)
    }
  }

  // 识别本 provider 生成的原生传输错误。
  private isNativeTransportError(
    error: unknown,
  ): error is SuperbedNativeTransportError {
    return (
      error instanceof Error &&
      ('code' in error ||
        'httpStatus' in error ||
        'responseData' in error ||
        'statusText' in error)
    )
  }
}
