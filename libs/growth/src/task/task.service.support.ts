import type { Db, DbTransaction, DrizzleService } from '@db/core'
import type { TaskDefinitionSelect } from '@db/schema'
import type { SQL } from 'drizzle-orm'
import type {
  CreateTaskDefinitionDto,
  UpdateTaskDefinitionDto,
} from './dto/task-admin.dto'
import type { AppAvailableTaskPageItemDto } from './dto/task-app.dto'
import type { QueryTaskDefinitionPageDto } from './dto/task-query.dto'
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
import {
  acquireIntegrityLocks,
  buildILikeCondition,
  exclusiveIntegrityLock,
  tableIntegrityLock,
} from '@db/core'
import { GrowthRewardSettlementStatusEnum } from '@libs/growth/growth-reward/growth-reward.constant'
import { GrowthRewardRuleAssetTypeEnum } from '@libs/growth/reward-rule/reward-rule.constant'
import { TaskTypeEnum } from '@libs/growth/task/task.constant'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { buildDateOnlyRangeInAppTimeZone } from '@libs/platform/utils'
import { and, eq, gte, inArray, isNull, lt, or, sql } from 'drizzle-orm'
import {
  TaskClaimModeEnum,
  TaskCompletionPolicyEnum,
  TaskDefinitionStatusEnum,
  TaskInstanceStatusEnum,
  TaskRepeatCycleEnum,
  TaskStepTriggerModeEnum,
  TaskVisibleStatusEnum,
} from './task.constant'

type TaskDefinitionAdminReadRecord = Pick<
  TaskDefinitionSelect,
  | 'id'
  | 'code'
  | 'title'
  | 'description'
  | 'cover'
  | 'sceneType'
  | 'status'
  | 'sortOrder'
  | 'claimMode'
  | 'completionPolicy'
  | 'repeatType'
  | 'startAt'
  | 'endAt'
  | 'rewardItems'
  | 'createdAt'
  | 'updatedAt'
>

type TaskDefinitionAppReadRecord = Pick<
  TaskDefinitionSelect,
  | 'id'
  | 'code'
  | 'title'
  | 'description'
  | 'cover'
  | 'sceneType'
  | 'sortOrder'
  | 'claimMode'
  | 'completionPolicy'
  | 'repeatType'
  | 'startAt'
  | 'endAt'
  | 'rewardItems'
