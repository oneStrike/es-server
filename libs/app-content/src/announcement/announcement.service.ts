import type { AppAnnouncementSelect } from '@db/schema'
import type { JsonValue } from '@libs/platform/utils'
import type { SQL } from 'drizzle-orm'
import type { AnnouncementFanoutPort } from './announcement-fanout.port'
import { buildILikeCondition, DrizzleService, toPageResult } from '@db/core'
import { BusinessErrorCode, EnablePlatformEnum } from '@libs/platform/constant'
import { IdDto, UpdatePublishedStatusDto } from '@libs/platform/dto/base.dto'
import { BusinessException } from '@libs/platform/exceptions'
import { assertValidTimeRange } from '@libs/platform/utils'
import { BadRequestException, Inject, Injectable, Optional } from '@nestjs/common'
import {
  and,
  arrayOverlaps,
  desc,
  eq,
  getColumns,
  gt,
  gte,
  isNull,
  lte,
  or,
  sql,
} from 'drizzle-orm'
import { ANNOUNCEMENT_FANOUT_PORT } from './announcement-fanout.port'
import {
  AnnouncementFanoutStatusEnum,
  AnnouncementPublishStatusEnum,
  PopupBackgroundPositionEnum,
  resolveAnnouncementPublishStatus,
} from './announcement.constant'
import {
  AppAnnouncementListItemDto,
  AnnouncementOutputBaseDto,
  CreateAnnouncementDto,
  QueryAnnouncementDto,
  QueryPublicAnnouncementCursorDto,
  UpdateAnnouncementDto,
} from './dto/announcement.dto'

const ENABLE_PLATFORM_VALUES = new Set<number>(
  Object.values(EnablePlatformEnum).filter(
    (value): value is number => typeof value === 'number',
  ),
)
const DEFAULT_ENABLE_PLATFORM = [
  EnablePlatformEnum.H5,
  EnablePlatformEnum.APP,
  EnablePlatformEnum.MINI_PROGRAM,
]

interface AnnouncementFanoutRuntimeFields {
  fanoutDesiredEventKey: string | null
  fanoutLastError: string | null
  fanoutStatus: AnnouncementFanoutStatusEnum | null
  fanoutUpdatedAt: Date | null
}
type AnnouncementInternalRuntimeColumn =
  | 'notificationEndBoundaryAt'
  | 'notificationFanoutDesiredEventKey'
  | 'notificationFanoutLastError'
  | 'notificationFanoutStatus'
  | 'notificationFanoutTaskId'
  | 'notificationFanoutUpdatedAt'
  | 'notificationStartBoundaryAt'
type AnnouncementResponseRow = Omit<
  AppAnnouncementSelect,
  AnnouncementInternalRuntimeColumn
> &
AnnouncementFanoutRuntimeFields
type AnnouncementOutputFieldSource = Pick<
  AppAnnouncementSelect,
  | 'enablePlatform'
  | 'pageId'
  | 'popupBackgroundImage'
  | 'popupBackgroundPosition'
  | 'publishEndTime'
  | 'publishStartTime'
  | 'summary'
>

/**
 * 系统公告服务
 * 负责公告写入、分页查询和系统公告通知 fanout
 */
@Injectable()
export class AppAnnouncementService {
  constructor(
    private readonly drizzle: DrizzleService,
    @Optional()
    @Inject(ANNOUNCEMENT_FANOUT_PORT)
    private readonly announcementFanout?: AnnouncementFanoutPort,
  ) {}

  /** 数据库连接实例 */
  private get db() {
    return this.drizzle.db
  }

  /** 公告表 */
  private get appAnnouncement() {
    return this.drizzle.schema.appAnnouncement
  }

  /** 公告阅读表 */
  private get appAnnouncementRead() {
    return this.drizzle.schema.appAnnouncementRead
  }

  /** 公告浏览表 */
  private get appAnnouncementView() {
    return this.drizzle.schema.appAnnouncementView
  }

  /** 页面表 */
  private get appPage() {
    return this.drizzle.schema.appPage
  }

