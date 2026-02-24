import type { CommentRateLimitConfigDto } from '@libs/system-config'
import type { CommentWithRelations, WorkCommentTransaction } from './work-comment.types'
import { UserStatusEnum } from '@libs/base/constant'
import { BaseService, Prisma } from '@libs/base/database'
import {
  ForumUserActionTargetTypeEnum,
  ForumUserActionTypeEnum,
} from '@libs/forum/action-log/action-log.constant'
import { ForumUserActionLogService } from '@libs/forum/action-log/action-log.service'
import { SensitiveWordLevelEnum } from '@libs/sensitive-word/sensitive-word-constant'
import { SensitiveWordDetectService } from '@libs/sensitive-word/sensitive-word-detect.service'
import { SystemConfigService } from '@libs/system-config'
import { UserLevelRuleService } from '@libs/user/level-rule'
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import {
  CreateWorkCommentDto,
  CreateWorkCommentReportDto,
  HandleWorkCommentReportDto,
  QueryWorkCommentDto,
  QueryWorkCommentReportDto,
  UpdateWorkCommentAuditDto,
  UpdateWorkCommentHiddenDto,
} from './dto/work-comment.dto'
import {
  WorkCommentAuditRoleEnum,
  WorkCommentAuditStatusEnum,
  WorkCommentReportStatusEnum,
  WorkCommentSortFieldEnum,
  WorkCommentSortOrderEnum,
} from './work-comment.constant'

@Injectable()
export class WorkCommentService extends BaseService {
  get workComment() {
    return this.prisma.workComment
  }

  get workCommentReport() {
    return this.prisma.workCommentReport
  }

  get workChapter() {
    return this.prisma.workChapter
  }

