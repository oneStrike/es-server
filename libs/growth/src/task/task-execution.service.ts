import type { Db } from '@db/core'
import type {
  TaskDefinitionSelect,
  TaskInstanceSelect,
  TaskStepSelect,
} from '@db/schema'
import type { TaskRewardSettlementResult } from '@libs/growth/growth-reward/types/growth-reward-result.type'
import type { SQL } from 'drizzle-orm'
import type { GrowthRewardItem } from '../reward-rule/reward-item.type'
import type { TaskRewardSettlementSummaryDto } from './dto/task-view.dto'
import type {
  TaskCycleDateParts,
  TaskEventLogWriteInput,
  TaskEventProgressInput,
  TaskEventProgressResult,
  TaskInstanceEventApplyParams,
  TaskInstanceEventApplyResult,
  TaskInstanceProgressApplyInput,
  TaskInstanceProgressApplyResult,
  TaskInstanceResolveResult,
  TaskInstanceStepResolveResult,
  TaskInstanceStepViewRecord,
  TaskLatestEventSummaryRecord,
  TaskProgressUpdateRawRow,
  TaskReconciliationInstanceRecord,
  TaskReminderSnapshotPayload,
  TaskRewardGrantedPublishInput,
  TaskRewardSettlementBizKeyInput,
  TaskRewardSettlementInput,
  TaskRewardSettlementLinkInput,
  TaskRewardSettlementUpdateResult,
  TaskUniqueDimensionResolvedValue,
  TaskUniqueFactInsertInput,
  TaskUniqueFactSummaryRecord,
} from './types/task.type'
import { randomUUID } from 'node:crypto'
import { DrizzleService, extractRows } from '@db/core'
import {
  encodeGrowthCursor,
  parseGrowthCursor,
  rejectOffsetPaginationFields,
  toCursorPage,
} from '@libs/growth/growth/cursor-page.util'
import { EventDefinitionConsumerEnum } from '@libs/growth/event-definition/event-definition.constant'
import {
  canConsumeEventEnvelopeByConsumer,
  createEventEnvelope,
  EventEnvelopeGovernanceStatusEnum,
} from '@libs/growth/event-definition/event-envelope.type'
import {
  GrowthRewardSettlementStatusEnum,
  GrowthRewardSettlementTypeEnum,
} from '@libs/growth/growth-reward/growth-reward.constant'
import { UserGrowthRewardService } from '@libs/growth/growth-reward/growth-reward.service'
import { MessageDomainEventPublisher } from '@libs/message/eventing/message-domain-event.publisher'
import { BusinessErrorCode } from '@libs/platform/constant'
import { IdDto } from '@libs/platform/dto/base.dto'
import { BusinessException } from '@libs/platform/exceptions'
import {
  buildDateOnlyRangeInAppTimeZone,
  getAppTimeZone,
} from '@libs/platform/utils'
import { Injectable } from '@nestjs/common'
import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import { and, desc, eq, gte, inArray, isNull, lt, or, sql } from 'drizzle-orm'
import {
  QueryAvailableTaskPageDto,
  QueryMyTaskPageDto,
  QueryTaskInstancePageDto,
  QueryTaskReconciliationPageDto,
  TaskProgressDto,
} from './dto/task-query.dto'
import {
  RetryTaskRewardBatchDto,
  TaskRewardRetryBatchResultDto,
  TaskRewardRetryFailureDto,
  TaskRewardRetryResultDto,
} from './dto/task-reward-retry.dto'
import { TaskEventTemplateRegistry } from './task-event-template.registry'
import { TaskNotificationService } from './task-notification.service'
import {
  TASK_COMPLETE_EVENT_CODE,
  TASK_COMPLETE_EVENT_KEY,
  TaskClaimModeEnum,
  TaskDefinitionStatusEnum,
  TaskEventActionTypeEnum,
  TaskEventProgressSourceEnum,
  TaskInstanceStatusEnum,
  TaskRepeatCycleEnum,
  TaskStepDedupeScopeEnum,
  TaskStepTriggerModeEnum,
} from './task.constant'
import { TaskServiceSupport } from './task.service.support'

dayjs.extend(utc)
dayjs.extend(timezone)

const TASK_REWARD_SETTLEMENT_CLAIM_LEASE_MS = 10 * 60 * 1000

/**
 * 新任务模型中的执行服务。
 *
 * 统一承接新 task 模型的 manual / event 执行链路、奖励挂接与对账读模型。
 */
@Injectable()
export class TaskExecutionService extends TaskServiceSupport {
  // 注入任务执行链路所需的模板注册表、奖励服务与数据库能力。
  constructor(
    drizzle: DrizzleService,
    private readonly taskEventTemplateRegistry: TaskEventTemplateRegistry,
    private readonly userGrowthRewardService: UserGrowthRewardService,
    private readonly messageDomainEventPublisher: MessageDomainEventPublisher,
    private readonly taskNotificationService: TaskNotificationService,
  ) {
    super(drizzle)
  }

  // 分页查询可领取任务。
  async getAvailableTasks(queryDto: QueryAvailableTaskPageDto, userId: number) {
    rejectOffsetPaginationFields(queryDto, '可领取任务列表')
    const now = new Date()
    const page = this.drizzle.buildPage({ pageSize: queryDto.pageSize })
    const cursor = this.parseAvailableTaskCursor(queryDto.cursor)
    const availableTaskIds = await this.getAvailableTaskDefinitionIds(
      queryDto,
      userId,
      now,
      page.limit + 1,
      cursor,
    )
    const rows = await this.getTaskDefinitionsByOrderedIds(availableTaskIds)
    const cursorPage = toCursorPage(rows, page.limit, (task) =>
      this.encodeAvailableTaskCursor(task),
    )
    const stepSummaryMap = await this.getTaskStepSummaryMap(
      cursorPage.list.map((item) => item.id),
    )

    return {
      ...cursorPage,
      list: cursorPage.list.map((task) =>
        this.toAppAvailableTaskItem(task, stepSummaryMap.get(task.id) ?? []),
      ),
    }
  }

  // 分页查询我的任务。
  async getMyTasks(queryDto: QueryMyTaskPageDto, userId: number) {
    rejectOffsetPaginationFields(queryDto, '我的任务列表')
    const page = this.drizzle.buildPage({ pageSize: queryDto.pageSize })
    const cursor = this.parseMyTaskCursor(queryDto.cursor)
    const where = and(
      eq(this.taskInstanceTable.userId, userId),
      isNull(this.taskInstanceTable.deletedAt),
      queryDto.status !== undefined
        ? eq(this.taskInstanceTable.status, queryDto.status)
        : undefined,
    )

    const rows = await this.db
      .select({
        instance: this.taskInstanceTable,
        task: this.taskDefinitionTable,
        rewardSettlement: this.growthRewardSettlementTable,
      })
      .from(this.taskInstanceTable)
      .leftJoin(
        this.taskDefinitionTable,
        eq(this.taskInstanceTable.taskId, this.taskDefinitionTable.id),
      )
      .leftJoin(
        this.growthRewardSettlementTable,
        eq(
          this.taskInstanceTable.rewardSettlementId,
          this.growthRewardSettlementTable.id,
        ),
      )
      .where(
        and(
          where,
          queryDto.sceneType !== undefined
            ? eq(this.taskDefinitionTable.sceneType, queryDto.sceneType)
            : undefined,
          cursor
            ? or(
                lt(this.taskInstanceTable.updatedAt, cursor.updatedAt),
                and(
                  eq(this.taskInstanceTable.updatedAt, cursor.updatedAt),
                  lt(this.taskInstanceTable.id, cursor.id),
                ),
              )
            : undefined,
        ),
      )
      .orderBy(
        desc(this.taskInstanceTable.updatedAt),
        desc(this.taskInstanceTable.id),
      )
      .limit(page.limit + 1)
    const cursorPage = toCursorPage(rows, page.limit, (item) =>
      this.encodeMyTaskCursor(item.instance),
    )

    const taskIds = cursorPage.list
      .map((item) => item.task?.id)
      .filter((id): id is number => typeof id === 'number')
    const instanceIds = cursorPage.list.map((item) => item.instance.id)
    const [stepSummaryMap, instanceStepMap] = await Promise.all([
      this.getTaskStepSummaryMap(taskIds),
      this.getTaskInstanceStepViewMap(instanceIds),
    ])

    return {
      ...cursorPage,
      list: cursorPage.list.map((item) => ({
        id: item.instance.id,
        taskId: item.instance.taskId,
        cycleKey: item.instance.cycleKey,
        visibleStatus: this.resolveTaskVisibleStatus({
          status: item.instance.status,
          rewardApplicable: item.instance.rewardApplicable,
          rewardSettlementStatus: item.rewardSettlement?.settlementStatus,
        }),
        rewardApplicable: item.instance.rewardApplicable,
        rewardSettlementId: item.instance.rewardSettlementId ?? null,
        claimedAt: item.instance.claimedAt ?? null,
        completedAt: item.instance.completedAt ?? null,
        expiredAt: item.instance.expiredAt ?? null,
        steps: instanceStepMap.get(item.instance.id) ?? [],
        task: item.task
          ? this.toAppAvailableTaskItem(
              item.task,
              stepSummaryMap.get(item.task.id) ?? [],
            )
          : null,
        rewardSettlement: this.toTaskRewardSettlementSummary(
          item.rewardSettlement,
        ),
      })),
    }
  }

  // 获取用户中心任务摘要。
  async getUserTaskSummary(userId: number) {
    const [claimableCount, rows] = await Promise.all([
      this.countAvailableTaskDefinitions({}, userId, new Date()),
      this.db
        .select({
          status: this.taskInstanceTable.status,
          rewardApplicable: this.taskInstanceTable.rewardApplicable,
          settlementStatus: this.growthRewardSettlementTable.settlementStatus,
          count: sql<number>`count(*)::int`,
        })
        .from(this.taskInstanceTable)
        .leftJoin(
          this.growthRewardSettlementTable,
          eq(
            this.taskInstanceTable.rewardSettlementId,
            this.growthRewardSettlementTable.id,
          ),
        )
        .where(
          and(
            eq(this.taskInstanceTable.userId, userId),
            isNull(this.taskInstanceTable.deletedAt),
          ),
        )
        .groupBy(
          this.taskInstanceTable.status,
          this.taskInstanceTable.rewardApplicable,
          this.growthRewardSettlementTable.settlementStatus,
        ),
    ])

    return {
      claimableCount,
      claimedCount: this.sumTaskInstanceSummaryCount(
        rows,
        (item) => item.status === TaskInstanceStatusEnum.PENDING,
      ),
      inProgressCount: this.sumTaskInstanceSummaryCount(
        rows,
        (item) => item.status === TaskInstanceStatusEnum.IN_PROGRESS,
      ),
      rewardPendingCount: this.sumTaskInstanceSummaryCount(
        rows,
        (item) =>
          item.status === TaskInstanceStatusEnum.COMPLETED &&
          item.rewardApplicable === 1 &&
          item.settlementStatus !== GrowthRewardSettlementStatusEnum.SUCCESS,
      ),
    }
  }

