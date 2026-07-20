import type { UploadConfigInterface } from '@libs/platform/config'
import type { ApiResponseCode } from '@libs/platform/constant'
import type { UploadConfigProvider } from '@libs/platform/modules/upload/upload.type'
import type {
  WsAckPayload,
  WsReadPayload,
  WsRequestEnvelope,
  WsSendPayload,
} from './notification-websocket.type'
import {
  buildSafeDatabaseDiagnostic,
  classifyPostgresError,
  getPostgresErrorResponseDescriptor,
} from '@db/core'
import {
  ApiSuccessCode,
  BusinessErrorCode,
  getPlatformErrorCode,
  PlatformErrorCode,
} from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { UPLOAD_CONFIG_PROVIDER } from '@libs/platform/modules/upload/upload.type'
import { UserService } from '@libs/user/user.service'
import {
  HttpException,
  Inject,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { buildChatMediaOriginPolicy } from '../chat/chat-media-origin-policy'
import { normalizeChatMessageSendInput } from '../chat/chat-message-boundary'
import { MessageChatService } from '../chat/chat.service'
import { MessageWsMonitorService } from '../monitor/ws-monitor.service'

const DIGIT_STRING_REGEX = /^\d+$/
const SAFE_ERROR_NAME_PATTERN = /^[a-z][\w.-]{0,63}$/i

/**
 * 原生 WS 聊天命令服务。
 *
 * 入站协议需要同步调用聊天 owner，因此由显式导入 `MessageChatModule` 的 consumer owner 承担；
 * 它不持有连接状态，也不参与出站 fanout。
 */
@Injectable()
export class MessageChatWsCommandService {
  private readonly logger = new Logger(MessageChatWsCommandService.name)
  private readonly uploadConfig: UploadConfigInterface

  constructor(
    private readonly messageChatService: MessageChatService,
    private readonly configService: ConfigService,
    private readonly messageWsMonitorService: MessageWsMonitorService,
    private readonly userCoreService: UserService,
    @Optional()
    @Inject(UPLOAD_CONFIG_PROVIDER)
    private readonly uploadConfigProvider?: UploadConfigProvider,
  ) {
    this.uploadConfig = this.configService.get<UploadConfigInterface>('upload')!
  }

  /** 处理 `chat.send`，完成鉴权前置校验、边界校验与 ack 映射。 */
  async handleChatSend(
    userId: number | null,
    body: WsRequestEnvelope<WsSendPayload>,
  ): Promise<WsAckPayload> {
    const requestStartAt = Date.now()
    this.recordRequestMetric()

    const requestId = this.normalizeRequestId(body?.requestId)
    if (!requestId) {
      return this.finishAck(
        {
          requestId: null,
          code: PlatformErrorCode.BAD_REQUEST,
          message: 'requestId is required',
        },
        requestStartAt,
      )
    }

    if (!userId) {
      return this.finishAck(
        {
          requestId,
          code: PlatformErrorCode.UNAUTHORIZED,
          message: 'Unauthorized',
        },
        requestStartAt,
      )
    }

    const accessDeniedAck = await this.buildAccessDeniedAck(userId, requestId)
    if (accessDeniedAck) {
      return this.finishAck(accessDeniedAck, requestStartAt)
    }

    const payload = body?.payload
    if (!payload) {
      return this.finishAck(
        {
          requestId,
          code: PlatformErrorCode.BAD_REQUEST,
          message: 'Invalid chat.send payload',
        },
        requestStartAt,
      )
    }

    const normalizedPayload = normalizeChatMessageSendInput(
      payload,
      this.createMediaOriginPolicy(),
    )
    if (!normalizedPayload.ok) {
      return this.finishAck(
        {
          requestId,
          code: PlatformErrorCode.BAD_REQUEST,
          message: 'Invalid chat.send payload',
        },
        requestStartAt,
      )
    }

    try {
      const result = await this.messageChatService.sendMessage(userId, {
        conversationId: normalizedPayload.value.conversationId,
        messageType: normalizedPayload.value.messageType,
        content: normalizedPayload.value.content,
        clientMessageId: normalizedPayload.value.clientMessageId,
        payload: normalizedPayload.value.payload,
      })

      return this.finishAck(
        {
          requestId,
          code: ApiSuccessCode,
          message: 'ok',
          data: {
            ...result,
            clientMessageId: normalizedPayload.value.clientMessageId,
          },
        },
        requestStartAt,
      )
    } catch (error) {
      return this.finishAck(
        {
          requestId,
          ...this.mapErrorToAck(error),
        },
        requestStartAt,
      )
    }
  }

  /** 处理 `chat.read`，完成鉴权前置校验、参数校验与 ack 映射。 */
  async handleChatRead(
    userId: number | null,
    body: WsRequestEnvelope<WsReadPayload>,
  ): Promise<WsAckPayload> {
    const requestStartAt = Date.now()
    this.recordRequestMetric()

    const requestId = this.normalizeRequestId(body?.requestId)
    if (!requestId) {
      return this.finishAck(
        {
          requestId: null,
          code: PlatformErrorCode.BAD_REQUEST,
          message: 'requestId is required',
        },
        requestStartAt,
      )
    }

    if (!userId) {
      return this.finishAck(
        {
          requestId,
          code: PlatformErrorCode.UNAUTHORIZED,
          message: 'Unauthorized',
        },
        requestStartAt,
      )
    }

    const accessDeniedAck = await this.buildAccessDeniedAck(userId, requestId)
    if (accessDeniedAck) {
      return this.finishAck(accessDeniedAck, requestStartAt)
    }

    const payload = body?.payload
    if (
      !payload ||
      !this.isPositiveInteger(payload.conversationId) ||
      typeof payload.messageId !== 'string' ||
      !DIGIT_STRING_REGEX.test(payload.messageId.trim())
    ) {
      return this.finishAck(
        {
          requestId,
          code: PlatformErrorCode.BAD_REQUEST,
          message: 'Invalid chat.read payload',
        },
        requestStartAt,
      )
    }

    try {
      const result = await this.messageChatService.markConversationRead(
        userId,
        {
          conversationId: payload.conversationId,
          messageId: payload.messageId.trim(),
        },
      )

      return this.finishAck(
        {
          requestId,
          code: ApiSuccessCode,
          message: 'ok',
          data: result,
        },
        requestStartAt,
      )
    } catch (error) {
      return this.finishAck(
        {
          requestId,
          ...this.mapErrorToAck(error),
        },
        requestStartAt,
      )
    }
  }

  /** 判断当前 ack 是否要求连接立即关闭。 */
  shouldDisconnectAfterAck(ack: WsAckPayload) {
    return (
      ack.code === PlatformErrorCode.UNAUTHORIZED ||
      ack.code === PlatformErrorCode.FORBIDDEN ||
      ack.code === BusinessErrorCode.OPERATION_NOT_ALLOWED
    )
  }

  // 构造聊天媒体上传来源校验策略，保持 WS 预校验与 service 入口一致。
  private createMediaOriginPolicy() {
    return buildChatMediaOriginPolicy({
      uploadConfig: this.uploadConfig,
      systemUploadConfig: this.uploadConfigProvider?.getUploadConfig(),
    })
  }

  // 构造事件级用户状态拒绝 ack，供 chat.send/read 前置拦截复用。
  private async buildAccessDeniedAck(
    userId: number,
    requestId: string,
  ): Promise<WsAckPayload | null> {
    const accessCheck = await this.userCoreService.getAppUserAccessCheck(userId)
    if (accessCheck.allowed) {
      return null
    }

    if (accessCheck.reason === 'not_found') {
      return {
        requestId,
        code: PlatformErrorCode.UNAUTHORIZED,
        message: 'Unauthorized',
      }
    }

    if (accessCheck.reason === 'disabled') {
      return {
        requestId,
        code: PlatformErrorCode.FORBIDDEN,
        message: accessCheck.message,
      }
    }

    return {
      requestId,
      code: accessCheck.code,
      message: accessCheck.message,
    }
  }

  // 记录 ack 延迟指标并返回最终 ack 载荷。
  private finishAck(payload: WsAckPayload, requestStartAt: number) {
    const latencyMs = Math.max(0, Date.now() - requestStartAt)
    this.recordAckMetric(payload.code, latencyMs)
    return payload
  }

  // 标准化客户端 requestId。 空字符串会被视为缺失，并统一限制最大长度。
  private normalizeRequestId(requestId?: string) {
    if (typeof requestId !== 'string' || !requestId.trim()) {
      return undefined
    }
    return requestId.trim().slice(0, 100)
  }

  // 判断输入值是否为正整数。
  private isPositiveInteger(value: unknown) {
    const normalized = Number(value)
    return Number.isInteger(normalized) && normalized > 0
  }

  // 把领域异常映射为 websocket ack 错误码。
  private mapErrorToAck(error: unknown) {
    if (error instanceof BusinessException) {
      return {
        code: error.code,
        message: error.message,
      }
    }

    if (error instanceof HttpException) {
      const databaseAck = this.mapDatabaseErrorToAck(error)
      if (databaseAck) {
        this.logger.warn('WebSocket request failed with database error', {
          database: buildSafeDatabaseDiagnostic(error),
        })
        return databaseAck
      }

      const message = this.getErrorMessage(error, 'Bad request')
      return {
        code: getPlatformErrorCode(error.getStatus()),
        message,
      }
    }

    const databaseAck = this.mapDatabaseErrorToAck(error)
    if (databaseAck) {
      this.logger.warn('WebSocket request failed with database error', {
        database: buildSafeDatabaseDiagnostic(error),
      })
      return databaseAck
    }

    this.logger.error('WebSocket request failed', {
      error: this.describeError(error),
    })
    return {
      code: PlatformErrorCode.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    }
  }

  // 从 Nest 异常对象中提取用户可读错误信息。
  private getErrorMessage(
    error: { getResponse: () => unknown },
    fallback: string,
  ) {
    const response = error.getResponse()
    if (typeof response === 'string' && response.trim()) {
      return response
    }
    if (
      typeof response === 'object' &&
      response !== null &&
      'message' in response
    ) {
      const { message } = response as { message?: string | string[] | null }
      if (typeof message === 'string' && message.trim()) {
        return message
      }
      if (Array.isArray(message) && message.length) {
        const first = message[0]
        if (typeof first === 'string' && first.trim()) {
          return first
        }
      }
    }
    return fallback
  }

  // 记录 websocket 请求总数指标。
  private recordRequestMetric() {
    void this.messageWsMonitorService.recordRequest().catch((error) => {
      this.logger.warn('Failed to record WS request metric', {
        database: buildSafeDatabaseDiagnostic(error),
      })
    })
  }

  // 记录 websocket ack 结果与延迟指标。
  private recordAckMetric(code: ApiResponseCode, latencyMs: number) {
    void this.messageWsMonitorService
      .recordAck(code, latencyMs)
      .catch((error) => {
        this.logger.warn('Failed to record WS ack metric', {
          database: buildSafeDatabaseDiagnostic(error),
        })
      })
  }

  private mapDatabaseErrorToAck(error: unknown) {
    const facts = classifyPostgresError(error)
    if (!facts) {
      return null
    }

    const descriptor = getPostgresErrorResponseDescriptor(facts.sqlState)
    if (!descriptor) {
      return null
    }

    return {
      code: descriptor.responseCode,
      message: descriptor.message,
    }
  }

  private describeError(error: unknown): { errorName: string } {
    return {
      errorName:
        error instanceof Error && SAFE_ERROR_NAME_PATTERN.test(error.name)
          ? error.name
          : 'UnknownError',
    }
  }
}