  get work() {
    return this.prisma.work
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

  private buildUserDto(user?: { id: number, nickname: string, avatar?: string | null }) {
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

  private mapComment(item: CommentWithRelations) {
    const { actualReplies, ...rest } = item
    const children = actualReplies?.map((child) => ({
      ...child,
      user: this.buildUserDto(child.user ?? undefined),
      replyTo: this.buildReplyToDto(child.replyTo ?? undefined),
    }))
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
      comment.auditStatus === WorkCommentAuditStatusEnum.APPROVED &&
      !comment.isHidden &&
      !comment.deletedAt
    )
  }

  private async updateCommentCount(
    tx: WorkCommentTransaction,
    workId: number,
    chapterId: number | null,
    delta: number,
  ) {
    if (chapterId) {
      const chapter = await tx.workChapter.findUnique({
        where: { id: chapterId },
        select: { commentCount: true },
      })
      if (!chapter) {
        throw new BadRequestException('章节不存在')
      }
      const nextCount = Math.max(0, (chapter.commentCount ?? 0) + delta)
      await tx.workChapter.update({
        where: { id: chapterId },
        data: { commentCount: nextCount },
      })
    }
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
    const count = await this.workComment.count({
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
      const count = await this.workComment.count({
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
      const count = await this.workComment.count({
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
      const count = await this.workComment.count({
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
      const latest = await this.workComment.findFirst({
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
    const detectResult = this.sensitiveWordDetectService.getMatchedWords({
      content,
    })
    const config = await this.systemConfigService.findActiveConfig()
    const policy = config?.contentReviewPolicy
    let auditStatus = WorkCommentAuditStatusEnum.APPROVED
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

  async createComment(dto: CreateWorkCommentDto, userId: number) {
    await this.checkUserStatus(userId)
    await this.checkUserDailyLimit(userId)
    await this.checkCommentRateLimit(userId)

    const work = await this.work.findUnique({
      where: { id: dto.workId, deletedAt: null },
      select: { id: true, isPublished: true },
    })
    if (!work) {
      throw new BadRequestException('作品不存在')
    }
    if (!work.isPublished) {
      throw new BadRequestException('作品未发布，无法评论')
    }

    if (dto.chapterId) {
      const chapter = await this.workChapter.findUnique({
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
    }

    let replyToId: number | undefined
    let actualReplyToId: number | undefined
    let floor: number | undefined
    if (dto.replyToId) {
      const replyTo = await this.workComment.findUnique({
        where: { id: dto.replyToId },
        select: {
          id: true,
          workId: true,
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
      if (replyTo.workId !== dto.workId) {
        throw new BadRequestException('被回复评论不属于当前作品')
      }
      if (replyTo.chapterId !== dto.chapterId) {
        throw new BadRequestException('被回复评论不属于当前章节')
      }
      replyToId = replyTo.id
      actualReplyToId = replyTo.actualReplyToId ?? replyTo.id
    } else {
      const maxFloor = await this.workComment.findFirst({
        where: {
          workId: dto.workId,
          chapterId: dto.chapterId ?? null,
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

    const created = await this.prisma.$transaction(async (tx: WorkCommentTransaction) => {
      const createdComment = await tx.workComment.create({
        data: {
          workId: dto.workId,
          workType: dto.workType,
          chapterId: dto.chapterId,
          userId,
          content: dto.content,
          replyToId,
          actualReplyToId,
          floor,
          auditStatus: reviewResult.auditStatus,
          isHidden: reviewResult.isHidden,
          auditAt:
            reviewResult.auditStatus === WorkCommentAuditStatusEnum.PENDING
              ? null
              : now,
          sensitiveWordHits: reviewResult.hits
            ? (reviewResult.hits as unknown as Prisma.InputJsonValue)
            : undefined,
        },
      })

      if (this.isVisible(createdComment)) {
        await this.updateCommentCount(tx, dto.workId, dto.chapterId ?? null, 1)
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

  async deleteComment(id: number, userId: number) {
    const comment = await this.workComment.findUnique({
      where: { id },
    })
    if (!comment || comment.deletedAt) {
      throw new BadRequestException('评论不存在')
    }
    if (comment.userId !== userId) {
      throw new BadRequestException('无权删除该评论')
    }
    const wasVisible = this.isVisible(comment)
    const deletedId = await this.prisma.$transaction(async (tx: WorkCommentTransaction) => {
      await tx.workComment.softDelete({ id })
      if (wasVisible) {
        await this.updateCommentCount(tx, comment.workId, comment.chapterId, -1)
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

  async deleteCommentByAdmin(id: number) {
    const comment = await this.workComment.findUnique({
      where: { id },
    })
    if (!comment || comment.deletedAt) {
      throw new BadRequestException('评论不存在')
    }
    const wasVisible = this.isVisible(comment)
    return this.prisma.$transaction(async (tx: WorkCommentTransaction) => {
      await tx.workComment.softDelete({ id })
      if (wasVisible) {
        await this.updateCommentCount(tx, comment.workId, comment.chapterId, -1)
      }
      return id
    })
  }

  async getCommentPage(dto: QueryWorkCommentDto) {
    if (!dto.workId) {
      throw new BadRequestException('作品ID不能为空')
    }
    const work = await this.work.findUnique({
      where: { id: dto.workId, deletedAt: null },
      select: { id: true },
    })
    if (!work) {
      throw new BadRequestException('作品不存在')
    }
    const orderBy =
      dto.sortBy === WorkCommentSortFieldEnum.CREATED_AT
        ? { createdAt: dto.sortOrder ?? WorkCommentSortOrderEnum.DESC }
        : { floor: dto.sortOrder ?? WorkCommentSortOrderEnum.ASC }
    type WorkCommentPageWhere = Prisma.WorkCommentWhereInput & {
      pageIndex?: number
      pageSize?: number
    }
    const visibleReplyWhere: Prisma.WorkCommentWhereInput = {
      deletedAt: null,
      auditStatus: WorkCommentAuditStatusEnum.APPROVED,
      isHidden: false,
    }
    const where: WorkCommentPageWhere = {
        workId: dto.workId,
        chapterId: dto.chapterId ?? null,
        replyToId: null,
        auditStatus: WorkCommentAuditStatusEnum.APPROVED,
        isHidden: false,
        OR: [
          { deletedAt: null },
          { actualReplies: { some: visibleReplyWhere } },
        ],
        pageIndex: dto.pageIndex,
        pageSize: dto.pageSize,
      }
    const result = await this.workComment.findPagination({
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

  async getCommentManagePage(dto: QueryWorkCommentDto) {
    type WorkCommentManageWhere = Prisma.WorkCommentWhereInput & {
      pageIndex?: number
      pageSize?: number
    }
    const where: WorkCommentManageWhere = {
      workId: dto.workId,
      workType: dto.workType,
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
      dto.sortBy === WorkCommentSortFieldEnum.FLOOR
        ? { floor: dto.sortOrder ?? WorkCommentSortOrderEnum.DESC }
        : { createdAt: dto.sortOrder ?? WorkCommentSortOrderEnum.DESC }
    const result = await this.workComment.findPagination({
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

  async getCommentDetail(id: number) {
    const comment = await this.workComment.findUnique({
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

  async updateCommentAudit(dto: UpdateWorkCommentAuditDto, adminUserId: number) {
    const comment = await this.workComment.findUnique({
      where: { id: dto.id },
    })
    if (!comment || comment.deletedAt) {
      throw new BadRequestException('评论不存在')
    }
    const wasVisible = this.isVisible(comment)
    const now = new Date()
    return this.prisma.$transaction(async (tx: WorkCommentTransaction) => {
      const updated = await tx.workComment.update({
        where: { id: dto.id },
        data: {
          auditStatus: dto.auditStatus,
          auditReason: dto.auditReason,
          auditAt: now,
          auditById: adminUserId,
          auditRole: WorkCommentAuditRoleEnum.ADMIN,
        },
      })
      const isVisible = this.isVisible(updated)
      if (wasVisible !== isVisible) {
        await this.updateCommentCount(
          tx,
          updated.workId,
          updated.chapterId,
          isVisible ? 1 : -1,
        )
      }
      return updated
    })
  }

  async updateCommentHidden(dto: UpdateWorkCommentHiddenDto) {
    const comment = await this.workComment.findUnique({
      where: { id: dto.id },
    })
    if (!comment || comment.deletedAt) {
      throw new BadRequestException('评论不存在')
    }
    const wasVisible = this.isVisible(comment)
    return this.prisma.$transaction(async (tx: WorkCommentTransaction) => {
      const updated = await tx.workComment.update({
        where: { id: dto.id },
        data: { isHidden: dto.isHidden },
      })
      const isVisible = this.isVisible(updated)
      if (wasVisible !== isVisible) {
        await this.updateCommentCount(
          tx,
          updated.workId,
          updated.chapterId,
          isVisible ? 1 : -1,
        )
      }
      return updated
    })
  }

  async recalcCommentCount(workId: number, chapterId?: number | null) {
    const work = await this.work.findUnique({
      where: { id: workId, deletedAt: null },
      select: { id: true },
    })
    if (!work) {
      throw new BadRequestException('作品不存在')
    }
    if (chapterId) {
      const chapter = await this.workChapter.findUnique({
        where: { id: chapterId, deletedAt: null },
        select: { id: true },
      })
      if (!chapter) {
        throw new BadRequestException('章节不存在')
      }
    }
    const count = await this.workComment.count({
      where: {
        workId,
        chapterId: chapterId ?? null,
        deletedAt: null,
        auditStatus: WorkCommentAuditStatusEnum.APPROVED,
        isHidden: false,
      },
    })
    if (chapterId) {
      await this.workChapter.update({
        where: { id: chapterId },
        data: { commentCount: count },
      })
    }
    return { workId, chapterId, commentCount: count }
  }

  async createCommentReport(dto: CreateWorkCommentReportDto, reporterId: number) {
    const reporter = await this.appUser.findUnique({
      where: { id: reporterId },
      select: { id: true },
    })
    if (!reporter) {
      throw new BadRequestException('举报人不存在')
    }
    const comment = await this.workComment.findUnique({
      where: { id: dto.commentId },
      select: { id: true, userId: true, deletedAt: true },
    })
    if (!comment || comment.deletedAt) {
      throw new NotFoundException('评论不存在')
    }
    if (comment.userId === reporterId) {
      throw new BadRequestException('不能举报自己的评论')
    }
    const existingReport = await this.workCommentReport.findFirst({
      where: {
        reporterId,
        commentId: dto.commentId,
        status: {
          in: [
            WorkCommentReportStatusEnum.PENDING,
            WorkCommentReportStatusEnum.PROCESSING,
          ],
        },
      },
    })
    if (existingReport) {
      throw new BadRequestException('您已经举报过该内容，请勿重复举报')
    }
    return this.workCommentReport.create({
      data: {
        reporterId,
        commentId: dto.commentId,
        reason: dto.reason,
        description: dto.description,
        evidenceUrl: dto.evidenceUrl,
        status: WorkCommentReportStatusEnum.PENDING,
      },
    })
  }

  async getCommentReportPage(dto: QueryWorkCommentReportDto) {
    type WorkCommentReportWhere = Prisma.WorkCommentReportWhereInput & {
      pageIndex?: number
      pageSize?: number
    }
    const where: WorkCommentReportWhere = {
        commentId: dto.commentId,
        reason: dto.reason,
        status: dto.status,
        reporterId: dto.reporterId,
        pageIndex: dto.pageIndex,
        pageSize: dto.pageSize,
      }
    return this.workCommentReport.findPagination({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        reporter: { select: { id: true, nickname: true, avatar: true } },
        handler: { select: { id: true, nickname: true, avatar: true } },
        comment: {
          select: {
            id: true,
            content: true,
            workId: true,
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

  async handleCommentReport(dto: HandleWorkCommentReportDto, handlerId: number) {
    const report = await this.workCommentReport.findUnique({
      where: { id: dto.id },
    })
    if (!report) {
      throw new BadRequestException('举报记录不存在')
    }
    return this.workCommentReport.update({
      where: { id: dto.id },
      data: {
        status: dto.status ?? WorkCommentReportStatusEnum.PROCESSING,
        handlerId,
        handlingNote: dto.handlingNote,
        handledAt: new Date(),
      },
    })
  }
}
