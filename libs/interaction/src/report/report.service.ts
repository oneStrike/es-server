import type { Db } from '@db/core'
import type { SQL } from 'drizzle-orm'
import type {
  CreateUserReportOptions,
  CreateUserReportPayload,
} from './report.type'
import { DrizzleService } from '@db/core'
import {
  createDefinedEventEnvelope,
  EventEnvelopeGovernanceStatusEnum,
} from '@libs/growth/event-definition/event-envelope.type'
import { GrowthRuleTypeEnum } from '@libs/growth/growth-rule.constant'
import { InteractionSummaryReadService } from '@libs/interaction/summary/interaction-summary-read.service'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { BadRequestException, Injectable } from '@nestjs/common'
import { and, eq, isNull } from 'drizzle-orm'
import {
  CreateReportCommandDto,
  HandleAdminReportCommandDto,
  QueryAdminReportPageDto,
  QueryMyReportPageCommandDto,
} from './dto/report.dto'
import { IReportTargetResolver } from './interfaces/report-target-resolver.interface'
import { ReportGrowthService } from './report-growth.service'
import { ReportStatusEnum, ReportTargetTypeEnum } from './report.constant'

/**
 * 举报服务
 * 提供举报创建、查询、后台处理等核心业务逻辑
 * 通过解析器模式支持多种目标类型（作品、章节、评论、论坛主题、用户等）的举报操作
 */
@Injectable()
export class ReportService {
  /** 目标类型到解析器的映射表，用于根据目标类型路由到对应的解析器 */
  private readonly resolvers = new Map<
    ReportTargetTypeEnum,
    IReportTargetResolver
  >()

  constructor(
    private readonly reportGrowthService: ReportGrowthService,
    private readonly drizzle: DrizzleService,
    private readonly interactionSummaryReadService: InteractionSummaryReadService,
  ) {}

  private get db() {
    return this.drizzle.db
  }

  private get userReport() {
    return this.drizzle.schema.userReport
  }

  /**
   * 构建举报裁决事件 envelope。
   * 统一表达举报正式成立后的 code / target / operator / governanceStatus 语义。
   */
  private buildHandledReportEventEnvelope(params: {
    reportId: number
    reporterId: number
    handlerId?: number | null
    status: ReportStatusEnum
    targetType: ReportTargetTypeEnum
    targetId: number
    occurredAt?: Date
  }) {
    return createDefinedEventEnvelope({
      code:
        params.status === ReportStatusEnum.RESOLVED
          ? GrowthRuleTypeEnum.REPORT_VALID
          : GrowthRuleTypeEnum.REPORT_INVALID,
      subjectId: params.reporterId,
      targetId: params.reportId,
      operatorId: params.handlerId ?? undefined,
      occurredAt: params.occurredAt,
      governanceStatus:
        params.status === ReportStatusEnum.RESOLVED
          ? EventEnvelopeGovernanceStatusEnum.PASSED
          : EventEnvelopeGovernanceStatusEnum.REJECTED,
      context: {
        reportStatus: params.status,
        reportedTargetType: params.targetType,
        reportedTargetId: params.targetId,
      },
    })
  }

  /**
   * 注册目标解析器
   * 供其他模块在应用启动时注册自己的举报解析器
   * @param resolver - 举报目标解析器实例
   */
  registerResolver(resolver: IReportTargetResolver) {
    if (this.resolvers.has(resolver.targetType)) {
      console.warn(
        `Report resolver for type ${resolver.targetType} is being overwritten.`,
      )
    }
    this.resolvers.set(resolver.targetType, resolver)
  }

  /**
   * 获取指定目标类型的解析器
   * @param targetType - 举报目标类型
   * @returns 对应的目标解析器
   * @throws BadRequestException 当目标类型不支持时抛出异常
   */
  private getResolver(targetType: ReportTargetTypeEnum) {
    const resolver = this.resolvers.get(targetType)
    if (!resolver) {
      throw new BadRequestException('不支持的举报目标类型')
    }
    return resolver
  }

