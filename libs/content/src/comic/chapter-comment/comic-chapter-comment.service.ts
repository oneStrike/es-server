import type { CommentRateLimitConfigDto } from '@libs/system-config'
import type {
  ComicChapterCommentTransaction,
  CommentWithRelations,
} from './comic-chapter-comment.types'
import { UserStatusEnum } from '@libs/base/constant'
import { BaseService, Prisma } from '@libs/base/database'
import {
  ForumUserActionTargetTypeEnum,
  ForumUserActionTypeEnum,
} from '@libs/forum/action-log/action-log.constant'
import {
  ForumUserActionLogService,
} from '@libs/forum/action-log/action-log.service'
import { SensitiveWordLevelEnum } from '@libs/sensitive-word/sensitive-word-constant'
import { SensitiveWordDetectService } from '@libs/sensitive-word/sensitive-word-detect.service'
import { SystemConfigService } from '@libs/system-config'
import { UserLevelRuleService } from '@libs/user/level-rule'
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import {
  ComicChapterCommentAuditRoleEnum,
  ComicChapterCommentAuditStatusEnum,
  ComicChapterCommentReportStatusEnum,
  ComicChapterCommentSortFieldEnum,
  ComicChapterCommentSortOrderEnum,
} from './comic-chapter-comment.constant'
import {
  CreateComicChapterCommentDto,
  CreateComicChapterCommentReportDto,
  HandleComicChapterCommentReportDto,
  QueryComicChapterCommentDto,
  QueryComicChapterCommentReportDto,
  UpdateComicChapterCommentAuditDto,
  UpdateComicChapterCommentHiddenDto,
} from './dto/comic-chapter-comment.dto'

/**
 * 漫画章节评论服务
 * 负责评论的创建、查询、审核与举报处理
 */
@Injectable()
export class ComicChapterCommentService extends BaseService {
  get workComicChapterComment() {
    return this.prisma.workComicChapterComment
  }

  get workComicChapterCommentReport() {
    return this.prisma.workComicChapterCommentReport
  }

  get workComicChapter() {
    return this.prisma.workComicChapter
  }

  get workComic() {
    return this.prisma.workComic
  }

  get appUser() {
    return this.prisma.appUser
  }

  constructor(
    private readonly sensitiveWordDetectService: SensitiveWordDetectService,
    private readonly systemConfigService: SystemConfigService,
    private readonly userLevelRuleService: UserLevelRuleService,
    private readonly actionLogService: ForumUserActionLogService,
  ) {
    super()
  }

  private buildUserDto(user?: {
    id: number
    nickname: string
    avatar?: string | null
  }) {
    if (!user) {
      return undefined
    }
    return {
      id: user.id,
      nickname: user.nickname,
      avatar: user.avatar ?? undefined,
    }
  }

  private buildReplyToDto(reply?: {
    id: number
    userId: number
    user?: { nickname: string, avatar?: string | null } | null
  }) {
    if (!reply) {
      return undefined
    }
    return {
      id: reply.id,
      userId: reply.userId,
      nickname: reply.user?.nickname ?? '',
      avatar: reply.user?.avatar ?? undefined,
    }
  }

  /**
   * 将评论实体映射为对外展示结构
   * 对已删除的父评论输出占位文本，保留楼中楼上下文
   */
  private mapComment(item: CommentWithRelations) {
    const { actualReplies, ...rest } = item
    const children = actualReplies?.map((child) => ({
      ...child,
      user: this.buildUserDto(child.user ?? undefined),
      replyTo: this.buildReplyToDto(child.replyTo ?? undefined),
    }))
    // 父评论删除后仅替换展示内容，保留原有关系与楼中楼
    const content = rest.deletedAt ? '原评论已删除' : rest.content
    return {
      ...rest,
      content,
      user: this.buildUserDto(item.user ?? undefined),
      replyTo: this.buildReplyToDto(item.replyTo ?? undefined),
      children,
    }
  }

  private isVisible(comment: {
    auditStatus: number
    isHidden: boolean
    deletedAt?: Date | null
  }) {
    return (
      comment.auditStatus === ComicChapterCommentAuditStatusEnum.APPROVED &&
      !comment.isHidden &&
      !comment.deletedAt
    )
  }

