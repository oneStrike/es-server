import { DrizzleService } from '@db/core'
import { assertValidTimeRange } from '@libs/platform/utils/timeRange'
import { BadRequestException, Injectable } from '@nestjs/common'
import { eq, sql } from 'drizzle-orm'
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
  constructor(private readonly drizzle: DrizzleService) { }

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

    await this.drizzle.withErrorHandling(() =>
      this.db.insert(this.appAnnouncement).values({
        ...others,
        pageId: pageId ?? null,
      }),
    )

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

    const where = this.drizzle.buildWhere(
      this.appAnnouncement,
      {
        and: {
          title: { like: title },
          publishStartTime: { lte: publishStartTime },
          publishEndTime: { gte: publishEndTime },
          enablePlatform: { in: platforms },
          announcementType: queryAnnouncementDto.announcementType,
          priorityLevel: queryAnnouncementDto.priorityLevel,
          isPublished: options?.publishedOnly ? true : queryAnnouncementDto.isPublished,
          isPinned: queryAnnouncementDto.isPinned,
          showAsPopup: queryAnnouncementDto.showAsPopup,
          pageId: queryAnnouncementDto.pageId,
        },
      },
    )

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
}
