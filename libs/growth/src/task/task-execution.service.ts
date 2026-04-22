import type { Db } from '@db/core'
import type { TaskDefinitionSelect, TaskStepSelect } from '@db/schema'
import type {
  TaskCycleDateParts,
  TaskEventLogWriteInput,
  TaskEventProgressInput,
  TaskEventProgressResult,
  TaskInstanceEventApplyParams,
  TaskInstanceEventApplyResult,
  TaskInstanceResolveResult,
  TaskInstanceStepResolveResult,
  TaskInstanceStepViewRecord,
  TaskLatestEventSummaryRecord,
  TaskReconciliationInstanceRecord,
  TaskRewardSettlementBizKeyInput,
  TaskRewardSettlementInput,
  TaskRewardSettlementLinkInput,
  TaskUniqueDimensionResolvedValue,
  TaskUniqueFactInsertInput,
  TaskUniqueFactSummaryRecord,
} from './types/task.type'
import { DrizzleService } from '@db/core'
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
import { BusinessErrorCode } from '@libs/platform/constant'
import { IdDto } from '@libs/platform/dto/base.dto'
import { BusinessException } from '@libs/platform/exceptions'
import { getAppTimeZone } from '@libs/platform/utils/time'
import { Injectable } from '@nestjs/common'
import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import { and, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm'
import {
  QueryAvailableTaskPageDto,
  QueryMyTaskPageDto,
  QueryTaskInstancePageDto,
  QueryTaskReconciliationPageDto,
  TaskProgressDto,
} from './dto/task-query.dto'
import { TaskEventTemplateRegistry } from './task-event-template.registry'
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
  TaskStepProgressModeEnum,
  TaskStepTriggerModeEnum,
} from './task.constant'
import { TaskServiceSupport } from './task.service.support'