  /**
   * 创建举报
   * 执行完整的举报流程：解析目标元数据、校验举报人、拦截自举报、创建举报记录、执行后置钩子
   * @param dto - 创建举报入参
   * @param options - 可选项
   * @returns 创建的举报记录
   */
  async createReport(
    dto: CreateReportCommandDto,
    options: CreateUserReportOptions = {},
  ) {
    const {
      reporterId,
      targetType,
      targetId,
      reasonType,
      description,
      evidenceUrl,
    } = dto

    const resolver = this.getResolver(targetType)

    const report = await this.drizzle.withTransaction(async (tx: Db) => {
      await this.ensureReporterExists(reporterId)
      const targetMeta = await resolver.resolveMeta(tx, targetId)

      this.ensureCanReportOwnTarget(reporterId, targetMeta.ownerUserId)

      const created = await this.createUserReport(
        tx,
        {
          reporterId,
          targetType,
          targetId,
          sceneType: targetMeta.sceneType,
          sceneId: targetMeta.sceneId,
          commentLevel: targetMeta.commentLevel,
          reasonType,
          description,
          evidenceUrl,
          status: ReportStatusEnum.PENDING,
        },
        {
          duplicateMessage:
            options.duplicateMessage ?? this.getDuplicateMessage(targetType),
        },
      )

      if (resolver.postReportHook) {
        await resolver.postReportHook(tx, targetId, reporterId, targetMeta)
      }

      return created
    })

    return report
  }

  /**
   * 获取用户举报列表
   * @param query - 举报列表查询条件
   * @returns 分页举报记录
   */
  async getUserReports(query: QueryMyReportPageCommandDto) {
    const conditions: SQL[] = [eq(this.userReport.reporterId, query.reporterId)]

    if (query.targetType !== undefined) {
      conditions.push(eq(this.userReport.targetType, query.targetType))
    }
    if (query.targetId !== undefined) {
      conditions.push(eq(this.userReport.targetId, query.targetId))
    }
    if (query.reasonType !== undefined) {
      conditions.push(eq(this.userReport.reasonType, query.reasonType))
    }
    if (query.status !== undefined) {
      conditions.push(eq(this.userReport.status, query.status))
    }

    const page = await this.drizzle.ext.findPagination(this.userReport, {
      where: and(...conditions),
      pageIndex: query.pageIndex,
      pageSize: query.pageSize,
      orderBy: {
        createdAt: 'desc',
      },
    })

    if (page.list.length === 0) {
      return page
    }

    const [targetSummaryMap, sceneSummaryMap] = await Promise.all([
      this.interactionSummaryReadService.getReportTargetSummaryMap(page.list),
      this.interactionSummaryReadService.getSceneSummaryMap(page.list),
    ])

    return {
      ...page,
      list: page.list.map((item) => ({
        ...item,
        targetSummary:
          targetSummaryMap.get(
            this.interactionSummaryReadService.buildTargetSummaryKey(item),
          ) ?? null,
        sceneSummary:
          sceneSummaryMap.get(
            this.interactionSummaryReadService.buildSceneSummaryKey(item),
          ) ?? null,
      })),
    }
  }

