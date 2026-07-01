import type { Db } from '@db/core'
import type {
  UserReportDispositionAttemptSelect,
} from '@db/schema'
import type { SQL } from 'drizzle-orm'
import type { IReportTargetResolver } from './interfaces/report-target-resolver.type'
import type {
  CreateUserReportOptions,
  CreateUserReportPayload,
  ReportDispositionComparison,
  ReportDispositionTxResult,
  ReportTargetKeyFields,
  ReportTargetTypeRef,
  UserReportWithDispositionEvents,
} from './report.type'
import { DrizzleService, toPageResult } from '@db/core'
import { createDefinedEventEnvelope } from '@libs/growth/event-definition/event-envelope.helper'
import { EventEnvelopeGovernanceStatusEnum } from '@libs/growth/event-definition/event-envelope.type'
import { GrowthRuleTypeEnum } from '@libs/growth/growth-rule.constant'
import { InteractionSummaryReadService } from '@libs/interaction/summary/interaction-summary-read.service'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { buildDateOnlyRangeInAppTimeZone } from '@libs/platform/utils'
import { Injectable } from '@nestjs/common'
import { and, desc, eq, exists, gte, inArray, isNull, lt } from 'drizzle-orm'
import {
  CreateReportCommandDto,
  HandleAdminReportCommandDto,
  QueryAdminReportPageDto,
  QueryMyReportPageCommandDto,
} from './dto/report.dto'
import { ReportGrowthService } from './report-growth.service'
import {
  ReportDispositionActionEnum,
  ReportDispositionAttemptStatusEnum,
  ReportDispositionStatusEnum,
  ReportDispositionStatusFilterEnum,
  ReportStatusEnum,
  ReportTargetTypeEnum,
} from './report.constant'

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

  private get userReportDispositionAttempt() {
    return this.drizzle.schema.userReportDispositionAttempt
  }

  // 构建举报裁决事件 envelope。 统一表达举报正式成立后的 code / target / operator / governanceStatus 语义。
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

  // 注册目标解析器 供其他模块在应用启动时注册自己的举报解析器
  registerResolver(resolver: IReportTargetResolver) {
    if (this.resolvers.has(resolver.targetType)) {
      console.warn(
        `Report resolver for type ${resolver.targetType} is being overwritten.`,
      )
    }
    this.resolvers.set(resolver.targetType, resolver)
  }

  // 获取指定目标类型的解析器
  private getResolver(targetType: ReportTargetTypeEnum) {
    const resolver = this.resolvers.get(targetType)
    if (!resolver) {
      throw new BusinessException(BusinessErrorCode.OPERATION_NOT_ALLOWED, '不支持的举报目标类型')
    }
    return resolver
  }

  // 创建举报 执行完整的举报流程：解析目标元数据、校验举报人、拦截自举报、创建举报记录、执行后置钩子
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

  // 获取用户举报列表
  async getUserReports(query: QueryMyReportPageCommandDto) {
    const conditions: SQL[] = [eq(this.userReport.reporterId, query.reporterId)]
    const pageParams = this.drizzle.buildPageParams(query, {
      table: this.userReport,
      fallbackOrderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })

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
    if (pageParams.dateRange?.gte) {
      conditions.push(gte(this.userReport.createdAt, pageParams.dateRange.gte))
    }
    if (pageParams.dateRange?.lt) {
      conditions.push(lt(this.userReport.createdAt, pageParams.dateRange.lt))
    }

    const where = and(...conditions)
    const [rows, total] = await Promise.all([
      this.db
        .select()
        .from(this.userReport)
        .where(where)
        .orderBy(...pageParams.order.orderBySql)
        .limit(pageParams.page.limit)
        .offset(pageParams.page.offset),
      this.db.$count(this.userReport, where),
    ])
    const page = toPageResult(rows, total, pageParams.page)

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

  // 获取用户举报详情
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

  // 获取管理端举报分页列表。 管理端视角不再限制举报人，可按目标、原因、处理人和状态筛选。
  async getAdminReportPage(query: QueryAdminReportPageDto) {
    const conditions: SQL[] = []
    const createdRange = buildDateOnlyRangeInAppTimeZone(
      query.startDate,
      query.endDate,
    )

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
    if (query.targetActionStatus !== undefined) {
      conditions.push(
        eq(this.userReport.targetActionStatus, query.targetActionStatus),
      )
    }
    if (query.dispositionStatus !== undefined) {
      if (
        query.dispositionStatus === ReportDispositionStatusFilterEnum.FAILED
      ) {
        conditions.push(
          exists(
            this.db
              .select({ id: this.userReportDispositionAttempt.id })
              .from(this.userReportDispositionAttempt)
              .where(
                and(
                  eq(
                    this.userReportDispositionAttempt.reportId,
                    this.userReport.id,
                  ),
                  eq(
                    this.userReportDispositionAttempt.attemptStatus,
                    ReportDispositionAttemptStatusEnum.FAILED,
                  ),
                  isNull(this.userReportDispositionAttempt.resolvedAt),
                ),
              ),
          ),
        )
      } else {
        conditions.push(
          eq(this.userReport.targetActionStatus, query.dispositionStatus),
        )
      }
    }
    if (createdRange?.gte) {
      conditions.push(gte(this.userReport.createdAt, createdRange.gte))
    }
    if (createdRange?.lt) {
      conditions.push(lt(this.userReport.createdAt, createdRange.lt))
    }

    const orderBy = query.orderBy?.trim()
      ? query.orderBy
      : { createdAt: 'desc' as const, id: 'desc' as const }

    const where = conditions.length > 0 ? and(...conditions) : undefined
    const pageQuery = this.drizzle.buildPage(query)
    const orderQuery = this.drizzle.buildOrderBy(orderBy, {
      table: this.userReport,
    })
    const [list, total] = await Promise.all([
      this.db
        .select()
        .from(this.userReport)
        .where(where)
        .orderBy(...orderQuery.orderBySql)
        .limit(pageQuery.limit)
        .offset(pageQuery.offset),
      this.db.$count(this.userReport, where),
    ])
    const page = toPageResult(list, total, pageQuery)

    if (page.list.length === 0) {
      return page
    }

    const [
      reporterSummaryMap,
      handlerSummaryMap,
      targetSummaryMap,
      sceneSummaryMap,
      latestFailedAttemptMap,
    ] = await Promise.all([
      this.interactionSummaryReadService.getAppUserSummaryMap(
        page.list.map((item) => item.reporterId),
      ),
      this.interactionSummaryReadService.getAdminActorSummaryMap(
        page.list.map((item) => item.handlerId),
      ),
      this.interactionSummaryReadService.getReportTargetSummaryMap(page.list),
      this.interactionSummaryReadService.getSceneSummaryMap(page.list),
      this.getLatestFailedDispositionAttemptMap(
        page.list.map((item) => item.id),
      ),
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
        latestFailedDispositionAttempt:
          latestFailedAttemptMap.get(item.id) ?? null,
      })),
    }
  }

  // 获取管理端举报详情。 该接口不限制举报人，用于后台处理时查看完整举报记录。
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
      latestFailedAttemptMap,
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
      this.getLatestFailedDispositionAttemptMap([report.id]),
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
      latestFailedDispositionAttempt:
        latestFailedAttemptMap.get(report.id) ?? null,
    }
  }

  // 处理举报。 只允许 PENDING / PROCESSING 进入 RESOLVED / REJECTED，并在裁决后触发奖励结算。
  async handleReport(input: HandleAdminReportCommandDto) {
    this.ensureHandleContract(input)

    const current = await this.db.query.userReport.findFirst({
      where: { id: input.id },
      columns: {
        id: true,
        reporterId: true,
        targetType: true,
        targetId: true,
        status: true,
        handlingNote: true,
        targetAction: true,
        targetActionReason: true,
        targetActionStatus: true,
        targetActionResult: true,
        targetActionAppliedAt: true,
      },
    })

    if (!current) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '举报记录不存在',
      )
    }

    if (this.isSameFinalDisposition(current, input)) {
      return true
    }

    this.ensureCanHandleReportStatus(current.status, input.status)
    this.ensureTargetActionMatchesReport(current, input)

    let handledReport: UserReportWithDispositionEvents | null = null

    try {
      handledReport = await this.drizzle.withErrorHandling(async () =>
        this.db.transaction(async (tx) => {
          const latest = await tx.query.userReport.findFirst({
            where: { id: input.id },
            columns: {
              id: true,
              reporterId: true,
              targetType: true,
              targetId: true,
              status: true,
              handlingNote: true,
              targetAction: true,
              targetActionReason: true,
              targetActionStatus: true,
              targetActionResult: true,
              targetActionAppliedAt: true,
            },
          })

          if (!latest) {
            throw new BusinessException(
              BusinessErrorCode.RESOURCE_NOT_FOUND,
              '举报记录不存在',
            )
          }

          if (this.isSameFinalDisposition(latest, input)) {
            return null
          }

          this.ensureCanHandleReportStatus(latest.status, input.status)
          this.ensureTargetActionMatchesReport(latest, input)

          const disposition = await this.applyTargetDispositionInTx(
            tx,
            latest,
            input,
          )
          const now = new Date()
          const targetActionStatus = this.resolveTargetActionStatus(input)
          const targetActionResult =
            disposition?.result ??
            ({
              applied: false,
              message:
                targetActionStatus === ReportDispositionStatusEnum.NOT_REQUIRED
                  ? '无需目标处置'
                  : '目标处置已完成',
            } satisfies Record<string, unknown>)

          const [updated] = await tx
            .update(this.userReport)
            .set({
              status: input.status,
              handlerId: input.handlerId,
              handledAt: now,
              handlingNote:
                input.handlingNote?.trim() || latest.handlingNote || null,
              targetAction: input.targetAction,
              targetActionReason: input.targetActionReason?.trim() || null,
              targetActionStatus,
              targetActionResult,
              targetActionAppliedAt:
                targetActionStatus === ReportDispositionStatusEnum.APPLIED
                  ? now
                  : null,
            })
            .where(
              and(
                eq(this.userReport.id, input.id),
                eq(this.userReport.status, latest.status),
              ),
            )
            .returning()

          if (!updated) {
            throw new BusinessException(
              BusinessErrorCode.STATE_CONFLICT,
              '举报状态已变化，请刷新后重试',
            )
          }

          await this.markFailedAttemptsRetrySucceededInTx(tx, input.id, now)

          return {
            ...updated,
            dispositionEvents: disposition?.events ?? [],
          }
        }),
      )
    } catch (error) {
      if (this.shouldRecordDispositionAttempt(input, current)) {
        await this.recordFailedDispositionAttempt(input, error)
      }
      throw error
    }

    if (!handledReport) {
      return true
    }

    const handledReportEvent = this.buildHandledReportEventEnvelope({
      reportId: handledReport.id,
      reporterId: handledReport.reporterId,
      handlerId: handledReport.handlerId,
      status: handledReport.status,
      targetType: handledReport.targetType,
      targetId: handledReport.targetId,
      occurredAt: handledReport.handledAt ?? undefined,
    })

    await this.reportGrowthService.rewardReportHandled({
      eventEnvelope: handledReportEvent,
    })

    const resolver = this.getResolver(
      handledReport.targetType,
    )
    if (resolver.postDispositionCommit) {
      for (const event of handledReport.dispositionEvents ?? []) {
        await resolver.postDispositionCommit(event)
      }
    }

    return true
  }

  private async getLatestFailedDispositionAttemptMap(reportIds: number[]) {
    const uniqueReportIds = [...new Set(reportIds)]
    if (uniqueReportIds.length === 0) {
      return new Map<number, UserReportDispositionAttemptSelect>()
    }

    const attempts = await this.db
      .select()
      .from(this.userReportDispositionAttempt)
      .where(
        and(
          inArray(this.userReportDispositionAttempt.reportId, uniqueReportIds),
          eq(
            this.userReportDispositionAttempt.attemptStatus,
            ReportDispositionAttemptStatusEnum.FAILED,
          ),
          isNull(this.userReportDispositionAttempt.resolvedAt),
        ),
      )
      .orderBy(
        this.userReportDispositionAttempt.reportId,
        desc(this.userReportDispositionAttempt.createdAt),
        desc(this.userReportDispositionAttempt.id),
      )

    const map = new Map<number, UserReportDispositionAttemptSelect>()
    for (const attempt of attempts) {
      if (!map.has(attempt.reportId)) {
        map.set(attempt.reportId, attempt)
      }
    }
    return map
  }

  private ensureHandleContract(input: HandleAdminReportCommandDto) {
    if (input.targetAction === undefined || input.targetAction === null) {
      throw new BusinessException(BusinessErrorCode.OPERATION_NOT_ALLOWED, '必须选择目标处置动作')
    }
    if (input.handlerId === undefined || input.handlerId === null) {
      throw new BusinessException(BusinessErrorCode.OPERATION_NOT_ALLOWED, '缺少处理人')
    }

    if (
      input.status === ReportStatusEnum.REJECTED &&
      input.targetAction !== ReportDispositionActionEnum.NO_ACTION_REQUIRED
    ) {
      throw new BusinessException(BusinessErrorCode.STATE_CONFLICT, '驳回举报时不能处置目标')
    }

    const reason = input.targetActionReason?.trim()
    if (
      input.status === ReportStatusEnum.RESOLVED &&
      input.targetAction === ReportDispositionActionEnum.NO_ACTION_REQUIRED &&
      !reason
    ) {
      throw new BusinessException(BusinessErrorCode.OPERATION_NOT_ALLOWED, '有效举报无需处置时必须填写原因')
    }

    if (
      input.targetAction !== ReportDispositionActionEnum.NO_ACTION_REQUIRED &&
      !reason
    ) {
      throw new BusinessException(BusinessErrorCode.OPERATION_NOT_ALLOWED, '目标处置原因不能为空')
    }
  }

  private isSameFinalDisposition(
    report: ReportDispositionComparison,
    input: HandleAdminReportCommandDto,
  ) {
    if (report.status !== input.status) {
      return false
    }

    if (report.targetAction !== input.targetAction) {
      return false
    }

    const expectedStatus = this.resolveTargetActionStatus(input)
    if (report.targetActionStatus !== expectedStatus) {
      return false
    }

    return (
      (report.targetActionReason ?? null) ===
      (input.targetActionReason?.trim() || null)
    )
  }

  private ensureTargetActionMatchesReport(
    report: ReportTargetTypeRef,
    input: HandleAdminReportCommandDto,
  ) {
    if (input.targetAction === ReportDispositionActionEnum.NO_ACTION_REQUIRED) {
      return
    }

    if (report.targetType === ReportTargetTypeEnum.COMMENT) {
      if (
        input.targetAction === ReportDispositionActionEnum.HIDE_COMMENT ||
        input.targetAction === ReportDispositionActionEnum.REJECT_COMMENT
      ) {
        return
      }
      throw new BusinessException(BusinessErrorCode.OPERATION_NOT_ALLOWED, '评论举报不支持该目标处置动作')
    }

    throw new BusinessException(BusinessErrorCode.OPERATION_NOT_ALLOWED, '该举报目标类型暂不支持目标写入处置')
  }

  private resolveTargetActionStatus(input: HandleAdminReportCommandDto) {
    return input.targetAction === ReportDispositionActionEnum.NO_ACTION_REQUIRED
      ? ReportDispositionStatusEnum.NOT_REQUIRED
      : ReportDispositionStatusEnum.APPLIED
  }

  private async applyTargetDispositionInTx(
    tx: Db,
    report: ReportTargetKeyFields,
    input: HandleAdminReportCommandDto,
  ): Promise<ReportDispositionTxResult | null> {
    if (input.targetAction === ReportDispositionActionEnum.NO_ACTION_REQUIRED) {
      return null
    }

    const resolver = this.getResolver(report.targetType)
    if (!resolver.applyDisposition) {
      throw new BusinessException(BusinessErrorCode.OPERATION_NOT_ALLOWED, '该举报目标类型暂不支持目标写入处置')
    }

    const disposition = await resolver.applyDisposition(tx, {
      reportId: report.id,
      targetId: report.targetId,
      action: input.targetAction,
      reason: input.targetActionReason?.trim() || null,
      actorUserId: input.handlerId!,
    })

    return {
      result: {
        applied: disposition.applied,
        statusBefore: disposition.statusBefore ?? null,
        statusAfter: disposition.statusAfter ?? null,
        message: disposition.message,
      },
      events: [disposition],
    }
  }

  private async markFailedAttemptsRetrySucceededInTx(
    tx: Db,
    reportId: number,
    resolvedAt: Date,
  ) {
    await tx
      .update(this.userReportDispositionAttempt)
      .set({
        attemptStatus: ReportDispositionAttemptStatusEnum.RETRY_SUCCEEDED,
        resolvedAt,
      })
      .where(
        and(
          eq(this.userReportDispositionAttempt.reportId, reportId),
          eq(
            this.userReportDispositionAttempt.attemptStatus,
            ReportDispositionAttemptStatusEnum.FAILED,
          ),
          isNull(this.userReportDispositionAttempt.resolvedAt),
        ),
      )
  }

  private shouldRecordDispositionAttempt(
    input: HandleAdminReportCommandDto,
    report: ReportTargetTypeRef,
  ) {
    if (input.targetAction === ReportDispositionActionEnum.NO_ACTION_REQUIRED) {
      return false
    }
    try {
      this.ensureTargetActionMatchesReport(report, input)
      return true
    } catch {
      return false
    }
  }

  private async recordFailedDispositionAttempt(
    input: HandleAdminReportCommandDto,
    error: unknown,
  ) {
    const failureMessage =
      error instanceof Error ? error.message : '目标处置执行失败'
    const failureCode =
      error instanceof BusinessException
        ? String(error.code)
        : error instanceof Error
          ? error.name
          : 'OWNER_DISPOSITION_FAILED'

    await this.drizzle.withErrorHandling(() =>
      this.db.insert(this.userReportDispositionAttempt).values({
        reportId: input.id,
        targetAction: input.targetAction,
        attemptStatus: ReportDispositionAttemptStatusEnum.FAILED,
        failureCode,
        failureMessage: failureMessage.slice(0, 500),
        retryable: true,
        actorUserId: input.handlerId!,
        attemptedAt: new Date(),
        result: {
          message: failureMessage,
        },
      }),
    )
  }

  // 真正执行举报落库 该方法只负责写库，不再承担目标校验职责
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

  // 校验举报人是否存在
  private async ensureReporterExists(reporterId: number) {
    const [reporter] = await this.db
      .select({ id: this.drizzle.schema.appUser.id })
      .from(this.drizzle.schema.appUser)
      .where(
        and(
          eq(this.drizzle.schema.appUser.id, reporterId),
          isNull(this.drizzle.schema.appUser.deletedAt),
        ),
      )
      .limit(1)
    if (!reporter) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '举报人不存在',
      )
    }
  }

  // 拦截举报自己内容的请求
  private ensureCanReportOwnTarget(reporterId: number, ownerUserId?: number) {
    if (ownerUserId && ownerUserId === reporterId) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '不能举报自己',
      )
    }
  }

  // 根据目标类型生成更明确的重复举报提示
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

  // 校验举报处理状态流转。 只允许待处理中的举报进入最终裁决态，避免已处理记录被错误回滚或重复裁决。
  private ensureCanHandleReportStatus(
    currentStatus: ReportStatusEnum,
    nextStatus: ReportStatusEnum,
  ) {
    if (
      nextStatus !== ReportStatusEnum.RESOLVED &&
      nextStatus !== ReportStatusEnum.REJECTED
    ) {
      throw new BusinessException(BusinessErrorCode.OPERATION_NOT_ALLOWED, '举报处理结果只允许为已解决或已驳回')
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