  // 领取一条手动任务。
  async claimTask(dto: IdDto, userId: number) {
    const now = new Date()
    const task = await this.getAvailableTaskDefinitionOrThrow(dto.id)
    const step = await this.getSingleTaskStepOrThrow(task.id)
    this.ensureManualTaskActionAllowed(task, step)
    const cycleKey = this.buildTaskCycleKey(task, now)

    await this.drizzle.withTransaction(async (tx) => {
      const existingInstance = await this.findTaskInstance(
        tx,
        task.id,
        userId,
        cycleKey,
      )
      if (existingInstance) {
        throw new BusinessException(
          BusinessErrorCode.OPERATION_NOT_ALLOWED,
          '任务已领取',
        )
      }

      const resolved = await this.createOrGetTaskInstance(
        tx,
        task,
        userId,
        cycleKey,
        now,
      )
      await this.createOrGetTaskInstanceStep(tx, resolved.instance.id, step)
      await this.writeTaskEventLog(tx, {
        taskId: task.id,
        instanceId: resolved.instance.id,
        userId,
        actionType: TaskEventActionTypeEnum.CLAIM,
        progressSource: TaskEventProgressSourceEnum.MANUAL,
        accepted: true,
        delta: 0,
        beforeValue: 0,
        afterValue: 0,
        occurredAt: now,
      })
    })

    return true
  }

