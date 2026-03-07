import type { MessageOutbox } from '@libs/base/database'
import type { NotificationOutboxPayload } from './dto/outbox-event.dto'
import { BaseService } from '@libs/base/database'
import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { MessageNotificationService } from '../notification/notification.service'
import {
  MESSAGE_OUTBOX_BATCH_SIZE,
  MESSAGE_OUTBOX_MAX_RETRY,
  MessageOutboxDomainEnum,
  MessageOutboxStatusEnum,
} from './outbox.constant'

/**
 * 消息发件箱工作器
 * 定时消费发件箱中的待处理事件，实现消息的可靠投递
 */
@Injectable()
export class MessageOutboxWorker extends BaseService {
  private readonly logger = new Logger(MessageOutboxWorker.name)

  constructor(
    private readonly messageNotificationService: MessageNotificationService,
  ) {
    super()
  }

  /**
   * 消费发件箱事件
   * 每5秒执行一次，批量处理待处理的事件
   */
  @Cron('*/5 * * * * *')
  async consumeOutbox() {
    const now = new Date()
    const events = await this.prisma.messageOutbox.findMany({
      where: {
        status: MessageOutboxStatusEnum.PENDING,
        OR: [
          { nextRetryAt: null },
          { nextRetryAt: { lte: now } },
        ],
      },
      orderBy: { id: 'asc' },
      take: MESSAGE_OUTBOX_BATCH_SIZE,
    })
    if (!events.length) {
      return
    }

    for (const event of events) {
      const lockResult = await this.prisma.messageOutbox.updateMany({
        where: {
          id: event.id,
          status: MessageOutboxStatusEnum.PENDING,
        },
        data: {
          status: MessageOutboxStatusEnum.PROCESSING,
        },
      })
      if (!lockResult.count) {
        continue
      }

      try {
        await this.processEvent(event)
        await this.prisma.messageOutbox.update({
          where: { id: event.id },
          data: {
            status: MessageOutboxStatusEnum.SUCCESS,
            processedAt: new Date(),
            lastError: null,
          },
        })
      } catch (error) {
        await this.handleProcessError(event, error)
      }
    }
  }

  /**
   * 处理单个发件箱事件
   * @param event 发件箱事件
   */
  private async processEvent(event: MessageOutbox) {
    if (event.domain === MessageOutboxDomainEnum.NOTIFICATION) {
      await this.processNotificationEvent(event)
      return
    }
    throw new Error(`unsupported outbox domain: ${event.domain}`)
  }

  /**
   * 处理通知类型的事件
   * @param event 发件箱事件
   */
  private async processNotificationEvent(event: MessageOutbox) {
    if (!event.payload || typeof event.payload !== 'object') {
      throw new Error('invalid notification payload')
    }
    await this.messageNotificationService.createFromOutbox(
      event.bizKey,
      event.payload as unknown as NotificationOutboxPayload,
    )
  }

  /**
   * 处理事件处理过程中的错误
   * @param event 发件箱事件
   * @param error 错误信息
   */
  private async handleProcessError(event: MessageOutbox, error: unknown) {
    const retryCount = event.retryCount + 1
    const message = this.stringifyError(error).slice(0, 500)

    if (retryCount >= MESSAGE_OUTBOX_MAX_RETRY) {
      await this.prisma.messageOutbox.update({
        where: { id: event.id },
        data: {
          status: MessageOutboxStatusEnum.FAILED,
          retryCount,
          lastError: message,
        },
      })
      this.logger.error(`outbox event failed permanently: id=${event.id}, err=${message}`)
      return
    }

    const nextRetryAt = new Date()
    const backoffSeconds = Math.min(300, 2 ** retryCount)
    nextRetryAt.setSeconds(nextRetryAt.getSeconds() + backoffSeconds)

    await this.prisma.messageOutbox.update({
      where: { id: event.id },
      data: {
        status: MessageOutboxStatusEnum.PENDING,
        retryCount,
        nextRetryAt,
        lastError: message,
      },
    })
    this.logger.warn(
      `outbox event retry scheduled: id=${event.id}, retry=${retryCount}, err=${message}`,
    )
  }

  /**
   * 将错误对象转换为字符串
   * @param error 错误对象
   * @returns 错误字符串
   */
  private stringifyError(error: unknown) {
    if (error instanceof Error) {
      return error.message
    }
    if (typeof error === 'string') {
      return error
    }
    try {
      return JSON.stringify(error)
    } catch {
      return 'unknown error'
    }
  }
}
