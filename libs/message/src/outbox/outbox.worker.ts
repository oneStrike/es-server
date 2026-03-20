import type { NotificationOutboxPayload } from './outbox.type'
import { DrizzleService } from '@db/core'
import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { and, asc, eq, isNull, lte, or } from 'drizzle-orm'
import { MessageNotificationService } from '../notification/notification.service'
import {
  MESSAGE_OUTBOX_BATCH_SIZE,
  MESSAGE_OUTBOX_MAX_RETRY,
  MESSAGE_OUTBOX_PROCESSING_TIMEOUT_SECONDS,
  MessageOutboxDomainEnum,
  MessageOutboxStatusEnum,
} from './outbox.constant'

@Injectable()
export class MessageOutboxWorker {
  private readonly logger = new Logger(MessageOutboxWorker.name)

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly messageNotificationService: MessageNotificationService,
  ) {}

  private get db() {
    return this.drizzle.db
  }

  private get outbox() {
    return this.drizzle.schema.messageOutbox
  }

  @Cron('*/5 * * * * *')
  async consumeOutbox() {
    const now = new Date()

    await this.recoverStaleProcessingEvents(now)

    const events = await this.db
      .select()
      .from(this.outbox)
      .where(and(
        eq(this.outbox.status, MessageOutboxStatusEnum.PENDING),
        or(
          isNull(this.outbox.nextRetryAt),
          lte(this.outbox.nextRetryAt, now),
        ),
      ))
      .orderBy(asc(this.outbox.id))
      .limit(MESSAGE_OUTBOX_BATCH_SIZE)

    if (!events.length) {
      return
    }

    for (const event of events) {
      const processingDeadline = this.buildProcessingDeadline()

      const lockResult = await this.db
        .update(this.outbox)
        .set({
          status: MessageOutboxStatusEnum.PROCESSING,
          nextRetryAt: processingDeadline,
        })
        .where(and(
          eq(this.outbox.id, event.id),
          eq(this.outbox.status, MessageOutboxStatusEnum.PENDING),
        ))
        .returning({ id: this.outbox.id })
      if (lockResult.length === 0) {
        continue
      }

      try {
        await this.processEvent(event)
        const updated = await this.db
          .update(this.outbox)
          .set({
            status: MessageOutboxStatusEnum.SUCCESS,
            processedAt: new Date(),
            nextRetryAt: null,
            lastError: null,
          })
          .where(eq(this.outbox.id, event.id))
        this.drizzle.assertAffectedRows(updated, 'Outbox 事件不存在')
      } catch (error) {
        await this.handleProcessError(event, error)
      }
    }
  }

  private async recoverStaleProcessingEvents(now: Date) {
    const recovered = await this.db
      .update(this.outbox)
      .set({
        status: MessageOutboxStatusEnum.PENDING,
        lastError: 'processing timeout recovered',
      })
      .where(and(
        eq(this.outbox.status, MessageOutboxStatusEnum.PROCESSING),
        lte(this.outbox.nextRetryAt, now),
      ))
      .returning({ id: this.outbox.id })

    if (recovered.length > 0) {
      this.logger.warn(
        `Recovered stale processing outbox events: ${recovered.length}`,
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

  private async processEvent(event: typeof this.outbox.$inferSelect) {
    if (event.domain === MessageOutboxDomainEnum.NOTIFICATION) {
      await this.processNotificationEvent(event)
      return
    }
    throw new Error(`Unsupported outbox domain: ${event.domain}`)
  }

  private async processNotificationEvent(event: typeof this.outbox.$inferSelect) {
    if (!event.payload || typeof event.payload !== 'object') {
      throw new Error('Invalid notification payload')
    }
    await this.messageNotificationService.createFromOutbox(
      event.bizKey,
      event.payload as unknown as NotificationOutboxPayload,
    )
  }

  private async handleProcessError(
    event: typeof this.outbox.$inferSelect,
    error: unknown,
  ) {
    const retryCount = event.retryCount + 1
    const message = this.stringifyError(error).slice(0, 500)

    if (retryCount >= MESSAGE_OUTBOX_MAX_RETRY) {
      const updated = await this.db
        .update(this.outbox)
        .set({
          status: MessageOutboxStatusEnum.FAILED,
          retryCount,
          lastError: message,
          processedAt: new Date(),
        })
        .where(eq(this.outbox.id, event.id))
      this.drizzle.assertAffectedRows(updated, 'Outbox 事件不存在')
      this.logger.error(`Outbox event permanently failed: id=${event.id}, error=${message}`)
      return
    }

    const nextRetryAt = new Date()
    const backoffSeconds = Math.min(300, 2 ** retryCount)
    nextRetryAt.setSeconds(nextRetryAt.getSeconds() + backoffSeconds)

    const updated = await this.db
      .update(this.outbox)
      .set({
        status: MessageOutboxStatusEnum.PENDING,
        retryCount,
        nextRetryAt,
        lastError: message,
      })
      .where(eq(this.outbox.id, event.id))
    this.drizzle.assertAffectedRows(updated, 'Outbox 事件不存在')
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