  // 手动推进单步骤任务。
  async reportProgress(dto: TaskProgressDto, userId: number) {
    if (!Number.isInteger(dto.delta) || dto.delta <= 0) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '进度增量必须是大于 0 的整数',
      )
    }

    const now = new Date()
    const task = await this.getAvailableTaskDefinitionOrThrow(dto.id)
    const step = await this.getSingleTaskStepOrThrow(task.id)
    this.ensureManualTaskActionAllowed(task, step)
    const cycleKey = this.buildTaskCycleKey(task, now)
    const result = await this.drizzle.withTransaction(async (tx) => {
      const instance = await this.findTaskInstance(
        tx,
        task.id,
        userId,
        cycleKey,
      )
      if (!instance) {
        throw new BusinessException(
          BusinessErrorCode.OPERATION_NOT_ALLOWED,
          '任务未领取',
        )
      }
      this.ensureManualTaskInstanceUsable(instance)

      const { instanceStep } = await this.createOrGetTaskInstanceStep(
        tx,
        instance.id,
        step,
      )
      const progress = await this.applyTaskInstanceProgressInTx({
        runner: tx,
        instance,
        instanceStep,
        delta: dto.delta,
        occurredAt: now,
      })

      await this.writeTaskEventLog(tx, {
        taskId: task.id,
        stepId: step.id,
        instanceId: progress.instanceId,
        instanceStepId: progress.instanceStepId,
        userId,
        actionType:
          progress.status === TaskInstanceStatusEnum.COMPLETED
            ? TaskEventActionTypeEnum.COMPLETE
            : TaskEventActionTypeEnum.PROGRESS,
        progressSource: TaskEventProgressSourceEnum.MANUAL,
        accepted: true,
        delta: progress.appliedDelta,
        beforeValue: progress.beforeValue,
        afterValue: progress.afterValue,
        occurredAt: now,
      })

      return {
        instanceId: instance.id,
        completed: progress.completed,
        rewardItems: this.resolveTaskRewardItems(
          instance.snapshotPayload,
          task.rewardItems,
        ),
      }
    })

    if (result.completed && this.hasRewardItems(result.rewardItems)) {
      await this.settleTaskInstanceReward({
        taskId: task.id,
        instanceId: result.instanceId,
        userId,
        rewardItems: result.rewardItems,
        occurredAt: now,
      })
    }

    return true
  }

  // 显式完成一条手动任务。
  async completeTask(dto: IdDto, userId: number) {
    const now = new Date()
    const task = await this.getAvailableTaskDefinitionOrThrow(dto.id)
    const step = await this.getSingleTaskStepOrThrow(task.id)
    this.ensureManualTaskActionAllowed(task, step)
    const cycleKey = this.buildTaskCycleKey(task, now)
    const result = await this.drizzle.withTransaction(async (tx) => {
      const instance = await this.findTaskInstance(
        tx,
        task.id,
        userId,
        cycleKey,
      )
      if (!instance) {
        throw new BusinessException(
          BusinessErrorCode.OPERATION_NOT_ALLOWED,
          '任务未领取',
        )
      }
      this.ensureManualTaskInstanceUsable(instance)

      const { instanceStep } = await this.createOrGetTaskInstanceStep(
        tx,
        instance.id,
        step,
      )
      const canCompleteImmediately = instanceStep.targetValue === 1

      if (
        !canCompleteImmediately &&
        instanceStep.currentValue < instanceStep.targetValue
      ) {
        throw new BusinessException(
          BusinessErrorCode.OPERATION_NOT_ALLOWED,
          '任务进度未达成',
        )
      }

      const progress = canCompleteImmediately
        ? await this.applyTaskInstanceProgressInTx({
            runner: tx,
            instance,
            instanceStep,
            delta: instanceStep.targetValue,
            occurredAt: now,
          })
        : await this.completeReadyTaskInstanceStepInTx({
            runner: tx,
            instance,
            instanceStep,
            delta: 0,
            occurredAt: now,
          })

      await this.writeTaskEventLog(tx, {
        taskId: task.id,
        stepId: step.id,
        instanceId: progress.instanceId,
        instanceStepId: progress.instanceStepId,
        userId,
        actionType: TaskEventActionTypeEnum.COMPLETE,
        progressSource: TaskEventProgressSourceEnum.MANUAL,
        accepted: true,
        delta: progress.appliedDelta,
        beforeValue: progress.beforeValue,
        afterValue: progress.afterValue,
        occurredAt: now,
      })

      return {
        instanceId: instance.id,
        rewardItems: this.resolveTaskRewardItems(
          instance.snapshotPayload,
          task.rewardItems,
        ),
      }
    })

    if (this.hasRewardItems(result.rewardItems)) {
      await this.settleTaskInstanceReward({
        taskId: task.id,
        instanceId: result.instanceId,
        userId,
        rewardItems: result.rewardItems,
        occurredAt: now,
      })
    }

    return true
  }

  // 分页查询实例列表。
  async getTaskInstancePage(queryDto: QueryTaskInstancePageDto) {
    const page = this.drizzle.buildPage(queryDto)
    const createdRange = buildDateOnlyRangeInAppTimeZone(
      queryDto.startDate,
      queryDto.endDate,
    )
    const where = and(
      isNull(this.taskInstanceTable.deletedAt),
      queryDto.taskId !== undefined
        ? eq(this.taskInstanceTable.taskId, queryDto.taskId)
        : undefined,
      queryDto.userId !== undefined
        ? eq(this.taskInstanceTable.userId, queryDto.userId)
        : undefined,
      queryDto.status !== undefined
        ? eq(this.taskInstanceTable.status, queryDto.status)
        : undefined,
      queryDto.sceneType !== undefined
        ? eq(this.taskDefinitionTable.sceneType, queryDto.sceneType)
        : undefined,
      createdRange?.gte
        ? gte(this.taskInstanceTable.createdAt, createdRange.gte)
        : undefined,
      createdRange?.lt
        ? lt(this.taskInstanceTable.createdAt, createdRange.lt)
        : undefined,
    )

    const rows = await this.db
      .select({
        instance: this.taskInstanceTable,
        task: this.taskDefinitionTable,
        rewardSettlement: this.growthRewardSettlementTable,
      })
      .from(this.taskInstanceTable)
      .leftJoin(
        this.taskDefinitionTable,
        eq(this.taskInstanceTable.taskId, this.taskDefinitionTable.id),
      )
      .leftJoin(
        this.growthRewardSettlementTable,
        eq(
          this.taskInstanceTable.rewardSettlementId,
          this.growthRewardSettlementTable.id,
        ),
      )
      .where(where)
      .orderBy(desc(this.taskInstanceTable.createdAt))
      .limit(page.limit)
      .offset(page.offset)

    const totalRows = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(this.taskInstanceTable)
      .leftJoin(
        this.taskDefinitionTable,
        eq(this.taskInstanceTable.taskId, this.taskDefinitionTable.id),
      )
      .where(where)

    const taskIds = rows
      .map((item) => item.task?.id)
      .filter((id): id is number => typeof id === 'number')
    const instanceIds = rows.map((item) => item.instance.id)
    const [stepSummaryMap, instanceStepMap] = await Promise.all([
      this.getTaskStepSummaryMap(taskIds),
      this.getTaskInstanceStepViewMap(instanceIds),
    ])

    return {
      list: rows.map((item) => ({
        id: item.instance.id,
        createdAt: item.instance.createdAt,
        updatedAt: item.instance.updatedAt,
        taskId: item.instance.taskId,
        userId: item.instance.userId,
        cycleKey: item.instance.cycleKey,
        status: item.instance.status,
        visibleStatus: this.resolveTaskVisibleStatus({
          status: item.instance.status,
          rewardApplicable: item.instance.rewardApplicable,
          rewardSettlementStatus: item.rewardSettlement?.settlementStatus,
        }),
        rewardApplicable: item.instance.rewardApplicable,
        rewardSettlementId: item.instance.rewardSettlementId ?? null,
        claimedAt: item.instance.claimedAt ?? null,
        completedAt: item.instance.completedAt ?? null,
        expiredAt: item.instance.expiredAt ?? null,
        steps: instanceStepMap.get(item.instance.id) ?? [],
        rewardSettlement: this.toTaskRewardSettlementSummary(
          item.rewardSettlement,
        ),
        task: item.task
          ? this.toAdminTaskDefinitionDetail(
              item.task,
              stepSummaryMap.get(item.task.id) ?? [],
            )
          : null,
      })),
      total: Number(totalRows[0]?.count ?? 0),
      pageIndex: page.pageIndex,
      pageSize: page.pageSize,
    }
  }

  // 分页查询对账页。
  async getTaskReconciliationPage(queryDto: QueryTaskReconciliationPageDto) {
    const page = this.drizzle.buildPage(queryDto)
    const createdRange = buildDateOnlyRangeInAppTimeZone(
      queryDto.startDate,
      queryDto.endDate,
    )
    const where = and(
      isNull(this.taskInstanceTable.deletedAt),
      queryDto.instanceId !== undefined
        ? eq(this.taskInstanceTable.id, queryDto.instanceId)
        : undefined,
      queryDto.taskId !== undefined
        ? eq(this.taskInstanceTable.taskId, queryDto.taskId)
        : undefined,
      queryDto.userId !== undefined
        ? eq(this.taskInstanceTable.userId, queryDto.userId)
        : undefined,
      queryDto.rewardSettlementId !== undefined
        ? sql`${this.taskInstanceTable.rewardSettlementId} = ${queryDto.rewardSettlementId}`
        : undefined,
      queryDto.settlementStatus !== undefined
        ? this.buildTaskReconciliationSettlementStatusCondition(
            queryDto.settlementStatus,
          )
        : undefined,
      createdRange?.gte
        ? gte(this.taskInstanceTable.createdAt, createdRange.gte)
        : undefined,
      createdRange?.lt
        ? lt(this.taskInstanceTable.createdAt, createdRange.lt)
        : undefined,
    )

    const rows = await this.db
      .select({
        instance: this.taskInstanceTable,
        task: this.taskDefinitionTable,
        rewardSettlement: this.growthRewardSettlementTable,
      })
      .from(this.taskInstanceTable)
      .leftJoin(
        this.taskDefinitionTable,
        eq(this.taskInstanceTable.taskId, this.taskDefinitionTable.id),
      )
      .leftJoin(
        this.growthRewardSettlementTable,
        eq(
          this.taskInstanceTable.rewardSettlementId,
          this.growthRewardSettlementTable.id,
        ),
      )
      .where(where)
      .orderBy(desc(this.taskInstanceTable.createdAt))
      .limit(page.limit)
      .offset(page.offset)

    const totalRows = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(this.taskInstanceTable)
      .leftJoin(
        this.growthRewardSettlementTable,
        eq(
          this.taskInstanceTable.rewardSettlementId,
          this.growthRewardSettlementTable.id,
        ),
      )
      .where(where)

    const taskIds = rows
      .map((item) => item.task?.id)
      .filter((id): id is number => typeof id === 'number')
    const instanceIds = rows.map((item) => item.instance.id)
    const reconciliationInstances: TaskReconciliationInstanceRecord[] =
      rows.map((item) => ({
        id: item.instance.id,
        taskId: item.instance.taskId,
        userId: item.instance.userId,
        cycleKey: item.instance.cycleKey,
      }))
    const [stepSummaryMap, instanceStepMap, latestEventMap, uniqueFactMap] =
      await Promise.all([
        this.getTaskStepSummaryMap(taskIds),
        this.getTaskInstanceStepViewMap(instanceIds),
        this.getLatestTaskEventSummaryMap(instanceIds),
        this.getTaskUniqueFactSummaryMap(reconciliationInstances),
      ])

    return {
      list: rows.map((item) => ({
        id: item.instance.id,
        createdAt: item.instance.createdAt,
        updatedAt: item.instance.updatedAt,
        taskId: item.instance.taskId,
        userId: item.instance.userId,
        cycleKey: item.instance.cycleKey,
        status: item.instance.status,
        visibleStatus: this.resolveTaskVisibleStatus({
          status: item.instance.status,
          rewardApplicable: item.instance.rewardApplicable,
          rewardSettlementStatus: item.rewardSettlement?.settlementStatus,
        }),
        rewardApplicable: item.instance.rewardApplicable,
        rewardSettlementId: item.instance.rewardSettlementId ?? null,
        claimedAt: item.instance.claimedAt ?? null,
        completedAt: item.instance.completedAt ?? null,
        expiredAt: item.instance.expiredAt ?? null,
        steps: instanceStepMap.get(item.instance.id) ?? [],
        rewardSettlement: this.toTaskRewardSettlementSummary(
          item.rewardSettlement,
        ),
        task: item.task
          ? this.toAdminTaskDefinitionDetail(
              item.task,
              stepSummaryMap.get(item.task.id) ?? [],
            )
          : null,
        latestEvent: latestEventMap.get(item.instance.id) ?? null,
        uniqueFacts: uniqueFactMap.get(item.instance.id) ?? [],
      })),
      total: Number(totalRows[0]?.count ?? 0),
      pageIndex: page.pageIndex,
      pageSize: page.pageSize,
    }
  }

  // 对账页的“待补偿”需与批量补偿扫描保持同一口径，包含缺失结算事实的坏链路。
  private buildTaskReconciliationSettlementStatusCondition(
    settlementStatus: GrowthRewardSettlementStatusEnum,
  ) {
    if (settlementStatus !== GrowthRewardSettlementStatusEnum.PENDING) {
      return eq(
        this.growthRewardSettlementTable.settlementStatus,
        settlementStatus,
      )
    }

    return and(
      eq(this.taskInstanceTable.status, TaskInstanceStatusEnum.COMPLETED),
      eq(this.taskInstanceTable.rewardApplicable, 1),
      or(
        isNull(this.taskInstanceTable.rewardSettlementId),
        isNull(this.growthRewardSettlementTable.id),
        eq(
          this.growthRewardSettlementTable.settlementStatus,
          GrowthRewardSettlementStatusEnum.PENDING,
        ),
      ),
    )
  }

  // 重试单条实例的奖励结算。
  async retryTaskInstanceReward(
    instanceId: number,
  ): Promise<TaskRewardRetryResultDto> {
    const instance = await this.db.query.taskInstance.findFirst({
      where: {
        id: instanceId,
        deletedAt: { isNull: true },
      },
      with: {
        rewardSettlement: true,
      },
    })

    if (!instance) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '任务实例不存在',
      )
    }
    if (instance.status !== TaskInstanceStatusEnum.COMPLETED) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '仅已完成任务允许重试奖励结算',
      )
    }
    if (instance.rewardApplicable !== 1) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '任务实例未配置奖励，无需重试',
      )
    }
    if (
      instance.rewardSettlement?.settlementStatus ===
      GrowthRewardSettlementStatusEnum.SUCCESS
    ) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '任务奖励已结算成功，无需重试',
      )
    }
    if (
      instance.rewardSettlement?.settlementStatus ===
      GrowthRewardSettlementStatusEnum.TERMINAL
    ) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '任务奖励已进入终态失败，无需重试',
      )
    }

    const task = await this.getTaskDefinitionForRewardOrThrow(instance.taskId)
    const rewardItems = this.resolveTaskRewardItems(
      instance.snapshotPayload,
      task.rewardItems,
    )
    if (!this.hasRewardItems(rewardItems)) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '任务实例没有可发放奖励，无需重试',
      )
    }
    await this.settleTaskInstanceReward({
      taskId: instance.taskId,
      instanceId: instance.id,
      userId: instance.userId,
      rewardItems,
      occurredAt: instance.completedAt ?? new Date(),
      isRetry: true,
    })
    return this.getTaskRewardRetryResult(instance.id)
  }

  // 批量扫描并重试已完成实例奖励。
  async retryCompletedTaskRewardsBatch(
    input: RetryTaskRewardBatchDto | number = {},
  ): Promise<TaskRewardRetryBatchResultDto> {
    const allowUnscoped = typeof input === 'number'
    const retryScope: RetryTaskRewardBatchDto =
      typeof input === 'number'
        ? { limit: input }
        : {
            ...input,
            instanceIds: this.normalizeTaskInstanceIds(input.instanceIds),
          }
    const limit = Math.max(1, Math.min(retryScope.limit ?? 100, 500))
    const createdRange =
      typeof input === 'number'
        ? undefined
        : buildDateOnlyRangeInAppTimeZone(input.startDate, input.endDate)
    const hasScopedFilter =
      allowUnscoped ||
      Boolean(retryScope.instanceIds?.length) ||
      retryScope.taskId !== undefined ||
      retryScope.userId !== undefined ||
      retryScope.rewardSettlementId !== undefined ||
      retryScope.settlementStatus !== undefined ||
      Boolean(createdRange?.gte) ||
      Boolean(createdRange?.lt)

    if (!hasScopedFilter) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '批量重试任务奖励必须携带当前筛选条件或选中的任务实例',
      )
    }

    const scopeConditions: SQL[] = []
    if (retryScope.instanceIds?.length) {
      scopeConditions.push(
        inArray(this.taskInstanceTable.id, retryScope.instanceIds),
      )
    }
    if (retryScope.taskId !== undefined) {
      scopeConditions.push(eq(this.taskInstanceTable.taskId, retryScope.taskId))
    }
    if (retryScope.userId !== undefined) {
      scopeConditions.push(eq(this.taskInstanceTable.userId, retryScope.userId))
    }
    if (retryScope.rewardSettlementId !== undefined) {
      scopeConditions.push(
        eq(
          this.growthRewardSettlementTable.id,
          retryScope.rewardSettlementId,
        ),
      )
    }
    if (retryScope.settlementStatus !== undefined) {
      const settlementStatusCondition =
        this.buildTaskReconciliationSettlementStatusCondition(
          retryScope.settlementStatus,
        )
      if (settlementStatusCondition) {
        scopeConditions.push(settlementStatusCondition)
      }
    }
    if (createdRange?.gte) {
      scopeConditions.push(gte(this.taskInstanceTable.createdAt, createdRange.gte))
    }
    if (createdRange?.lt) {
      scopeConditions.push(lt(this.taskInstanceTable.createdAt, createdRange.lt))
    }

    const rows = await this.db
      .select({
        instanceId: this.taskInstanceTable.id,
        rewardSettlementId: this.taskInstanceTable.rewardSettlementId,
      })
      .from(this.taskInstanceTable)
      .leftJoin(
        this.growthRewardSettlementTable,
        eq(
          this.taskInstanceTable.rewardSettlementId,
          this.growthRewardSettlementTable.id,
        ),
      )
      .where(
        and(
          isNull(this.taskInstanceTable.deletedAt),
          eq(this.taskInstanceTable.status, TaskInstanceStatusEnum.COMPLETED),
          eq(this.taskInstanceTable.rewardApplicable, 1),
          or(
            isNull(this.taskInstanceTable.rewardSettlementId),
            isNull(this.growthRewardSettlementTable.id),
            sql`${this.growthRewardSettlementTable.settlementStatus} not in (${GrowthRewardSettlementStatusEnum.SUCCESS}, ${GrowthRewardSettlementStatusEnum.TERMINAL})`,
          ),
          ...scopeConditions,
        ),
      )
      .orderBy(desc(this.taskInstanceTable.id))
      .limit(limit)

    let succeededCount = 0
    let failedCount = 0
    let skippedCount = 0
    const failures: TaskRewardRetryFailureDto[] = []

    for (const row of rows) {
      try {
        const result = await this.retryTaskInstanceReward(row.instanceId)
        if (result.succeeded) {
          succeededCount += 1
        } else {
          failedCount += 1
          this.pushTaskRewardRetryFailure(failures, {
            instanceId: row.instanceId,
            rewardSettlementId: result.rewardSettlementId,
            message: result.message,
          })
        }
      } catch (error) {
        if (this.isTaskRewardRetrySkippedError(error)) {
          skippedCount += 1
          continue
        }
        failedCount += 1
        this.pushTaskRewardRetryFailure(failures, {
          instanceId: row.instanceId,
          rewardSettlementId: row.rewardSettlementId,
          message: error instanceof Error ? error.message : String(error),
        })
      }
    }

    return {
      scannedCount: rows.length,
      succeededCount,
      failedCount,
      skippedCount,
      failures,
    }
  }

  // 规整后台选中的任务实例 ID，避免重复扫描和无效输入污染 SQL。
  private normalizeTaskInstanceIds(ids?: number[]) {
    return [
      ...new Set(
        (ids ?? []).filter((id) => Number.isInteger(id) && id > 0),
      ),
    ]
  }

  // 消费业务事件并推进事件步骤。
  async consumeEventProgress(
    input: TaskEventProgressInput,
  ): Promise<TaskEventProgressResult> {
    const result: TaskEventProgressResult = {
      matchedTaskIds: [],
      progressedInstanceIds: [],
      completedInstanceIds: [],
      duplicateInstanceIds: [],
    }

    if (
      !canConsumeEventEnvelopeByConsumer(
        input.eventEnvelope,
        EventDefinitionConsumerEnum.TASK,
      )
    ) {
      return result
    }

    const template = this.taskEventTemplateRegistry.getTemplateByEventCode(
      input.eventEnvelope.code,
    )
    if (!template) {
      return result
    }

    const occurredAt = input.eventEnvelope.occurredAt ?? new Date()
    const candidateSteps = await this.listCandidateEventSteps(
      input.eventEnvelope.code,
      occurredAt,
    )

    for (const item of candidateSteps) {
      if (
        !this.taskEventTemplateRegistry.matchesFilterPayload(
          item.step.filterPayload as Record<string, unknown> | null | undefined,
          String(input.eventEnvelope.targetType),
          input.eventEnvelope.targetId,
          input.eventEnvelope.context,
        )
      ) {
        await this.writeTaskEventLog(this.db, {
          taskId: item.task.id,
          stepId: item.step.id,
          userId: input.eventEnvelope.subjectId,
          eventCode: input.eventEnvelope.code,
          eventBizKey: input.bizKey,
          actionType: TaskEventActionTypeEnum.REJECT,
          progressSource: TaskEventProgressSourceEnum.EVENT,
          accepted: false,
          rejectReason: 'filter_mismatch',
          targetType: String(input.eventEnvelope.targetType),
          targetId: input.eventEnvelope.targetId,
          occurredAt,
          context: input.eventEnvelope.context,
        })
        continue
      }

      result.matchedTaskIds.push(item.task.id)

      const instanceResult = await this.applyEventToTaskStep({
        task: item.task,
        step: item.step,
        userId: input.eventEnvelope.subjectId,
        eventBizKey: input.bizKey,
        eventCode: input.eventEnvelope.code,
        targetType: String(input.eventEnvelope.targetType),
        targetId: input.eventEnvelope.targetId,
        occurredAt,
        context: input.eventEnvelope.context,
      })

      if (!instanceResult.instanceId) {
        continue
      }
      if (instanceResult.duplicate) {
        result.duplicateInstanceIds.push(instanceResult.instanceId)
        continue
      }
      if (instanceResult.completed) {
        result.completedInstanceIds.push(instanceResult.instanceId)
        continue
      }
      if (instanceResult.progressed) {
        result.progressedInstanceIds.push(instanceResult.instanceId)
      }
    }

    return result
  }

  // 查询当前可被事件推进的候选步骤。
  private async listCandidateEventSteps(eventCode: number, occurredAt: Date) {
    return this.db
      .select({
        task: this.taskDefinitionTable,
        step: this.taskStepTable,
      })
      .from(this.taskStepTable)
      .innerJoin(
        this.taskDefinitionTable,
        eq(this.taskStepTable.taskId, this.taskDefinitionTable.id),
      )
      .where(
        and(
          isNull(this.taskDefinitionTable.deletedAt),
          eq(this.taskDefinitionTable.status, TaskDefinitionStatusEnum.ACTIVE),
          eq(this.taskDefinitionTable.claimMode, TaskClaimModeEnum.AUTO),
          eq(this.taskStepTable.triggerMode, TaskStepTriggerModeEnum.EVENT),
          eq(this.taskStepTable.eventCode, eventCode),
          sql`${this.taskDefinitionTable.startAt} is null or ${this.taskDefinitionTable.startAt} <= ${occurredAt}`,
          sql`${this.taskDefinitionTable.endAt} is null or ${this.taskDefinitionTable.endAt} >= ${occurredAt}`,
        ),
      )
  }

  // 把单次事件作用到某个步骤。
  private async applyEventToTaskStep(
    params: TaskInstanceEventApplyParams,
  ): Promise<TaskInstanceEventApplyResult> {
    const cycleKey = this.buildTaskCycleKey(params.task, params.occurredAt)
    const result = await this.drizzle.withTransaction(async (tx) => {
      const existingInstance = await this.findTaskInstance(
        tx,
        params.task.id,
        params.userId,
        cycleKey,
      )
      const existingInstanceStep = existingInstance
        ? await this.findTaskInstanceStep(
            tx,
            existingInstance.id,
            params.step.id,
          )
        : null

      if (existingInstance?.status === TaskInstanceStatusEnum.COMPLETED) {
        return {
          instanceId: existingInstance.id,
          progressed: false,
          completed: false,
          duplicate: false,
        }
      }

      let dimension: TaskUniqueDimensionResolvedValue | null = null
      let uniqueFactId: number | null = null

      if (params.step.dedupeScope) {
        dimension = this.taskEventTemplateRegistry.resolveUniqueDimensionValue(
          params.step.templateKey ?? '',
          params.targetId,
          params.context,
        )

        if (!dimension) {
          await this.writeTaskEventLog(tx, {
            taskId: params.task.id,
            stepId: params.step.id,
            instanceId: existingInstance?.id ?? null,
            instanceStepId: existingInstanceStep?.id ?? null,
            userId: params.userId,
            eventCode: params.eventCode,
            eventBizKey: params.eventBizKey,
            actionType: TaskEventActionTypeEnum.REJECT,
            progressSource: TaskEventProgressSourceEnum.EVENT,
            accepted: false,
            rejectReason: 'unique_dimension_missing',
            targetType: params.targetType,
            targetId: params.targetId,
            occurredAt: params.occurredAt,
            context: params.context,
          })
          return {
            instanceId: existingInstance?.id ?? null,
            progressed: false,
            completed: false,
            duplicate: false,
          }
        }

        const inserted = await this.tryInsertTaskUniqueFact(tx, {
          taskId: params.task.id,
          stepId: params.step.id,
          userId: params.userId,
          cycleKey,
          dedupeScope: params.step.dedupeScope ?? TaskStepDedupeScopeEnum.CYCLE,
          dimension,
          eventCode: params.eventCode,
          eventBizKey: params.eventBizKey,
          targetType: params.targetType,
          targetId: params.targetId,
          occurredAt: params.occurredAt,
          context: params.context,
        })

        if (!inserted.created) {
          await this.writeTaskEventLog(tx, {
            taskId: params.task.id,
            stepId: params.step.id,
            instanceId: existingInstance?.id ?? null,
            instanceStepId: existingInstanceStep?.id ?? null,
            userId: params.userId,
            eventCode: params.eventCode,
            eventBizKey: params.eventBizKey,
            actionType: TaskEventActionTypeEnum.REJECT,
            progressSource: TaskEventProgressSourceEnum.EVENT,
            accepted: false,
            rejectReason: 'duplicate_unique_dimension',
            targetType: params.targetType,
            targetId: params.targetId,
            dimensionKey: dimension.key,
            dimensionValue: dimension.value,
            occurredAt: params.occurredAt,
            context: params.context,
          })
          return {
            instanceId: existingInstance?.id ?? null,
            progressed: false,
            completed: false,
            duplicate: true,
          }
        }
        uniqueFactId = inserted.id
      }

      const resolvedInstance: TaskInstanceResolveResult = existingInstance
        ? {
            instance: existingInstance,
            created: false,
          }
        : await this.createOrGetTaskInstance(
            tx,
            params.task,
            params.userId,
            cycleKey,
            params.occurredAt,
          )
      const instance = resolvedInstance.instance
      const resolvedInstanceStep: TaskInstanceStepResolveResult =
        existingInstanceStep
          ? {
              instanceStep: existingInstanceStep,
              created: false,
            }
          : await this.createOrGetTaskInstanceStep(tx, instance.id, params.step)
      const instanceStep = resolvedInstanceStep.instanceStep

      if (
        resolvedInstance.created &&
        params.task.claimMode === TaskClaimModeEnum.AUTO
      ) {
        await this.publishAutoAssignedReminderInTx(
          tx,
          params.task,
          instance,
          params.occurredAt,
        )
      }

      const progress = await this.applyTaskInstanceProgressInTx({
        runner: tx,
        instance,
        instanceStep,
        delta: 1,
        occurredAt: params.occurredAt,
      })

      if (progress.appliedDelta <= 0 && uniqueFactId) {
        await tx
          .delete(this.taskStepUniqueFactTable)
          .where(eq(this.taskStepUniqueFactTable.id, uniqueFactId))
      }

      await this.writeTaskEventLog(tx, {
        taskId: params.task.id,
        stepId: params.step.id,
        instanceId: progress.instanceId,
        instanceStepId: progress.instanceStepId,
        userId: params.userId,
        eventCode: params.eventCode,
        eventBizKey: params.eventBizKey,
        actionType:
          progress.status === TaskInstanceStatusEnum.COMPLETED
            ? TaskEventActionTypeEnum.COMPLETE
            : TaskEventActionTypeEnum.PROGRESS,
        progressSource: TaskEventProgressSourceEnum.EVENT,
        accepted: true,
        delta: progress.appliedDelta,
        beforeValue: progress.beforeValue,
        afterValue: progress.afterValue,
        targetType: params.targetType,
        targetId: params.targetId,
        dimensionKey: dimension?.key ?? null,
        dimensionValue: dimension?.value ?? null,
        occurredAt: params.occurredAt,
        context: params.context,
      })

      return {
        instanceId: instance.id,
        progressed: progress.status !== TaskInstanceStatusEnum.COMPLETED,
        completed: progress.completed,
        duplicate: false,
        rewardItems: this.resolveTaskRewardItems(
          instance.snapshotPayload,
          params.task.rewardItems,
        ),
      }
    })

    if (
      result.completed &&
      'rewardItems' in result &&
      this.hasRewardItems(result.rewardItems)
    ) {
      await this.settleTaskInstanceReward({
        taskId: params.task.id,
        instanceId: result.instanceId!,
        userId: params.userId,
        rewardItems: result.rewardItems,
        occurredAt: params.occurredAt,
      })
    }

    return result
  }

  // 原子推进实例步骤，并以数据库锁定后的真实 before/after 作为唯一事实来源。
  private async applyTaskInstanceProgressInTx(
    params: TaskInstanceProgressApplyInput,
  ): Promise<TaskInstanceProgressApplyResult> {
    if (!Number.isInteger(params.delta) || params.delta <= 0) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '进度增量必须是大于 0 的整数',
      )
    }

    const result = await params.runner.execute(sql`
      WITH locked_progress AS (
        SELECT
          s.id AS instance_step_id,
          s.instance_id,
          s.current_value AS before_value,
          s.target_value,
          LEAST(s.target_value, s.current_value + ${params.delta}) AS after_value
        FROM task_instance_step s
        INNER JOIN task_instance i
          ON i.id = s.instance_id
        WHERE s.id = ${params.instanceStep.id}
          AND s.instance_id = ${params.instance.id}
          AND i.id = ${params.instance.id}
          AND i.deleted_at IS NULL
          AND s.status IN (${TaskInstanceStatusEnum.PENDING}, ${TaskInstanceStatusEnum.IN_PROGRESS})
          AND i.status IN (${TaskInstanceStatusEnum.PENDING}, ${TaskInstanceStatusEnum.IN_PROGRESS})
        FOR UPDATE OF s, i
      ),
      updated_step AS (
        UPDATE task_instance_step s
        SET
          current_value = locked_progress.after_value,
          status = CASE
            WHEN locked_progress.after_value >= locked_progress.target_value
              THEN ${TaskInstanceStatusEnum.COMPLETED}
            ELSE ${TaskInstanceStatusEnum.IN_PROGRESS}
          END,
          completed_at = CASE
            WHEN locked_progress.after_value >= locked_progress.target_value
              THEN ${params.occurredAt}
            ELSE NULL
          END,
          version = s.version + 1
        FROM locked_progress
        WHERE s.id = locked_progress.instance_step_id
        RETURNING
          s.id AS instance_step_id,
          s.instance_id,
          locked_progress.before_value,
          s.current_value AS after_value,
          s.target_value,
          s.status
      ),
      updated_instance AS (
        UPDATE task_instance i
        SET
          status = updated_step.status,
          completed_at = CASE
            WHEN updated_step.status = ${TaskInstanceStatusEnum.COMPLETED}
              THEN ${params.occurredAt}
            ELSE NULL
          END,
          version = i.version + 1
        FROM updated_step
        WHERE i.id = updated_step.instance_id
        RETURNING i.id AS instance_id, i.status
      )
      SELECT
        updated_instance.instance_id AS "instanceId",
        updated_step.instance_step_id AS "instanceStepId",
        updated_step.before_value AS "beforeValue",
        updated_step.after_value AS "afterValue",
        updated_step.after_value - updated_step.before_value AS "appliedDelta",
        updated_step.target_value AS "targetValue",
        updated_step.status AS "status"
      FROM updated_step
      INNER JOIN updated_instance
        ON updated_instance.instance_id = updated_step.instance_id
    `)

    return this.toTaskProgressApplyResult(result)
  }

  // 原子完成已满足目标值的实例步骤。
  private async completeReadyTaskInstanceStepInTx(
    params: TaskInstanceProgressApplyInput,
  ): Promise<TaskInstanceProgressApplyResult> {
    const result = await params.runner.execute(sql`
      WITH locked_progress AS (
        SELECT
          s.id AS instance_step_id,
          s.instance_id,
          s.current_value AS before_value,
          s.target_value
        FROM task_instance_step s
        INNER JOIN task_instance i
          ON i.id = s.instance_id
        WHERE s.id = ${params.instanceStep.id}
          AND s.instance_id = ${params.instance.id}
          AND i.id = ${params.instance.id}
          AND i.deleted_at IS NULL
          AND s.status IN (${TaskInstanceStatusEnum.PENDING}, ${TaskInstanceStatusEnum.IN_PROGRESS})
          AND i.status IN (${TaskInstanceStatusEnum.PENDING}, ${TaskInstanceStatusEnum.IN_PROGRESS})
          AND s.current_value >= s.target_value
        FOR UPDATE OF s, i
      ),
      updated_step AS (
        UPDATE task_instance_step s
        SET
          status = ${TaskInstanceStatusEnum.COMPLETED},
          completed_at = ${params.occurredAt},
          version = s.version + 1
        FROM locked_progress
        WHERE s.id = locked_progress.instance_step_id
        RETURNING
          s.id AS instance_step_id,
          s.instance_id,
          locked_progress.before_value,
          s.current_value AS after_value,
          s.target_value,
          s.status
      ),
      updated_instance AS (
        UPDATE task_instance i
        SET
          status = ${TaskInstanceStatusEnum.COMPLETED},
          completed_at = ${params.occurredAt},
          version = i.version + 1
        FROM updated_step
        WHERE i.id = updated_step.instance_id
        RETURNING i.id AS instance_id, i.status
      )
      SELECT
        updated_instance.instance_id AS "instanceId",
        updated_step.instance_step_id AS "instanceStepId",
        updated_step.before_value AS "beforeValue",
        updated_step.after_value AS "afterValue",
        updated_step.after_value - updated_step.before_value AS "appliedDelta",
        updated_step.target_value AS "targetValue",
        updated_step.status AS "status"
      FROM updated_step
      INNER JOIN updated_instance
        ON updated_instance.instance_id = updated_step.instance_id
    `)

    return this.toTaskProgressApplyResult(result)
  }

  // 将原生 SQL 返回值规整成步骤推进结果。
  private toTaskProgressApplyResult(
    result: { rows?: TaskProgressUpdateRawRow[] | null } | object | null,
  ): TaskInstanceProgressApplyResult {
    const row = extractRows<TaskProgressUpdateRawRow>(result)[0]
    if (!row) {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '任务状态已变更，请刷新后重试',
      )
    }

    return {
      instanceId: Number(row.instanceId),
      instanceStepId: Number(row.instanceStepId),
      beforeValue: Number(row.beforeValue),
      afterValue: Number(row.afterValue),
      appliedDelta: Number(row.appliedDelta),
      targetValue: Number(row.targetValue),
      status: Number(row.status) as TaskInstanceStatusEnum,
      completed: Number(row.status) === TaskInstanceStatusEnum.COMPLETED,
    }
  }

  // 修复旧数据中已领取但缺失步骤快照的活跃实例。
  async repairMissingActiveTaskInstanceSteps(limit = 500) {
    const cappedLimit = Math.max(1, Math.min(Math.floor(limit), 500))
    return this.drizzle.withTransaction(async (tx) => {
      const result = await tx.execute(sql`
        WITH missing_steps AS (
          SELECT
            i.id AS instance_id,
            s.id AS step_id,
            s.target_value
          FROM task_instance i
          INNER JOIN task_step s
            ON s.task_id = i.task_id
           AND s.step_no = 1
          LEFT JOIN task_instance_step tis
            ON tis.instance_id = i.id
           AND tis.step_id = s.id
          WHERE i.deleted_at IS NULL
            AND i.status IN (${TaskInstanceStatusEnum.PENDING}, ${TaskInstanceStatusEnum.IN_PROGRESS})
            AND tis.id IS NULL
          ORDER BY i.id
          LIMIT ${cappedLimit}
        ),
        inserted AS (
          INSERT INTO task_instance_step (
            instance_id,
            step_id,
            status,
            current_value,
            target_value
          )
          SELECT
            instance_id,
            step_id,
            ${TaskInstanceStatusEnum.PENDING},
            0,
            target_value
          FROM missing_steps
          ON CONFLICT (instance_id, step_id) DO NOTHING
          RETURNING id
        )
        SELECT count(*)::int AS "insertedCount"
        FROM inserted
      `)
      const row = extractRows<{ insertedCount: number }>(result)[0]
      return Number(row?.insertedCount ?? 0)
    })
  }

  // 创建或复用任务实例。
  private async createOrGetTaskInstance(
    runner: Db,
    task: TaskDefinitionSelect,
    userId: number,
    cycleKey: string,
    now: Date,
  ): Promise<TaskInstanceResolveResult> {
    const [created] = await runner
      .insert(this.taskInstanceTable)
      .values({
        taskId: task.id,
        userId,
        cycleKey,
        status: TaskInstanceStatusEnum.PENDING,
        rewardApplicable: this.hasRewardItems(task.rewardItems) ? 1 : 0,
        snapshotPayload: {
          taskId: task.id,
          code: task.code,
          title: task.title,
          sceneType: task.sceneType,
          rewardItems: task.rewardItems,
        },
        claimedAt: now,
        expiredAt: this.buildTaskExpiredAt(task, now),
      })
      .onConflictDoNothing()
      .returning()

    if (created) {
      return {
        instance: created,
        created: true,
      }
    }

    const existing = await runner.query.taskInstance.findFirst({
      where: {
        taskId: task.id,
        userId,
        cycleKey,
        deletedAt: { isNull: true },
      },
    })

    if (!existing) {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '任务实例创建失败',
      )
    }

    return {
      instance: existing,
      created: false,
    }
  }

  // 查询同用户、同任务、同周期下是否已有实例。
  private async findTaskInstance(
    runner: Db,
    taskId: number,
    userId: number,
    cycleKey: string,
  ) {
    return runner.query.taskInstance.findFirst({
      where: {
        taskId,
        userId,
        cycleKey,
        deletedAt: { isNull: true },
      },
    })
  }

  // 创建或复用实例步骤。
  private async createOrGetTaskInstanceStep(
    runner: Db,
    instanceId: number,
    step: TaskStepSelect,
  ): Promise<TaskInstanceStepResolveResult> {
    const [created] = await runner
      .insert(this.taskInstanceStepTable)
      .values({
        instanceId,
        stepId: step.id,
        status: TaskInstanceStatusEnum.PENDING,
        currentValue: 0,
        targetValue: step.targetValue,
      })
      .onConflictDoNothing()
      .returning()

    if (created) {
      return {
        instanceStep: created,
        created: true,
      }
    }

    const existing = await runner.query.taskInstanceStep.findFirst({
      where: {
        instanceId,
        stepId: step.id,
      },
    })

    if (!existing) {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '任务步骤实例创建失败',
      )
    }

    return {
      instanceStep: existing,
      created: false,
    }
  }

  // 查询实例下指定步骤是否已有进度行。
  private async findTaskInstanceStep(
    runner: Db,
    instanceId: number,
    stepId: number,
  ) {
    return runner.query.taskInstanceStep.findFirst({
      where: {
        instanceId,
        stepId,
      },
    })
  }

  // 插入一次唯一计数事实。
  private async tryInsertTaskUniqueFact(
    runner: Db,
    params: TaskUniqueFactInsertInput,
  ) {
    const scopeKey =
      params.dedupeScope === TaskStepDedupeScopeEnum.LIFETIME
        ? 'lifetime'
        : params.cycleKey

    const [created] = await runner
      .insert(this.taskStepUniqueFactTable)
      .values({
        taskId: params.taskId,
        stepId: params.stepId,
        userId: params.userId,
        cycleKey:
          params.dedupeScope === TaskStepDedupeScopeEnum.LIFETIME
            ? null
            : params.cycleKey,
        dedupeScope: params.dedupeScope,
        scopeKey,
        dimensionKey: params.dimension.key,
        dimensionValue: params.dimension.value,
        dimensionHash: params.dimension.value,
        firstEventCode: params.eventCode,
        firstEventBizKey: params.eventBizKey,
        firstTargetType: params.targetType,
        firstTargetId: params.targetId,
        firstOccurredAt: params.occurredAt,
        firstContext: params.context,
      })
      .onConflictDoNothing()
      .returning({ id: this.taskStepUniqueFactTable.id })

    return {
      created: Boolean(created),
      id: created?.id ?? null,
    }
  }

  // 写入一次任务事件日志。
  private async writeTaskEventLog(runner: Db, params: TaskEventLogWriteInput) {
    await runner.insert(this.taskEventLogTable).values({
      taskId: params.taskId,
      stepId: params.stepId ?? null,
      instanceId: params.instanceId ?? null,
      instanceStepId: params.instanceStepId ?? null,
      userId: params.userId,
      eventCode: params.eventCode ?? null,
      eventBizKey: params.eventBizKey ?? null,
      actionType: params.actionType,
      progressSource:
        params.progressSource ?? TaskEventProgressSourceEnum.EVENT,
      accepted: params.accepted,
      rejectReason: params.rejectReason ?? null,
      delta: params.delta ?? 0,
      beforeValue: params.beforeValue ?? 0,
      afterValue: params.afterValue ?? 0,
      targetType: params.targetType ?? null,
      targetId: params.targetId ?? null,
      dimensionKey: params.dimensionKey ?? null,
      dimensionValue: params.dimensionValue ?? null,
      occurredAt: params.occurredAt ?? null,
      context: params.context,
    })
  }

  // 校验当前任务是否允许走手动执行链路。
  private ensureManualTaskActionAllowed(
    task: TaskDefinitionSelect,
    step: TaskStepSelect,
  ) {
    if (task.claimMode !== TaskClaimModeEnum.MANUAL) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '当前任务不允许手动领取或手动完成',
      )
    }
    if (step.triggerMode !== TaskStepTriggerModeEnum.MANUAL) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '当前任务步骤不允许手动执行',
      )
    }
  }

  // 校验手动操作的实例状态是否合法。
  private ensureManualTaskInstanceUsable(
    instance:
      | TaskDefinitionSelect
      | {
          status: number
        },
  ) {
    if (instance.status === TaskInstanceStatusEnum.COMPLETED) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '任务已完成',
      )
    }
    if (instance.status === TaskInstanceStatusEnum.EXPIRED) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '任务已过期',
      )
    }
  }

  // 计算任务周期键。
  private buildTaskCycleKey(task: TaskDefinitionSelect, now: Date) {
    const dateParts = this.getTaskCycleDateParts(now)

    if (task.repeatType === TaskRepeatCycleEnum.DAILY) {
      return `${dateParts.year}-${dateParts.month}-${dateParts.date}`
    }
    if (task.repeatType === TaskRepeatCycleEnum.WEEKLY) {
      return this.buildWeeklyCycleKey(
        dateParts.year,
        dateParts.month,
        dateParts.date,
      )
    }
    if (task.repeatType === TaskRepeatCycleEnum.MONTHLY) {
      return `${dateParts.year}-${dateParts.month}`
    }
    return 'once'
  }

  // 按应用时区提取周期切分所需的日期片段。
  private getTaskCycleDateParts(value: Date): TaskCycleDateParts {
    const timeZone = getAppTimeZone()
    const anchor = dayjs(value).tz(timeZone)
    const year = anchor.format('YYYY')
    const month = anchor.format('MM')
    const date = anchor.format('DD')
    const weekday = anchor.day() === 0 ? 7 : anchor.day()

    return {
      year,
      month,
      date,
      weekday,
    }
  }

  // 生成周周期键，统一以周一为起始日。
  private buildWeeklyCycleKey(year: string, month: string, date: string) {
    const anchor = new Date(
      Date.UTC(Number(year), Number(month) - 1, Number(date)),
    )
    const weekday = anchor.getUTCDay() === 0 ? 7 : anchor.getUTCDay()
    anchor.setUTCDate(anchor.getUTCDate() - (weekday - 1))

    const weekYear = String(anchor.getUTCFullYear())
    const weekMonth = String(anchor.getUTCMonth() + 1).padStart(2, '0')
    const weekDate = String(anchor.getUTCDate()).padStart(2, '0')
    return `${weekYear}-${weekMonth}-${weekDate}`
  }

  // 计算任务实例过期时间。
  private buildTaskExpiredAt(task: TaskDefinitionSelect, now: Date) {
    const timeZone = getAppTimeZone()
    const anchor = dayjs(now).tz(timeZone)
    let cycleExpiredAt: Date | null = null

    if (task.repeatType === TaskRepeatCycleEnum.DAILY) {
      cycleExpiredAt = anchor.add(1, 'day').startOf('day').toDate()
    } else if (task.repeatType === TaskRepeatCycleEnum.WEEKLY) {
      const weekday = anchor.day() === 0 ? 7 : anchor.day()
      cycleExpiredAt = anchor
        .add(8 - weekday, 'day')
        .startOf('day')
        .toDate()
    } else if (task.repeatType === TaskRepeatCycleEnum.MONTHLY) {
      cycleExpiredAt = anchor.add(1, 'month').startOf('month').toDate()
    }

    if (
      task.endAt &&
      (!cycleExpiredAt || task.endAt.getTime() < cycleExpiredAt.getTime())
    ) {
      return task.endAt
    }

    return cycleExpiredAt ?? task.endAt ?? null
  }

  // 读取一条当前仍可用的任务头。
  private async getAvailableTaskDefinitionOrThrow(taskId: number) {
    const now = new Date()
    const task = await this.db.query.taskDefinition.findFirst({
      where: {
        id: taskId,
        deletedAt: { isNull: true },
        status: TaskDefinitionStatusEnum.ACTIVE,
      },
    })

    if (!task) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '任务不存在',
      )
    }

    if (task.startAt && task.startAt.getTime() > now.getTime()) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '任务未开始',
      )
    }
    if (task.endAt && task.endAt.getTime() < now.getTime()) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '任务已结束',
      )
    }

    return task
  }

  // 读取奖励补偿需要的任务头，不受当前上架状态影响。
  private async getTaskDefinitionForRewardOrThrow(taskId: number) {
    const task = await this.db.query.taskDefinition.findFirst({
      where: {
        id: taskId,
      },
    })

    if (!task) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '任务不存在',
      )
    }

    return task
  }

  // 查询单步骤任务的唯一步骤。
  private async getSingleTaskStepOrThrow(taskId: number) {
    const step = await this.db.query.taskStep.findFirst({
      where: {
        taskId,
      },
    })

    if (!step) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '任务步骤不存在',
      )
    }

    return step
  }

  // 数据库侧查询当前用户仍可领取的任务 ID。
  private async getAvailableTaskDefinitionIds(
    queryDto: QueryAvailableTaskPageDto,
    userId: number,
    now: Date,
    limit: number,
    cursor?: { sortOrder: number, id: number },
  ) {
    const cycleKeys = this.buildCurrentTaskCycleKeys(now)
    const sceneFilter =
      queryDto.sceneType !== undefined
        ? sql`AND d.scene_type = ${queryDto.sceneType}`
        : sql.empty()
    const cursorFilter = cursor
      ? sql`AND (c.sort_order > ${cursor.sortOrder} OR (c.sort_order = ${cursor.sortOrder} AND c.id > ${cursor.id}))`
      : sql.empty()
    const result = await this.db.execute(sql`
      WITH claimable_candidates AS (
        SELECT
          d.id,
          d.sort_order,
          CASE d.repeat_type
            WHEN ${TaskRepeatCycleEnum.DAILY} THEN ${cycleKeys.daily}
            WHEN ${TaskRepeatCycleEnum.WEEKLY} THEN ${cycleKeys.weekly}
            WHEN ${TaskRepeatCycleEnum.MONTHLY} THEN ${cycleKeys.monthly}
            ELSE 'once'
          END AS cycle_key
        FROM task_definition d
        WHERE d.deleted_at IS NULL
          AND d.status = ${TaskDefinitionStatusEnum.ACTIVE}
          AND d.claim_mode = ${TaskClaimModeEnum.MANUAL}
          AND (d.start_at IS NULL OR d.start_at <= ${now})
          AND (d.end_at IS NULL OR d.end_at >= ${now})
          ${sceneFilter}
      )
      SELECT c.id
      FROM claimable_candidates c
      WHERE NOT EXISTS (
        SELECT 1
        FROM task_instance i
        WHERE i.deleted_at IS NULL
          AND i.user_id = ${userId}
          AND i.task_id = c.id
          AND i.cycle_key = c.cycle_key
      )
      ${cursorFilter}
      ORDER BY c.sort_order ASC, c.id ASC
      LIMIT ${limit}
    `)

    return extractRows<{ id: number }>(result).map((row) => Number(row.id))
  }

  private encodeAvailableTaskCursor(
    task: Pick<TaskDefinitionSelect, 'sortOrder' | 'id'>,
  ) {
    return encodeGrowthCursor({ sortOrder: task.sortOrder, id: task.id })
  }

  private parseAvailableTaskCursor(cursor?: string | null) {
    return parseGrowthCursor(cursor, '可领取任务分页游标非法', (payload) => {
      const sortOrder = Number(payload.sortOrder)
      const id = Number(payload.id)
      if (
        !Number.isInteger(sortOrder) ||
        sortOrder < 0 ||
        !Number.isInteger(id) ||
        id <= 0
      ) {
        return undefined
      }
      return { sortOrder, id }
    })
  }

  private encodeMyTaskCursor(
    task: Pick<TaskInstanceSelect, 'updatedAt' | 'id'>,
  ) {
    return encodeGrowthCursor({
      updatedAt: task.updatedAt.toISOString(),
      id: task.id,
    })
  }

  private parseMyTaskCursor(cursor?: string | null) {
    return parseGrowthCursor(cursor, '我的任务分页游标非法', (payload) => {
      const updatedAt = new Date(String(payload.updatedAt))
      const id = Number(payload.id)
      if (
        Number.isNaN(updatedAt.getTime()) ||
        !Number.isInteger(id) ||
        id <= 0
      ) {
        return undefined
      }
      return { updatedAt, id }
    })
  }

  // 数据库侧统计当前用户仍可领取的任务数量。
  private async countAvailableTaskDefinitions(
    queryDto: QueryAvailableTaskPageDto,
    userId: number,
    now: Date,
  ) {
    const cycleKeys = this.buildCurrentTaskCycleKeys(now)
    const sceneFilter =
      queryDto.sceneType !== undefined
        ? sql`AND d.scene_type = ${queryDto.sceneType}`
        : sql.empty()
    const result = await this.db.execute(sql`
      WITH claimable_candidates AS (
        SELECT
          d.id,
          CASE d.repeat_type
            WHEN ${TaskRepeatCycleEnum.DAILY} THEN ${cycleKeys.daily}
            WHEN ${TaskRepeatCycleEnum.WEEKLY} THEN ${cycleKeys.weekly}
            WHEN ${TaskRepeatCycleEnum.MONTHLY} THEN ${cycleKeys.monthly}
            ELSE 'once'
          END AS cycle_key
        FROM task_definition d
        WHERE d.deleted_at IS NULL
          AND d.status = ${TaskDefinitionStatusEnum.ACTIVE}
          AND d.claim_mode = ${TaskClaimModeEnum.MANUAL}
          AND (d.start_at IS NULL OR d.start_at <= ${now})
          AND (d.end_at IS NULL OR d.end_at >= ${now})
          ${sceneFilter}
      )
      SELECT count(*)::int AS count
      FROM claimable_candidates c
      WHERE NOT EXISTS (
        SELECT 1
        FROM task_instance i
        WHERE i.deleted_at IS NULL
          AND i.user_id = ${userId}
          AND i.task_id = c.id
          AND i.cycle_key = c.cycle_key
      )
    `)

    return Number(extractRows<{ count: number }>(result)[0]?.count ?? 0)
  }

  // 按 SQL 查询结果顺序读取任务头实体。
  private async getTaskDefinitionsByOrderedIds(ids: number[]) {
    if (ids.length === 0) {
      return []
    }

    const rows = await this.db
      .select()
      .from(this.taskDefinitionTable)
      .where(inArray(this.taskDefinitionTable.id, ids))
    const rowMap = new Map(rows.map((row) => [row.id, row]))

    return ids
      .map((id) => rowMap.get(id))
      .filter((row): row is TaskDefinitionSelect => Boolean(row))
  }

  // 构建与 buildTaskCycleKey 同源的当前周期键。
  private buildCurrentTaskCycleKeys(now: Date) {
    const dateParts = this.getTaskCycleDateParts(now)

    return {
      daily: `${dateParts.year}-${dateParts.month}-${dateParts.date}`,
      weekly: this.buildWeeklyCycleKey(
        dateParts.year,
        dateParts.month,
        dateParts.date,
      ),
      monthly: `${dateParts.year}-${dateParts.month}`,
    }
  }

  // 汇总用户任务摘要聚合行。
  private sumTaskInstanceSummaryCount<T extends { count: number }>(
    rows: T[],
    predicate: (row: T) => boolean,
  ) {
    return rows
      .filter(predicate)
      .reduce((sum, row) => sum + Number(row.count ?? 0), 0)
  }

  // 读取任务奖励重试后的稳定返回视图。
  private async getTaskRewardRetryResult(
    instanceId: number,
  ): Promise<TaskRewardRetryResultDto> {
    const [row] = await this.db
      .select({
        instanceId: this.taskInstanceTable.id,
        rewardSettlementId: this.taskInstanceTable.rewardSettlementId,
        settlementStatus: this.growthRewardSettlementTable.settlementStatus,
      })
      .from(this.taskInstanceTable)
      .leftJoin(
        this.growthRewardSettlementTable,
        eq(
          this.taskInstanceTable.rewardSettlementId,
          this.growthRewardSettlementTable.id,
        ),
      )
      .where(eq(this.taskInstanceTable.id, instanceId))

    if (!row) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '任务实例不存在',
      )
    }

    const succeeded =
      row.settlementStatus === GrowthRewardSettlementStatusEnum.SUCCESS

    return {
      instanceId: row.instanceId,
      rewardSettlementId: row.rewardSettlementId ?? null,
      settlementStatus: row.settlementStatus ?? null,
      succeeded,
      message: succeeded
        ? '任务奖励已补偿成功'
        : '任务奖励补偿重试已执行，当前仍未成功',
    }
  }

  // 将左连接得到的奖励结算事实收敛为稳定输出 DTO。
  private toTaskRewardSettlementSummary(
    settlement: typeof this.growthRewardSettlementTable.$inferSelect | null,
  ): TaskRewardSettlementSummaryDto | null {
    if (!settlement?.id) {
      return null
    }

    return {
      id: settlement.id,
      settlementStatus: settlement.settlementStatus,
      settlementResultType: settlement.settlementResultType ?? null,
      retryCount: settlement.retryCount,
      lastRetryAt: settlement.lastRetryAt ?? null,
      settledAt: settlement.settledAt ?? null,
      lastError: settlement.lastError ?? null,
      ledgerRecordIds: settlement.ledgerRecordIds,
    }
  }

  // 批量返回最多保留前 20 条失败摘要。
  private pushTaskRewardRetryFailure(
    failures: TaskRewardRetryFailureDto[],
    failure: TaskRewardRetryFailureDto,
  ) {
    if (failures.length < 20) {
      failures.push(failure)
    }
  }

  // 批量扫描中不可重试的业务拒绝计入 skipped，而不是系统失败。
  private isTaskRewardRetrySkippedError(error: unknown) {
    return (
      error instanceof BusinessException &&
      error.code === BusinessErrorCode.OPERATION_NOT_ALLOWED
    )
  }

  // 查询一组实例的步骤进度摘要。
  private async getTaskInstanceStepViewMap(instanceIds: number[]) {
    const result = new Map<number, TaskInstanceStepViewRecord[]>()
    const uniqueInstanceIds = [...new Set(instanceIds.filter((id) => id > 0))]

    if (uniqueInstanceIds.length === 0) {
      return result
    }

    const rows = await this.db
      .select()
      .from(this.taskInstanceStepTable)
      .where(inArray(this.taskInstanceStepTable.instanceId, uniqueInstanceIds))

    for (const row of rows) {
      const current = result.get(row.instanceId) ?? []
      current.push({
        id: row.id,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        stepId: row.stepId,
        status: row.status,
        currentValue: row.currentValue,
        targetValue: row.targetValue,
        completedAt: row.completedAt,
      })
      result.set(row.instanceId, current)
    }

    return result
  }

  // 查询一组实例最近一次事件摘要。
  private async getLatestTaskEventSummaryMap(instanceIds: number[]) {
    const result = new Map<number, TaskLatestEventSummaryRecord>()
    const uniqueInstanceIds = [...new Set(instanceIds.filter((id) => id > 0))]

    if (uniqueInstanceIds.length === 0) {
      return result
    }

    const instanceIdList = sql.join(
      uniqueInstanceIds.map((id) => sql`${id}`),
      sql`, `,
    )
    const rows = extractRows<
      TaskLatestEventSummaryRecord & { instanceId: number }
    >(
      await this.db.execute(sql`
        SELECT
          instance_id AS "instanceId",
          event_biz_key AS "eventBizKey",
          occurred_at AS "occurredAt",
          accepted,
          reject_reason AS "rejectReason",
          target_type AS "targetType",
          target_id AS "targetId"
        FROM (
          SELECT
            l.*,
            row_number() OVER (
              PARTITION BY l.instance_id
              ORDER BY l.occurred_at DESC NULLS LAST, l.created_at DESC
            ) AS rn
          FROM task_event_log l
          WHERE l.instance_id IN (${instanceIdList})
        ) latest
        WHERE latest.rn = 1
      `),
    )

    for (const row of rows) {
      if (!row.instanceId) {
        continue
      }
      result.set(row.instanceId, {
        eventBizKey: row.eventBizKey,
        occurredAt: row.occurredAt,
        accepted: row.accepted,
        rejectReason: row.rejectReason,
        targetType: row.targetType,
        targetId: row.targetId,
      })
    }

    return result
  }

  // 查询对账页需要的唯一事实摘要。
  private async getTaskUniqueFactSummaryMap(
    instances: TaskReconciliationInstanceRecord[],
  ) {
    const result = new Map<number, TaskUniqueFactSummaryRecord[]>()
    if (instances.length === 0) {
      return result
    }

    const uniqueTaskIds = [...new Set(instances.map((item) => item.taskId))]
    const uniqueUserIds = [...new Set(instances.map((item) => item.userId))]
    const uniqueScopeKeys = [
      ...new Set([
        'lifetime',
        ...instances.map((item) => item.cycleKey).filter(Boolean),
      ]),
    ]
    const stepRows = await this.db
      .select({
        id: this.taskStepTable.id,
        taskId: this.taskStepTable.taskId,
        dedupeScope: this.taskStepTable.dedupeScope,
      })
      .from(this.taskStepTable)
      .where(inArray(this.taskStepTable.taskId, uniqueTaskIds))
    const factRows = await this.db
      .select({
        taskId: this.taskStepUniqueFactTable.taskId,
        stepId: this.taskStepUniqueFactTable.stepId,
        userId: this.taskStepUniqueFactTable.userId,
        scopeKey: this.taskStepUniqueFactTable.scopeKey,
        dedupeScope: this.taskStepUniqueFactTable.dedupeScope,
        dimensionValue: this.taskStepUniqueFactTable.dimensionValue,
        firstOccurredAt: this.taskStepUniqueFactTable.firstOccurredAt,
      })
      .from(this.taskStepUniqueFactTable)
      .where(
        and(
          inArray(this.taskStepUniqueFactTable.taskId, uniqueTaskIds),
          inArray(this.taskStepUniqueFactTable.userId, uniqueUserIds),
          inArray(this.taskStepUniqueFactTable.scopeKey, uniqueScopeKeys),
        ),
      )
      .orderBy(desc(this.taskStepUniqueFactTable.firstOccurredAt))

    const stepMap = new Map<
      number,
      Array<{ id: number, dedupeScope: number | null }>
    >()
    for (const step of stepRows) {
      const current = stepMap.get(step.taskId) ?? []
      current.push({
        id: step.id,
        dedupeScope: step.dedupeScope,
      })
      stepMap.set(step.taskId, current)
    }

    const factMap = new Map<string, typeof factRows>()
    for (const fact of factRows) {
      const key = this.buildTaskUniqueFactSummaryKey(
        fact.taskId,
        fact.stepId,
        fact.userId,
        fact.scopeKey,
      )
      const current = factMap.get(key) ?? []
      current.push(fact)
      factMap.set(key, current)
    }

    for (const instance of instances) {
      const summaries: TaskUniqueFactSummaryRecord[] = []
      for (const step of stepMap.get(instance.taskId) ?? []) {
        const scopeKey =
          step.dedupeScope === TaskStepDedupeScopeEnum.LIFETIME
            ? 'lifetime'
            : instance.cycleKey
        const matchedFacts =
          factMap.get(
            this.buildTaskUniqueFactSummaryKey(
              instance.taskId,
              step.id,
              instance.userId,
              scopeKey,
            ),
          ) ?? []

        if (matchedFacts.length === 0) {
          continue
        }

        summaries.push({
          stepId: step.id,
          dedupeScope: step.dedupeScope ?? TaskStepDedupeScopeEnum.CYCLE,
          factCount: matchedFacts.length,
          latestDimensionValue: matchedFacts[0]?.dimensionValue ?? null,
          latestOccurredAt: matchedFacts[0]?.firstOccurredAt ?? null,
        })
      }
      result.set(instance.id, summaries)
    }

    return result
  }

  // 对账唯一事实摘要的稳定聚合 key。
  private buildTaskUniqueFactSummaryKey(
    taskId: number,
    stepId: number,
    userId: number,
    scopeKey: string,
  ) {
    return `${taskId}:${stepId}:${userId}:${scopeKey}`
  }

  // 判断任务头是否配置了真实奖励。
  private hasRewardItems(rewardItems: unknown) {
    return Array.isArray(rewardItems) && rewardItems.length > 0
  }

  // 规整任务奖励项。
  private normalizeRewardItems(rewardItems: unknown) {
    return Array.isArray(rewardItems) ? rewardItems : null
  }

  // 优先使用实例快照中的奖励项，避免任务定义变更污染历史补偿。
  private resolveTaskRewardItems(
    snapshotPayload: unknown,
    fallbackRewardItems: unknown,
  ) {
    if (
      snapshotPayload &&
      typeof snapshotPayload === 'object' &&
      !Array.isArray(snapshotPayload)
    ) {
      const rewardItems = (snapshotPayload as { rewardItems?: unknown })
        .rewardItems
      if (Array.isArray(rewardItems)) {
        return rewardItems
      }
    }

    return fallbackRewardItems
  }

  // 构建任务奖励幂等键。
  private buildTaskRewardSettlementBizKey(
    params: TaskRewardSettlementBizKeyInput,
  ) {
    return [
      'task',
      'complete',
      params.taskId,
      'instance',
      params.instanceId,
      'user',
      params.userId,
    ].join(':')
  }

  // 确保实例奖励结算事实存在。
  private async ensureTaskRewardSettlementLink(
    params: TaskRewardSettlementLinkInput,
  ) {
    const bizKey = this.buildTaskRewardSettlementBizKey(params)
    const [created] = await this.db
      .insert(this.growthRewardSettlementTable)
      .values({
        userId: params.userId,
        bizKey,
        settlementType: GrowthRewardSettlementTypeEnum.TASK_REWARD,
        source: 'task_bonus',
        sourceRecordId: params.instanceId,
        targetId: params.taskId,
        eventOccurredAt: params.occurredAt,
        settlementStatus: GrowthRewardSettlementStatusEnum.PENDING,
        requestPayload: {
          kind: 'task_reward',
          taskId: params.taskId,
          instanceId: params.instanceId,
          userId: params.userId,
          rewardItems: params.rewardItems,
          occurredAt: params.occurredAt.toISOString(),
        },
      })
      .onConflictDoNothing()
      .returning({
        id: this.growthRewardSettlementTable.id,
      })

    const settlement =
      created ??
      (await this.db.query.growthRewardSettlement.findFirst({
        where: {
          userId: params.userId,
          bizKey,
        },
        columns: {
          id: true,
        },
      }))

    if (!settlement) {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '任务奖励结算事实创建失败',
      )
    }

    await this.db
      .update(this.taskInstanceTable)
      .set({
        rewardSettlementId: settlement.id,
      })
      .where(eq(this.taskInstanceTable.id, params.instanceId))

    return settlement
  }

  // 对已完成实例执行奖励结算。
  private async settleTaskInstanceReward(params: TaskRewardSettlementInput) {
    const settlement = await this.ensureTaskRewardSettlementLink({
      taskId: params.taskId,
      instanceId: params.instanceId,
      userId: params.userId,
      rewardItems: params.rewardItems,
      occurredAt: params.occurredAt,
    })
    const executionClaim = await this.claimTaskRewardSettlementExecution(
      settlement.id,
      Boolean(params.isRetry),
    )

    const rewardResult =
      await this.userGrowthRewardService.tryRewardTaskComplete({
        userId: params.userId,
        taskId: params.taskId,
        instanceId: params.instanceId,
        rewardItems: this.normalizeRewardItems(params.rewardItems),
        eventEnvelope: createEventEnvelope({
          code: TASK_COMPLETE_EVENT_CODE,
          key: TASK_COMPLETE_EVENT_KEY,
          subjectType: 'user',
          subjectId: params.userId,
          targetType: 'task_instance',
          targetId: params.instanceId,
          occurredAt: params.occurredAt,
          governanceStatus: EventEnvelopeGovernanceStatusEnum.NONE,
          context: {
            taskId: params.taskId,
            taskInstanceId: params.instanceId,
          },
        }),
      })

    await this.drizzle.withTransaction(async (tx) => {
      const updateResult = await this.updateRewardSettlementResultInTx(
        tx,
        settlement.id,
        executionClaim.token,
        rewardResult,
      )

      if (rewardResult.success && updateResult.updated) {
        await this.publishRewardGrantedReminderInTx(tx, {
          taskId: params.taskId,
          instanceId: params.instanceId,
          userId: params.userId,
          rewardItems: (this.normalizeRewardItems(params.rewardItems) ??
            []) as GrowthRewardItem[],
          ledgerRecordIds: rewardResult.ledgerRecordIds,
          occurredAt: rewardResult.settledAt,
        })
      }
    })
  }

  // 奖励副作用执行前先取得短租约，避免并发重试同时进入奖励发放。
  private async claimTaskRewardSettlementExecution(
    settlementId: number,
    isRetry: boolean,
  ) {
    const claimToken = randomUUID()
    const claimStartedAt = new Date()
    const expiredBefore = new Date(
      claimStartedAt.getTime() - TASK_REWARD_SETTLEMENT_CLAIM_LEASE_MS,
    )
    const [claimed] = await this.db
      .update(this.growthRewardSettlementTable)
      .set({
        settlementStatus: GrowthRewardSettlementStatusEnum.PENDING,
        processingToken: claimToken,
        processingStartedAt: claimStartedAt,
        ...(isRetry
          ? {
              retryCount: sql`${this.growthRewardSettlementTable.retryCount} + 1`,
              lastRetryAt: claimStartedAt,
            }
          : {}),
      })
      .where(
        and(
          eq(this.growthRewardSettlementTable.id, settlementId),
          sql`${this.growthRewardSettlementTable.settlementStatus} not in (${GrowthRewardSettlementStatusEnum.SUCCESS}, ${GrowthRewardSettlementStatusEnum.TERMINAL})`,
          or(
            isNull(this.growthRewardSettlementTable.processingToken),
            lt(
              this.growthRewardSettlementTable.processingStartedAt,
              expiredBefore,
            ),
          ),
        ),
      )
      .returning({
        id: this.growthRewardSettlementTable.id,
        token: this.growthRewardSettlementTable.processingToken,
      })

    if (!claimed || claimed.token !== claimToken) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '任务奖励结算事实已成功、终态或正在执行，不能重复执行',
      )
    }

    return { token: claimToken }
  }

  // 只允许非成功且非终态结算事实被本次结果改写，避免补偿重试重复发布奖励到账提醒。
  private async updateRewardSettlementResultInTx(
    runner: Db,
    settlementId: number,
    claimToken: string,
    rewardResult: TaskRewardSettlementResult,
  ): Promise<TaskRewardSettlementUpdateResult> {
    const [updated] = await runner
      .update(this.growthRewardSettlementTable)
      .set({
        settlementStatus: rewardResult.success
          ? GrowthRewardSettlementStatusEnum.SUCCESS
          : GrowthRewardSettlementStatusEnum.PENDING,
        settlementResultType: rewardResult.resultType,
        ledgerRecordIds: rewardResult.ledgerRecordIds,
        settledAt: rewardResult.success ? rewardResult.settledAt : null,
        lastError: rewardResult.success
          ? null
          : (rewardResult.errorMessage ?? '任务奖励发放失败，请稍后重试'),
        processingToken: null,
        processingStartedAt: null,
      })
      .where(
        and(
          eq(this.growthRewardSettlementTable.id, settlementId),
          eq(this.growthRewardSettlementTable.processingToken, claimToken),
          sql`${this.growthRewardSettlementTable.settlementStatus} not in (${GrowthRewardSettlementStatusEnum.SUCCESS}, ${GrowthRewardSettlementStatusEnum.TERMINAL})`,
        ),
      )
      .returning({ id: this.growthRewardSettlementTable.id })

    return {
      updated: Boolean(updated),
    }
  }

  // 在任务实例首次自动创建时写入自动加入提醒 outbox。
  private async publishAutoAssignedReminderInTx(
    runner: Db,
    task: TaskDefinitionSelect,
    instance: TaskInstanceSelect,
    occurredAt: Date,
  ) {
    await this.messageDomainEventPublisher.publishInTx(runner, {
      ...this.taskNotificationService.createAutoAssignedReminderEvent({
        bizKey: this.taskNotificationService.buildAutoAssignedReminderBizKey(
          instance.id,
        ),
        receiverUserId: instance.userId,
        task: {
          id: task.id,
          code: task.code,
          title: task.title,
          type: task.sceneType,
        },
        cycleKey: instance.cycleKey,
        instanceId: instance.id,
      }),
      occurredAt,
    })
  }

  // 在奖励首次成功结算时写入奖励到账提醒 outbox。
  private async publishRewardGrantedReminderInTx(
    runner: Db,
    params: TaskRewardGrantedPublishInput,
  ) {
    const [row] = await runner
      .select({
        instance: this.taskInstanceTable,
        task: this.taskDefinitionTable,
      })
      .from(this.taskInstanceTable)
      .leftJoin(
        this.taskDefinitionTable,
        eq(this.taskInstanceTable.taskId, this.taskDefinitionTable.id),
      )
      .where(eq(this.taskInstanceTable.id, params.instanceId))
      .limit(1)

    await this.messageDomainEventPublisher.publishInTx(runner, {
      ...this.taskNotificationService.createRewardGrantedReminderEvent({
        bizKey: this.taskNotificationService.buildRewardGrantedReminderBizKey(
          params.instanceId,
        ),
        receiverUserId: params.userId,
        task: this.resolveReminderTaskInfo(
          row?.instance?.snapshotPayload,
          row?.task ?? null,
          params.taskId,
        ),
        cycleKey: row?.instance?.cycleKey,
        instanceId: params.instanceId,
        rewardItems: params.rewardItems,
        ledgerRecordIds: params.ledgerRecordIds,
      }),
      occurredAt: params.occurredAt,
    })
  }

  // 解析提醒所需的任务信息，优先使用实例快照以保护历史合同。
  private resolveReminderTaskInfo(
    snapshotPayload: unknown,
    task: TaskDefinitionSelect | null,
    taskId: number,
  ) {
    const snapshot = this.resolveTaskReminderSnapshot(snapshotPayload)

    return {
      id: taskId,
      code: snapshot?.code ?? task?.code ?? `task-${taskId}`,
      title: snapshot?.title ?? task?.title ?? '任务',
      type: snapshot?.sceneType ?? task?.sceneType,
    }
  }

  // 从实例快照中提取任务提醒可用字段。
  private resolveTaskReminderSnapshot(
    snapshotPayload: unknown,
  ): TaskReminderSnapshotPayload | null {
    if (
      !snapshotPayload ||
      typeof snapshotPayload !== 'object' ||
      Array.isArray(snapshotPayload)
    ) {
      return null
    }

    return snapshotPayload as TaskReminderSnapshotPayload
  }
}