  /**
   * 创建公告并在写入成功后入队公告通知 fanout 任务。
   * 写入前会校验发布时间区间和关联页面，通知 fanout 改由后台任务执行。
   */
  async createAnnouncement(createAnnouncementDto: CreateAnnouncementDto) {
    assertValidTimeRange(
      createAnnouncementDto.publishStartTime,
      createAnnouncementDto.publishEndTime,
      '发布开始时间不能大于或等于结束时间',
    )
    this.assertValidPopupConfig(createAnnouncementDto)

    const { enablePlatform, pageId, ...others } = createAnnouncementDto
    const normalizedEnablePlatform =
      this.normalizeAnnouncementEnablePlatform(enablePlatform)

    // 校验关联页面是否存在
    if (pageId != null) {
      const page = await this.db.query.appPage.findFirst({
        where: { id: pageId },
        columns: { id: true },
      })
      if (!page) {
        throw new BusinessException(
          BusinessErrorCode.RESOURCE_NOT_FOUND,
          '关联页面不存在',
        )
      }
    }

    await this.drizzle.withTransaction(
      async (tx) => {
        const createdAnnouncements = await tx
          .insert(this.appAnnouncement)
          .values({
            ...others,
            enablePlatform: normalizedEnablePlatform,
            pageId: pageId ?? null,
          })
          .returning({
            id: this.appAnnouncement.id,
          })

        const [createdAnnouncement] = this.drizzle.assertNotEmpty(
          createdAnnouncements,
          '公告创建失败',
        )

        await this.getAnnouncementNotificationFanoutService().enqueueAnnouncementFanout(
          createdAnnouncement.id,
          tx,
        )
      },
      { duplicate: '公告已存在' },
    )
    return true
  }

  /**
   * 管理端公告分页。
   */
  async findAnnouncementPage(queryAnnouncementDto: QueryAnnouncementDto) {
    const { where, pageParams } =
      this.buildAnnouncementPageQuery(queryAnnouncementDto)
    const page = this.drizzle.buildPage(pageParams)
    const orderQuery = this.drizzle.buildOrderBy(
      pageParams.orderBy?.trim() ? pageParams.orderBy : { id: 'desc' as const },
      { table: this.appAnnouncement },
    )
    const [list, total] = await Promise.all([
      this.db
        .select(this.buildAnnouncementResponseSelect())
        .from(this.appAnnouncement)
        .where(where)
        .orderBy(...orderQuery.orderBySql)
        .limit(page.limit)
        .offset(page.offset),
      this.db.$count(this.appAnnouncement, where),
    ])

    return toPageResult(await this.hydrateAdminAnnouncementRows(list), total, page)
  }

  /**
   * APP 公开公告分页。强制 APP 平台和当前生效窗口，并排除正文大字段。
   */
  async findPublicAnnouncementPage(
    queryAnnouncementDto: QueryPublicAnnouncementCursorDto,
  ) {
    this.assertCursorPageQuery(queryAnnouncementDto)
    const { where } = this.buildAnnouncementPageQuery(
      {} as QueryAnnouncementDto,
      {
        appVisibleOnly: true,
      },
    )
    const pageSize = this.normalizeCursorPageSize(
      queryAnnouncementDto.pageSize,
      15,
      100,
    )
    const cursor = this.parseAnnouncementCursor(queryAnnouncementDto.cursor)
    const cursorWhere = cursor
      ? sql`(${this.appAnnouncement.createdAt} < ${cursor.createdAt} OR (${this.appAnnouncement.createdAt} = ${cursor.createdAt} AND ${this.appAnnouncement.id} < ${cursor.id}))`
      : undefined
    const rows = await this.db
      .select(this.buildPublicAnnouncementListSelect())
      .from(this.appAnnouncement)
      .where(cursorWhere ? and(where, cursorWhere) : where)
      .orderBy(desc(this.appAnnouncement.createdAt), desc(this.appAnnouncement.id))
      .limit(pageSize + 1)
    const hasMore = rows.length > pageSize
    const pageRows = rows.slice(0, pageSize)

    return {
      list: pageRows.map((item) =>
        this.toAnnouncementOutputDto(item),
      ) as AppAnnouncementListItemDto[],
      pageSize,
      hasMore,
      nextCursor: hasMore
        ? this.encodeAnnouncementCursor(pageRows[pageRows.length - 1])
        : null,
    }
  }

