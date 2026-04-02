import type { SQL } from 'drizzle-orm'
import { buildILikeCondition, DrizzleService } from '@db/core'
import {
  MessageNotificationSubjectTypeEnum,
  MessageNotificationTypeEnum,
} from '@libs/message/notification'
import { MessageOutboxService } from '@libs/message/outbox'
import { assertValidTimeRange } from '@libs/platform/utils/timeRange'
import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { and, eq, gte, isNull, lte, sql } from 'drizzle-orm'
import {
  isAnnouncementPublishedNow,
  shouldAnnouncementEnterNotificationCenter,
} from './announcement.constant'
import {
  AnnouncementPageQuery,
  CreateAnnouncementInput,
  DeleteAnnouncementInput,
  UpdateAnnouncementInput,
  UpdateAnnouncementStatusInput,
} from './announcement.type'

/**
 * 系统公告服务
 * 负责公告的创建、查询与更新
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

  /**
   * 创建公告
   * @param createAnnouncementDto 创建数据
   * @returns 是否成功
   */
  async createAnnouncement(createAnnouncementDto: CreateAnnouncementInput) {
    assertValidTimeRange(
      createAnnouncementDto.publishStartTime,
      createAnnouncementDto.publishEndTime,
      '发布开始时间不能大于或等于结束时间',
    )

    const { pageId, ...others } = createAnnouncementDto

    // 校验关联页面是否存在
    if (pageId) {
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
   * 分页查询公告
   * @param queryAnnouncementDto 查询条件
   * @returns 分页结果
   */
  async findAnnouncementPage(
    queryAnnouncementDto: AnnouncementPageQuery,
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

    let platforms: number[] | undefined
    if (enablePlatform && enablePlatform !== '[]') {
      const parsed = JSON.parse(enablePlatform).map((item: string) =>
        Number(item),
      )
      if (parsed.length > 0) {
        platforms = parsed
      }
    }

    const conditions: SQL[] = []
    const isPublished = options?.publishedOnly
      ? true
      : queryAnnouncementDto.isPublished

    if (title) {
      conditions.push(
        buildILikeCondition(this.appAnnouncement.title, title)!,
      )
    }
    if (publishStartTime !== undefined) {
      conditions.push(
        lte(this.appAnnouncement.publishStartTime, publishStartTime),
      )
    }
    if (publishEndTime !== undefined) {
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
    if (queryAnnouncementDto.isPinned !== undefined) {
      conditions.push(eq(this.appAnnouncement.isPinned, queryAnnouncementDto.isPinned))
    }
    if (queryAnnouncementDto.showAsPopup !== undefined) {
      conditions.push(
        eq(this.appAnnouncement.showAsPopup, queryAnnouncementDto.showAsPopup),
      )
    }
    if (queryAnnouncementDto.pageId !== undefined) {
      conditions.push(eq(this.appAnnouncement.pageId, queryAnnouncementDto.pageId))
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined

    return this.drizzle.ext.findPagination(this.appAnnouncement, {
      where,
      ...pageParams,
    })
  }

  /**
   * 更新公告
   * @param updateAnnouncementDto 更新数据
   * @returns 是否成功
   */
  async updateAnnouncement(updateAnnouncementDto: UpdateAnnouncementInput) {
    const { id, pageId, ...updateData } = updateAnnouncementDto

    assertValidTimeRange(
      updateData.publishStartTime,
      updateData.publishEndTime,
      '发布开始时间不能大于或等于结束时间',
    )

    // 检查公告是否存在
    const announcement = await this.db.query.appAnnouncement.findFirst({
      where: { id },
      columns: { id: true, pageId: true },
    })

    if (!announcement) {
      throw new BadRequestException('公告不存在')
    }

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

    const result = await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.appAnnouncement)
        .set({
          ...updateData,
          pageId: pageId ?? null,
        })
        .where(eq(this.appAnnouncement.id, id)),
    )

    this.drizzle.assertAffectedRows(result, '公告不存在')
    await this.tryFanoutImportantAnnouncementNotification(id)
    return true
  }

  /**
   * 更新公告状态
   * @param dto 更新状态数据
   * @returns 是否成功
   */
  async updateAnnouncementStatus(dto: UpdateAnnouncementStatusInput) {
    const result = await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.appAnnouncement)
        .set({ isPublished: dto.isPublished })
        .where(eq(this.appAnnouncement.id, dto.id)),
    )

    this.drizzle.assertAffectedRows(result, '公告不存在')
    await this.tryFanoutImportantAnnouncementNotification(dto.id)
    return true
  }

  /**
   * 下线公告
   * @param dto 删除数据
   * @returns 是否成功
   */
  async deleteAnnouncement(dto: DeleteAnnouncementInput) {
    const { id } = dto
    const result = await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.appAnnouncement)
        .set({ isPublished: false })
        .where(eq(this.appAnnouncement.id, id)),
    )

    this.drizzle.assertAffectedRows(result, '公告不存在')
    await this.tryFanoutImportantAnnouncementNotification(id)
    return true
  }

  /**
   * 获取公告详情
   * @param id 公告ID
   * @returns 公告详情
   */
  async findAnnouncementDetail(id: number) {
    return this.db.query.appAnnouncement.findFirst({
      where: { id },
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
   * 增加浏览量
   * @param id 公告ID
   */
  async incrementViewCount(id: number) {
    const result = await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.appAnnouncement)
        .set({
          viewCount: sql`${this.appAnnouncement.viewCount} + 1`,
        })
        .where(eq(this.appAnnouncement.id, id)),
    )

    this.drizzle.assertAffectedRows(result, '公告不存在')
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
      if (!shouldAnnouncementEnterNotificationCenter(announcement)) {
        return
      }
      if (!isAnnouncementPublishedNow(announcement)) {
        return
      }

      const users = await this.db
        .select({
          id: this.appUser.id,
        })
        .from(this.appUser)
        .where(
          and(
            eq(this.appUser.isEnabled, true),
            isNull(this.appUser.deletedAt),
          ),
        )

      if (users.length === 0) {
        return
      }

      const notificationContent = this.buildAnnouncementNotificationContent(
        announcement.summary,
        announcement.content,
      )

      await this.messageOutboxService.enqueueNotificationEvents(
        users.map((user) =>
          this.buildAnnouncementNotificationEvent({
            announcementId: announcement.id,
            receiverUserId: user.id,
            title: announcement.title,
            content: notificationContent,
            announcementType: announcement.announcementType,
            priorityLevel: announcement.priorityLevel,
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
   * 优先使用摘要，缺失时从正文截取，避免把长公告全文直接塞入通知列表。
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
      },
    }
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
