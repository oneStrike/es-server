import type { NotificationSyncAction } from '@libs/message/outbox/outbox.type';
import type { SQL } from 'drizzle-orm'
import { buildILikeCondition, DrizzleService } from '@db/core'
import { MessageNotificationSubjectTypeEnum, MessageNotificationTypeEnum } from '@libs/message/notification/notification.constant';
import { MessageOutboxService } from '@libs/message/outbox/outbox.service';
import { IdDto, UpdatePublishedStatusDto } from '@libs/platform/dto/base.dto';
import { assertValidTimeRange } from '@libs/platform/utils/timeRange'
import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { and, eq, gte, isNull, lte, or, sql } from 'drizzle-orm'
import {
  isAnnouncementPublishedNow,
  shouldAnnouncementEnterNotificationCenter,
} from './announcement.constant'
import {
  CreateAnnouncementDto,
  QueryAnnouncementDto,
  UpdateAnnouncementDto,
} from './dto/announcement.dto'

/**
 * 系统公告服务
 * 负责公告写入、分页查询和重要公告通知 fanout
 */
@Injectable()
export class AppAnnouncementService {
  private readonly logger = new Logger(AppAnnouncementService.name)

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly messageOutboxService: MessageOutboxService,
  ) { }

  /** 数据库连接实例 */
  private get db() {
    return this.drizzle.db
  }

  /** 公告表 */
  private get appAnnouncement() {
    return this.drizzle.schema.appAnnouncement
  }

  /** 页面表 */
  private get appPage() {
    return this.drizzle.schema.appPage
  }

  /** 应用用户表 */
  private get appUser() {
    return this.drizzle.schema.appUser
  }

  /** 用户通知表 */
  private get userNotification() {
    return this.drizzle.schema.userNotification
  }

  /**
   * 创建公告并在写入成功后尝试 fanout 重要公告通知。
   * 写入前会校验发布时间区间和关联页面，通知 sidecar 失败只记录 warning，不回滚主流程。
   */
  async createAnnouncement(createAnnouncementDto: CreateAnnouncementDto) {
    assertValidTimeRange(
      createAnnouncementDto.publishStartTime,
      createAnnouncementDto.publishEndTime,
      '发布开始时间不能大于或等于结束时间',
    )

    const { pageId, ...others } = createAnnouncementDto

    // 校验关联页面是否存在
    if (pageId != null) {
      const page = await this.db.query.appPage.findFirst({
        where: { id: pageId },
        columns: { id: true },
      })
      if (!page) {
        throw new BadRequestException('关联页面不存在')
      }
    }

    const [createdAnnouncement] = await this.drizzle.withErrorHandling(() =>
      this.db.insert(this.appAnnouncement).values({
        ...others,
        pageId: pageId ?? null,
      }).returning({
        id: this.appAnnouncement.id,
      }),
    )

    await this.tryFanoutImportantAnnouncementNotification(createdAnnouncement?.id)
    return true
  }

  /**
   * 根据查询 DTO 构造动态筛选条件并返回分页结果。
   * `enablePlatform` 保持 JSON 字符串入参，兼容 query 参数只能传字符串的入口约束。
   */
  async findAnnouncementPage(
    queryAnnouncementDto: QueryAnnouncementDto,
    options?: {
      publishedOnly?: boolean
    },
  ) {
    const {
      title,
      publishStartTime,
      publishEndTime,
      enablePlatform,
      ...pageParams
    } = queryAnnouncementDto

    const platforms = this.parseEnablePlatforms(enablePlatform)

    const conditions: SQL[] = []
    const isPublished = options?.publishedOnly
      ? true
      : queryAnnouncementDto.isPublished

    if (title) {
      conditions.push(
        buildILikeCondition(this.appAnnouncement.title, title)!,
      )
    }
    if (publishStartTime != null) {
      conditions.push(
        lte(this.appAnnouncement.publishStartTime, publishStartTime),
      )
    }
    if (publishEndTime != null) {
      conditions.push(
        gte(this.appAnnouncement.publishEndTime, publishEndTime),
      )
    }
    if (platforms && platforms.length > 0) {
      const platformArray = sql`ARRAY[${sql.join(
        platforms.map((item) => sql`${item}`),
        sql`, `,
      )}]::integer[]`
      conditions.push(sql`${this.appAnnouncement.enablePlatform} && ${platformArray}`)
    }
    if (queryAnnouncementDto.announcementType !== undefined) {
      conditions.push(
        eq(
          this.appAnnouncement.announcementType,
          queryAnnouncementDto.announcementType,
        ),
      )
    }
    if (queryAnnouncementDto.priorityLevel !== undefined) {
      conditions.push(
        eq(this.appAnnouncement.priorityLevel, queryAnnouncementDto.priorityLevel),
      )
    }
    if (isPublished !== undefined) {
      conditions.push(eq(this.appAnnouncement.isPublished, isPublished))
    }
    if (options?.publishedOnly) {
      const now = new Date()
      conditions.push(or(
        isNull(this.appAnnouncement.publishStartTime),
        lte(this.appAnnouncement.publishStartTime, now),
      )!)
      conditions.push(or(
        isNull(this.appAnnouncement.publishEndTime),
        gte(this.appAnnouncement.publishEndTime, now),
      )!)
    }
    if (queryAnnouncementDto.isPinned !== undefined) {
      conditions.push(eq(this.appAnnouncement.isPinned, queryAnnouncementDto.isPinned))
    }
    if (queryAnnouncementDto.showAsPopup !== undefined) {
      conditions.push(
        eq(this.appAnnouncement.showAsPopup, queryAnnouncementDto.showAsPopup),
      )
    }
    if (queryAnnouncementDto.pageId != null) {
      conditions.push(eq(this.appAnnouncement.pageId, queryAnnouncementDto.pageId))
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined

    return this.drizzle.ext.findPagination(this.appAnnouncement, {
      where,
      ...pageParams,
    })
  }

  /**
   * 按公告 id 更新主体字段，并在成功后重新评估是否需要 fanout 通知。
   * 若请求显式变更 `pageId`，会先校验目标页面是否存在。
   */
  async updateAnnouncement(updateAnnouncementDto: UpdateAnnouncementDto) {
    const { id, pageId, ...updateData } = updateAnnouncementDto

    // 检查公告是否存在
    const announcement = await this.db.query.appAnnouncement.findFirst({
      where: { id },
      columns: {
        id: true,
        pageId: true,
        publishStartTime: true,
        publishEndTime: true,
      },
    })

    if (!announcement) {
      throw new BadRequestException('公告不存在')
    }

    assertValidTimeRange(
      updateData.publishStartTime ?? announcement.publishStartTime,
      updateData.publishEndTime ?? announcement.publishEndTime,
      '发布开始时间不能大于或等于结束时间',
    )

    // 校验关联页面是否存在（仅在 pageId 变更时）
    if (pageId !== undefined && announcement.pageId !== pageId) {
      if (pageId !== null) {
        const page = await this.db.query.appPage.findFirst({
          where: { id: pageId },
          columns: { id: true },
        })
        if (!page) {
          throw new BadRequestException('关联页面不存在')
        }
      }
    }

    const nextUpdateData: Partial<typeof this.appAnnouncement.$inferInsert> = {
      ...updateData,
    }
    if (pageId !== undefined) {
      nextUpdateData.pageId = pageId
    }

    await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.appAnnouncement)
        .set(nextUpdateData)
        .where(eq(this.appAnnouncement.id, id)), { notFound: '公告不存在' },)
    await this.tryFanoutImportantAnnouncementNotification(id)
    return true
  }

  /**
   * 切换公告发布状态，并在成功后重新评估通知 sidecar。
   */
  async updateAnnouncementStatus(dto: UpdatePublishedStatusDto) {
    await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.appAnnouncement)
        .set({ isPublished: dto.isPublished })
        .where(eq(this.appAnnouncement.id, dto.id)), { notFound: '公告不存在' },)
    await this.tryFanoutImportantAnnouncementNotification(dto.id)
    return true
  }

  /**
   * 通过 `isPublished=false` 逻辑下线公告，不执行物理删除。
   */
  async deleteAnnouncement(dto: IdDto) {
    const { id } = dto
    await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.appAnnouncement)
        .set({ isPublished: false })
        .where(eq(this.appAnnouncement.id, id)), { notFound: '公告不存在' },)
    await this.tryFanoutImportantAnnouncementNotification(id)
    return true
  }

  /**
   * 查询公告详情并补齐关联页面快照，未命中时返回 `undefined`。
   */
  async findAnnouncementDetail(dto: IdDto) {
    return this.db.query.appAnnouncement.findFirst({
      where: { id: dto.id },
      with: {
        appPage: {
          columns: {
            id: true,
            code: true,
            name: true,
            path: true,
          },
        },
      },
    })
  }

  /**
   * 以原子自增方式累加浏览量，避免并发读改写覆盖。
   */
  async incrementViewCount(dto: IdDto) {
    await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.appAnnouncement)
        .set({
          viewCount: sql`${this.appAnnouncement.viewCount} + 1`,
        })
        .where(eq(this.appAnnouncement.id, dto.id)), { notFound: '公告不存在' },)
    return true
  }

  /**
   * 尝试将重要公告物化为消息域通知
   *
   * 仅对“重要且当前已发布”的公告执行 fanout，普通公告继续保留在内容域展示。
   */
  private async tryFanoutImportantAnnouncementNotification(announcementId?: number) {
    if (!announcementId) {
      return
    }

    try {
      const announcement = await this.db.query.appAnnouncement.findFirst({
        where: { id: announcementId },
        columns: {
          id: true,
          title: true,
          content: true,
          summary: true,
          announcementType: true,
          priorityLevel: true,
          isPublished: true,
          isPinned: true,
          showAsPopup: true,
          publishStartTime: true,
          publishEndTime: true,
        },
      })
      if (!announcement) {
        return
      }
      const receiverUserIds = await this.collectAnnouncementNotificationReceiverUserIds(
        announcement.id,
      )
      if (receiverUserIds.length === 0) {
        return
      }

      const syncAction: NotificationSyncAction = shouldAnnouncementEnterNotificationCenter(announcement)
        && isAnnouncementPublishedNow(announcement)
        ? 'UPSERT'
        : 'DELETE'
      const notificationContent = this.buildAnnouncementNotificationContent(
        announcement.summary,
        announcement.content,
      )

      await this.messageOutboxService.replaceNotificationEvents(
        receiverUserIds.map((receiverUserId) =>
          this.buildAnnouncementNotificationEvent({
            announcementId: announcement.id,
            receiverUserId,
            title: announcement.title,
            content: notificationContent,
            announcementType: announcement.announcementType,
            priorityLevel: announcement.priorityLevel,
            syncAction,
          }),
        ),
      )
    } catch (error) {
      this.logger.warn(
        `important_announcement_notification_enqueue_failed announcementId=${announcementId} error=${this.stringifyError(error)}`,
      )
    }
  }

  /**
   * 构建公告通知正文
   * 优先使用摘要，缺失时回退正文截断，避免把长公告全文直接塞入通知列表。
   */
  private buildAnnouncementNotificationContent(
    summary?: string | null,
    content?: string | null,
  ) {
    const value = (summary?.trim() || content?.trim() || '你收到一条新的重要公告。')
    return value.slice(0, 180)
  }

  /**
   * 构建公告通知 outbox 事件
   * 重要公告统一物化为 user_notification(type=SYSTEM_ANNOUNCEMENT)。
   */
  private buildAnnouncementNotificationEvent(params: {
    announcementId: number
    receiverUserId: number
    title: string
    content: string
    announcementType: number
    priorityLevel: number
    syncAction: NotificationSyncAction
  }) {
    return {
      eventType: MessageNotificationTypeEnum.SYSTEM_ANNOUNCEMENT,
      bizKey: `announcement:notify:${params.announcementId}:user:${params.receiverUserId}`,
      payload: {
        receiverUserId: params.receiverUserId,
        type: MessageNotificationTypeEnum.SYSTEM_ANNOUNCEMENT,
        targetId: params.announcementId,
        subjectType: MessageNotificationSubjectTypeEnum.SYSTEM,
        subjectId: params.announcementId,
        title: params.title,
        content: params.content,
        payload: {
          title: params.title,
          content: params.content,
          announcementId: params.announcementId,
          announcementType: params.announcementType,
          priorityLevel: params.priorityLevel,
        },
        syncAction: params.syncAction,
      },
    }
  }

  /**
   * 解析公告平台筛选参数。
   * 仅接受数字数组 JSON，避免传入合法 JSON 但结构错误时把坏请求打成 500。
   */
  private parseEnablePlatforms(enablePlatform?: string) {
    if (!enablePlatform || enablePlatform === '[]') {
      return undefined
    }

    let parsedValue: unknown
    try {
      parsedValue = JSON.parse(enablePlatform)
    } catch {
      throw new BadRequestException('启用平台筛选必须是合法 JSON 数组')
    }

    if (!Array.isArray(parsedValue)) {
      throw new BadRequestException('启用平台筛选必须是数字数组')
    }

    const platforms = parsedValue.map((item) => Number(item))
    if (platforms.some((item) => !Number.isInteger(item) || item <= 0)) {
      throw new BadRequestException('启用平台筛选必须是数字数组')
    }

    return platforms.length > 0 ? [...new Set(platforms)] : undefined
  }

  /**
   * 收敛公告通知接收人。
   * 需要同时包含当前活跃用户和历史上已经收到该公告通知的用户，才能在下线时清干净旧通知。
   */
  private async collectAnnouncementNotificationReceiverUserIds(announcementId: number) {
    const [activeUsers, existingReceivers] = await Promise.all([
      this.db
        .select({
          id: this.appUser.id,
        })
        .from(this.appUser)
        .where(
          and(
            eq(this.appUser.isEnabled, true),
            isNull(this.appUser.deletedAt),
          ),
        ),
      this.db.query.userNotification.findMany({
        where: {
          type: MessageNotificationTypeEnum.SYSTEM_ANNOUNCEMENT,
          targetId: announcementId,
        },
        columns: {
          userId: true,
        },
      }),
    ])

    return [...new Set([
      ...existingReceivers.map((item) => item.userId),
      ...activeUsers.map((item) => item.id),
    ])]
  }

  /**
   * 统一序列化公告通知 sidecar 异常
   * 仅用于 warning 日志，避免日志中出现不可读对象。
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