  /**
   * 按公告 id 更新主体字段，并在成功后重新入队公告通知 fanout 任务。
   * 若请求显式变更 `pageId`，会先校验目标页面是否存在。
   */
  async updateAnnouncement(updateAnnouncementDto: UpdateAnnouncementDto) {
    const { enablePlatform, id, pageId, ...updateData } = updateAnnouncementDto

    // 检查公告是否存在
    const announcement = await this.db.query.appAnnouncement.findFirst({
      where: { id },
      columns: {
        id: true,
        pageId: true,
        popupBackgroundImage: true,
        popupBackgroundPosition: true,
        publishStartTime: true,
        publishEndTime: true,
        showAsPopup: true,
      },
    })

    if (!announcement) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '公告不存在',
      )
    }

    assertValidTimeRange(
      updateData.publishStartTime ?? announcement.publishStartTime,
      updateData.publishEndTime ?? announcement.publishEndTime,
      '发布开始时间不能大于或等于结束时间',
    )
    this.assertValidPopupConfig({
      popupBackgroundImage:
        updateData.popupBackgroundImage === undefined
          ? announcement.popupBackgroundImage
          : updateData.popupBackgroundImage,
      popupBackgroundPosition:
        updateData.popupBackgroundPosition === undefined
          ? (announcement.popupBackgroundPosition as
          | PopupBackgroundPositionEnum
          | null)
          : updateData.popupBackgroundPosition,
      showAsPopup: updateData.showAsPopup ?? announcement.showAsPopup,
    })

    // 校验关联页面是否存在（仅在 pageId 变更时）
    if (pageId !== undefined && announcement.pageId !== pageId) {
      if (pageId !== null) {
        const page = await this.db.query.appPage.findFirst({
          where: { id: pageId },
          columns: { id: true },
        })
        if (!page) {
          throw new BusinessException(
            BusinessErrorCode.RESOURCE_NOT_FOUND,
            '关联页面不存在',
          )
        }
      }
    }

    const nextUpdateData: Partial<typeof this.appAnnouncement.$inferInsert> = {
      ...updateData,
    }
    if (enablePlatform !== undefined) {
      nextUpdateData.enablePlatform =
        this.normalizeAnnouncementEnablePlatform(enablePlatform)
    }
    if (pageId !== undefined) {
      nextUpdateData.pageId = pageId
    }

    await this.drizzle.withTransaction(async (tx) => {
      const result = await tx
        .update(this.appAnnouncement)
        .set(nextUpdateData)
        .where(eq(this.appAnnouncement.id, id))

      this.drizzle.assertAffectedRows(result, '公告不存在')
      await this.getAnnouncementNotificationFanoutService().enqueueAnnouncementFanout(
        id,
        tx,
      )
    })
    return true
  }

  /**
   * 切换公告发布状态，并在成功后重新入队公告通知 fanout 任务。
   */
  async updateAnnouncementStatus(dto: UpdatePublishedStatusDto) {
    await this.drizzle.withTransaction(async (tx) => {
      const result = await tx
        .update(this.appAnnouncement)
        .set({ isPublished: dto.isPublished })
        .where(eq(this.appAnnouncement.id, dto.id))

      this.drizzle.assertAffectedRows(result, '公告不存在')
      await this.getAnnouncementNotificationFanoutService().enqueueAnnouncementFanout(
        dto.id,
        tx,
      )
    })
    return true
  }

  /**
   * 通过 `isPublished=false` 逻辑下线公告，不执行物理删除。
   */
  async deleteAnnouncement(dto: IdDto) {
    const { id } = dto
    await this.drizzle.withTransaction(async (tx) => {
      const result = await tx
        .update(this.appAnnouncement)
        .set({ isPublished: false })
        .where(eq(this.appAnnouncement.id, id))

      this.drizzle.assertAffectedRows(result, '公告不存在')
      await this.getAnnouncementNotificationFanoutService().enqueueAnnouncementFanout(
        id,
        tx,
      )
    })
    return true
  }

  /**
   * 重试当前公告最新失败的消息中心通知任务。
   */
  async retryAnnouncementFanout(dto: IdDto) {
    const announcement = await this.db.query.appAnnouncement.findFirst({
      where: { id: dto.id },
      columns: { id: true },
    })
    if (!announcement) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '公告不存在',
      )
    }

    return this.getAnnouncementNotificationFanoutService().retryFailedAnnouncementFanout(
      dto.id,
    )
  }

  /**
   * 查询公告详情并补齐关联页面、发布状态和消息中心扇出状态。
   */
  async findAnnouncementDetail(dto: IdDto) {
    const announcement = await this.db.query.appAnnouncement.findFirst({
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

    if (!announcement) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '公告不存在',
      )
    }

    const {
      appPage,
      notificationEndBoundaryAt: _notificationEndBoundaryAt,
      notificationFanoutDesiredEventKey,
      notificationFanoutLastError,
      notificationFanoutStatus,
      notificationFanoutTaskId: _notificationFanoutTaskId,
      notificationFanoutUpdatedAt,
      notificationStartBoundaryAt: _notificationStartBoundaryAt,
      ...announcementResponse
    } = announcement
    const [runtime] = await this.hydrateAdminAnnouncementRows([
      {
        ...announcementResponse,
        fanoutDesiredEventKey: notificationFanoutDesiredEventKey,
        fanoutLastError: notificationFanoutLastError,
        fanoutStatus: notificationFanoutStatus,
        fanoutUpdatedAt: notificationFanoutUpdatedAt,
      },
    ])
    return {
      ...runtime,
      appPage: appPage ?? null,
    }
  }

  /**
   * 查询 APP 公开公告详情，只允许 APP 平台且当前生效的公告。
   */
  async findPublicAnnouncementDetail(
    dto: IdDto,
  ): Promise<AnnouncementOutputBaseDto> {
    const announcement = await this.findVisiblePublicAnnouncement(dto.id)
    return this.toAnnouncementOutputDto(announcement)
  }

  /**
   * 当前用户标记公告已读。
   */
  async markAnnouncementRead(dto: IdDto, userId: number) {
    await this.findVisiblePublicAnnouncement(dto.id)
    await this.db
      .insert(this.appAnnouncementRead)
      .values({
        announcementId: dto.id,
        userId,
        readAt: new Date(),
      })
      .onConflictDoNothing()

    return true
  }

  /**
   * 以原子自增方式累加 APP 公开公告浏览量，避免并发读改写覆盖。
   */
  async incrementPublicAnnouncementViewCount(dto: IdDto, userId: number) {
    await this.drizzle.withTransaction(async (tx) => {
      const visibleRows = await tx
        .select({ id: this.appAnnouncement.id })
        .from(this.appAnnouncement)
        .where(
          and(
            eq(this.appAnnouncement.id, dto.id),
            ...this.buildAppVisibilityConditions(new Date()),
          ),
        )
        .limit(1)

      if (!visibleRows[0]) {
        throw new BusinessException(
          BusinessErrorCode.RESOURCE_NOT_FOUND,
          '公告不存在',
        )
      }

      const insertedRows = await tx
        .insert(this.appAnnouncementView)
        .values({
          announcementId: dto.id,
          userId,
          viewedAt: new Date(),
        })
        .onConflictDoNothing()
        .returning({
          announcementId: this.appAnnouncementView.announcementId,
        })

      if (!insertedRows[0]) {
        return
      }

      const result = await tx
        .update(this.appAnnouncement)
        .set({
          viewCount: sql`${this.appAnnouncement.viewCount} + 1`,
        })
        .where(eq(this.appAnnouncement.id, dto.id))

      this.drizzle.assertAffectedRows(result, '公告不存在')
    })
    return true
  }

  /**
   * 以原子自增方式累加浏览量，避免并发读改写覆盖。
   */
  async incrementViewCount(dto: IdDto, userId: number) {
    return this.incrementPublicAnnouncementViewCount(dto, userId)
  }

  private encodeAnnouncementCursor(item: { createdAt: Date; id: number }) {
    return Buffer.from(
      JSON.stringify({
        createdAt: item.createdAt.toISOString(),
        id: item.id,
      }),
    ).toString('base64url')
  }

  private parseAnnouncementCursor(cursor?: string | null) {
    if (!cursor?.trim()) {
      return undefined
    }

    try {
      const payload = JSON.parse(
        Buffer.from(cursor.trim(), 'base64url').toString('utf8'),
      ) as Partial<{ createdAt: unknown; id: unknown }>
      if (
        typeof payload.createdAt !== 'string' ||
        !Number.isInteger(payload.id) ||
        Number(payload.id) <= 0
      ) {
        throw new TypeError('invalid cursor payload')
      }
      const createdAt = new Date(payload.createdAt)
      if (Number.isNaN(createdAt.getTime())) {
        throw new TypeError('invalid cursor payload')
      }
      return { createdAt, id: Number(payload.id) }
    } catch {
      throw new BadRequestException('cursor 格式无效')
    }
  }

  private assertCursorPageQuery(dto: object) {
    const unsupportedFields = ['pageIndex', 'orderBy', 'startDate', 'endDate']
      .filter((field) => Object.prototype.hasOwnProperty.call(dto, field))

    if (unsupportedFields.length > 0) {
      throw new BadRequestException(
        `公告列表仅支持 pageSize 和 cursor 查询，不支持 ${unsupportedFields.join(', ')}`,
      )
    }
  }

  private normalizeCursorPageSize(
    pageSize: number | undefined,
    defaultPageSize: number,
    maxPageSize: number,
  ) {
    const value = Number.isFinite(Number(pageSize))
      ? Math.floor(Number(pageSize))
      : defaultPageSize
    return Math.min(Math.max(1, value), maxPageSize)
  }

  private buildAnnouncementPageQuery(
    queryAnnouncementDto: QueryAnnouncementDto,
    options?: {
      appVisibleOnly?: boolean
    },
  ) {
    const {
      announcementType,
      isPinned,
      isPublished,
      isRealtime,
      pageId,
      priorityLevel,
      showAsPopup,
      title,
      publishStartTime,
      publishEndTime,
      enablePlatform,
      fanoutStatus,
      publishStatus,
      ...pageParams
    } = queryAnnouncementDto

    const platforms = options?.appVisibleOnly
      ? [EnablePlatformEnum.APP]
      : this.parseEnablePlatforms(enablePlatform)

    const conditions: SQL[] = []
    const now = new Date()

    if (title) {
      conditions.push(buildILikeCondition(this.appAnnouncement.title, title)!)
    }
    if (publishStartTime != null) {
      conditions.push(
        lte(this.appAnnouncement.publishStartTime, publishStartTime),
      )
    }
    if (publishEndTime != null) {
      conditions.push(gte(this.appAnnouncement.publishEndTime, publishEndTime))
    }
    if (platforms && platforms.length > 0) {
      conditions.push(
        arrayOverlaps(this.appAnnouncement.enablePlatform, platforms),
      )
    }
    if (announcementType !== undefined) {
      conditions.push(eq(this.appAnnouncement.announcementType, announcementType))
    }
    if (priorityLevel !== undefined) {
      conditions.push(eq(this.appAnnouncement.priorityLevel, priorityLevel))
    }
    if (options?.appVisibleOnly) {
      conditions.push(...this.buildAppVisibilityConditions(now, false))
    } else if (publishStatus !== undefined) {
      conditions.push(...this.buildPublishStatusConditions(publishStatus, now))
    } else if (isPublished !== undefined) {
      conditions.push(eq(this.appAnnouncement.isPublished, isPublished))
    }
    if (isRealtime !== undefined) {
      conditions.push(eq(this.appAnnouncement.isRealtime, isRealtime))
    }
    if (isPinned !== undefined) {
      conditions.push(eq(this.appAnnouncement.isPinned, isPinned))
    }
    if (showAsPopup !== undefined) {
      conditions.push(eq(this.appAnnouncement.showAsPopup, showAsPopup))
    }
    if (!options?.appVisibleOnly && fanoutStatus !== undefined) {
      conditions.push(this.buildLatestFanoutStatusCondition(fanoutStatus))
    }
    if (pageId != null) {
      conditions.push(eq(this.appAnnouncement.pageId, pageId))
    }

    return {
      pageParams,
      where: conditions.length > 0 ? and(...conditions) : undefined,
    }
  }

  private buildPublishStatusConditions(
    status: AnnouncementPublishStatusEnum,
    now: Date,
  ) {
    if (status === AnnouncementPublishStatusEnum.UNPUBLISHED) {
      return [eq(this.appAnnouncement.isPublished, false)]
    }
    if (status === AnnouncementPublishStatusEnum.SCHEDULED) {
      return [
        eq(this.appAnnouncement.isPublished, true),
        gt(this.appAnnouncement.publishStartTime, now),
      ]
    }
    if (status === AnnouncementPublishStatusEnum.EXPIRED) {
      return [
        eq(this.appAnnouncement.isPublished, true),
        lte(this.appAnnouncement.publishEndTime, now),
      ]
    }
    return [
      eq(this.appAnnouncement.isPublished, true),
      or(
        isNull(this.appAnnouncement.publishStartTime),
        lte(this.appAnnouncement.publishStartTime, now),
      )!,
      or(
        isNull(this.appAnnouncement.publishEndTime),
        gt(this.appAnnouncement.publishEndTime, now),
      )!,
    ]
  }

  private buildAppVisibilityConditions(
    now: Date,
    includePlatform = true,
  ): SQL[] {
    const conditions = this.buildPublishStatusConditions(
      AnnouncementPublishStatusEnum.ACTIVE,
      now,
    )
    if (includePlatform) {
      conditions.push(
        arrayOverlaps(this.appAnnouncement.enablePlatform, [
          EnablePlatformEnum.APP,
        ]),
      )
    }
    return conditions
  }

  private buildLatestFanoutStatusCondition(status: AnnouncementFanoutStatusEnum) {
    return eq(this.appAnnouncement.notificationFanoutStatus, status)
  }

  private buildPublicAnnouncementListSelect() {
    const {
      // 正文大字段只允许详情接口返回，避免公开列表拖垮分页和泄露完整内容。
      content,
      // 内部生命周期标记只用于服务端调度，不暴露给 APP。
      notificationEndBoundaryAt,
      notificationFanoutDesiredEventKey,
      notificationFanoutLastError,
      notificationFanoutStatus,
      notificationFanoutTaskId,
      notificationFanoutUpdatedAt,
      notificationStartBoundaryAt,
      ...rest
    } = getColumns(this.appAnnouncement)
    return rest
  }

  private buildAnnouncementResponseSelect() {
    const {
      notificationEndBoundaryAt,
      notificationFanoutDesiredEventKey,
      notificationFanoutLastError,
      notificationFanoutStatus,
      notificationFanoutTaskId,
      notificationFanoutUpdatedAt,
      notificationStartBoundaryAt,
      ...rest
    } = getColumns(this.appAnnouncement)
    return {
      ...rest,
      fanoutDesiredEventKey: notificationFanoutDesiredEventKey,
      fanoutLastError: notificationFanoutLastError,
      fanoutStatus: notificationFanoutStatus,
      fanoutUpdatedAt: notificationFanoutUpdatedAt,
    }
  }

  private buildPublicAnnouncementDetailSelect() {
    const {
      notificationEndBoundaryAt,
      notificationFanoutDesiredEventKey,
      notificationFanoutLastError,
      notificationFanoutStatus,
      notificationFanoutTaskId,
      notificationFanoutUpdatedAt,
      notificationStartBoundaryAt,
      ...rest
    } = getColumns(this.appAnnouncement)
    return rest
  }

  private async findVisiblePublicAnnouncement(id: number) {
    const rows = await this.db
      .select(this.buildPublicAnnouncementDetailSelect())
      .from(this.appAnnouncement)
      .where(
        and(
          eq(this.appAnnouncement.id, id),
          ...this.buildAppVisibilityConditions(new Date()),
        ),
      )
      .limit(1)

    const announcement = rows[0]
    if (!announcement) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '公告不存在',
      )
    }

    return announcement
  }

  private async hydrateAdminAnnouncementRows<T extends AnnouncementResponseRow>(
    rows: T[],
  ) {
    return rows.map((row) => ({
      ...this.toAnnouncementOutputDto(row),
      publishStatus: resolveAnnouncementPublishStatus(row),
      fanoutDesiredEventKey: row.fanoutDesiredEventKey ?? null,
      fanoutLastError: row.fanoutLastError ?? null,
      fanoutStatus: row.fanoutStatus ?? null,
      fanoutUpdatedAt: row.fanoutUpdatedAt ?? null,
    }))
  }

  private toAnnouncementOutputDto<T extends Partial<AnnouncementOutputFieldSource>>(
    row: T,
  ) {
    return {
      ...row,
      summary: row.summary ?? null,
      publishStartTime: row.publishStartTime ?? null,
      publishEndTime: row.publishEndTime ?? null,
      pageId: row.pageId ?? null,
      popupBackgroundImage: row.popupBackgroundImage ?? null,
      popupBackgroundPosition:
        (row.popupBackgroundPosition as PopupBackgroundPositionEnum | null) ??
        PopupBackgroundPositionEnum.CENTER,
      enablePlatform: this.toAnnouncementOutputEnablePlatform(
        row.enablePlatform,
      ),
    }
  }

  private toAnnouncementOutputEnablePlatform(
    enablePlatform?: EnablePlatformEnum[] | number[] | null,
  ) {
    if (!Array.isArray(enablePlatform) || enablePlatform.length === 0) {
      return [...DEFAULT_ENABLE_PLATFORM]
    }

    return enablePlatform.map((item) => Number(item)) as EnablePlatformEnum[]
  }

  /**
   * 解析公告平台筛选参数。
   * 仅接受数字数组 JSON，避免传入合法 JSON 但结构错误时把坏请求打成 500。
   */
  private parseEnablePlatforms(enablePlatform?: string) {
    if (!enablePlatform || enablePlatform === '[]') {
      return undefined
    }

    let parsedValue: JsonValue | null
    try {
      parsedValue = JSON.parse(enablePlatform)
    } catch {
      throw new BadRequestException('启用平台筛选必须是合法 JSON 数组')
    }

    if (!Array.isArray(parsedValue)) {
      throw new BadRequestException('启用平台筛选必须是平台枚举值数组')
    }

    const platforms = parsedValue.map((item) => Number(item))
    if (
      platforms.some(
        (item) => !Number.isInteger(item) || !ENABLE_PLATFORM_VALUES.has(item),
      )
    ) {
      throw new BadRequestException('启用平台筛选必须是平台枚举值数组')
    }

    return platforms.length > 0 ? [...new Set(platforms)] : undefined
  }

  private normalizeAnnouncementEnablePlatform(
    enablePlatform?: EnablePlatformEnum[] | null,
  ) {
    if (enablePlatform === undefined) {
      return undefined
    }
    if (!Array.isArray(enablePlatform) || enablePlatform.length === 0) {
      throw new BadRequestException('发布平台不能为空')
    }

    const platforms = [...new Set(enablePlatform.map((item) => Number(item)))]
    if (
      platforms.some(
        (item) => !Number.isInteger(item) || !ENABLE_PLATFORM_VALUES.has(item),
      )
    ) {
      throw new BadRequestException('发布平台包含不支持的平台')
    }

    return platforms as EnablePlatformEnum[]
  }

  private assertValidPopupConfig(input: {
    popupBackgroundImage?: string | null
    popupBackgroundPosition?: PopupBackgroundPositionEnum | null
    showAsPopup?: boolean
  }) {
    if (!input.showAsPopup) {
      return
    }

    if (!input.popupBackgroundImage?.trim()) {
      throw new BadRequestException('弹窗公告必须配置背景图片')
    }
    if (input.popupBackgroundPosition === null) {
      throw new BadRequestException('弹窗背景位置不能为空')
    }
  }

  private getAnnouncementNotificationFanoutService() {
    if (!this.announcementFanout) {
      throw new Error('公告消息中心运行时模块未注册')
    }
    return this.announcementFanout
  }
}
