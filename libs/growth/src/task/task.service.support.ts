import type { DrizzleService } from '@db/core';
import type { SQL } from 'drizzle-orm'
import type {
  CreateTaskDefinitionDto,
  QueryTaskDefinitionPageDto,
  UpdateTaskDefinitionDto,
} from './dto/task-admin.dto'
import type { AppAvailableTaskPageItemDto } from './dto/task-app.dto'
import type {
  AdminTaskDefinitionDetailDto,
  AdminTaskDefinitionListItemDto,
  TaskStepSummaryDto,
} from './dto/task-view.dto'
import type {
  TaskDefinitionRuntimeSummary,
  TaskStepFilterValueView,
  TaskStepSummaryView,
  TaskStepWriteInput,
  TaskVisibleStatusInput,
} from './types/task.type'
import { buildILikeCondition } from '@db/core'
import { GrowthRewardSettlementStatusEnum } from '@libs/growth/growth-reward/growth-reward.constant'
import { TaskTypeEnum } from '@libs/growth/task/task.constant'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { BadRequestException } from '@nestjs/common'
import { and, eq, inArray, isNull, or, sql } from 'drizzle-orm'
import {
  TaskClaimModeEnum,
  TaskCompletionPolicyEnum,
  TaskDefinitionStatusEnum,
  TaskRepeatCycleEnum,
  TaskStepProgressModeEnum,
  TaskStepTriggerModeEnum,
  TaskVisibleStatusEnum,
} from './task.constant'

/**
 * 新任务模型读链路共享支撑类。
 *
 * 收口 task 所需的表访问、步骤摘要聚合和运行态摘要查询，供读服务与后续执行服务复用。
 */
export abstract class TaskServiceSupport {
  // 注入 task 域共享的 Drizzle 访问入口。
  constructor(protected readonly drizzle: DrizzleService) {}

  // 数据库访问入口。
  protected get db() {
    return this.drizzle.db
  }

  // 新任务头表。
  protected get taskDefinitionTable() {
    return this.drizzle.schema.taskDefinition
  }

  // 新任务步骤表。
  protected get taskStepTable() {
    return this.drizzle.schema.taskStep
  }

  // 新任务实例表。
  protected get taskInstanceTable() {
    return this.drizzle.schema.taskInstance
  }

  // 新任务实例步骤表。
  protected get taskInstanceStepTable() {
    return this.drizzle.schema.taskInstanceStep
  }

  // 新任务唯一计数事实表。
  protected get taskStepUniqueFactTable() {
    return this.drizzle.schema.taskStepUniqueFact
  }

  // 新任务事件日志表。
  protected get taskEventLogTable() {
    return this.drizzle.schema.taskEventLog
  }

  // 奖励结算事实表。
  protected get growthRewardSettlementTable() {
    return this.drizzle.schema.growthRewardSettlement
  }

  // 构建任务头分页查询条件。
  protected buildTaskDefinitionWhere(params: QueryTaskDefinitionPageDto) {
    const conditions: SQL[] = [isNull(this.taskDefinitionTable.deletedAt)]

    if (params.status !== undefined) {
      conditions.push(eq(this.taskDefinitionTable.status, params.status))
    }
    if (params.sceneType !== undefined) {
      conditions.push(eq(this.taskDefinitionTable.sceneType, params.sceneType))
    }
    if (params.title) {
      conditions.push(
        buildILikeCondition(this.taskDefinitionTable.title, params.title)!,
      )
    }

    return and(...conditions)
  }

  // 查询一组任务头的步骤摘要。
  protected async getTaskStepSummaryMap(taskIds: number[]) {
    const uniqueTaskIds = [...new Set(taskIds.filter((id) => id > 0))]
    const result = new Map<number, TaskStepSummaryView[]>()

    if (uniqueTaskIds.length === 0) {
      return result
    }

    const rows = await this.db
      .select()
      .from(this.taskStepTable)
      .where(inArray(this.taskStepTable.taskId, uniqueTaskIds))
      .orderBy(this.taskStepTable.taskId, this.taskStepTable.stepNo)

    for (const row of rows) {
      const current = result.get(row.taskId) ?? []
      current.push({
        id: row.id,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        stepKey: row.stepKey,
        title: row.title,
        description: row.description ?? undefined,
        stepNo: row.stepNo,
        triggerMode: row.triggerMode,
        progressMode: row.progressMode,
        targetValue: row.targetValue,
        templateKey: row.templateKey ?? undefined,
        filters: this.normalizeTaskFilterValues(row.filterPayload),
        uniqueDimensionKey: row.uniqueDimensionKey ?? undefined,
        dedupeScope: row.dedupeScope ?? undefined,
      })
      result.set(row.taskId, current)
    }

    return result
  }