  /**
   * 获取用户举报详情
   * @param reportId - 举报记录 ID
   * @param reporterId - 举报人 ID
   * @returns 举报记录详情
   */
  async getReportDetail(reportId: number, reporterId: number) {
    const [report] = await this.db
      .select()
      .from(this.userReport)
      .where(
        and(
          eq(this.userReport.id, reportId),
          eq(this.userReport.reporterId, reporterId),
        ),
      )
      .limit(1)

    if (!report) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '举报记录不存在',
      )
    }

    const [targetSummaryMap, sceneSummaryMap, commentSummaryMap] =
      await Promise.all([
        this.interactionSummaryReadService.getReportTargetSummaryMap([report], {
          detail: true,
        }),
        this.interactionSummaryReadService.getSceneSummaryMap([report]),
        this.interactionSummaryReadService.getReportCommentSummaryMap(
          report.targetType === ReportTargetTypeEnum.COMMENT
            ? [report.targetId]
            : [],
        ),
      ])

    return {
      ...report,
      targetSummary:
        targetSummaryMap.get(
          this.interactionSummaryReadService.buildTargetSummaryKey(report),
        ) ?? null,
      sceneSummary:
        sceneSummaryMap.get(
          this.interactionSummaryReadService.buildSceneSummaryKey(report),
        ) ?? null,
      commentSummary:
        report.targetType === ReportTargetTypeEnum.COMMENT
          ? (commentSummaryMap.get(report.targetId) ?? null)
          : null,
    }
  }

  /**
   * 获取管理端举报分页列表。
   * 管理端视角不再限制举报人，可按目标、原因、处理人和状态筛选。
   */
  async getAdminReportPage(query: QueryAdminReportPageDto) {
    const conditions: SQL[] = []

    if (query.id !== undefined) {
      conditions.push(eq(this.userReport.id, query.id))
    }
    if (query.reporterId !== undefined) {
      conditions.push(eq(this.userReport.reporterId, query.reporterId))
    }
    if (query.handlerId !== undefined) {
      conditions.push(
        query.handlerId === null
          ? isNull(this.userReport.handlerId)
          : eq(this.userReport.handlerId, query.handlerId),
      )
    }
    if (query.targetType !== undefined) {
      conditions.push(eq(this.userReport.targetType, query.targetType))
    }
    if (query.targetId !== undefined) {
      conditions.push(eq(this.userReport.targetId, query.targetId))
    }
    if (query.sceneType !== undefined) {
      conditions.push(eq(this.userReport.sceneType, query.sceneType))
    }
    if (query.sceneId !== undefined) {
      conditions.push(eq(this.userReport.sceneId, query.sceneId))
    }
    if (query.reasonType !== undefined) {
      conditions.push(eq(this.userReport.reasonType, query.reasonType))
    }
    if (query.status !== undefined) {
      conditions.push(eq(this.userReport.status, query.status))
    }

    const orderBy = query.orderBy?.trim()
      ? query.orderBy
      : { createdAt: 'desc' as const, id: 'desc' as const }

    const page = await this.drizzle.ext.findPagination(this.userReport, {
      where: conditions.length > 0 ? and(...conditions) : undefined,
      pageIndex: query.pageIndex,
      pageSize: query.pageSize,
      orderBy,
    })

    if (page.list.length === 0) {
      return page
    }

    const [
      reporterSummaryMap,
      handlerSummaryMap,
      targetSummaryMap,
      sceneSummaryMap,
    ] = await Promise.all([
      this.interactionSummaryReadService.getAppUserSummaryMap(
        page.list.map((item) => item.reporterId),
      ),
      this.interactionSummaryReadService.getAdminActorSummaryMap(
        page.list.map((item) => item.handlerId),
      ),
      this.interactionSummaryReadService.getReportTargetSummaryMap(page.list),
      this.interactionSummaryReadService.getSceneSummaryMap(page.list),
    ])

    return {
      ...page,
      list: page.list.map((item) => ({
        ...item,
        reporterSummary: reporterSummaryMap.get(item.reporterId) ?? null,
        handlerSummary: item.handlerId
          ? (handlerSummaryMap.get(
              this.interactionSummaryReadService.buildAdminActorSummaryKey(
                item.handlerId,
              ),
            ) ?? null)
          : null,
        targetSummary:
          targetSummaryMap.get(
            this.interactionSummaryReadService.buildTargetSummaryKey(item),
          ) ?? null,
        sceneSummary:
          sceneSummaryMap.get(
            this.interactionSummaryReadService.buildSceneSummaryKey(item),
          ) ?? null,
      })),
    }
  }

  /**
   * 获取管理端举报详情。
   * 该接口不限制举报人，用于后台处理时查看完整举报记录。
   */
  async getAdminReportDetail(reportId: number) {
    const [report] = await this.db
      .select()
      .from(this.userReport)
      .where(eq(this.userReport.id, reportId))
      .limit(1)

    if (!report) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '举报记录不存在',
      )
    }

    const [
      reporterSummaryMap,
      handlerSummaryMap,
      targetSummaryMap,
      sceneSummaryMap,
      commentSummaryMap,
    ] = await Promise.all([
      this.interactionSummaryReadService.getAppUserSummaryMap([
        report.reporterId,
      ]),
      this.interactionSummaryReadService.getAdminActorSummaryMap([
        report.handlerId,
      ]),
      this.interactionSummaryReadService.getReportTargetSummaryMap([report], {
        detail: true,
      }),
      this.interactionSummaryReadService.getSceneSummaryMap([report]),
      this.interactionSummaryReadService.getReportCommentSummaryMap(
        report.targetType === ReportTargetTypeEnum.COMMENT
          ? [report.targetId]
          : [],
      ),
    ])

    return {
      ...report,
      reporterSummary: reporterSummaryMap.get(report.reporterId) ?? null,
      handlerSummary: report.handlerId
        ? (handlerSummaryMap.get(
            this.interactionSummaryReadService.buildAdminActorSummaryKey(
              report.handlerId,
            ),
          ) ?? null)
        : null,
      targetSummary:
        targetSummaryMap.get(
          this.interactionSummaryReadService.buildTargetSummaryKey(report),
        ) ?? null,
      sceneSummary:
        sceneSummaryMap.get(
          this.interactionSummaryReadService.buildSceneSummaryKey(report),
        ) ?? null,
      commentSummary:
        report.targetType === ReportTargetTypeEnum.COMMENT
          ? (commentSummaryMap.get(report.targetId) ?? null)
          : null,
    }
  }

  /**
   * 处理举报。
   * 只允许 PENDING / PROCESSING 进入 RESOLVED / REJECTED，并在裁决后触发奖励结算。
   */
  async handleReport(input: HandleAdminReportCommandDto) {
    const current = await this.db.query.userReport.findFirst({
      where: { id: input.id },
      columns: {
        id: true,
        reporterId: true,
        targetType: true,
        targetId: true,
        status: true,
        handlingNote: true,
      },
    })

    if (!current) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '举报记录不存在',
      )
    }

    if (current.status === input.status) {
      return true
    }

    this.ensureCanHandleReportStatus(current.status, input.status)

    const handledReport = await this.drizzle.withErrorHandling(async () =>
      this.db.transaction(async (tx) => {
        const [updated] = await tx
          .update(this.userReport)
          .set({
            status: input.status,
            handlerId: input.handlerId,
            handledAt: new Date(),
            handlingNote:
              input.handlingNote?.trim() || current.handlingNote || null,
          })
          .where(
            and(
              eq(this.userReport.id, input.id),
              eq(this.userReport.status, current.status),
            ),
          )
          .returning()

        if (!updated) {
          const latest = await tx.query.userReport.findFirst({
            where: { id: input.id },
            columns: {
              status: true,
            },
          })
          if (!latest) {
            throw new BusinessException(
              BusinessErrorCode.RESOURCE_NOT_FOUND,
              '举报记录不存在',
            )
          }
          if (latest.status === input.status) {
            return null
          }
          this.ensureCanHandleReportStatus(latest.status, input.status)
          throw new BusinessException(
            BusinessErrorCode.STATE_CONFLICT,
            '举报状态已变化，请刷新后重试',
          )
        }

        return updated
      }),
    )

    if (!handledReport) {
      return true
    }

    const handledReportEvent = this.buildHandledReportEventEnvelope({
      reportId: handledReport.id,
      reporterId: handledReport.reporterId,
      handlerId: handledReport.handlerId,
      status: handledReport.status,
      targetType: handledReport.targetType as ReportTargetTypeEnum,
      targetId: handledReport.targetId,
      occurredAt: handledReport.handledAt ?? undefined,
    })

    await this.reportGrowthService.rewardReportHandled({
      eventEnvelope: handledReportEvent,
    })

    return true
  }

  /**
   * 真正执行举报落库
   * 该方法只负责写库，不再承担目标校验职责
   * @param tx - 事务客户端
   * @param dto - 创建举报记录的完整数据
   * @param options - 可选项
   * @returns 创建的举报记录
   */
  private async createUserReport(
    tx: Db,
    dto: CreateUserReportPayload,
    options: CreateUserReportOptions = {},
  ) {
    const { status, ...otherDto } = dto
    const rows = await this.drizzle.withErrorHandling(
      () =>
        tx
          .insert(this.userReport)
          .values({
            ...otherDto,
            status: status ?? ReportStatusEnum.PENDING,
          })
          .returning(),
      {
        duplicate:
          options.duplicateMessage ?? '您已经举报过该内容，请勿重复举报',
      },
    )
    return rows[0]
  }

  /**
   * 校验举报人是否存在
   * @param reporterId - 举报人ID
   * @throws BadRequestException 当举报人不存在时抛出异常
   */
  private async ensureReporterExists(reporterId: number) {
    const existed = await this.drizzle.ext.existsActive(
      this.drizzle.schema.appUser,
      eq(this.drizzle.schema.appUser.id, reporterId),
    )
    if (!existed) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '举报人不存在',
      )
    }
  }

  /**
   * 拦截举报自己内容的请求
   * @param reporterId - 举报人ID
   * @param ownerUserId - 目标所有者ID
   * @throws BadRequestException 当举报自己的内容时抛出异常
   */
  private ensureCanReportOwnTarget(reporterId: number, ownerUserId?: number) {
    if (ownerUserId && ownerUserId === reporterId) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '不能举报自己',
      )
    }
  }

  /**
   * 根据目标类型生成更明确的重复举报提示
   * @param targetType - 目标类型
   * @returns 重复举报提示信息
   */
  private getDuplicateMessage(targetType: ReportTargetTypeEnum) {
    switch (targetType) {
      case ReportTargetTypeEnum.COMIC:
      case ReportTargetTypeEnum.NOVEL:
        return '您已经举报过该作品，请勿重复举报'
      case ReportTargetTypeEnum.COMIC_CHAPTER:
      case ReportTargetTypeEnum.NOVEL_CHAPTER:
        return '您已经举报过该章节，请勿重复举报'
      case ReportTargetTypeEnum.FORUM_TOPIC:
        return '您已经举报过该主题，请勿重复举报'
      case ReportTargetTypeEnum.COMMENT:
        return '您已经举报过该评论，请勿重复举报'
      case ReportTargetTypeEnum.USER:
        return '您已经举报过该用户，请勿重复举报'
      default:
        return '您已经举报过该内容，请勿重复举报'
    }
  }

  /**
   * 校验举报处理状态流转。
   * 只允许待处理中的举报进入最终裁决态，避免已处理记录被错误回滚或重复裁决。
   */
  private ensureCanHandleReportStatus(
    currentStatus: ReportStatusEnum,
    nextStatus: ReportStatusEnum,
  ) {
    if (
      nextStatus !== ReportStatusEnum.RESOLVED &&
      nextStatus !== ReportStatusEnum.REJECTED
    ) {
      throw new BadRequestException('举报处理结果只允许为已解决或已驳回')
    }

    if (
      currentStatus !== ReportStatusEnum.PENDING &&
      currentStatus !== ReportStatusEnum.PROCESSING
    ) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '已处理举报不能重复裁决',
      )
    }
  }
}