  private async updateChapterCommentCount(
    tx: ComicChapterCommentTransaction,
    chapterId: number,
    delta: number,
  ) {
    const chapter = await tx.workComicChapter.findUnique({
      where: { id: chapterId },
      select: { commentCount: true },
    })
    if (!chapter) {
      throw new BadRequestException('章节不存在')
    }
    const nextCount = Math.max(0, (chapter.commentCount ?? 0) + delta)
    await tx.workComicChapter.update({
      where: { id: chapterId },
      data: { commentCount: nextCount },
    })
  }

  private async checkUserStatus(userId: number) {
    const user = await this.appUser.findFirst({
      where: { id: userId, isEnabled: true },
      select: { status: true },
    })
    if (!user) {
      throw new BadRequestException('用户不存在或已被封禁')
    }
    if (
      [
        UserStatusEnum.MUTED,
        UserStatusEnum.PERMANENT_MUTED,
        UserStatusEnum.BANNED,
        UserStatusEnum.PERMANENT_BANNED,
      ].includes(user.status)
    ) {
      throw new BadRequestException('用户已被禁言或封禁，无法评论')
    }
  }

  private async checkUserDailyLimit(userId: number) {
    const levelInfo = await this.userLevelRuleService.getUserLevelInfo(userId)
    const limit = levelInfo.permissions.dailyReplyCommentLimit
    if (!limit || limit <= 0) {
      return
    }
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const count = await this.workComicChapterComment.count({
      where: {
        userId,
        deletedAt: null,
        createdAt: { gte: startOfDay },
      },
    })
    if (count >= limit) {
      throw new BadRequestException('今日评论已达上限')
    }
  }

  private async checkCommentRateLimit(userId: number) {
    // 按系统配置执行频率限制与冷却时间校验
    const config =
      (await this.systemConfigService.findActiveConfig()) as
      | { commentRateLimitConfig?: CommentRateLimitConfigDto }
      | null
    const limitConfig = config?.commentRateLimitConfig
    if (!limitConfig?.enabled) {
      return
    }
    const now = new Date()
    if (limitConfig.perMinute && limitConfig.perMinute > 0) {
      const minuteAgo = new Date(now.getTime() - 60 * 1000)
      const count = await this.workComicChapterComment.count({
        where: {
          userId,
          deletedAt: null,
          createdAt: { gte: minuteAgo },
        },
      })
      if (count >= limitConfig.perMinute) {
        throw new BadRequestException('评论过于频繁，请稍后再试')
      }
    }
    if (limitConfig.perHour && limitConfig.perHour > 0) {
      const hourAgo = new Date(now.getTime() - 60 * 60 * 1000)
      const count = await this.workComicChapterComment.count({
        where: {
          userId,
          deletedAt: null,
          createdAt: { gte: hourAgo },
        },
      })
      if (count >= limitConfig.perHour) {
        throw new BadRequestException('评论过于频繁，请稍后再试')
      }
    }
    if (limitConfig.perDay && limitConfig.perDay > 0) {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const count = await this.workComicChapterComment.count({
        where: {
          userId,
          deletedAt: null,
          createdAt: { gte: startOfDay },
        },
      })
      if (count >= limitConfig.perDay) {
        throw new BadRequestException('今日评论已达上限')
      }
    }
    if (limitConfig.cooldownSeconds && limitConfig.cooldownSeconds > 0) {
      const latest = await this.workComicChapterComment.findFirst({
        where: { userId, deletedAt: null },
        select: { createdAt: true },
        orderBy: { createdAt: 'desc' },
      })
      if (latest) {
        const elapsedSeconds =
          (now.getTime() - latest.createdAt.getTime()) / 1000
        if (elapsedSeconds < limitConfig.cooldownSeconds) {
          throw new BadRequestException('评论过于频繁，请稍后再试')
        }
      }
    }
  }

  private async getReviewDecision(content: string) {
    // 按敏感词最高等级匹配策略，决定审核状态与隐藏策略
    const detectResult = this.sensitiveWordDetectService.getMatchedWords({
      content,
    })
    const config = await this.systemConfigService.findActiveConfig()
    const policy = config?.contentReviewPolicy
    let auditStatus = ComicChapterCommentAuditStatusEnum.APPROVED
    let isHidden = false
    if (detectResult.highestLevel && policy) {
      if (detectResult.highestLevel === SensitiveWordLevelEnum.SEVERE) {
        auditStatus = policy.severeAction.auditStatus
        isHidden = policy.severeAction.isHidden ?? false
      } else if (detectResult.highestLevel === SensitiveWordLevelEnum.GENERAL) {
        auditStatus = policy.generalAction.auditStatus
        isHidden = policy.generalAction.isHidden ?? false
      } else if (detectResult.highestLevel === SensitiveWordLevelEnum.LIGHT) {
        auditStatus = policy.lightAction.auditStatus
        isHidden = policy.lightAction.isHidden ?? false
      }
    }
    const hits = detectResult.hits ?? []
    const recordHits = policy?.recordHits !== false && hits.length > 0
    return { auditStatus, isHidden, hits: recordHits ? hits : undefined }
  }