>

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

  /**
   * task_definition 不使用物理外键。定义失效（暂停、归档、软删除、执行合同
   * 更新）与新实例写入必须争用同一 canonical record lock；调用方必须在获得
   * 锁后重新读取任务和步骤，不能复用锁前快照。
   */
  protected async lockTaskDefinitionForMutation(
    tx: DbTransaction,
    taskId: number,
  ) {
    await acquireIntegrityLocks(tx, [
      exclusiveIntegrityLock(tableIntegrityLock('task_definition', taskId)),
    ])
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

  // 新任务事件消费失败事实表。
  protected get taskEventFailureTable() {
    return this.drizzle.schema.taskEventFailure
  }

  // 奖励结算事实表。
  protected get growthRewardSettlementTable() {
    return this.drizzle.schema.growthRewardSettlement
  }

  // 管理端任务头列表/详情的稳定读取投影。
  protected getTaskDefinitionAdminReadSelect() {
    return {
      id: this.taskDefinitionTable.id,
      code: this.taskDefinitionTable.code,
      title: this.taskDefinitionTable.title,
      description: this.taskDefinitionTable.description,
      cover: this.taskDefinitionTable.cover,
      sceneType: this.taskDefinitionTable.sceneType,
      status: this.taskDefinitionTable.status,
      sortOrder: this.taskDefinitionTable.sortOrder,
      claimMode: this.taskDefinitionTable.claimMode,
      completionPolicy: this.taskDefinitionTable.completionPolicy,
      repeatType: this.taskDefinitionTable.repeatType,
      startAt: this.taskDefinitionTable.startAt,
      endAt: this.taskDefinitionTable.endAt,
      rewardItems: this.taskDefinitionTable.rewardItems,
      createdAt: this.taskDefinitionTable.createdAt,
      updatedAt: this.taskDefinitionTable.updatedAt,
    }
  }

  // App 可领取任务卡片的稳定读取投影。
  protected getTaskDefinitionAppReadSelect() {
    return {
      id: this.taskDefinitionTable.id,
      code: this.taskDefinitionTable.code,
      title: this.taskDefinitionTable.title,
      description: this.taskDefinitionTable.description,
      cover: this.taskDefinitionTable.cover,
      sceneType: this.taskDefinitionTable.sceneType,
      sortOrder: this.taskDefinitionTable.sortOrder,
      claimMode: this.taskDefinitionTable.claimMode,
      completionPolicy: this.taskDefinitionTable.completionPolicy,
      repeatType: this.taskDefinitionTable.repeatType,
      startAt: this.taskDefinitionTable.startAt,
      endAt: this.taskDefinitionTable.endAt,
      rewardItems: this.taskDefinitionTable.rewardItems,
    }
  }

  // 管理端任务头详情 RQB V2 显式列集。
  protected getTaskDefinitionAdminReadColumns() {
    return {
      id: true,
      code: true,
      title: true,
      description: true,
      cover: true,
      sceneType: true,
      status: true,
      sortOrder: true,
      claimMode: true,
      completionPolicy: true,
      repeatType: true,
      startAt: true,
      endAt: true,
      rewardItems: true,
      createdAt: true,
      updatedAt: true,
    } as const
  }

  // 写链需要完整任务头快照；显式全列避免 RQB 隐式宽读。
  protected getTaskDefinitionWriteColumns() {
    return {
      id: true,
      code: true,
      title: true,
      description: true,
      cover: true,
      sceneType: true,
      status: true,
      sortOrder: true,
      claimMode: true,
      completionPolicy: true,
      repeatType: true,
      startAt: true,
      endAt: true,
      rewardItems: true,
      createdById: true,
      updatedById: true,
      createdAt: true,
      updatedAt: true,
      deletedAt: true,
    } as const
  }

  // 写链需要完整步骤快照；显式全列避免 RQB 隐式宽读。
  protected getTaskStepWriteColumns() {
    return {
      id: true,
      taskId: true,
      stepKey: true,
      title: true,
      description: true,
      stepNo: true,
      triggerMode: true,
      eventCode: true,
      targetValue: true,
      templateKey: true,
      filterPayload: true,
      dedupeScope: true,
      createdAt: true,
      updatedAt: true,
    } as const
  }

  // 任务步骤摘要的最小读取投影。
  protected getTaskStepSummarySelect() {
    return {
      id: this.taskStepTable.id,
      taskId: this.taskStepTable.taskId,
      createdAt: this.taskStepTable.createdAt,
      updatedAt: this.taskStepTable.updatedAt,
      stepKey: this.taskStepTable.stepKey,
      title: this.taskStepTable.title,
      description: this.taskStepTable.description,
      stepNo: this.taskStepTable.stepNo,
      triggerMode: this.taskStepTable.triggerMode,
      targetValue: this.taskStepTable.targetValue,
      templateKey: this.taskStepTable.templateKey,
      filterPayload: this.taskStepTable.filterPayload,
      dedupeScope: this.taskStepTable.dedupeScope,
    }
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
    const createdRange = buildDateOnlyRangeInAppTimeZone(
      params.startDate,
      params.endDate,
    )
    if (createdRange?.gte) {
      conditions.push(gte(this.taskDefinitionTable.createdAt, createdRange.gte))
    }
    if (createdRange?.lt) {
      conditions.push(lt(this.taskDefinitionTable.createdAt, createdRange.lt))
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
      .select(this.getTaskStepSummarySelect())
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
        description: row.description ?? null,
        stepNo: row.stepNo,
        triggerMode: row.triggerMode,
        targetValue: row.targetValue,
        templateKey: row.templateKey ?? null,
        filters: this.normalizeTaskFilterValues(row.filterPayload),
        dedupeScope: row.dedupeScope ?? null,
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
          count: sql<number>`count(*)::int`.mapWith(Number),
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
          count: sql<number>`count(*)::int`.mapWith(Number),
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
              isNull(this.growthRewardSettlementTable.id),
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

  // 断言任务没有仍在执行中的实例，避免运营侧改写已领取实例的执行合同。
  protected async ensureNoActiveTaskInstances(runner: Db, taskId: number) {
    const rows = await runner
      .select({ count: sql<number>`count(*)::int`.mapWith(Number) })
      .from(this.taskInstanceTable)
      .where(
        and(
          isNull(this.taskInstanceTable.deletedAt),
          eq(this.taskInstanceTable.taskId, taskId),
          inArray(this.taskInstanceTable.status, [
            TaskInstanceStatusEnum.PENDING,
            TaskInstanceStatusEnum.IN_PROGRESS,
          ]),
        ),
      )

    if (Number(rows[0]?.count ?? 0) > 0) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '任务已有进行中的实例，不能修改执行合同',
      )
    }
  }

  // 把任务头记录映射成管理端列表投影。
  protected toAdminTaskDefinitionListItem(
    taskRecord: TaskDefinitionAdminReadRecord,
    stepCount: number,
    runtimeSummary?: TaskDefinitionRuntimeSummary,
  ): AdminTaskDefinitionListItemDto {
    return {
      id: taskRecord.id,
      code: taskRecord.code,
      title: taskRecord.title,
      description: taskRecord.description ?? null,
      cover: taskRecord.cover ?? null,
      sceneType: taskRecord.sceneType,
      status: taskRecord.status,
      sortOrder: taskRecord.sortOrder,
      claimMode: taskRecord.claimMode,
      completionPolicy: taskRecord.completionPolicy,
      repeatType: taskRecord.repeatType,
      startAt: taskRecord.startAt,
      endAt: taskRecord.endAt,
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
    taskRecord: TaskDefinitionAdminReadRecord,
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
  protected async getTaskDefinitionDetailRecordOrThrow(id: number) {
    const taskRecord = await this.db.query.taskDefinition.findFirst({
      columns: this.getTaskDefinitionAdminReadColumns(),
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

  // 写链读取完整任务头，不存在则抛业务异常。
  protected async getTaskDefinitionRecordOrThrow(id: number) {
    const taskRecord = await this.db.query.taskDefinition.findFirst({
      columns: this.getTaskDefinitionWriteColumns(),
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

  // 在已取得任务定义完整性锁的事务内读取仍有效的任务头。
  protected async getTaskDefinitionRecordOrThrowInTx(
    tx: DbTransaction,
    id: number,
  ) {
    const taskRecord = await tx.query.taskDefinition.findFirst({
      columns: this.getTaskDefinitionWriteColumns(),
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

  // 在已取得任务定义完整性锁的事务内读取唯一步骤。
  protected async getSingleTaskStepOrThrowInTx(
    tx: DbTransaction,
    taskId: number,
    stepNo?: number,
  ) {
    const step = await tx.query.taskStep.findFirst({
      columns: this.getTaskStepWriteColumns(),
      where: {
        taskId,
        ...(stepNo === undefined ? {} : { stepNo }),
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

  // 在已取得任务定义完整性锁的事务内确认当前任务仍可领取/执行。
  protected async getAvailableTaskDefinitionOrThrowInTx(
    tx: DbTransaction,
    taskId: number,
    now: Date,
  ) {
    const task = await tx.query.taskDefinition.findFirst({
      columns: this.getTaskDefinitionWriteColumns(),
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

  // 构建任务头分页默认排序。
  protected buildTaskDefinitionOrderBy(params: QueryTaskDefinitionPageDto) {
    return this.drizzle.buildOrderBy(params.orderBy, {
      table: this.taskDefinitionTable,
      fallbackOrderBy: { sortOrder: 'asc', id: 'asc' },
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
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '生效开始时间不能晚于生效结束时间',
      )
    }
  }

  // 校验任务头场景类型。
  protected ensureTaskDefinitionSceneType(sceneType: number) {
    if (!Object.values(TaskTypeEnum).includes(sceneType)) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        'sceneType 仅支持 ONBOARDING、DAILY、CAMPAIGN',
      )
    }
  }

  // 校验任务头状态。
  protected ensureTaskDefinitionStatus(status: number) {
    if (!Object.values(TaskDefinitionStatusEnum).includes(status)) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        'status 仅支持 DRAFT、ACTIVE、PAUSED、ARCHIVED',
      )
    }
  }

  // 校验任务头领取方式。
  protected ensureTaskDefinitionClaimMode(claimMode: number) {
    if (!Object.values(TaskClaimModeEnum).includes(claimMode)) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        'claimMode 仅支持 AUTO、MANUAL',
      )
    }
  }

  // 校验任务领取方式与步骤触发方式的唯一合法矩阵。
  protected ensureTaskExecutionModeMatrix(
    claimMode: number,
    triggerMode: number,
  ) {
    const legalAutoEvent =
      claimMode === TaskClaimModeEnum.AUTO &&
      triggerMode === TaskStepTriggerModeEnum.EVENT
    const legalManualManual =
      claimMode === TaskClaimModeEnum.MANUAL &&
      triggerMode === TaskStepTriggerModeEnum.MANUAL

    if (!legalAutoEvent && !legalManualManual) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '任务执行模式仅支持自动领取+事件驱动，或手动领取+手动触发',
      )
    }
  }

  // 校验任务头完成聚合策略。
  protected ensureTaskCompletionPolicy(completionPolicy?: number | null) {
    const policy = completionPolicy ?? TaskCompletionPolicyEnum.ALL_STEPS
    if (!Object.values(TaskCompletionPolicyEnum).includes(policy)) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        'completionPolicy 当前仅支持 ALL_STEPS',
      )
    }
    return policy
  }

  // 校验任务头重复周期。
  protected ensureTaskRepeatType(repeatType?: number | null) {
    const value = repeatType ?? TaskRepeatCycleEnum.ONCE
    if (!Object.values(TaskRepeatCycleEnum).includes(value)) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
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
    templateSupportsUniqueCounting?: boolean,
  ) {
    if (!step.title?.trim()) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        'step.title 不能为空',
      )
    }
    if (!Number.isInteger(step.targetValue) || step.targetValue <= 0) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        'step.targetValue 必须是大于 0 的整数',
      )
    }
    if (!Object.values(TaskStepTriggerModeEnum).includes(step.triggerMode)) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        'step.triggerMode 仅支持 MANUAL、EVENT',
      )
    }

    if (step.triggerMode === TaskStepTriggerModeEnum.MANUAL) {
      if (
        step.eventCode !== undefined ||
        step.templateKey !== undefined ||
        this.hasTaskFilterPayload(step.filterPayload) ||
        step.dedupeScope !== undefined
      ) {
        throw new BusinessException(
          BusinessErrorCode.OPERATION_NOT_ALLOWED,
          '手动步骤不能配置 eventCode、templateKey、过滤条件或去重范围',
        )
      }
    }

    if (step.triggerMode === TaskStepTriggerModeEnum.EVENT) {
      if (!step.templateKey) {
        throw new BusinessException(
          BusinessErrorCode.OPERATION_NOT_ALLOWED,
          '事件步骤必须配置 templateKey',
        )
      }
      if (step.eventCode === undefined || step.eventCode === null) {
        throw new BusinessException(
          BusinessErrorCode.OPERATION_NOT_ALLOWED,
          '事件步骤必须配置 eventCode',
        )
      }
      if (!templateSelectable) {
        throw new BusinessException(
          BusinessErrorCode.OPERATION_NOT_ALLOWED,
          '当前模板未正式接通，不能创建为生效任务',
        )
      }
      if (
        typeof templateEventCode === 'number' &&
        step.eventCode !== templateEventCode
      ) {
        throw new BusinessException(
          BusinessErrorCode.OPERATION_NOT_ALLOWED,
          'step.eventCode 与模板事件编码不一致',
        )
      }
      if (step.dedupeScope !== undefined && !templateSupportsUniqueCounting) {
        throw new BusinessException(
          BusinessErrorCode.OPERATION_NOT_ALLOWED,
          '当前模板不支持按不同对象累计',
        )
      }
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
    this.ensureTaskRewardItemsContract(input.rewardItems)
  }

  // 任务奖励当前仅支持积分和经验，避免运营配置无法落账的通用资产。
  protected ensureTaskRewardItemsContract(rewardItems?: unknown) {
    if (rewardItems === undefined || rewardItems === null) {
      return
    }
    if (!Array.isArray(rewardItems)) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        'rewardItems 必须是奖励项数组',
      )
    }

    for (const [index, item] of rewardItems.entries()) {
      const record =
        item && typeof item === 'object' && !Array.isArray(item)
          ? (item as Record<string, unknown>)
          : null
      const assetType = Number(record?.assetType)
      const amount = Number(record?.amount)
      const assetKey = String(record?.assetKey ?? '')

      if (
        assetType !== GrowthRewardRuleAssetTypeEnum.POINTS &&
        assetType !== GrowthRewardRuleAssetTypeEnum.EXPERIENCE
      ) {
        throw new BusinessException(
          BusinessErrorCode.OPERATION_NOT_ALLOWED,
          `任务奖励第 ${index + 1} 项仅支持积分或经验`,
        )
      }
      if (assetKey.trim() !== '') {
        throw new BusinessException(
          BusinessErrorCode.OPERATION_NOT_ALLOWED,
          `任务奖励第 ${index + 1} 项积分/经验 assetKey 必须为空`,
        )
      }
      if (!Number.isInteger(amount) || amount <= 0) {
        throw new BusinessException(
          BusinessErrorCode.OPERATION_NOT_ALLOWED,
          `任务奖励第 ${index + 1} 项 amount 必须是大于 0 的整数`,
        )
      }
    }
  }

  // 统一映射用户可见状态。
  protected resolveTaskVisibleStatus(params: TaskVisibleStatusInput) {
    switch (params.status) {
      case TaskInstanceStatusEnum.EXPIRED:
        return TaskVisibleStatusEnum.EXPIRED
      case TaskInstanceStatusEnum.IN_PROGRESS:
        return TaskVisibleStatusEnum.IN_PROGRESS
      case TaskInstanceStatusEnum.PENDING:
        return TaskVisibleStatusEnum.CLAIMED
      case TaskInstanceStatusEnum.COMPLETED:
        if (params.rewardApplicable !== 1) {
          return TaskVisibleStatusEnum.COMPLETED
        }
        return params.rewardSettlementStatus ===
          GrowthRewardSettlementStatusEnum.SUCCESS
          ? TaskVisibleStatusEnum.REWARD_GRANTED
          : TaskVisibleStatusEnum.REWARD_PENDING
      default:
        return TaskVisibleStatusEnum.UNAVAILABLE
    }
  }

  // 映射 app 可领取任务卡片。
  protected toAppAvailableTaskItem(
    taskRecord: TaskDefinitionAppReadRecord,
    steps: TaskStepSummaryDto[],
  ): AppAvailableTaskPageItemDto {
    return {
      id: taskRecord.id,
      code: taskRecord.code,
      title: taskRecord.title,
      description: taskRecord.description ?? null,
      cover: taskRecord.cover ?? null,
      sceneType: taskRecord.sceneType,
      sortOrder: taskRecord.sortOrder,
      claimMode: taskRecord.claimMode,
      completionPolicy: taskRecord.completionPolicy,
      repeatType: taskRecord.repeatType,
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
        ([key, value]) => {
          let normalizedValue = JSON.stringify(value)

          if (typeof value === 'string') {
            normalizedValue = value
          } else if (value === null || value === undefined) {
            normalizedValue = ''
          }

          return {
            key,
            value: normalizedValue,
          }
        },
      )
    }

    return []
  }
}
