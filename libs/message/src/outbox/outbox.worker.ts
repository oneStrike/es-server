import type { MessageOutbox } from '@libs/base/database'
import type { NotificationOutboxPayload } from './dto/outbox-event.dto'
import { BaseService } from '@libs/base/database'
import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { MessageNotificationService } from '../notification/notification.service'
import {
  MESSAGE_OUTBOX_BATCH_SIZE,
  MESSAGE_OUTBOX_MAX_RETRY,
  MESSAGE_OUTBOX_PROCESSING_TIMEOUT_SECONDS,
  MessageOutboxDomainEnum,
  MessageOutboxStatusEnum,
} from './outbox.constant'

@Injectable()
export class MessageOutboxWorker extends BaseService {
  private readonly logger = new Logger(MessageOutboxWorker.name)

  constructor(
    private readonly messageNotificationService: MessageNotificationService,
  ) {
    super()
  }

  @Cron('*/5 * * * * *')
  async consumeOutbox() {
    const now = new Date()

    await this.recoverStaleProcessingEvents(now)

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
      const processingDeadline = this.buildProcessingDeadline()

      const lockResult = await this.prisma.messageOutbox.updateMany({
        where: {
          id: event.id,
          status: MessageOutboxStatusEnum.PENDING,
        },
        data: {
          status: MessageOutboxStatusEnum.PROCESSING,
          nextRetryAt: processingDeadline,
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
            nextRetryAt: null,
            lastError: null,
          },
        })
      } catch (error) {
        await this.handleProcessError(event, error)
      }
    }
  }

  private async recoverStaleProcessingEvents(now: Date) {
    const recovered = await this.prisma.messageOutbox.updateMany({
      where: {
        status: MessageOutboxStatusEnum.PROCESSING,
        nextRetryAt: { lte: now },
      },
      data: {
        status: MessageOutboxStatusEnum.PENDING,
        lastError: 'processing timeout recovered',
      },
    })

    if (recovered.count > 0) {
      this.logger.warn(
        `Recovered stale processing outbox events: ${recovered.count}`,
      )
    }
  }

  private buildProcessingDeadline() {
    const deadline = new Date()
    deadline.setSeconds(
      deadline.getSeconds() + MESSAGE_OUTBOX_PROCESSING_TIMEOUT_SECONDS,
    )
    return deadline
  }

  private async processEvent(event: MessageOutbox) {
    if (event.domain === MessageOutboxDomainEnum.NOTIFICATION) {
      await this.processNotificationEvent(event)
      return
    }
    throw new Error(`Unsupported outbox domain: ${event.domain}`)
  }

  private async processNotificationEvent(event: MessageOutbox) {
    if (!event.payload || typeof event.payload !== 'object') {
      throw new Error('Invalid notification payload')
    }
    await this.messageNotificationService.createFromOutbox(
      event.bizKey,
      event.payload as unknown as NotificationOutboxPayload,
    )
  }

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
          processedAt: new Date(),
        },
      })
      this.logger.error(`Outbox event permanently failed: id=${event.id}, error=${message}`)
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
      `Outbox retry scheduled: id=${event.id}, retry=${retryCount}, error=${message}`,
    )
  }

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