  async createComicChapterComment(
    dto: CreateComicChapterCommentDto,
    userId: number,
  ) {
    await this.checkUserStatus(userId)
    await this.checkUserDailyLimit(userId)
    await this.checkCommentRateLimit(userId)

    const chapter = await this.workComicChapter.findUnique({
      where: { id: dto.chapterId, deletedAt: null },
      select: { id: true, canComment: true, isPublished: true, isPreview: true },
    })
    if (!chapter) {
      throw new BadRequestException('章节不存在')
    }
    if (!chapter.isPublished && !chapter.isPreview) {
      throw new BadRequestException('章节未发布，无法评论')
    }
    if (!chapter.canComment) {
      throw new BadRequestException('该章节已关闭评论')
    }

    let replyToId: number | undefined
    let actualReplyToId: number | undefined
    let floor: number | undefined
    if (dto.replyToId) {
      const replyTo = await this.workComicChapterComment.findUnique({
        where: { id: dto.replyToId },
        select: {
          id: true,
          chapterId: true,
          actualReplyToId: true,
          deletedAt: true,
        },
      })
      if (!replyTo || replyTo.deletedAt) {
        throw new BadRequestException('被回复评论不存在')
      }
      if (replyTo.actualReplyToId) {
        throw new BadRequestException('仅支持回复一级评论')
      }
      if (replyTo.chapterId !== dto.chapterId) {
        throw new BadRequestException('被回复评论不属于当前章节')
      }
      replyToId = replyTo.id
      actualReplyToId = replyTo.actualReplyToId ?? replyTo.id
    } else {
      const maxFloor = await this.workComicChapterComment.findFirst({
        where: {
          chapterId: dto.chapterId,
          replyToId: null,
          deletedAt: null,
        },
        select: { floor: true },
        orderBy: { floor: 'desc' },
      })
      floor = (maxFloor?.floor ?? 0) + 1
    }

    const reviewResult = await this.getReviewDecision(dto.content)
    const now = new Date()

    // 创建评论与计数变更放在同一事务内，避免并发错账
    const created = await this.prisma.$transaction(async (tx: ComicChapterCommentTransaction) => {
      const createdComment = await tx.workComicChapterComment.create({
        data: {
          chapterId: dto.chapterId,
          userId,
          content: dto.content,
          replyToId,
          actualReplyToId,
          floor,
          auditStatus: reviewResult.auditStatus,
          isHidden: reviewResult.isHidden,
          auditAt:
            reviewResult.auditStatus === ComicChapterCommentAuditStatusEnum.PENDING
              ? null
              : now,
          sensitiveWordHits: reviewResult.hits
            ? (reviewResult.hits as unknown as Prisma.InputJsonValue)
            : undefined,
        },
      })

      if (this.isVisible(createdComment)) {
        await this.updateChapterCommentCount(tx, dto.chapterId, 1)
      }

      return createdComment
    })
    await this.actionLogService.createActionLog({
      userId,
      actionType: ForumUserActionTypeEnum.CREATE_REPLY,
      targetType: ForumUserActionTargetTypeEnum.REPLY,
      targetId: created.id,
    })
    return created
  }

  async deleteComicChapterComment(id: number, userId: number) {
    const comment = await this.workComicChapterComment.findUnique({
      where: { id },
    })
    if (!comment || comment.deletedAt) {
      throw new BadRequestException('评论不存在')
    }
    if (comment.userId !== userId) {
      throw new BadRequestException('无权删除该评论')
    }
    const wasVisible = this.isVisible(comment)
    const deletedId = await this.prisma.$transaction(async (tx: ComicChapterCommentTransaction) => {
      await tx.workComicChapterComment.softDelete({ id })
      if (wasVisible) {
        await this.updateChapterCommentCount(tx, comment.chapterId, -1)
      }
      return id
    })
    await this.actionLogService.createActionLog({
      userId,
      actionType: ForumUserActionTypeEnum.DELETE_REPLY,
      targetType: ForumUserActionTargetTypeEnum.REPLY,
      targetId: id,
    })
    return deletedId
  }