dayjs.extend(utc)
dayjs.extend(timezone)

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
  ) {
    super(drizzle)
  }

  // 分页查询可领取任务。
  async getAvailableTasks(queryDto: QueryAvailableTaskPageDto, userId: number) {
    const now = new Date()
    const page = this.drizzle.buildPage(queryDto)
    const rows = await this.db
      .select()
      .from(this.taskDefinitionTable)
      .where(
        and(
          isNull(this.taskDefinitionTable.deletedAt),
          eq(this.taskDefinitionTable.status, TaskDefinitionStatusEnum.ACTIVE),
          eq(this.taskDefinitionTable.claimMode, TaskClaimModeEnum.MANUAL),
          sql`${this.taskDefinitionTable.startAt} is null or ${this.taskDefinitionTable.startAt} <= ${now}`,
          sql`${this.taskDefinitionTable.endAt} is null or ${this.taskDefinitionTable.endAt} >= ${now}`,
          queryDto.sceneType !== undefined
            ? eq(this.taskDefinitionTable.sceneType, queryDto.sceneType)
            : undefined,
        ),
      )
      .orderBy(
        desc(this.taskDefinitionTable.priority),
        desc(this.taskDefinitionTable.createdAt),
      )

    const filtered = await this.filterClaimableTaskDefinitionsForUser(
      rows,
      userId,
      now,
    )
    const paged = filtered.slice(page.offset, page.offset + page.limit)
    const stepSummaryMap = await this.getTaskStepSummaryMap(
      paged.map((item) => item.id),
    )

    return {
      list: paged.map((task) =>
        this.toAppAvailableTaskItem(task, stepSummaryMap.get(task.id) ?? []),
      ),
      total: filtered.length,
      pageIndex: page.pageIndex,
      pageSize: page.pageSize,
    }
  }

  // 分页查询我的任务。
  async getMyTasks(queryDto: QueryMyTaskPageDto, userId: number) {
    const page = this.drizzle.buildPage(queryDto)
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
        ),
      )
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
      .where(
        and(
          where,
          queryDto.sceneType !== undefined
            ? eq(this.taskDefinitionTable.sceneType, queryDto.sceneType)
            : undefined,
        ),
      )

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
        taskId: item.instance.taskId,
        cycleKey: item.instance.cycleKey,
        visibleStatus: this.resolveTaskVisibleStatus({
          status: item.instance.status,
          rewardApplicable: item.instance.rewardApplicable,
          rewardSettlementStatus: item.rewardSettlement?.settlementStatus,
        }),
        rewardApplicable: item.instance.rewardApplicable,
        rewardSettlementId: item.instance.rewardSettlementId,
        claimedAt: item.instance.claimedAt,
        completedAt: item.instance.completedAt,
        expiredAt: item.instance.expiredAt,
        steps: instanceStepMap.get(item.instance.id) ?? [],
        task: item.task
          ? this.toAppAvailableTaskItem(
              item.task,
              stepSummaryMap.get(item.task.id) ?? [],
            )
          : null,
        rewardSettlement: item.rewardSettlement?.id
          ? {
              id: item.rewardSettlement.id,
              settlementStatus: item.rewardSettlement.settlementStatus,
              settlementResultType: item.rewardSettlement.settlementResultType,
              retryCount: item.rewardSettlement.retryCount,
              lastRetryAt: item.rewardSettlement.lastRetryAt,
              settledAt: item.rewardSettlement.settledAt,
              lastError: item.rewardSettlement.lastError,
              ledgerRecordIds: item.rewardSettlement.ledgerRecordIds,
            }
          : null,
      })),
      total: Number(totalRows[0]?.count ?? 0),
      pageIndex: page.pageIndex,
      pageSize: page.pageSize,
    }
  }

  // 获取用户中心任务摘要。
  async getUserTaskSummary(userId: number) {
    const available = await this.getAvailableTasks({}, userId)
    const rows = await this.db
      .select({
        status: this.taskInstanceTable.status,
        rewardApplicable: this.taskInstanceTable.rewardApplicable,
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
      .where(
        and(
          eq(this.taskInstanceTable.userId, userId),
          isNull(this.taskInstanceTable.deletedAt),
        ),
      )

    return {
      claimableCount: available.total,
      claimedCount: rows.filter((item) => item.status === 0).length,
      inProgressCount: rows.filter((item) => item.status === 1).length,
      rewardPendingCount: rows.filter(
        (item) =>
          item.status === 2 &&
          item.rewardApplicable === 1 &&
          item.settlementStatus !== GrowthRewardSettlementStatusEnum.SUCCESS,
      ).length,
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
      const nextCurrentValue = Math.min(
        instanceStep.targetValue,
        instanceStep.currentValue + dto.delta,
      )
      const nextStatus =
        nextCurrentValue >= instanceStep.targetValue
          ? TaskInstanceStatusEnum.COMPLETED
          : TaskInstanceStatusEnum.IN_PROGRESS

      await tx
        .update(this.taskInstanceStepTable)
        .set({
          currentValue: nextCurrentValue,
          status: nextStatus,
          completedAt:
            nextStatus === TaskInstanceStatusEnum.COMPLETED ? now : null,
          version: sql`${this.taskInstanceStepTable.version} + 1`,
        })
        .where(eq(this.taskInstanceStepTable.id, instanceStep.id))

      await tx
        .update(this.taskInstanceTable)
        .set({
          status: nextStatus,
          completedAt:
            nextStatus === TaskInstanceStatusEnum.COMPLETED ? now : null,
          version: sql`${this.taskInstanceTable.version} + 1`,
        })
        .where(eq(this.taskInstanceTable.id, instance.id))

      await this.writeTaskEventLog(tx, {
        taskId: task.id,
        stepId: step.id,
        instanceId: instance.id,
        instanceStepId: instanceStep.id,
        userId,
        actionType:
          nextStatus === TaskInstanceStatusEnum.COMPLETED
            ? TaskEventActionTypeEnum.COMPLETE
            : TaskEventActionTypeEnum.PROGRESS,
        progressSource: TaskEventProgressSourceEnum.MANUAL,
        accepted: true,
        delta: nextCurrentValue - instanceStep.currentValue,
        beforeValue: instanceStep.currentValue,
        afterValue: nextCurrentValue,
        occurredAt: now,
      })

      return {
        instanceId: instance.id,
        completed: nextStatus === TaskInstanceStatusEnum.COMPLETED,
      }
    })

    if (result.completed && this.hasRewardItems(task.rewardItems)) {
      await this.settleTaskInstanceReward({
        taskId: task.id,
        instanceId: result.instanceId,
        userId,
        rewardItems: task.rewardItems,
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
      const canCompleteImmediately =
        step.progressMode === TaskStepProgressModeEnum.ONCE

      if (
        !canCompleteImmediately &&
        instanceStep.currentValue < instanceStep.targetValue
      ) {
        throw new BusinessException(
          BusinessErrorCode.OPERATION_NOT_ALLOWED,
          '任务进度未达成',
        )
      }

      const nextCurrentValue = canCompleteImmediately
        ? instanceStep.targetValue
        : instanceStep.currentValue

      await tx
        .update(this.taskInstanceStepTable)
        .set({
          currentValue: nextCurrentValue,
          status: TaskInstanceStatusEnum.COMPLETED,
          completedAt: now,
          version: sql`${this.taskInstanceStepTable.version} + 1`,
        })
        .where(eq(this.taskInstanceStepTable.id, instanceStep.id))

      await tx
        .update(this.taskInstanceTable)
        .set({
          status: TaskInstanceStatusEnum.COMPLETED,
          completedAt: now,
          version: sql`${this.taskInstanceTable.version} + 1`,
        })
        .where(eq(this.taskInstanceTable.id, instance.id))

      await this.writeTaskEventLog(tx, {
        taskId: task.id,
        stepId: step.id,
        instanceId: instance.id,
        instanceStepId: instanceStep.id,
        userId,
        actionType: TaskEventActionTypeEnum.COMPLETE,
        progressSource: TaskEventProgressSourceEnum.MANUAL,
        accepted: true,
        delta: nextCurrentValue - instanceStep.currentValue,
        beforeValue: instanceStep.currentValue,
        afterValue: nextCurrentValue,
        occurredAt: now,
      })

      return {
        instanceId: instance.id,
      }
    })

    if (this.hasRewardItems(task.rewardItems)) {
      await this.settleTaskInstanceReward({
        taskId: task.id,
        instanceId: result.instanceId,
        userId,
        rewardItems: task.rewardItems,
        occurredAt: now,
      })
    }

    return true
  }

  // 分页查询实例列表。
  async getTaskInstancePage(queryDto: QueryTaskInstancePageDto) {
    const page = this.drizzle.buildPage(queryDto)
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
        rewardSettlementId: item.instance.rewardSettlementId,
        claimedAt: item.instance.claimedAt,
        completedAt: item.instance.completedAt,
        expiredAt: item.instance.expiredAt,
        steps: instanceStepMap.get(item.instance.id) ?? [],
        rewardSettlement: item.rewardSettlement?.id
          ? {
              id: item.rewardSettlement.id,
              settlementStatus: item.rewardSettlement.settlementStatus,
              settlementResultType: item.rewardSettlement.settlementResultType,
              retryCount: item.rewardSettlement.retryCount,
              lastRetryAt: item.rewardSettlement.lastRetryAt,
              settledAt: item.rewardSettlement.settledAt,
              lastError: item.rewardSettlement.lastError,
              ledgerRecordIds: item.rewardSettlement.ledgerRecordIds,
            }
          : null,
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
        ? eq(
            this.growthRewardSettlementTable.settlementStatus,
            queryDto.settlementStatus,
          )
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
        rewardSettlementId: item.instance.rewardSettlementId,
        claimedAt: item.instance.claimedAt,
        completedAt: item.instance.completedAt,
        expiredAt: item.instance.expiredAt,
        steps: instanceStepMap.get(item.instance.id) ?? [],
        rewardSettlement: item.rewardSettlement?.id
          ? {
              id: item.rewardSettlement.id,
              settlementStatus: item.rewardSettlement.settlementStatus,
              settlementResultType: item.rewardSettlement.settlementResultType,
              retryCount: item.rewardSettlement.retryCount,
              lastRetryAt: item.rewardSettlement.lastRetryAt,
              settledAt: item.rewardSettlement.settledAt,
              lastError: item.rewardSettlement.lastError,
              ledgerRecordIds: item.rewardSettlement.ledgerRecordIds,
            }
          : null,
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

  // 重试单条实例的奖励结算。
  async retryTaskInstanceReward(instanceId: number) {
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
    if (
      instance.rewardSettlement?.settlementStatus ===
      GrowthRewardSettlementStatusEnum.SUCCESS
    ) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '任务奖励已结算成功，无需重试',
      )
    }

    const task = await this.getTaskDefinitionForRewardOrThrow(instance.taskId)
    await this.settleTaskInstanceReward({
      taskId: instance.taskId,
      instanceId: instance.id,
      userId: instance.userId,
      rewardItems: this.resolveTaskRewardItems(
        instance.snapshotPayload,
        task.rewardItems,
      ),
      occurredAt: instance.completedAt ?? new Date(),
    })
    return true
  }

  // 批量扫描并重试已完成实例奖励。
  async retryCompletedTaskRewardsBatch(limit = 100) {
    const rows = await this.db
      .select({
        instanceId: this.taskInstanceTable.id,
        taskId: this.taskInstanceTable.taskId,
        userId: this.taskInstanceTable.userId,
        snapshotPayload: this.taskInstanceTable.snapshotPayload,
        completedAt: this.taskInstanceTable.completedAt,
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
            eq(
              this.growthRewardSettlementTable.settlementStatus,
              GrowthRewardSettlementStatusEnum.PENDING,
            ),
          ),
        ),
      )
      .orderBy(desc(this.taskInstanceTable.id))
      .limit(Math.max(1, Math.min(limit, 500)))

    for (const row of rows) {
      const task = await this.getTaskDefinitionForRewardOrThrow(row.taskId)
      await this.settleTaskInstanceReward({
        taskId: row.taskId,
        instanceId: row.instanceId,
        userId: row.userId,
        rewardItems: this.resolveTaskRewardItems(
          row.snapshotPayload,
          task.rewardItems,
        ),
        occurredAt: row.completedAt ?? new Date(),
      })
    }

    return {
      scannedCount: rows.length,
      triggeredCount: rows.length,
    }
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

      if (params.step.progressMode === TaskStepProgressModeEnum.UNIQUE_COUNT) {
        dimension = this.taskEventTemplateRegistry.resolveUniqueDimensionValue(
          params.step.templateKey ?? '',
          params.step.uniqueDimensionKey ?? '',
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

        if (!inserted) {
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

      const nextCurrentValue =
        params.step.progressMode === TaskStepProgressModeEnum.ONCE
          ? 1
          : Math.min(instanceStep.targetValue, instanceStep.currentValue + 1)
      const nextStepStatus =
        nextCurrentValue >= instanceStep.targetValue
          ? TaskInstanceStatusEnum.COMPLETED
          : TaskInstanceStatusEnum.IN_PROGRESS
      const nextTaskStatus = nextStepStatus

      await tx
        .update(this.taskInstanceStepTable)
        .set({
          currentValue: nextCurrentValue,
          status: nextStepStatus,
          completedAt:
            nextStepStatus === TaskInstanceStatusEnum.COMPLETED
              ? params.occurredAt
              : null,
          version: sql`${this.taskInstanceStepTable.version} + 1`,
        })
        .where(eq(this.taskInstanceStepTable.id, instanceStep.id))

      await tx
        .update(this.taskInstanceTable)
        .set({
          status: nextTaskStatus,
          completedAt:
            nextTaskStatus === TaskInstanceStatusEnum.COMPLETED
              ? params.occurredAt
              : null,
          version: sql`${this.taskInstanceTable.version} + 1`,
        })
        .where(eq(this.taskInstanceTable.id, instance.id))

      await this.writeTaskEventLog(tx, {
        taskId: params.task.id,
        stepId: params.step.id,
        instanceId: instance.id,
        instanceStepId: instanceStep.id,
        userId: params.userId,
        eventCode: params.eventCode,
        eventBizKey: params.eventBizKey,
        actionType:
          nextTaskStatus === TaskInstanceStatusEnum.COMPLETED
            ? TaskEventActionTypeEnum.COMPLETE
            : TaskEventActionTypeEnum.PROGRESS,
        progressSource: TaskEventProgressSourceEnum.EVENT,
        accepted: true,
        delta:
          nextCurrentValue > instanceStep.currentValue
            ? nextCurrentValue - instanceStep.currentValue
            : 0,
        beforeValue: instanceStep.currentValue,
        afterValue: nextCurrentValue,
        targetType: params.targetType,
        targetId: params.targetId,
        dimensionKey:
          params.step.progressMode === TaskStepProgressModeEnum.UNIQUE_COUNT
            ? (params.step.uniqueDimensionKey ?? null)
            : null,
        dimensionValue: dimension?.value ?? null,
        occurredAt: params.occurredAt,
        context: params.context,
      })

      return {
        instanceId: instance.id,
        progressed: nextTaskStatus !== TaskInstanceStatusEnum.COMPLETED,
        completed: nextTaskStatus === TaskInstanceStatusEnum.COMPLETED,
        duplicate: false,
      }
    })

    if (result.completed && this.hasRewardItems(params.task.rewardItems)) {
      await this.settleTaskInstanceReward({
        taskId: params.task.id,
        instanceId: result.instanceId!,
        userId: params.userId,
        rewardItems: params.task.rewardItems,
        occurredAt: params.occurredAt,
      })
    }

    return result
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

    return Boolean(created)
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
    const dateParts = this.getTaskCycleDateParts(task.repeatTimezone, now)

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

  // 按任务时区提取周期切分所需的日期片段。
  private getTaskCycleDateParts(
    repeatTimezone: string | null,
    value: Date,
  ): TaskCycleDateParts {
    const timeZone = repeatTimezone?.trim() || getAppTimeZone()
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
    const timeZone = task.repeatTimezone?.trim() || getAppTimeZone()
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

  // 过滤当前周期仍可领取的任务头。
  private async filterClaimableTaskDefinitionsForUser(
    tasks: TaskDefinitionSelect[],
    userId: number,
    now: Date,
  ) {
    if (tasks.length === 0) {
      return tasks
    }

    const cycleKeyByTaskId = new Map<number, string>()
    for (const task of tasks) {
      cycleKeyByTaskId.set(task.id, this.buildTaskCycleKey(task, now))
    }

    const rows = await this.db
      .select({
        taskId: this.taskInstanceTable.taskId,
        cycleKey: this.taskInstanceTable.cycleKey,
      })
      .from(this.taskInstanceTable)
      .where(
        and(
          eq(this.taskInstanceTable.userId, userId),
          isNull(this.taskInstanceTable.deletedAt),
          inArray(
            this.taskInstanceTable.taskId,
            tasks.map((task) => task.id),
          ),
        ),
      )

    const taken = new Set(rows.map((item) => `${item.taskId}:${item.cycleKey}`))

    return tasks.filter((task) => {
      const cycleKey = cycleKeyByTaskId.get(task.id)
      return !taken.has(`${task.id}:${cycleKey}`)
    })
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

    const rows = await this.db
      .select()
      .from(this.taskEventLogTable)
      .where(inArray(this.taskEventLogTable.instanceId, uniqueInstanceIds))
      .orderBy(
        desc(this.taskEventLogTable.occurredAt),
        desc(this.taskEventLogTable.createdAt),
      )

    for (const row of rows) {
      if (!row.instanceId || result.has(row.instanceId)) {
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

    for (const instance of instances) {
      const summaries: TaskUniqueFactSummaryRecord[] = []
      for (const step of stepMap.get(instance.taskId) ?? []) {
        const scopeKey =
          step.dedupeScope === TaskStepDedupeScopeEnum.LIFETIME
            ? 'lifetime'
            : instance.cycleKey
        const matchedFacts = factRows.filter(
          (row) =>
            row.taskId === instance.taskId &&
            row.stepId === step.id &&
            row.userId === instance.userId &&
            row.scopeKey === scopeKey,
        )

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

    await this.db
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
      })
      .where(eq(this.growthRewardSettlementTable.id, settlement.id))
  }
}