  // 查询一组任务头的运行态摘要。
  protected async getTaskDefinitionRuntimeSummaryMap(taskIds: number[]) {
    const uniqueTaskIds = [...new Set(taskIds.filter((id) => id > 0))]
    const result = new Map<number, TaskDefinitionRuntimeSummary>()

    if (uniqueTaskIds.length === 0) {
      return result
    }

    const [activeRows, rewardPendingRows] = await Promise.all([
      this.db
        .select({
          taskId: this.taskInstanceTable.taskId,
          count: sql<number>`count(*)::int`,
        })
        .from(this.taskInstanceTable)
        .where(
          and(
            isNull(this.taskInstanceTable.deletedAt),
            inArray(this.taskInstanceTable.taskId, uniqueTaskIds),
            inArray(this.taskInstanceTable.status, [0, 1, 2]),
          ),
        )
        .groupBy(this.taskInstanceTable.taskId),
      this.db
        .select({
          taskId: this.taskInstanceTable.taskId,
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
            isNull(this.taskInstanceTable.deletedAt),
            inArray(this.taskInstanceTable.taskId, uniqueTaskIds),
            eq(this.taskInstanceTable.status, 2),
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
        .groupBy(this.taskInstanceTable.taskId),
    ])

    for (const taskId of uniqueTaskIds) {
      result.set(taskId, {
        activeInstanceCount: 0,
        pendingRewardCompensationCount: 0,
      })
    }

    for (const row of activeRows) {
      result.set(row.taskId, {
        activeInstanceCount: Number(row.count ?? 0),
        pendingRewardCompensationCount:
          result.get(row.taskId)?.pendingRewardCompensationCount ?? 0,
      })
    }

    for (const row of rewardPendingRows) {
      result.set(row.taskId, {
        activeInstanceCount: result.get(row.taskId)?.activeInstanceCount ?? 0,
        pendingRewardCompensationCount: Number(row.count ?? 0),
      })
    }

    return result
  }

  // 把任务头记录映射成管理端列表投影。
  protected toAdminTaskDefinitionListItem(
    taskRecord: typeof this.taskDefinitionTable.$inferSelect,
    stepCount: number,
    runtimeSummary?: TaskDefinitionRuntimeSummary,
  ): AdminTaskDefinitionListItemDto {
    return {
      id: taskRecord.id,
      code: taskRecord.code,
      title: taskRecord.title,
      description: taskRecord.description ?? undefined,
      cover: taskRecord.cover ?? undefined,
      sceneType: taskRecord.sceneType,
      status: taskRecord.status,
      priority: taskRecord.priority,
      claimMode: taskRecord.claimMode,
      completionPolicy: taskRecord.completionPolicy,
      repeatType: taskRecord.repeatType,
      repeatTimezone: taskRecord.repeatTimezone ?? undefined,
      startAt: taskRecord.startAt,
      endAt: taskRecord.endAt,
      audienceSegmentId: taskRecord.audienceSegmentId ?? undefined,
      rewardItems: Array.isArray(taskRecord.rewardItems)
        ? taskRecord.rewardItems
        : null,
      createdAt: taskRecord.createdAt,
      updatedAt: taskRecord.updatedAt,
      stepCount,
      activeInstanceCount: runtimeSummary?.activeInstanceCount ?? 0,
      pendingRewardCompensationCount:
        runtimeSummary?.pendingRewardCompensationCount ?? 0,
    }
  }

  // 把任务头记录映射成管理端详情投影。
  protected toAdminTaskDefinitionDetail(
    taskRecord: typeof this.taskDefinitionTable.$inferSelect,
    steps: TaskStepSummaryDto[],
    runtimeSummary?: TaskDefinitionRuntimeSummary,
  ): AdminTaskDefinitionDetailDto {
    return {
      ...this.toAdminTaskDefinitionListItem(
        taskRecord,
        steps.length,
        runtimeSummary,
      ),
      steps,
    }
  }

  // 读取任务头详情，不存在则抛业务异常。
  protected async getTaskDefinitionRecordOrThrow(id: number) {
    const taskRecord = await this.db.query.taskDefinition.findFirst({
      where: {
        id,
        deletedAt: { isNull: true },
      },
    })

    if (!taskRecord) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '任务不存在',
      )
    }

    return taskRecord
  }

  // 构建任务头分页默认排序。
  protected buildTaskDefinitionOrderBy(params: QueryTaskDefinitionPageDto) {
    return this.drizzle.buildOrderBy(params.orderBy, {
      table: this.taskDefinitionTable,
      fallbackOrderBy: { id: 'desc' },
    })
  }