  async deleteComicChapterCommentByAdmin(id: number) {
    const comment = await this.workComicChapterComment.findUnique({
      where: { id },
    })
    if (!comment || comment.deletedAt) {
      throw new BadRequestException('评论不存在')
    }
    const wasVisible = this.isVisible(comment)
    return this.prisma.$transaction(async (tx: ComicChapterCommentTransaction) => {
      await tx.workComicChapterComment.softDelete({ id })
      if (wasVisible) {
        await this.updateChapterCommentCount(tx, comment.chapterId, -1)
      }
      return id
    })
  }

  async getComicChapterCommentPage(dto: QueryComicChapterCommentDto) {
    if (!dto.chapterId) {
      throw new BadRequestException('章节ID不能为空')
    }
    const chapter = await this.workComicChapter.findUnique({
      where: { id: dto.chapterId, deletedAt: null },
      select: { id: true },
    })
    if (!chapter) {
      throw new BadRequestException('章节不存在')
    }
    const orderBy =
      dto.sortBy === ComicChapterCommentSortFieldEnum.CREATED_AT
        ? { createdAt: dto.sortOrder ?? ComicChapterCommentSortOrderEnum.DESC }
        : { floor: dto.sortOrder ?? ComicChapterCommentSortOrderEnum.ASC }
    type ComicChapterCommentPageWhere =
      Prisma.WorkComicChapterCommentWhereInput & {
        pageIndex?: number
        pageSize?: number
      }
    // 可见楼中楼条件：审核通过且未隐藏未删除
    const visibleReplyWhere: Prisma.WorkComicChapterCommentWhereInput = {
      deletedAt: null,
      auditStatus: ComicChapterCommentAuditStatusEnum.APPROVED,
      isHidden: false,
    }
    const where: ComicChapterCommentPageWhere = {
        chapterId: dto.chapterId,
        replyToId: null,
        auditStatus: ComicChapterCommentAuditStatusEnum.APPROVED,
        isHidden: false,
        // 父评论已删除但存在可见楼中楼时仍需展示占位
        OR: [
          { deletedAt: null },
          { actualReplies: { some: visibleReplyWhere } },
        ],
        pageIndex: dto.pageIndex,
        pageSize: dto.pageSize,
      }
    const result = await this.workComicChapterComment.findPagination({
      where,
      orderBy,
      include: {
        user: {
          select: { id: true, nickname: true, avatar: true },
        },
        replyTo: {
          select: {
            id: true,
            userId: true,
            user: { select: { nickname: true, avatar: true } },
          },
        },
        actualReplies: {
          where: visibleReplyWhere,
          orderBy: { createdAt: 'asc' },
          include: {
            user: { select: { id: true, nickname: true, avatar: true } },
            replyTo: {
              select: {
                id: true,
                userId: true,
                user: { select: { nickname: true, avatar: true } },
              },
            },
          },
        },
      },
    })
    const list = result.list as CommentWithRelations[]
    return {
      ...result,
      list: list.map((item) => this.mapComment(item)),
    }
  }

  async getComicChapterCommentManagePage(dto: QueryComicChapterCommentDto) {
    type ComicChapterCommentManageWhere = Prisma.WorkComicChapterCommentWhereInput & {
      pageIndex?: number
      pageSize?: number
    }
    const where: ComicChapterCommentManageWhere = {
      chapterId: dto.chapterId,
      userId: dto.userId,
      auditStatus: dto.auditStatus,
      isHidden: dto.isHidden,
      floor: dto.floor,
      deletedAt: null,
    }
    if (dto.content) {
      where.content = { contains: dto.content, mode: 'insensitive' }
    }
    if (dto.startDate || dto.endDate) {
      const createdAt: Prisma.DateTimeFilter = {}
      if (dto.startDate) {
        const startDate = new Date(dto.startDate)
        if (!Number.isNaN(startDate.getTime())) {
          createdAt.gte = startDate
        }
      }
      if (dto.endDate) {
        const endDate = new Date(dto.endDate)
        if (!Number.isNaN(endDate.getTime())) {
          const endDateExclusive = new Date(endDate.getTime())
          endDateExclusive.setDate(endDateExclusive.getDate() + 1)
          createdAt.lt = endDateExclusive
        }
      }
      if (Object.keys(createdAt).length > 0) {
        where.createdAt = createdAt
      }
    }
    const orderBy =
      dto.sortBy === ComicChapterCommentSortFieldEnum.FLOOR
        ? { floor: dto.sortOrder ?? ComicChapterCommentSortOrderEnum.DESC }
        : { createdAt: dto.sortOrder ?? ComicChapterCommentSortOrderEnum.DESC }
    const result = await this.workComicChapterComment.findPagination({
      where: {
        ...where,
        pageIndex: dto.pageIndex,
        pageSize: dto.pageSize,
      },
      orderBy,
      include: {
        user: {
          select: { id: true, nickname: true, avatar: true },
        },
        replyTo: {
          select: {
            id: true,
            userId: true,
            user: { select: { nickname: true, avatar: true } },
          },
        },
      },
    })
    const list = result.list as CommentWithRelations[]
    return {
      ...result,
      list: list.map((item) => this.mapComment(item)),
    }
  }