  // 构建任务头分页信息。
  protected buildTaskDefinitionPage(params: QueryTaskDefinitionPageDto) {
    return this.drizzle.buildPage({
      pageIndex: params.pageIndex,
      pageSize: params.pageSize,
    })
  }

  // 校验任务头发布时间窗口。
  protected ensureTaskDefinitionWindow(
    startAt?: Date | null,
    endAt?: Date | null,
  ) {
    if (startAt && endAt && startAt.getTime() > endAt.getTime()) {
      throw new BadRequestException('生效开始时间不能晚于生效结束时间')
    }
  }

  // 校验任务头场景类型。
  protected ensureTaskDefinitionSceneType(sceneType: number) {
    if (!Object.values(TaskTypeEnum).includes(sceneType)) {
      throw new BadRequestException(
        'sceneType 仅支持 ONBOARDING、DAILY、CAMPAIGN',
      )
    }
  }

  // 校验任务头状态。
  protected ensureTaskDefinitionStatus(status: number) {
    if (!Object.values(TaskDefinitionStatusEnum).includes(status)) {
      throw new BadRequestException(
        'status 仅支持 DRAFT、ACTIVE、PAUSED、ARCHIVED',
      )
    }
  }

  // 校验任务头领取方式。
  protected ensureTaskDefinitionClaimMode(claimMode: number) {
    if (!Object.values(TaskClaimModeEnum).includes(claimMode)) {
      throw new BadRequestException('claimMode 仅支持 AUTO、MANUAL')
    }
  }

  // 校验任务头完成聚合策略。
  protected ensureTaskCompletionPolicy(completionPolicy?: number | null) {
    const policy = completionPolicy ?? TaskCompletionPolicyEnum.ALL_STEPS
    if (!Object.values(TaskCompletionPolicyEnum).includes(policy)) {
      throw new BadRequestException('completionPolicy 当前仅支持 ALL_STEPS')
    }
    return policy
  }

  // 校验任务头重复周期。
  protected ensureTaskRepeatType(repeatType?: number | null) {
    const value = repeatType ?? TaskRepeatCycleEnum.ONCE
    if (!Object.values(TaskRepeatCycleEnum).includes(value)) {
      throw new BadRequestException(
        'repeatType 仅支持 ONCE、DAILY、WEEKLY、MONTHLY',
      )
    }
    return value
  }

  // 校验单步骤写入合同。
  protected ensureTaskStepWriteInput(
    step: TaskStepWriteInput,
    templateSelectable: boolean,
    templateEventCode?: number | null,
    supportedProgressModes?: readonly number[],
  ) {
    if (!step.title?.trim()) {
      throw new BadRequestException('step.title 不能为空')
    }
    if (!Number.isInteger(step.targetValue) || step.targetValue <= 0) {
      throw new BadRequestException('step.targetValue 必须是大于 0 的整数')
    }
    if (!Object.values(TaskStepTriggerModeEnum).includes(step.triggerMode)) {
      throw new BadRequestException('step.triggerMode 仅支持 MANUAL、EVENT')
    }
    if (!Object.values(TaskStepProgressModeEnum).includes(step.progressMode)) {
      throw new BadRequestException(
        'step.progressMode 仅支持 ONCE、COUNT、UNIQUE_COUNT',
      )
    }

    if (step.triggerMode === TaskStepTriggerModeEnum.MANUAL) {
      if (
        step.eventCode !== undefined ||
        step.templateKey !== undefined ||
        this.hasTaskFilterPayload(step.filterPayload)
      ) {
        throw new BadRequestException(
          '手动步骤不能配置 eventCode、templateKey 或过滤条件',
        )
      }
      if (step.progressMode === TaskStepProgressModeEnum.UNIQUE_COUNT) {
        throw new BadRequestException('手动步骤当前不支持 UNIQUE_COUNT')
      }
    }

    if (step.triggerMode === TaskStepTriggerModeEnum.EVENT) {
      if (!step.templateKey) {
        throw new BadRequestException('事件步骤必须配置 templateKey')
      }
      if (step.eventCode === undefined || step.eventCode === null) {
        throw new BadRequestException('事件步骤必须配置 eventCode')
      }
      if (!templateSelectable) {
        throw new BadRequestException('当前模板未正式接通，不能创建为生效任务')
      }
      if (
        typeof templateEventCode === 'number' &&
        step.eventCode !== templateEventCode
      ) {
        throw new BadRequestException('step.eventCode 与模板事件编码不一致')
      }
      if (
        supportedProgressModes &&
        !supportedProgressModes.includes(step.progressMode)
      ) {
        throw new BadRequestException('当前模板不支持所选 progressMode')
      }
    }

    if (step.progressMode === TaskStepProgressModeEnum.UNIQUE_COUNT) {
      if (!step.uniqueDimensionKey?.trim()) {
        throw new BadRequestException(
          'UNIQUE_COUNT 步骤必须配置 uniqueDimensionKey',
        )
      }
      if (!step.dedupeScope) {
        throw new BadRequestException('UNIQUE_COUNT 步骤必须配置 dedupeScope')
      }
    } else if (
      step.uniqueDimensionKey !== undefined ||
      step.dedupeScope !== undefined
    ) {
      throw new BadRequestException(
        '只有 UNIQUE_COUNT 步骤允许配置 uniqueDimensionKey 和 dedupeScope',
      )
    }
  }

  // 校验单步骤任务头写入合同。
  protected ensureTaskDefinitionWriteInput(
    input: CreateTaskDefinitionDto | UpdateTaskDefinitionDto,
  ) {
    if (input.sceneType !== undefined) {
      this.ensureTaskDefinitionSceneType(input.sceneType)
    }
    if (input.status !== undefined) {
      this.ensureTaskDefinitionStatus(input.status)
    }
    if (input.claimMode !== undefined) {
      this.ensureTaskDefinitionClaimMode(input.claimMode)
    }
    this.ensureTaskDefinitionWindow(input.startAt, input.endAt)
    this.ensureTaskCompletionPolicy(input.completionPolicy)
    this.ensureTaskRepeatType(input.repeatType)
  }

  // 统一映射用户可见状态。
  protected resolveTaskVisibleStatus(params: TaskVisibleStatusInput) {
    if (params.status === 3) {
      return TaskVisibleStatusEnum.EXPIRED
    }
    if (params.status === 1) {
      return TaskVisibleStatusEnum.IN_PROGRESS
    }
    if (params.status === 0) {
      return TaskVisibleStatusEnum.CLAIMED
    }
    if (params.status === 2) {
      if (params.rewardApplicable !== 1) {
        return TaskVisibleStatusEnum.COMPLETED
      }
      return params.rewardSettlementStatus ===
        GrowthRewardSettlementStatusEnum.SUCCESS
        ? TaskVisibleStatusEnum.REWARD_GRANTED
        : TaskVisibleStatusEnum.REWARD_PENDING
    }
    return TaskVisibleStatusEnum.UNAVAILABLE
  }

  // 映射 app 可领取任务卡片。
  protected toAppAvailableTaskItem(
    taskRecord: typeof this.taskDefinitionTable.$inferSelect,
    steps: TaskStepSummaryDto[],
  ): AppAvailableTaskPageItemDto {
    return {
      id: taskRecord.id,
      code: taskRecord.code,
      title: taskRecord.title,
      description: taskRecord.description ?? undefined,
      cover: taskRecord.cover ?? undefined,
      sceneType: taskRecord.sceneType,
      priority: taskRecord.priority,
      claimMode: taskRecord.claimMode,
      completionPolicy: taskRecord.completionPolicy,
      repeatType: taskRecord.repeatType,
      repeatTimezone: taskRecord.repeatTimezone ?? undefined,
      startAt: taskRecord.startAt,
      endAt: taskRecord.endAt,
      rewardItems: Array.isArray(taskRecord.rewardItems)
        ? taskRecord.rewardItems
        : null,
      visibleStatus: TaskVisibleStatusEnum.CLAIMABLE,
      steps,
    }
  }

  // 时间平移辅助方法。
  protected addHours(date: Date, hours: number) {
    const next = new Date(date)
    next.setHours(next.getHours() + hours)
    return next
  }

  // 判断过滤配置中是否存在有效条件。
  protected hasTaskFilterPayload(filterPayload: unknown) {
    return this.normalizeTaskFilterValues(filterPayload).length > 0
  }

  // 把步骤过滤配置收敛成可复用的结构化字段视图。
  protected normalizeTaskFilterValues(
    filterPayload: unknown,
  ): TaskStepFilterValueView[] {
    if (
      filterPayload &&
      typeof filterPayload === 'object' &&
      !Array.isArray(filterPayload)
    ) {
      return Object.entries(filterPayload as Record<string, unknown>).map(
        ([key, value]) => ({
          key,
          value:
            typeof value === 'string'
              ? value
              : value === null || value === undefined
                ? ''
                : JSON.stringify(value),
        }),
      )
    }

    return []
  }
}