  async getComicChapterCommentDetail(id: number) {
    const comment = await this.workComicChapterComment.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, nickname: true, avatar: true } },
        replyTo: {
          select: {
            id: true,
            userId: true,
            user: { select: { nickname: true, avatar: true } },
          },
        },
        actualReplies: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
          include: {
            user: { select: { id: true, nickname: true, avatar: true } },
            replyTo: {
              select: {
                id: true,
                userId: true,
                user: { select: { nickname: true, avatar: true } },
              },
            },
          },
        },
      },
    })
    if (!comment || comment.deletedAt) {
      throw new NotFoundException('评论不存在')
    }
    return this.mapComment(comment as CommentWithRelations)
  }

  async updateComicChapterCommentAudit(
    dto: UpdateComicChapterCommentAuditDto,
    adminUserId: number,
  ) {
    const comment = await this.workComicChapterComment.findUnique({
      where: { id: dto.id },
    })
    if (!comment || comment.deletedAt) {
      throw new BadRequestException('评论不存在')
    }
    const wasVisible = this.isVisible(comment)
    const now = new Date()
    return this.prisma.$transaction(async (tx: ComicChapterCommentTransaction) => {
      const updated = await tx.workComicChapterComment.update({
        where: { id: dto.id },
        data: {
          auditStatus: dto.auditStatus,
          auditReason: dto.auditReason,
          auditAt: now,
          auditById: adminUserId,
          auditRole: ComicChapterCommentAuditRoleEnum.ADMIN,
        },
      })
      const isVisible = this.isVisible(updated)
      if (wasVisible !== isVisible) {
        await this.updateChapterCommentCount(
          tx,
          updated.chapterId,
          isVisible ? 1 : -1,
        )
      }
      return updated
    })
  }

  async updateComicChapterCommentHidden(
    dto: UpdateComicChapterCommentHiddenDto,
  ) {
    const comment = await this.workComicChapterComment.findUnique({
      where: { id: dto.id },
    })
    if (!comment || comment.deletedAt) {
      throw new BadRequestException('评论不存在')
    }
    const wasVisible = this.isVisible(comment)
    return this.prisma.$transaction(async (tx: ComicChapterCommentTransaction) => {
      const updated = await tx.workComicChapterComment.update({
        where: { id: dto.id },
        data: { isHidden: dto.isHidden },
      })
      const isVisible = this.isVisible(updated)
      if (wasVisible !== isVisible) {
        await this.updateChapterCommentCount(
          tx,
          updated.chapterId,
          isVisible ? 1 : -1,
        )
      }
      return updated
    })
  }

  async recalcChapterCommentCount(chapterId: number) {
    const chapter = await this.workComicChapter.findUnique({
      where: { id: chapterId, deletedAt: null },
      select: { id: true },
    })
    if (!chapter) {
      throw new BadRequestException('章节不存在')
    }
    const count = await this.workComicChapterComment.count({
      where: {
        chapterId,
        deletedAt: null,
        auditStatus: ComicChapterCommentAuditStatusEnum.APPROVED,
        isHidden: false,
      },
    })
    await this.workComicChapter.update({
      where: { id: chapterId },
      data: { commentCount: count },
    })
    return { chapterId, commentCount: count }
  }

  /**
   * 按漫画维度重算所有章节评论数
   * 以可见评论为基准，避免跨章节统计偏差
   */
  async recalcComicCommentCount(comicId: number) {
    const comic = await this.workComic.findUnique({
      where: { id: comicId, deletedAt: null },
      select: { id: true },
    })
    if (!comic) {
      throw new BadRequestException('漫画不存在')
    }
    const chapters = await this.workComicChapter.findMany({
      where: { comicId, deletedAt: null },
      select: { id: true },
    })
    const chapterIds = chapters.map((chapter) => chapter.id)
    if (chapterIds.length === 0) {
      return { comicId, chapterCount: 0, totalCommentCount: 0 }
    }
    // 先聚合得到各章节可见评论数量，再批量回写章节计数
    const counts = await this.workComicChapterComment.groupBy({
      by: ['chapterId'],
      where: {
        chapterId: { in: chapterIds },
        deletedAt: null,
        auditStatus: ComicChapterCommentAuditStatusEnum.APPROVED,
        isHidden: false,
      },
      _count: { _all: true },
    })
    const countMap = new Map(
      counts.map((item) => [item.chapterId, item._count._all]),
    )
    let totalCommentCount = 0
    await this.prisma.$transaction(async (tx) => {
      for (const chapterId of chapterIds) {
        const commentCount = countMap.get(chapterId) ?? 0
        totalCommentCount += commentCount
        await tx.workComicChapter.update({
          where: { id: chapterId },
          data: { commentCount },
        })
      }
    })
    return {
      comicId,
      chapterCount: chapterIds.length,
      totalCommentCount,
    }
  }

  async createComicChapterCommentReport(
    dto: CreateComicChapterCommentReportDto,
    reporterId: number,
  ) {
    const reporter = await this.appUser.findUnique({
      where: { id: reporterId },
      select: { id: true },
    })
    if (!reporter) {
      throw new BadRequestException('举报人不存在')
    }
    const comment = await this.workComicChapterComment.findUnique({
      where: { id: dto.commentId },
      select: { id: true, userId: true, deletedAt: true },
    })
    if (!comment || comment.deletedAt) {
      throw new NotFoundException('评论不存在')
    }
    if (comment.userId === reporterId) {
      throw new BadRequestException('不能举报自己的评论')
    }
    const existingReport = await this.workComicChapterCommentReport.findFirst({
      where: {
        reporterId,
        commentId: dto.commentId,
        status: {
          in: [
            ComicChapterCommentReportStatusEnum.PENDING,
            ComicChapterCommentReportStatusEnum.PROCESSING,
          ],
        },
      },
    })
    if (existingReport) {
      throw new BadRequestException('您已经举报过该内容，请勿重复举报')
    }
    return this.workComicChapterCommentReport.create({
      data: {
        reporterId,
        commentId: dto.commentId,
        reason: dto.reason,
        description: dto.description,
        evidenceUrl: dto.evidenceUrl,
        status: ComicChapterCommentReportStatusEnum.PENDING,
      },
    })
  }

  async getComicChapterCommentReportPage(
    dto: QueryComicChapterCommentReportDto,
  ) {
    type ComicChapterCommentReportWhere =
      Prisma.WorkComicChapterCommentReportWhereInput & {
        pageIndex?: number
        pageSize?: number
      }
    const where: ComicChapterCommentReportWhere = {
        commentId: dto.commentId,
        reason: dto.reason,
        status: dto.status,
        reporterId: dto.reporterId,
        pageIndex: dto.pageIndex,
        pageSize: dto.pageSize,
      }
    return this.workComicChapterCommentReport.findPagination({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        reporter: { select: { id: true, nickname: true, avatar: true } },
        handler: { select: { id: true, nickname: true, avatar: true } },
        comment: {
          select: {
            id: true,
            content: true,
            chapterId: true,
            userId: true,
            auditStatus: true,
            isHidden: true,
            createdAt: true,
          },
        },
      },
    })
  }

  async handleComicChapterCommentReport(
    dto: HandleComicChapterCommentReportDto,
    handlerId: number,
  ) {
    const report = await this.workComicChapterCommentReport.findUnique({
      where: { id: dto.id },
    })
    if (!report) {
      throw new BadRequestException('举报记录不存在')
    }
    return this.workComicChapterCommentReport.update({
      where: { id: dto.id },
      data: {
        status: dto.status ?? ComicChapterCommentReportStatusEnum.PROCESSING,
        handlerId,
        handlingNote: dto.handlingNote,
        // 处理动作发生时记录处理时间
        handledAt: new Date(),
      },
    })
  }
}
