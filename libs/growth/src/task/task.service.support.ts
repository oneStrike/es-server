import type { Db, DrizzleService } from '@db/core'

import type { TaskAssignmentInsert, TaskAssignmentSelect, TaskSelect } from '@db/schema'

import type { MessageDomainEventPublisher } from '@libs/message/eventing/message-domain-event.publisher'
import type { PublishMessageDomainEventInput } from '@libs/message/eventing/message-event.type'
import type { Dayjs } from 'dayjs'
import type { SQL } from 'drizzle-orm'
import type { UserGrowthRewardService } from '../growth-reward/growth-reward.service'
import type { TaskRewardSettlementResult } from '../growth-reward/growth-reward.types'
import type { GrowthRuleTypeEnum } from '../growth-rule.constant'
import type {
  QueryTaskAssignmentReconciliationDto,
  UpdateTaskDto,
} from './dto/task.dto'
import type {
  AdvanceAssignmentByEventInput,
  ApplyAssignmentEventProgressInput,
  AppTaskViewSource,
  AutoAssignmentTaskSource,
  BuildTaskCompleteEventEnvelopeInput,
  CreateOrGetAssignmentOptions,
  CreateOrGetAssignmentTaskInput,
  EnsureTaskObjectiveContractInput,
  ExpireAssignmentsByWhereInput,
  QueryTaskAssignmentPageParams,
  QueryTaskAssignmentPageResult,
  ResolveTaskUserVisibleStatusInput,
  TaskAssignmentEventProgressSummary,
  TaskAssignmentRewardReminderSummary,
  TaskAssignmentWithTaskRow,
  TaskAutoAssignmentReminderTaskInput,
  TaskCompleteEventAssignmentInput,
  TaskCompleteEventTaskInput,
  TaskEventProgressInput,
  TaskLatestReminderRow,
  TaskObjectiveConfig,
  TaskProgressLogRecordInput,
  TaskRelationRow,
  TaskReminderAssignmentInput,
  TaskRepeatRuleConfig,
  TaskRewardItems,
  TaskRewardReminderTaskInput,
  TaskRewardSettlementAssignmentInput,
  TaskRewardSettlementRelationRow,
  TaskRewardSettlementTaskInput,
  TaskRewardTaskRecord,
  TaskRewardTaskRecordBuildAssignmentInput,
  TaskRewardTaskRecordBuildCurrentTaskInput,
  TaskRuntimeHealthSummary,
  TaskSnapshotSource,
} from './task.type'
import process from 'node:process'
import { EventDefinitionEntityTypeEnum } from '@libs/growth/event-definition/event-definition.type'
import {
  createEventEnvelope,
  EventEnvelopeGovernanceStatusEnum,
} from '@libs/growth/event-definition/event-envelope.type'
import {
  GrowthRewardSettlementStatusEnum,
  GrowthRewardSettlementTypeEnum,
} from '@libs/growth/growth-reward/growth-reward.constant'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { BadRequestException, Logger } from '@nestjs/common'
import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lte,
  or,
  sql,
} from 'drizzle-orm'
import { GROWTH_RULE_TYPE_VALUES } from '../growth-rule.constant'
import { GrowthRewardRuleAssetTypeEnum } from '../reward-rule/reward-rule.constant'
import { TaskNotificationService } from './task-notification.service'
import {
  getTaskTypeFilterValues,
  normalizeTaskObjectiveType,
  normalizeTaskType,
  TASK_COMPLETE_EVENT_CODE,
  TASK_COMPLETE_EVENT_KEY,
  TaskAssignmentRewardResultTypeEnum,
  TaskAssignmentStatusEnum,
  TaskClaimModeEnum,
  TaskCompleteModeEnum,
  TaskObjectiveTypeEnum,
  TaskProgressActionTypeEnum,
  TaskProgressSourceEnum,
  TaskReminderKindEnum,
  TaskRepeatTypeEnum,
  TaskStatusEnum,
  TaskUserVisibleStatusEnum,
} from './task.constant'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(isoWeek)

/**
 * 任务域共享支撑类。
 *
 * 收口 task 模块的底层 Drizzle 访问、状态机规则、奖励补偿、通知组装、
 * 视图映射与周期计算，供拆分后的 task 子服务和兼容测试适配层复用。
 */
export abstract class TaskServiceSupport {
  protected readonly logger = new Logger('TaskService')
  protected readonly taskNotificationService = new TaskNotificationService()
  protected readonly defaultTaskTimezone =
    this.normalizeTaskTimezone(process.env.TZ) ?? 'Asia/Shanghai'

  constructor(
    protected readonly drizzle: DrizzleService,
    protected readonly userGrowthRewardService: UserGrowthRewardService,
    protected readonly messageDomainEventPublisher: MessageDomainEventPublisher,
  ) {}

  /** 数据库连接实例 */
  protected get db() {
    return this.drizzle.db
  }

  /** 任务表 */
  protected get taskTable() {
    return this.drizzle.schema.task
  }

  /** 任务分配表 */
  protected get taskAssignmentTable() {
    return this.drizzle.schema.taskAssignment
  }

  /** 任务奖励结算事实表 */
  protected get growthRewardSettlementTable() {
    return this.drizzle.schema.growthRewardSettlement
  }

  /** 任务进度日志表 */
  protected get taskProgressLogTable() {
    return this.drizzle.schema.taskProgressLog
  }

  /** 通知投递结果表 */
  protected get notificationDeliveryTable() {
    return this.drizzle.schema.notificationDelivery
  }

  /** 领域事件表 */
  protected get domainEventTable() {
    return this.drizzle.schema.domainEvent
  }

  // ==================== 查询投影与分页 ====================

  /**
   * 构建 assignment 列表联表查询使用的稳定 task 摘要投影。
   */
  protected buildTaskRelationSelection() {
    return {
      id: this.taskTable.id,
      code: this.taskTable.code,
      title: this.taskTable.title,
      description: this.taskTable.description,
      cover: this.taskTable.cover,
      type: this.taskTable.type,
      objectiveType: this.taskTable.objectiveType,
      eventCode: this.taskTable.eventCode,
      objectiveConfig: this.taskTable.objectiveConfig,
      rewardItems: this.taskTable.rewardItems,
      targetCount: this.taskTable.targetCount,
      completeMode: this.taskTable.completeMode,
      claimMode: this.taskTable.claimMode,
    }
  }

  /**
   * 构建 assignment 列表联表查询使用的奖励结算摘要投影。
   */
  protected buildTaskRewardSettlementSelection() {
    return {
      id: this.growthRewardSettlementTable.id,
      settlementStatus: this.growthRewardSettlementTable.settlementStatus,
      settlementResultType:
        this.growthRewardSettlementTable.settlementResultType,
      retryCount: this.growthRewardSettlementTable.retryCount,
      lastRetryAt: this.growthRewardSettlementTable.lastRetryAt,
      settledAt: this.growthRewardSettlementTable.settledAt,
      lastError: this.growthRewardSettlementTable.lastError,
      ledgerRecordIds: this.growthRewardSettlementTable.ledgerRecordIds,
    }
  }

  /**
   * 构建自动分配链路使用的 task 执行态投影。
   */
  protected buildAutoAssignmentTaskSelection() {
    return {
      id: this.taskTable.id,
      code: this.taskTable.code,
      title: this.taskTable.title,
      description: this.taskTable.description,
      cover: this.taskTable.cover,
      type: this.taskTable.type,
      completeMode: this.taskTable.completeMode,
      objectiveType: this.taskTable.objectiveType,
      eventCode: this.taskTable.eventCode,
      objectiveConfig: this.taskTable.objectiveConfig,
      rewardItems: this.taskTable.rewardItems,
      targetCount: this.taskTable.targetCount,
      claimMode: this.taskTable.claimMode,
      publishStartAt: this.taskTable.publishStartAt,
      publishEndAt: this.taskTable.publishEndAt,
      repeatRule: this.taskTable.repeatRule,
    }
  }

  /**
   * 按条件分页查询任务分配，并固定携带任务摘要字段。
   *
   * 该方法统一管理排序解析、联表投影与总数统计，确保管理端与应用端列表查询
   * 复用同一份 assignment + live task 摘要合同。
   */
  protected async queryTaskAssignmentPage(
    params: QueryTaskAssignmentPageParams,
  ): Promise<QueryTaskAssignmentPageResult> {
    const {
      assignmentWhereClause,
      taskWhereClause,
      pageIndex,
      pageSize,
      orderBy,
    } = params
    const page = this.drizzle.buildPage({ pageIndex, pageSize })
    const order = this.drizzle.buildOrderBy(orderBy, {
      table: this.taskAssignmentTable,
      fallbackOrderBy: { id: 'desc' },
    })
    const whereClause =
      assignmentWhereClause && taskWhereClause
        ? and(assignmentWhereClause, taskWhereClause)
        : (assignmentWhereClause ?? taskWhereClause)
    const [primaryOrderBy, ...secondaryOrderBys] = order.orderBySql as [
      SQL,
      ...SQL[],
    ]

    const [list, total] = await Promise.all([
      this.db
        .select({
          assignment: this.taskAssignmentTable,
          task: this.buildTaskRelationSelection(),
          rewardSettlement: this.buildTaskRewardSettlementSelection(),
        })
        .from(this.taskAssignmentTable)
        .leftJoin(
          this.taskTable,
          eq(this.taskAssignmentTable.taskId, this.taskTable.id),
        )
        .leftJoin(
          this.growthRewardSettlementTable,
          eq(
            this.taskAssignmentTable.rewardSettlementId,
            this.growthRewardSettlementTable.id,
          ),
        )
        .where(whereClause)
        .limit(page.limit)
        .offset(page.offset)
        .orderBy(primaryOrderBy, ...secondaryOrderBys),
      this.countTaskAssignmentPage(
        assignmentWhereClause,
        taskWhereClause,
        whereClause,
      ),
    ])

    return {
      list: list.map((item) => ({
        ...item.assignment,
        task: item.task ? this.normalizeTaskRelation(item.task) : item.task,
        rewardSettlement: item.rewardSettlement?.id
          ? this.normalizeTaskRewardSettlement(item.rewardSettlement)
          : null,
      })),
      total,
      pageIndex: page.pageIndex,
      pageSize: page.pageSize,
    }
  }

  /**
   * 统计任务分配分页总数。
   *
   * 仅在 task 侧存在过滤条件时才联表 task，避免普通 assignment 分页在 count
   * 阶段承担额外 join 成本。
   */
  protected async countTaskAssignmentPage(
    assignmentWhereClause: SQL | undefined,
    taskWhereClause: SQL | undefined,
    whereClause: SQL | undefined,
  ) {
    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(this.taskAssignmentTable)
      .leftJoin(
        this.taskTable,
        eq(this.taskAssignmentTable.taskId, this.taskTable.id),
      )
      .leftJoin(
        this.growthRewardSettlementTable,
        eq(
          this.taskAssignmentTable.rewardSettlementId,
          this.growthRewardSettlementTable.id,
        ),
      )
      .where(taskWhereClause ? whereClause : (whereClause ?? assignmentWhereClause))
    return countResult?.count ?? 0
  }

  // ==================== 解析、校验与可用性 ====================

  /**
   * 校验发布时间窗口
   *
   * 确保发布开始时间不晚于结束时间。
   *
   * @param startAt 发布开始时间
   * @param endAt 发布结束时间
   * @throws BadRequestException 发布时间无效
   */
  protected ensurePublishWindow(startAt?: Date | null, endAt?: Date | null) {
    if (startAt && endAt && startAt.getTime() > endAt.getTime()) {
      throw new BadRequestException('发布开始时间不能晚于结束时间')
    }
  }

  /**
   * 校验任务目标次数。
   *
   * 任务目标是状态机判定的核心边界，必须始终保持为正整数。
   */
  protected ensurePositiveTaskTargetCount(value?: number) {
    if (value === undefined) {
      return
    }
    if (!Number.isInteger(value) || value <= 0) {
      throw new BadRequestException('targetCount 必须是大于 0 的整数')
    }
  }

  /**
   * 解析JSON字符串
   *
   * 将字符串解析为JSON对象，用于处理前端传递的JSON配置。
   *
   * @param value JSON字符串
   * @returns 解析后的对象，如果为空则返回undefined
   * @throws BadRequestException JSON格式错误
   */
  protected parseJsonValue<TObject extends object>(
    value?: string | TObject | Record<string, unknown> | null,
  ) {
    if (value === undefined || value === null || value === '') {
      return undefined
    }
    if (typeof value === 'object') {
      return value
    }
    try {
      return JSON.parse(value) as Record<string, unknown>
    } catch {
      throw new BadRequestException('JSON格式错误')
    }
  }

  /**
   * 解析并校验任务奖励项列表。
   *
   * 当前任务奖励正式合同为 `rewardItems[]`，且只接受积分/经验两类资产。
   */
  protected parseTaskRewardItems(
    value?: unknown,
  ) {
    if (value === undefined || value === '') {
      return undefined
    }
    if (value === null) {
      return null
    }

    const parsed = this.parseJsonValue(value)
    if (parsed === null) {
      return null
    }
    if (!Array.isArray(parsed)) {
      throw new BadRequestException('rewardItems 必须是数组')
    }
    if (parsed.length === 0) {
      return null
    }

    const rewardItems = parsed.map((item, index) =>
      this.parseTaskRewardItem(item, index),
    )
    const dedupeKeySet = new Set<string>()
    for (const rewardItem of rewardItems) {
      const dedupeKey = `${rewardItem.assetType}:${rewardItem.assetKey ?? ''}`
      if (dedupeKeySet.has(dedupeKey)) {
        throw new BadRequestException(
          `rewardItems 存在重复奖励项：assetType=${rewardItem.assetType} assetKey=${rewardItem.assetKey ?? ''}`,
        )
      }
      dedupeKeySet.add(dedupeKey)
    }

    return rewardItems
  }

  /**
   * 解析并校验任务重复规则。
   * 当前仅支持 type=once/daily/weekly/monthly，传 null 表示清空为一次性任务。
   */
  protected parseTaskRepeatRule(
    value?: string | TaskRepeatRuleConfig | Record<string, unknown> | null,
  ) {
    if (value === undefined || value === '') {
      return undefined
    }
    if (value === null) {
      return null
    }

    const parsed = this.parseJsonValue(value)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new BadRequestException('repeatRule 必须是 JSON 对象')
    }

    const type = parsed.type
    if (
      !Object.values(TaskRepeatTypeEnum).includes(type as TaskRepeatTypeEnum)
    ) {
      throw new BadRequestException(
        'repeatRule.type 仅支持 once、daily、weekly、monthly',
      )
    }

    const rawTimezone = parsed.timezone
    if (rawTimezone !== undefined && rawTimezone !== null) {
      if (typeof rawTimezone !== 'string' || rawTimezone.trim() === '') {
        throw new BadRequestException('repeatRule.timezone 必须是非空字符串')
      }
      if (!this.normalizeTaskTimezone(rawTimezone)) {
        throw new BadRequestException(
          'repeatRule.timezone 必须是合法的 IANA 时区标识',
        )
      }
    }

    return {
      type: type as TaskRepeatTypeEnum,
      timezone:
        typeof rawTimezone === 'string' && rawTimezone.trim() !== ''
          ? rawTimezone.trim()
          : undefined,
    }
  }

  /**
   * 解析任务目标附加配置。
   * 当前仅允许 JSON 对象或 null。
   */
  protected parseTaskObjectiveConfig(
    value?: string | TaskObjectiveConfig | Record<string, unknown> | null,
  ) {
    if (value === undefined || value === '') {
      return undefined
    }
    if (value === null) {
      return null
    }

    const parsed = this.parseJsonValue(value)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new BadRequestException('objectiveConfig 必须是 JSON 对象')
    }
    return parsed as TaskObjectiveConfig
  }

  /**
   * 归一化并校验任务目标类型。
   */
  protected parseTaskObjectiveType(value?: number | null) {
    if (value === undefined || value === null) {
      return TaskObjectiveTypeEnum.MANUAL
    }
    if (!Object.values(TaskObjectiveTypeEnum).includes(value)) {
      throw new BadRequestException('objectiveType 仅支持 MANUAL、EVENT_COUNT')
    }
    return value
  }

  /**
   * 归一化并校验目标事件编码。
   */
  protected parseTaskEventCode(value?: number | string | null) {
    if (value === undefined || value === '') {
      return undefined
    }
    if (value === null) {
      return null
    }

    const numericValue =
      typeof value === 'string' ? Number.parseInt(value, 10) : value
    if (!Number.isInteger(numericValue)) {
      throw new BadRequestException('eventCode 必须是合法的事件编码')
    }
    if (!GROWTH_RULE_TYPE_VALUES.includes(numericValue as GrowthRuleTypeEnum)) {
      throw new BadRequestException('eventCode 不是受支持的成长事件编码')
    }
    return numericValue as GrowthRuleTypeEnum
  }

  /**
   * 校验任务目标模型合同。
   */
  protected ensureTaskObjectiveContract(
    params: EnsureTaskObjectiveContractInput,
  ) {
    if (params.objectiveType === TaskObjectiveTypeEnum.MANUAL) {
      if (params.eventCode !== undefined && params.eventCode !== null) {
        throw new BadRequestException(
          'MANUAL 任务不能配置 eventCode，请改为 EVENT_COUNT 或清空 eventCode',
        )
      }
      if (
        params.objectiveConfig !== undefined &&
        params.objectiveConfig !== null
      ) {
        throw new BadRequestException(
          'MANUAL 任务不能配置 objectiveConfig，请改为 EVENT_COUNT 或清空 objectiveConfig',
        )
      }
      return
    }

    if (params.eventCode === undefined || params.eventCode === null) {
      throw new BadRequestException('EVENT_COUNT 任务必须配置 eventCode')
    }
  }

  /**
   * 校验奖励数量字段中的正整数值。
   *
   * 统一用于 `rewardItems[].amount` 解析，避免非法数值进入奖励结算路径。
   */
  protected parseRewardConfigPositiveInt<T>(value: T, fieldName: string) {
    if (!Number.isInteger(value) || Number(value) <= 0) {
      throw new BadRequestException(
        `${fieldName} 必须是大于 0 的整数，清空请传 null 或移除该字段`,
      )
    }
    return Number(value)
  }

  /**
   * 解析单个任务奖励项。
   *
   * 当前任务域只支持积分/经验奖励，因此会在这里提前拦截未支持资产类型。
   */
  protected parseTaskRewardItem(
    value: unknown,
    index: number,
  ): NonNullable<TaskRewardItems>[number] {
    const record = this.asRecord(value)
    if (!record) {
      throw new BadRequestException(`rewardItems[${index}] 必须是 JSON 对象`)
    }

    const unsupportedKeys = Object.keys(record).filter(
      (key) => !['assetType', 'assetKey', 'amount'].includes(key),
    )
    if (unsupportedKeys.length > 0) {
      throw new BadRequestException(
        `rewardItems[${index}] 暂不支持字段：${unsupportedKeys.join(', ')}`,
      )
    }

    const assetType = Number(record.assetType)
    if (
      !Number.isInteger(assetType)
      || (
        assetType !== GrowthRewardRuleAssetTypeEnum.POINTS
        && assetType !== GrowthRewardRuleAssetTypeEnum.EXPERIENCE
      )
    ) {
      throw new BadRequestException(
        `rewardItems[${index}].assetType 仅支持 1=积分、2=经验`,
      )
    }

    const assetKey =
      typeof record.assetKey === 'string' ? record.assetKey.trim() : ''
    if (assetKey !== '') {
      throw new BadRequestException(
        `rewardItems[${index}].assetKey 当前必须为空字符串`,
      )
    }

    return {
      assetType,
      assetKey,
      amount: this.parseRewardConfigPositiveInt(
        record.amount,
        `rewardItems[${index}].amount`,
      ),
    }
  }

  /**
   * 构建可领取任务的查询条件
   *
   * 条件包括：
   * - 未删除
   * - 已发布状态
   * - 已启用
   * - 在发布时间窗口内
   *
   * @param type 任务场景类型（可选）
   * @returns 查询条件
   */
  protected buildAvailableWhere(
    type?: TaskSelect['type'],
    claimMode?: TaskSelect['claimMode'],
    now = new Date(),
  ): SQL | undefined {
    // 发布开始时间条件：为空或已到开始时间
    const publishStartCondition = or(
      isNull(this.taskTable.publishStartAt),
      lte(this.taskTable.publishStartAt, now),
    )
    // 发布结束时间条件：为空或未到结束时间
    const publishEndCondition = or(
      isNull(this.taskTable.publishEndAt),
      gte(this.taskTable.publishEndAt, now),
    )

    const conditions: SQL[] = [
      isNull(this.taskTable.deletedAt),
      eq(this.taskTable.status, TaskStatusEnum.PUBLISHED),
      eq(this.taskTable.isEnabled, true),
    ]

    if (publishStartCondition) {
      conditions.push(publishStartCondition)
    }
    if (publishEndCondition) {
      conditions.push(publishEndCondition)
    }
    if (type !== undefined) {
      conditions.push(
        inArray(this.taskTable.type, getTaskTypeFilterValues(type)),
      )
    }
    if (claimMode !== undefined) {
      conditions.push(eq(this.taskTable.claimMode, claimMode))
    }
    return conditions.length > 0 ? and(...conditions) : undefined
  }

  /**
   * 查找可用任务
   *
   * 查找满足基本条件的任务：未删除、已启用、已发布。
   *
   * @param taskId 任务ID
   * @returns 任务记录
   * @throws BusinessException 任务不存在
   */
  protected async findAvailableTask(taskId: number, now = new Date()) {
    const [taskRecord] = await this.db
      .select()
      .from(this.taskTable)
      .where(
        and(
          eq(this.taskTable.id, taskId),
          isNull(this.taskTable.deletedAt),
          eq(this.taskTable.isEnabled, true),
          eq(this.taskTable.status, TaskStatusEnum.PUBLISHED),
        ),
      )
      .limit(1)

    if (!taskRecord) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '任务不存在',
      )
    }
    this.assertTaskInPublishWindow(taskRecord, now)
    return taskRecord
  }

  /**
   * 查找可领取的任务
   *
   * 在可用任务基础上，额外校验任务是否在发布时间窗口内。
   *
   * @param taskId 任务ID
   * @returns 任务记录
   * @throws BusinessException 任务未开始或已结束
   * @throws BusinessException 任务不存在
   */
  protected async findClaimableTask(taskId: number, now = new Date()) {
    return this.findAvailableTask(taskId, now)
  }

  /**
   * 根据事件编码查找当前可消费的事件型任务。
   * 事件推进仍受发布时间窗口约束，但统一以事件发生时间判断是否命中当前发布实例。
   */
  protected async findEventProgressTasks(
    eventCode: GrowthRuleTypeEnum,
    occurredAt: Date,
  ) {
    const whereClause = and(
      this.buildAvailableWhere(undefined, undefined, occurredAt),
      eq(this.taskTable.objectiveType, TaskObjectiveTypeEnum.EVENT_COUNT),
      eq(this.taskTable.eventCode, eventCode),
    )

    return this.db
      .select()
      .from(this.taskTable)
      .where(whereClause)
      .orderBy(desc(this.taskTable.priority), asc(this.taskTable.id))
  }

  /**
   * 构建任务周期标识
   *
   * 根据任务的重复规则生成当前周期的唯一标识：
   * - 一次性任务：返回 'once'
   * - 每日任务：返回日期字符串 'YYYY-MM-DD'
   * - 每周任务：返回周起始日期 'week-YYYY-MM-DD'
   * - 每月任务：返回月份 'YYYY-MM'
   */
  protected buildCycleKey(
    taskRecord: Pick<TaskSelect, 'repeatRule'>,
    now: Date,
  ): string {
    const type = this.getTaskRepeatType(taskRecord)
    const cycleAnchor = this.getTaskCycleAnchor(taskRecord, now)
    if (type === TaskRepeatTypeEnum.DAILY) {
      return this.formatDate(cycleAnchor)
    }
    if (type === TaskRepeatTypeEnum.WEEKLY) {
      return `week-${this.formatDate(this.getWeekStart(cycleAnchor))}`
    }
    if (type === TaskRepeatTypeEnum.MONTHLY) {
      return cycleAnchor.format('YYYY-MM')
    }
    return TaskRepeatTypeEnum.ONCE
  }

  /**
   * 解析任务重复类型。
   *
   * repeatRule 当前只认 type 字段，缺省时回退到一次性任务。
   */
  protected getTaskRepeatType(taskRecord: Pick<TaskSelect, 'repeatRule'>) {
    const rule = taskRecord.repeatRule as { type?: string } | null
    const type = rule?.type ?? TaskRepeatTypeEnum.ONCE
    return Object.values(TaskRepeatTypeEnum).includes(
      type as TaskRepeatTypeEnum,
    )
      ? (type as TaskRepeatTypeEnum)
      : TaskRepeatTypeEnum.ONCE
  }

  /**
   * 已有进行中 assignment 时，阻止修改会改写存量任务语义的关键配置。
   */
  protected async assertNoActiveAssignmentConfigMutation(
    taskRecord: Pick<
      TaskSelect,
      | 'id'
      | 'repeatRule'
      | 'completeMode'
      | 'publishStartAt'
      | 'publishEndAt'
      | 'objectiveType'
      | 'eventCode'
      | 'objectiveConfig'
    >,
    dto: UpdateTaskDto,
    repeatRule: TaskRepeatRuleConfig | null | undefined,
    objectiveType: TaskObjectiveTypeEnum,
  ) {
    const nextRepeatType =
      dto.repeatRule !== undefined
        ? this.getTaskRepeatType({ repeatRule: repeatRule ?? null })
        : this.getTaskRepeatType(taskRecord)
    const repeatRuleChanged =
      dto.repeatRule !== undefined &&
      nextRepeatType !== this.getTaskRepeatType(taskRecord)
    const completeModeChanged =
      dto.completeMode !== undefined &&
      dto.completeMode !== taskRecord.completeMode
    const objectiveTypeChanged =
      dto.objectiveType !== undefined &&
      objectiveType !== normalizeTaskObjectiveType(taskRecord.objectiveType)
    const eventCodeChanged =
      dto.eventCode !== undefined &&
      (dto.eventCode ?? null) !== (taskRecord.eventCode ?? null)
    const objectiveConfigChanged =
      dto.objectiveConfig !== undefined &&
      JSON.stringify(
        this.asRecord(dto.objectiveConfig) ?? dto.objectiveConfig ?? null,
      ) !==
      JSON.stringify(
          this.asRecord(taskRecord.objectiveConfig) ??
          taskRecord.objectiveConfig ??
          null,
        )
    const publishWindowChanged =
      (dto.publishStartAt !== undefined &&
        !this.isSameNullableDate(
          dto.publishStartAt ?? null,
          taskRecord.publishStartAt ?? null,
        )) ||
        (dto.publishEndAt !== undefined &&
          !this.isSameNullableDate(
          dto.publishEndAt ?? null,
          taskRecord.publishEndAt ?? null,
        ))

    if (
      !repeatRuleChanged &&
      !completeModeChanged &&
      !objectiveTypeChanged &&
      !eventCodeChanged &&
      !objectiveConfigChanged &&
      !publishWindowChanged
    ) {
      return
    }

    const [activeAssignment] = await this.db
      .select({ id: this.taskAssignmentTable.id })
      .from(this.taskAssignmentTable)
      .where(
        and(
          eq(this.taskAssignmentTable.taskId, taskRecord.id),
          isNull(this.taskAssignmentTable.deletedAt),
          inArray(this.taskAssignmentTable.status, [
            TaskAssignmentStatusEnum.PENDING,
            TaskAssignmentStatusEnum.IN_PROGRESS,
          ]),
        ),
      )
      .limit(1)

    if (!activeAssignment) {
      return
    }

    const blockedFields: string[] = []
    if (repeatRuleChanged) {
      blockedFields.push('周期规则')
    }
    if (completeModeChanged) {
      blockedFields.push('完成方式')
    }
    if (objectiveTypeChanged || eventCodeChanged || objectiveConfigChanged) {
      blockedFields.push('任务目标')
    }
    if (publishWindowChanged) {
      blockedFields.push('发布时间窗口')
    }

    throw new BusinessException(
      BusinessErrorCode.OPERATION_NOT_ALLOWED,
      `存在进行中的任务分配，不能修改${blockedFields.join('和')}`,
    )
  }

  // ==================== 周期与 assignment 编排 ====================

  /**
   * 格式化日期为 YYYY-MM-DD 格式
   *
   * @param date 日期对象
   * @returns 格式化的日期字符串
   */
  protected formatDate(date: Dayjs) {
    return date.format('YYYY-MM-DD')
  }

  /**
   * 获取周起始日期（周一）
   *
   * @param date 日期对象
   * @returns 该周周一的日期对象
   */
  protected getWeekStart(date: Dayjs) {
    return date.startOf('day').subtract(date.isoWeekday() - 1, 'day')
  }

  /**
   * 根据唯一键查找任务分配
   *
   * 唯一键由 任务ID + 用户ID + 周期标识 组成。
   *
   * @param taskId 任务ID
   * @param userId 用户ID
   * @param cycleKey 周期标识
   * @returns 任务分配记录，不存在则返回undefined
   */
  protected async findAssignmentByUniqueKey(
    taskId: number,
    userId: number,
    cycleKey: string,
  ) {
    const [assignment] = await this.db
      .select({
        assignment: this.taskAssignmentTable,
        rewardSettlement: this.buildTaskRewardSettlementSelection(),
      })
      .from(this.taskAssignmentTable)
      .leftJoin(
        this.growthRewardSettlementTable,
        eq(
          this.taskAssignmentTable.rewardSettlementId,
          this.growthRewardSettlementTable.id,
        ),
      )
      .where(
        and(
          eq(this.taskAssignmentTable.taskId, taskId),
          eq(this.taskAssignmentTable.userId, userId),
          eq(this.taskAssignmentTable.cycleKey, cycleKey),
          isNull(this.taskAssignmentTable.deletedAt),
        ),
      )
      .limit(1)
    if (!assignment) {
      return undefined
    }
    return {
      ...assignment.assignment,
      rewardSettlement: assignment.rewardSettlement?.id
        ? this.normalizeTaskRewardSettlement(assignment.rewardSettlement)
        : null,
    }
  }

  /**
   * 统一关闭命中条件的活跃 assignment，并补写 EXPIRE 审计日志。
   */
  protected async expireAssignmentsByWhere(
    db: Db,
    params: ExpireAssignmentsByWhereInput,
  ) {
    const expiredAssignments = await db
      .update(this.taskAssignmentTable)
      .set({
        status: TaskAssignmentStatusEnum.EXPIRED,
        expiredAt: params.overrideExpiredAt ?? undefined,
        version: sql`${this.taskAssignmentTable.version} + 1`,
      })
      .where(
        and(
          isNull(this.taskAssignmentTable.deletedAt),
          inArray(this.taskAssignmentTable.status, [
            TaskAssignmentStatusEnum.PENDING,
            TaskAssignmentStatusEnum.IN_PROGRESS,
          ]),
          params.whereClause,
        ),
      )
      .returning({
        assignmentId: this.taskAssignmentTable.id,
        userId: this.taskAssignmentTable.userId,
        progress: this.taskAssignmentTable.progress,
      })

    if (expiredAssignments.length === 0) {
      return 0
    }

    await db.insert(this.taskProgressLogTable).values(
      expiredAssignments.map((assignment) => ({
        ...this.buildTaskProgressLogRecord({
          assignmentId: assignment.assignmentId,
          userId: assignment.userId,
          actionType: TaskProgressActionTypeEnum.EXPIRE,
          progressSource: TaskProgressSourceEnum.SYSTEM,
          delta: 0,
          beforeValue: assignment.progress,
          afterValue: assignment.progress,
        }),
      })),
    )

    return expiredAssignments.length
  }

  /**
   * 用户查询“我的任务”前，先即时收口本用户已过期但尚未被 cron 处理的 assignment。
   */
  protected async expireDueAssignmentsForUser(userId: number, now: Date) {
    await this.drizzle.withTransaction(async (tx) =>
      this.expireAssignmentsByWhere(tx, {
        now,
        whereClause: and(
          eq(this.taskAssignmentTable.userId, userId),
          lte(this.taskAssignmentTable.expiredAt, now),
        )!,
      }),
    )
  }

  /**
   * 创建或获取已存在的任务分配
   *
   * 通过唯一键 + `onConflictDoNothing()` 处理并发领取，只允许同用户同周期生成一条
   * assignment；并发命中时回查既有记录并保持调用方拿到稳定结果。
   */
  protected async createOrGetAssignment(
    taskRecord: CreateOrGetAssignmentTaskInput,
    userId: number,
    cycleKey: string,
    now: Date,
    options?: CreateOrGetAssignmentOptions,
  ) {
    const taskSnapshot = this.buildTaskSnapshot(taskRecord)
    let createdAssignment: TaskAssignmentSelect | undefined
    const assignmentInsert: TaskAssignmentInsert = {
      taskId: taskRecord.id,
      userId,
      cycleKey,
      status: TaskAssignmentStatusEnum.PENDING,
      rewardApplicable: this.hasConfiguredTaskReward(taskRecord.rewardItems)
        ? 1
        : 0,
      progress: 0,
      target: taskRecord.targetCount,
      claimedAt: now,
      expiredAt: this.buildAssignmentExpiredAt(taskRecord, now),
      taskSnapshot,
    }

    const assignment = await this.drizzle.withTransaction(async (tx) => {
      const [insertedAssignment] = await tx
        .insert(this.taskAssignmentTable)
        .values(assignmentInsert)
        .onConflictDoNothing()
        .returning()

      if (insertedAssignment) {
        createdAssignment = insertedAssignment
        await tx.insert(this.taskProgressLogTable).values(
          this.buildTaskProgressLogRecord({
            assignmentId: insertedAssignment.id,
            userId,
            actionType: TaskProgressActionTypeEnum.CLAIM,
            progressSource:
              options?.progressSource ??
              (taskRecord.claimMode === TaskClaimModeEnum.AUTO
                ? TaskProgressSourceEnum.SYSTEM
                : TaskProgressSourceEnum.MANUAL),
            delta: 0,
            beforeValue: 0,
            afterValue: 0,
          }),
        )
        return insertedAssignment
      }

      const [existing] = await tx
        .select()
        .from(this.taskAssignmentTable)
        .where(
          and(
            eq(this.taskAssignmentTable.taskId, taskRecord.id),
            eq(this.taskAssignmentTable.userId, userId),
            eq(this.taskAssignmentTable.cycleKey, cycleKey),
            isNull(this.taskAssignmentTable.deletedAt),
          ),
        )
        .limit(1)

      if (existing) {
        return existing
      }

      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '任务分配创建失败',
      )
    })

    if (
      createdAssignment &&
      taskRecord.claimMode === TaskClaimModeEnum.AUTO &&
      options?.notifyAutoAssignment !== false
    ) {
      await this.tryNotifyAutoAssignedTask(
        userId,
        taskRecord,
        assignment,
        cycleKey,
      )
    }

    return {
      ...assignment,
      rewardSettlement: null,
    }
  }

  /**
   * 构建任务进度日志记录。
   *
   * 所有 claim/progress/complete/expire 写库都复用同一结构，保证审计字段口径一致。
   */
  protected buildTaskProgressLogRecord(params: TaskProgressLogRecordInput) {
    return {
      assignmentId: params.assignmentId,
      userId: params.userId,
      actionType: params.actionType,
      progressSource: params.progressSource,
      delta: params.delta,
      beforeValue: params.beforeValue,
      afterValue: params.afterValue,
      eventCode: params.eventCode ?? null,
      eventBizKey: params.eventBizKey ?? null,
      eventOccurredAt: params.eventOccurredAt ?? null,
      context: params.context,
    }
  }

  /**
   * 把业务事件封装成 assignment 可落库的上下文快照。
   *
   * 该上下文同时服务幂等排障和后台对账，避免只剩一条抽象 bizKey 无法追溯来源。
   */
  protected buildTaskEventProgressContext(
    eventEnvelope: TaskEventProgressInput['eventEnvelope'],
    bizKey: string,
  ) {
    return {
      ...(eventEnvelope.context ?? {}),
      eventCode: eventEnvelope.code,
      eventKey: eventEnvelope.key,
      eventBizKey: bizKey,
      eventSubjectId: eventEnvelope.subjectId,
      eventOperatorId: eventEnvelope.operatorId,
      governanceStatus: eventEnvelope.governanceStatus,
      occurredAt: eventEnvelope.occurredAt.toISOString(),
    }
  }

  /**
   * 判断事件上下文是否满足任务目标附加配置。
   *
   * 当前只支持浅层 key/value 精确匹配，保证配置语义稳定且便于排障。
   */
  protected matchesTaskObjectiveConfig<T>(
    objectiveConfig: T,
    eventContext?: Record<string, unknown>,
  ) {
    const normalizedObjectiveConfig = this.asRecord(objectiveConfig)
    if (!normalizedObjectiveConfig) {
      return true
    }

    const normalizedEventContext = eventContext ?? {}
    return Object.entries(normalizedObjectiveConfig).every(
      ([key, value]) =>
        JSON.stringify(normalizedEventContext[key]) === JSON.stringify(value),
    )
  }

  /**
   * 使用事件推进 assignment。
   *
   * 该入口统一处理自动领取、事件幂等、完成态补偿和“事件发生早于手动领取”的边界判断。
   */
  protected async advanceAssignmentByEvent(
    params: AdvanceAssignmentByEventInput,
  ) {
    const cycleKey = this.buildCycleKey(params.taskRecord, params.occurredAt)
    let assignment = await this.findAssignmentByUniqueKey(
      params.taskRecord.id,
      params.userId,
      cycleKey,
    )

    if (!assignment) {
      if (params.taskRecord.claimMode !== TaskClaimModeEnum.AUTO) {
        return {
          assignmentId: undefined,
          progressed: false,
          completed: false,
          duplicate: false,
        }
      }

      assignment = await this.createOrGetAssignment(
        params.taskRecord,
        params.userId,
        cycleKey,
        params.occurredAt,
        {
          notifyAutoAssignment: false,
          progressSource: TaskProgressSourceEnum.EVENT,
        },
      )
    }
    if (!assignment) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '任务分配不存在',
      )
    }

    if (assignment.status === TaskAssignmentStatusEnum.COMPLETED) {
      await this.settleCompletedAssignmentRewardIfNeeded(
        params.userId,
        this.buildTaskRewardTaskRecord(
          params.taskRecord.id,
          params.taskRecord,
          assignment,
        ),
        assignment,
      )
      return {
        assignmentId: assignment.id,
        progressed: false,
        completed: false,
        duplicate: false,
      }
    }

    if (assignment.status === TaskAssignmentStatusEnum.EXPIRED) {
      return {
        assignmentId: assignment.id,
        progressed: false,
        completed: false,
        duplicate: false,
      }
    }

    if (
      params.taskRecord.claimMode === TaskClaimModeEnum.MANUAL &&
      assignment.claimedAt &&
      params.occurredAt.getTime() < assignment.claimedAt.getTime()
    ) {
      return {
        assignmentId: assignment.id,
        progressed: false,
        completed: false,
        duplicate: false,
      }
    }

    const nextProgress = Math.min(assignment.target, assignment.progress + 1)
    const shouldAutoComplete =
      params.taskRecord.completeMode === TaskCompleteModeEnum.AUTO &&
      nextProgress >= assignment.target
    if (!shouldAutoComplete && nextProgress <= assignment.progress) {
      return {
        assignmentId: assignment.id,
        progressed: false,
        completed: false,
        duplicate: false,
      }
    }

    const nextStatus = shouldAutoComplete
      ? TaskAssignmentStatusEnum.COMPLETED
      : TaskAssignmentStatusEnum.IN_PROGRESS
    const eventContext = this.buildTaskEventProgressContext(
      params.eventEnvelope,
      params.eventBizKey,
    )
    const eventApplied = await this.applyAssignmentEventProgress({
      assignment,
      userId: params.userId,
      nextProgress,
      nextStatus,
      eventCode: params.eventEnvelope.code,
      eventBizKey: params.eventBizKey,
      eventOccurredAt: params.occurredAt,
      context: eventContext,
    })

    if (eventApplied === 'duplicate') {
      return {
        assignmentId: assignment.id,
        progressed: false,
        completed: false,
        duplicate: true,
      }
    }

    if (
      assignment.status !== TaskAssignmentStatusEnum.COMPLETED &&
      nextStatus === TaskAssignmentStatusEnum.COMPLETED
    ) {
      await this.emitTaskCompleteEvent(
        params.userId,
        this.buildTaskRewardTaskRecord(
          params.taskRecord.id,
          params.taskRecord,
          assignment,
        ),
        {
          ...assignment,
          completedAt: params.occurredAt,
        },
      )
    }

    return {
      assignmentId: assignment.id,
      progressed: nextStatus !== TaskAssignmentStatusEnum.COMPLETED,
      completed: nextStatus === TaskAssignmentStatusEnum.COMPLETED,
      duplicate: false,
    }
  }

  /**
   * 在事务内落事件推进事实并更新 assignment。
   *
   * 先插入带唯一键的 progress log，再更新 assignment，保证同一 bizKey 只会成功推进一次。
   */
  protected async applyAssignmentEventProgress(
    params: ApplyAssignmentEventProgressInput,
  ) {
    return this.drizzle.withTransaction(async (tx) => {
      const [insertedLog] = await tx
        .insert(this.taskProgressLogTable)
        .values(
          this.buildTaskProgressLogRecord({
            assignmentId: params.assignment.id,
            userId: params.userId,
            actionType:
              params.nextStatus === TaskAssignmentStatusEnum.COMPLETED
                ? TaskProgressActionTypeEnum.COMPLETE
                : TaskProgressActionTypeEnum.PROGRESS,
            progressSource: TaskProgressSourceEnum.EVENT,
            delta: Math.max(
              0,
              params.nextProgress - params.assignment.progress,
            ),
            beforeValue: params.assignment.progress,
            afterValue: params.nextProgress,
            eventCode: params.eventCode,
            eventBizKey: params.eventBizKey,
            eventOccurredAt: params.eventOccurredAt,
            context: params.context,
          }),
        )
        .onConflictDoNothing({
          target: [
            this.taskProgressLogTable.assignmentId,
            this.taskProgressLogTable.eventBizKey,
          ],
        })
        .returning({ id: this.taskProgressLogTable.id })

      if (!insertedLog) {
        return 'duplicate' as const
      }

      const updateResult = await tx
        .update(this.taskAssignmentTable)
        .set({
          progress: params.nextProgress,
          status: params.nextStatus,
          completedAt:
            params.nextStatus === TaskAssignmentStatusEnum.COMPLETED
              ? params.eventOccurredAt
              : undefined,
          context: params.context,
          version: sql`${this.taskAssignmentTable.version} + 1`,
        })
        .where(
          and(
            eq(this.taskAssignmentTable.id, params.assignment.id),
            eq(this.taskAssignmentTable.version, params.assignment.version),
          ),
        )

      if ((updateResult.rowCount ?? 0) === 0) {
        throw new BusinessException(
          BusinessErrorCode.STATE_CONFLICT,
          '任务事件推进冲突，请重试',
        )
      }

      return 'applied' as const
    })
  }

  /**
   * 从候选任务中过滤掉当前周期已领取的记录。
   *
   * “可领取任务”列表只应展示当前周期尚未生成 assignment 的手动任务。
   */
  protected async filterClaimableTasksForUser(
    tasks: TaskSelect[],
    userId: number,
    now: Date,
  ) {
    if (tasks.length === 0) {
      return tasks
    }

    const cycleKeyByTaskId = new Map<number, string>()
    for (const taskRecord of tasks) {
      cycleKeyByTaskId.set(taskRecord.id, this.buildCycleKey(taskRecord, now))
    }

    const taskIds = tasks.map((taskRecord) => taskRecord.id)
    const cycleKeys = [...new Set(cycleKeyByTaskId.values())]
    const existingAssignments = await this.db
      .select({
        taskId: this.taskAssignmentTable.taskId,
        cycleKey: this.taskAssignmentTable.cycleKey,
      })
      .from(this.taskAssignmentTable)
      .where(
        and(
          eq(this.taskAssignmentTable.userId, userId),
          isNull(this.taskAssignmentTable.deletedAt),
          inArray(this.taskAssignmentTable.taskId, taskIds),
          inArray(this.taskAssignmentTable.cycleKey, cycleKeys),
        ),
      )

    const claimedKeys = new Set(
      existingAssignments.map(
        (assignment) => `${assignment.taskId}:${assignment.cycleKey}`,
      ),
    )

    return tasks.filter((taskRecord) => {
      const cycleKey = cycleKeyByTaskId.get(taskRecord.id)
      return !claimedKeys.has(`${taskRecord.id}:${cycleKey}`)
    })
  }

  /**
   * 确保一组任务的自动分配
   *
   * 批量检查并为自动领取模式的任务创建分配。
   *
   * @param userId 用户ID
   * @param tasks 任务列表
   */
  protected async ensureAutoAssignments(
    userId: number,
    tasks: AutoAssignmentTaskSource[],
    now: Date,
  ) {
    await Promise.all(
      tasks.map(async (taskRecord) =>
        this.ensureAutoAssignmentByTask(userId, taskRecord, now),
      ),
    )
  }

  /**
   * 确保用户的所有自动领取任务已分配
   *
   * 查询所有可用任务，为自动领取模式的任务创建分配。
   *
   * @param userId 用户ID
   */
  protected async ensureAutoAssignmentsForUser(userId: number, now: Date) {
    const where = this.buildAvailableWhere()
    const tasks = await this.db
      .select(this.buildAutoAssignmentTaskSelection())
      .from(this.taskTable)
      .where(where)

    await this.ensureAutoAssignments(userId, tasks, now)
  }

  /**
   * 确保单个任务的自动分配
   *
   * 按任务 ID 读取一份自动领取所需的最小 task 视图，再复用统一分配入口。
   */
  protected async ensureAutoAssignment(userId: number, taskId: number) {
    const now = new Date()
    const [taskRecord] = await this.db
      .select(this.buildAutoAssignmentTaskSelection())
      .from(this.taskTable)
      .where(
        and(
          eq(this.taskTable.id, taskId),
          isNull(this.taskTable.deletedAt),
          eq(this.taskTable.isEnabled, true),
          eq(this.taskTable.status, TaskStatusEnum.PUBLISHED),
          eq(this.taskTable.claimMode, TaskClaimModeEnum.AUTO),
        ),
      )
      .limit(1)

    if (!taskRecord) {
      return
    }
    await this.ensureAutoAssignmentByTask(userId, taskRecord, now)
  }

  /**
   * 根据任务信息确保自动分配
   *
   * 该入口只负责领取模式与发布时间窗口校验；真正的 assignment 幂等创建交给
   * `createOrGetAssignment(...)`。
   */
  protected async ensureAutoAssignmentByTask(
    userId: number,
    taskRecord: AutoAssignmentTaskSource,
    now = new Date(),
  ) {
    // 非自动领取模式跳过
    if (taskRecord.claimMode !== TaskClaimModeEnum.AUTO) {
      return
    }
    if (this.getTaskAvailabilityError(taskRecord, now)) {
      return
    }
    // 计算周期并创建分配
    const cycleKey = this.buildCycleKey(taskRecord, now)
    await this.createOrGetAssignment(taskRecord, userId, cycleKey, now)
  }

  // ==================== 快照、奖励与通知 ====================

  /**
   * 构建 assignment 持久化使用的任务快照。
   *
   * 快照冻结执行与展示都依赖的关键字段，避免模板变更改写历史 assignment 语义。
   */
  protected buildTaskSnapshot(taskRecord: TaskSnapshotSource) {
    return {
      id: taskRecord.id,
      code: taskRecord.code,
      title: taskRecord.title,
      description: taskRecord.description,
      cover: taskRecord.cover,
      type: normalizeTaskType(taskRecord.type),
      claimMode: taskRecord.claimMode,
      completeMode: taskRecord.completeMode,
      objectiveType: normalizeTaskObjectiveType(taskRecord.objectiveType),
      eventCode: taskRecord.eventCode ?? null,
      objectiveConfig: taskRecord.objectiveConfig ?? null,
      repeatRule: taskRecord.repeatRule,
      publishStartAt: taskRecord.publishStartAt,
      publishEndAt: taskRecord.publishEndAt,
      rewardItems: this.parseTaskRewardItems(taskRecord.rewardItems) ?? null,
      targetCount: taskRecord.targetCount,
    }
  }

  /**
   * 构建任务奖励结算所需的最小任务视图。
   * 优先使用 assignment 快照，避免 live task 配置变更改写历史结算语义。
   */
  protected buildTaskRewardTaskRecord(
    taskId: TaskRewardTaskRecord['id'],
    currentTask?: TaskRewardTaskRecordBuildCurrentTaskInput,
    assignment?: TaskRewardTaskRecordBuildAssignmentInput,
  ) {
    const snapshot = this.asRecord(assignment?.taskSnapshot)
    const snapshotCode =
      typeof snapshot?.code === 'string' ? snapshot.code : undefined
    const snapshotTitle =
      typeof snapshot?.title === 'string' ? snapshot.title : undefined
    const snapshotType =
      typeof snapshot?.type === 'number' ? snapshot.type : undefined

    const taskRecord: TaskRewardTaskRecord = {
      id: taskId,
      code: snapshotCode ?? currentTask?.code,
      title: snapshotTitle ?? currentTask?.title,
      type: snapshotType ?? currentTask?.type,
      rewardItems:
        this.parseTaskRewardItems(this.asArray(snapshot?.rewardItems) ?? null)
        ?? this.parseTaskRewardItems(currentTask?.rewardItems ?? null)
        ?? null,
    }

    return taskRecord
  }

  /**
   * 触发任务完成事件并同步奖励副作用。
   *
   * 该入口统一负责事件壳构建、奖励服务调用、assignment 状态回写与到账提醒。
   */
  protected async emitTaskCompleteEvent(
    userId: number,
    taskRecord: TaskCompleteEventTaskInput,
    assignment: TaskCompleteEventAssignmentInput,
    options?: { isRetry?: boolean },
  ) {
    if (!this.hasConfiguredTaskReward(taskRecord.rewardItems)) {
      return
    }

    const settlement = await this.ensureTaskRewardSettlementLink({
      assignmentId: assignment.id,
      taskId: taskRecord.id,
      userId,
      rewardItems: taskRecord.rewardItems ?? null,
      occurredAt: assignment.completedAt ?? undefined,
    })
    const taskCompleteEvent = this.buildTaskCompleteEventEnvelope({
      userId,
      taskId: taskRecord.id,
      assignmentId: assignment.id,
      occurredAt: assignment.completedAt ?? undefined,
    })

    const rewardResult =
      await this.userGrowthRewardService.tryRewardTaskComplete({
        userId,
        taskId: taskRecord.id,
        assignmentId: assignment.id,
        rewardItems: taskRecord.rewardItems,
        eventEnvelope: taskCompleteEvent,
      })

    await this.syncTaskRewardSettlementState(
      settlement.id,
      rewardResult,
      options,
    )
    await this.tryNotifyTaskRewardGranted(
      userId,
      taskRecord,
      assignment,
      rewardResult,
    )
  }

  /**
   * 在任务完成后按需触发奖励结算。
   *
   * 仅当分配记录尚未结算成功时才触发结算，避免重复调用奖励服务。
   */
  protected async settleCompletedAssignmentRewardIfNeeded(
    userId: number,
    taskRecord: TaskRewardSettlementTaskInput,
    assignment: TaskRewardSettlementAssignmentInput,
  ) {
    if (!assignment.rewardApplicable) {
      return
    }
    if (
      assignment.rewardSettlement?.settlementStatus
      === GrowthRewardSettlementStatusEnum.SUCCESS
    ) {
      return
    }

    await this.emitTaskCompleteEvent(userId, taskRecord, assignment)
  }

  /**
   * 确保任务奖励结算事实存在，并把 assignment 挂接到唯一结算记录。
   *
   * 该步骤是 task 奖励状态的单一事实源入口；一旦需要奖励结算，就必须先创建
   * `growth_reward_settlement`，而不是继续写 assignment 内部状态字段。
   */
  protected async ensureTaskRewardSettlementLink(params: {
    assignmentId: number
    taskId: number
    userId: number
    rewardItems?: TaskRewardItems | null
    occurredAt?: Date
  }) {
    const bizKey = this.buildTaskRewardSettlementBizKey(params)
    const requestPayload = {
      kind: 'task_reward',
      assignmentId: params.assignmentId,
      taskId: params.taskId,
      userId: params.userId,
      rewardItems: params.rewardItems ?? null,
      occurredAt: (params.occurredAt ?? new Date()).toISOString(),
    }

    return this.drizzle.withTransaction(async (tx) => {
      const [createdSettlement] = await tx
        .insert(this.growthRewardSettlementTable)
        .values({
          userId: params.userId,
          bizKey,
          settlementType: GrowthRewardSettlementTypeEnum.TASK_REWARD,
          source: 'task_bonus',
          sourceRecordId: params.assignmentId,
          targetId: params.taskId,
          eventOccurredAt: params.occurredAt ?? new Date(),
          settlementStatus: GrowthRewardSettlementStatusEnum.PENDING,
          requestPayload,
        })
        .onConflictDoNothing()
        .returning({
          id: this.growthRewardSettlementTable.id,
          bizKey: this.growthRewardSettlementTable.bizKey,
        })

      const settlement =
        createdSettlement
        ?? (
          await tx.query.growthRewardSettlement.findFirst({
            where: {
              userId: params.userId,
              bizKey,
            },
            columns: {
              id: true,
              bizKey: true,
            },
          })
        )

      if (!settlement) {
        throw new BusinessException(
          BusinessErrorCode.STATE_CONFLICT,
          '任务奖励结算事实创建失败',
        )
      }

      await tx
        .update(this.taskAssignmentTable)
        .set({ rewardSettlementId: settlement.id })
        .where(eq(this.taskAssignmentTable.id, params.assignmentId))

      return settlement
    })
  }

  /**
   * 同步任务奖励结算事实状态。
   */
  protected async syncTaskRewardSettlementState(
    settlementId: number,
    rewardResult: TaskRewardSettlementResult,
    options?: { isRetry?: boolean },
  ) {
    try {
      const settlement = await this.db.query.growthRewardSettlement.findFirst({
        where: { id: settlementId },
        columns: {
          retryCount: true,
          lastRetryAt: true,
        },
      })

      if (!settlement) {
        throw new BusinessException(
          BusinessErrorCode.RESOURCE_NOT_FOUND,
          '任务奖励结算事实不存在',
        )
      }

      await this.drizzle.withErrorHandling(() =>
        this.db
          .update(this.growthRewardSettlementTable)
          .set({
            settlementStatus: rewardResult.success
              ? GrowthRewardSettlementStatusEnum.SUCCESS
              : GrowthRewardSettlementStatusEnum.PENDING,
            settlementResultType: rewardResult.resultType,
            ledgerRecordIds: rewardResult.ledgerRecordIds,
            retryCount: options?.isRetry
              ? settlement.retryCount + 1
              : settlement.retryCount,
            lastRetryAt: options?.isRetry ? new Date() : settlement.lastRetryAt,
            settledAt: rewardResult.success ? rewardResult.settledAt : null,
            lastError: rewardResult.success
              ? null
              : (rewardResult.errorMessage ?? '任务奖励发放失败，请稍后重试'),
          })
          .where(eq(this.growthRewardSettlementTable.id, settlementId)),
      )
    } catch (error) {
      this.logger.warn(
        `task_reward_state_sync_failed settlementId=${settlementId} resultType=${rewardResult.resultType} error=${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }

  /**
   * 构建任务奖励结算事实的稳定幂等键。
   */
  protected buildTaskRewardSettlementBizKey(params: {
    assignmentId: number
    taskId: number
    userId: number
  }) {
    return [
      'task',
      'complete',
      params.taskId,
      'assignment',
      params.assignmentId,
      'user',
      params.userId,
    ].join(':')
  }

  /**
   * 尝试发送“自动分配的新任务”提醒
   *
   * 自动领取任务创建 assignment 后立刻补一条提醒，帮助用户感知任务已进入“我的任务”。
   */
  protected async tryNotifyAutoAssignedTask(
    userId: number,
    taskRecord: TaskAutoAssignmentReminderTaskInput,
    assignment: TaskReminderAssignmentInput,
    cycleKey: string,
  ) {
    try {
      await this.publishTaskReminderIfNeeded(
        this.taskNotificationService.createAutoAssignedReminderEvent({
          bizKey: this.taskNotificationService.buildAutoAssignedReminderBizKey(
            assignment.id,
          ),
          receiverUserId: userId,
          task: {
            id: taskRecord.id,
            code: taskRecord.code,
            title: taskRecord.title,
            type: taskRecord.type,
          },
          cycleKey,
          assignmentId: assignment.id,
        }),
      )
    } catch (error) {
      this.logger.warn(
        `task_auto_assignment_reminder_enqueue_failed userId=${userId} taskId=${taskRecord.id} assignmentId=${assignment.id} error=${this.stringifyError(error)}`,
      )
    }
  }

  /**
   * 尝试发送“奖励到账”提醒
   *
   * 仅当本次任务奖励真实落账时发送；命中幂等、失败或未配置奖励都不会再次提醒。
   */
  protected async tryNotifyTaskRewardGranted(
    userId: number,
    taskRecord: TaskRewardReminderTaskInput,
    assignment: TaskReminderAssignmentInput,
    rewardResult: TaskRewardSettlementResult,
  ) {
    if (
      rewardResult.resultType !== TaskAssignmentRewardResultTypeEnum.APPLIED
    ) {
      return
    }

    const grantedRewardItems = this.getAppliedRewardItems(rewardResult)
    if (grantedRewardItems.length === 0) {
      return
    }

    try {
      await this.publishTaskReminderIfNeeded(
        this.taskNotificationService.createRewardGrantedReminderEvent({
          bizKey: this.taskNotificationService.buildRewardGrantedReminderBizKey(
            assignment.id,
          ),
          receiverUserId: userId,
          task: {
            id: taskRecord.id,
            code: taskRecord.code,
            title: taskRecord.title ?? `任务#${taskRecord.id}`,
            type: taskRecord.type,
          },
          assignmentId: assignment.id,
          rewardItems: grantedRewardItems,
          ledgerRecordIds: rewardResult.ledgerRecordIds,
        }),
      )
    } catch (error) {
      this.logger.warn(
        `task_reward_reminder_enqueue_failed userId=${userId} taskId=${taskRecord.id} assignmentId=${assignment.id} error=${this.stringifyError(error)}`,
      )
    }
  }

  /**
   * 发布任务提醒事件。
   * 任务提醒的幂等由消息域事件发布器根据稳定 idempotencyKey 统一兜底，
   * 不再在 task 域额外做“先查再发”的竞态判重。
   */
  protected async publishTaskReminderIfNeeded(
    notification: PublishMessageDomainEventInput,
  ) {
    const result = await this.messageDomainEventPublisher.publish(notification)
    return !result.duplicated
  }

  // ==================== 视图映射与对账查询 ====================

  /**
   * 计算任务进入可领取状态的参考时间
   *
   * 优先使用 publishStartAt；未设置时回退到 createdAt，便于界定“新任务可领”的提醒窗口。
   */
  protected getTaskAvailableReferenceTime(
    taskRecord: Pick<TaskSelect, 'publishStartAt' | 'createdAt'>,
  ) {
    return taskRecord.publishStartAt ?? taskRecord.createdAt
  }

  /**
   * 映射 app 可领取任务视图。
   *
   * 该视图只面向“尚可领取”的任务，因此 visibleStatus 固定为 CLAIMABLE。
   */
  protected toAppTaskView(taskRecord: AppTaskViewSource) {
    return {
      id: taskRecord.id,
      createdAt: taskRecord.createdAt,
      updatedAt: taskRecord.updatedAt,
      code: taskRecord.code,
      title: taskRecord.title,
      description: taskRecord.description,
      cover: taskRecord.cover,
      type: normalizeTaskType(taskRecord.type),
      priority: taskRecord.priority,
      claimMode: taskRecord.claimMode,
      completeMode: taskRecord.completeMode,
      objectiveType: normalizeTaskObjectiveType(taskRecord.objectiveType),
      eventCode: taskRecord.eventCode,
      objectiveConfig: taskRecord.objectiveConfig,
      targetCount: taskRecord.targetCount,
      rewardItems: this.parseTaskRewardItems(taskRecord.rewardItems) ?? null,
      publishStartAt: taskRecord.publishStartAt,
      publishEndAt: taskRecord.publishEndAt,
      repeatRule: taskRecord.repeatRule,
      visibleStatus: TaskUserVisibleStatusEnum.CLAIMABLE,
    }
  }

  /**
   * 映射 app 我的任务视图。
   *
   * 任务摘要优先使用 assignment 快照，保证模板变更后历史实例的展示仍然稳定。
   */
  protected toAppMyTaskView(item: TaskAssignmentWithTaskRow) {
    const taskView = this.buildAssignmentTaskView(item)
    return {
      id: item.id,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      taskId: item.taskId,
      cycleKey: item.cycleKey,
      status: item.status,
      rewardApplicable: item.rewardApplicable,
      rewardSettlementId: item.rewardSettlementId,
      progress: item.progress,
      target: item.target,
      claimedAt: item.claimedAt,
      completedAt: item.completedAt,
      expiredAt: item.expiredAt,
      visibleStatus: this.resolveTaskUserVisibleStatus({
        status: item.status,
        rewardApplicable: item.rewardApplicable === 1,
        rewardSettlementStatus: item.rewardSettlement?.settlementStatus,
      }),
      rewardSettlement: item.rewardSettlement,
      task: taskView,
    }
  }

  /**
   * 映射管理端任务视图并补齐运行态摘要。
   */
  protected toAdminTaskView(
    taskRecord: TaskSelect,
    runtimeHealth?: TaskRuntimeHealthSummary,
  ) {
    return {
      ...this.normalizeTaskTypeRecord(taskRecord),
      activeAssignmentCount: runtimeHealth?.activeAssignmentCount ?? 0,
      pendingRewardCompensationCount:
        runtimeHealth?.pendingRewardCompensationCount ?? 0,
      latestReminder: runtimeHealth?.latestReminder ?? null,
    }
  }

  /**
   * 映射管理端 assignment 视图。
   */
  protected toAdminTaskAssignmentView(item: TaskAssignmentWithTaskRow) {
    const taskView = this.buildAssignmentTaskView(item)
    return {
      ...item,
      visibleStatus: this.resolveTaskUserVisibleStatus({
        status: item.status,
        rewardApplicable: item.rewardApplicable === 1,
        rewardSettlementStatus: item.rewardSettlement?.settlementStatus,
      }),
      task: taskView,
    }
  }

  /**
   * 归一化任务主记录里的历史枚举值。
   */
  protected normalizeTaskTypeRecord<T extends { type: number | null }>(
    record: T,
  ) {
    return {
      ...record,
      type: normalizeTaskType(record.type),
      objectiveType: normalizeTaskObjectiveType(
        (record as { objectiveType?: number | null }).objectiveType,
      ),
    }
  }

  /**
   * 归一化任务关联对象里的历史枚举值。
   */
  protected normalizeTaskRelation(record: TaskRelationRow) {
    return {
      ...record,
      type: normalizeTaskType(record.type),
      objectiveType: normalizeTaskObjectiveType(record.objectiveType),
    }
  }

  /**
   * 归一化任务奖励结算关联摘要。
   */
  protected normalizeTaskRewardSettlement(
    record: TaskRewardSettlementRelationRow,
  ) {
    return {
      ...record,
      ledgerRecordIds: record.ledgerRecordIds ?? [],
    }
  }

  /**
   * 基于 assignment 快照和 live task 构建统一任务摘要。
   *
   * 快照字段优先级高于 live task，避免历史任务展示和补偿语义被新配置覆盖。
   */
  protected buildAssignmentTaskView(item: TaskAssignmentWithTaskRow) {
    const snapshot = this.asRecord(item.taskSnapshot)
    const liveTask = item.task ? this.normalizeTaskRelation(item.task) : null
    const taskId =
      this.readSnapshotPositiveInt(snapshot?.id) ?? liveTask?.id ?? item.taskId

    if (!taskId) {
      return null
    }

    return {
      id: taskId,
      code:
        this.readSnapshotString(snapshot?.code) ??
        liveTask?.code ??
        `task-${taskId}`,
      title:
        this.readSnapshotString(snapshot?.title) ??
        liveTask?.title ??
        `任务#${taskId}`,
      description:
        this.readSnapshotString(snapshot?.description) ??
        liveTask?.description ??
        null,
      cover:
        this.readSnapshotString(snapshot?.cover) ?? liveTask?.cover ?? null,
      type: normalizeTaskType(
        this.readSnapshotPositiveInt(snapshot?.type) ?? liveTask?.type,
      ),
      objectiveType: normalizeTaskObjectiveType(
        this.readSnapshotPositiveInt(snapshot?.objectiveType) ??
        liveTask?.objectiveType,
      ),
      eventCode:
        this.readSnapshotPositiveInt(snapshot?.eventCode) ??
        liveTask?.eventCode ??
        null,
      objectiveConfig:
        snapshot?.objectiveConfig ?? liveTask?.objectiveConfig ?? null,
      rewardItems:
        this.parseTaskRewardItems(this.asArray(snapshot?.rewardItems) ?? null)
        ?? this.parseTaskRewardItems(liveTask?.rewardItems ?? null)
        ?? null,
      targetCount:
        this.readSnapshotPositiveInt(snapshot?.targetCount) ??
        liveTask?.targetCount ??
        item.target,
      completeMode:
        this.readSnapshotPositiveInt(snapshot?.completeMode) ??
        liveTask?.completeMode ??
        TaskCompleteModeEnum.MANUAL,
      claimMode:
        this.readSnapshotPositiveInt(snapshot?.claimMode) ??
        liveTask?.claimMode ??
        TaskClaimModeEnum.MANUAL,
    }
  }

  /**
   * 统一映射用户可见状态。
   *
   * app 列表、用户中心和后台对账都复用同一口径，避免不同页面状态含义漂移。
   */
  protected resolveTaskUserVisibleStatus(
    params: ResolveTaskUserVisibleStatusInput,
  ) {
    if (params.status === TaskAssignmentStatusEnum.EXPIRED) {
      return TaskUserVisibleStatusEnum.EXPIRED
    }
    if (params.status === TaskAssignmentStatusEnum.IN_PROGRESS) {
      return TaskUserVisibleStatusEnum.IN_PROGRESS
    }
    if (params.status === TaskAssignmentStatusEnum.PENDING) {
      return TaskUserVisibleStatusEnum.CLAIMED
    }
    if (params.status === TaskAssignmentStatusEnum.COMPLETED) {
      if (!params.rewardApplicable) {
        return TaskUserVisibleStatusEnum.COMPLETED
      }
      return params.rewardSettlementStatus === GrowthRewardSettlementStatusEnum.SUCCESS
        ? TaskUserVisibleStatusEnum.REWARD_GRANTED
        : TaskUserVisibleStatusEnum.REWARD_PENDING
    }
    return TaskUserVisibleStatusEnum.UNAVAILABLE
  }

  /**
   * 聚合任务运行态健康信息。
   *
   * 管理端任务页需要一次性拿到活跃 assignment 数、待补偿奖励数和最近提醒状态，避免 N+1 查询。
   */
  protected async getTaskRuntimeHealthMap(taskIds: number[]) {
    const uniqueTaskIds = [...new Set(taskIds.filter((id) => id > 0))]
    if (uniqueTaskIds.length === 0) {
      return new Map<number, TaskRuntimeHealthSummary>()
    }

    const [activeRows, rewardPendingRows, reminderRows] = await Promise.all([
      this.db
        .select({
          taskId: this.taskAssignmentTable.taskId,
          count: sql<number>`COUNT(*)::int`,
        })
        .from(this.taskAssignmentTable)
        .where(
          and(
            isNull(this.taskAssignmentTable.deletedAt),
            inArray(this.taskAssignmentTable.taskId, uniqueTaskIds),
            inArray(this.taskAssignmentTable.status, [
              TaskAssignmentStatusEnum.PENDING,
              TaskAssignmentStatusEnum.IN_PROGRESS,
              TaskAssignmentStatusEnum.COMPLETED,
            ]),
          ),
        )
        .groupBy(this.taskAssignmentTable.taskId),
      this.db
        .select({
          taskId: this.taskAssignmentTable.taskId,
          count: sql<number>`COUNT(*)::int`,
        })
        .from(this.taskAssignmentTable)
        .leftJoin(
          this.growthRewardSettlementTable,
          eq(
            this.taskAssignmentTable.rewardSettlementId,
            this.growthRewardSettlementTable.id,
          ),
        )
        .where(
          and(
            isNull(this.taskAssignmentTable.deletedAt),
            inArray(this.taskAssignmentTable.taskId, uniqueTaskIds),
            eq(
              this.taskAssignmentTable.status,
              TaskAssignmentStatusEnum.COMPLETED,
            ),
          eq(this.taskAssignmentTable.rewardApplicable, 1),
          or(
            isNull(this.taskAssignmentTable.rewardSettlementId),
            eq(
              this.growthRewardSettlementTable.settlementStatus,
              GrowthRewardSettlementStatusEnum.PENDING,
            ),
          ),
        ),
      )
        .groupBy(this.taskAssignmentTable.taskId),
      this.queryLatestTaskReminderRows(uniqueTaskIds),
    ])

    const runtimeMap = new Map<number, TaskRuntimeHealthSummary>()

    for (const taskId of uniqueTaskIds) {
      runtimeMap.set(taskId, {
        activeAssignmentCount: 0,
        pendingRewardCompensationCount: 0,
      })
    }

    for (const row of activeRows) {
      const current = runtimeMap.get(row.taskId) ?? {
        activeAssignmentCount: 0,
        pendingRewardCompensationCount: 0,
      }
      runtimeMap.set(row.taskId, {
        ...current,
        activeAssignmentCount: Number(row.count ?? 0),
      })
    }

    for (const row of rewardPendingRows) {
      const current = runtimeMap.get(row.taskId) ?? {
        activeAssignmentCount: 0,
        pendingRewardCompensationCount: 0,
      }
      runtimeMap.set(row.taskId, {
        ...current,
        pendingRewardCompensationCount: Number(row.count ?? 0),
      })
    }

    for (const row of reminderRows) {
      if (!runtimeMap.has(row.taskId)) {
        continue
      }
      const current = runtimeMap.get(row.taskId) ?? {
        activeAssignmentCount: 0,
        pendingRewardCompensationCount: 0,
      }
      runtimeMap.set(row.taskId, {
        ...current,
        latestReminder: {
          reminderKind: row.reminderKind ?? undefined,
          status: row.status,
          failureReason: row.failureReason ?? undefined,
          lastAttemptAt: row.lastAttemptAt,
          updatedAt: row.updatedAt,
        },
      })
    }

    return runtimeMap
  }

  /**
   * 查询任务维度最近一次提醒投递结果。
   */
  protected async queryLatestTaskReminderRows(taskIds: number[]) {
    const taskIdSql = sql<number>`(${this.domainEventTable.context} -> 'payload' ->> 'taskId')::int`
    const reminderKindSql = sql<
      string | null
    >`${this.domainEventTable.context} -> 'payload' ->> 'reminderKind'`

    const rows = await this.db
      .select({
        taskId: taskIdSql,
        reminderKind: reminderKindSql,
        status: this.notificationDeliveryTable.status,
        failureReason: this.notificationDeliveryTable.failureReason,
        lastAttemptAt: this.notificationDeliveryTable.lastAttemptAt,
        updatedAt: this.notificationDeliveryTable.updatedAt,
      })
      .from(this.notificationDeliveryTable)
      .leftJoin(
        this.domainEventTable,
        eq(this.notificationDeliveryTable.eventId, this.domainEventTable.id),
      )
      .where(
        and(
          eq(this.notificationDeliveryTable.categoryKey, 'task_reminder'),
          inArray(taskIdSql, taskIds),
        ),
      )
      .orderBy(
        desc(this.notificationDeliveryTable.updatedAt),
        desc(this.notificationDeliveryTable.id),
      )

    const latestRows: TaskLatestReminderRow[] = []
    const seenTaskIds = new Set<number>()

    for (const row of rows) {
      if (!row.taskId || seenTaskIds.has(row.taskId)) {
        continue
      }
      seenTaskIds.add(row.taskId)
      latestRows.push({
        taskId: row.taskId,
        reminderKind: row.reminderKind,
        status: row.status as TaskLatestReminderRow['status'],
        failureReason: row.failureReason,
        lastAttemptAt: row.lastAttemptAt,
        updatedAt: row.updatedAt,
      })
    }

    return latestRows
  }

  /**
   * 根据事件过滤条件反查 assignment ID 列表。
   */
  protected async queryAssignmentIdsByEventFilter(
    queryDto: Pick<
      QueryTaskAssignmentReconciliationDto,
      'eventCode' | 'eventBizKey'
    >,
  ) {
    if (queryDto.eventCode === undefined && !queryDto.eventBizKey?.trim()) {
      return undefined
    }

    const conditions: SQL[] = []
    if (queryDto.eventCode !== undefined) {
      conditions.push(
        eq(this.taskProgressLogTable.eventCode, queryDto.eventCode),
      )
    }
    if (queryDto.eventBizKey?.trim()) {
      conditions.push(
        eq(this.taskProgressLogTable.eventBizKey, queryDto.eventBizKey.trim()),
      )
    }

    const rows = await this.db
      .select({ assignmentId: this.taskProgressLogTable.assignmentId })
      .from(this.taskProgressLogTable)
      .where(and(...conditions))

    return [...new Set(rows.map((item) => item.assignmentId))]
  }

  /**
   * 根据奖励提醒投递状态反查 assignment ID 列表。
   */
  protected async queryAssignmentIdsByRewardReminderFilter(
    queryDto: Pick<QueryTaskAssignmentReconciliationDto, 'notificationStatus'>,
  ) {
    if (queryDto.notificationStatus === undefined) {
      return undefined
    }

    const assignmentIdSql = sql<number>`(${this.domainEventTable.context} -> 'payload' ->> 'assignmentId')::int`
    const reminderKindSql = sql<
      string | null
    >`${this.domainEventTable.context} -> 'payload' ->> 'reminderKind'`
    const rows = await this.db
      .select({ assignmentId: assignmentIdSql })
      .from(this.notificationDeliveryTable)
      .leftJoin(
        this.domainEventTable,
        eq(this.notificationDeliveryTable.eventId, this.domainEventTable.id),
      )
      .where(
        and(
          eq(this.notificationDeliveryTable.categoryKey, 'task_reminder'),
          eq(
            this.notificationDeliveryTable.status,
            queryDto.notificationStatus,
          ),
          eq(reminderKindSql, TaskReminderKindEnum.REWARD_GRANTED),
        ),
      )

    return [...new Set(rows.map((item) => item.assignmentId).filter(Boolean))]
  }

  /**
   * 查询 assignment 最近一次命中的事件摘要。
   */
  protected async getAssignmentEventProgressMap(assignmentIds: number[]) {
    const uniqueAssignmentIds = [
      ...new Set(assignmentIds.filter((id) => id > 0)),
    ]
    if (uniqueAssignmentIds.length === 0) {
      return new Map<number, TaskAssignmentEventProgressSummary>()
    }

    const rows = await this.db
      .select({
        assignmentId: this.taskProgressLogTable.assignmentId,
        eventCode: this.taskProgressLogTable.eventCode,
        eventBizKey: this.taskProgressLogTable.eventBizKey,
        eventOccurredAt: this.taskProgressLogTable.eventOccurredAt,
        id: this.taskProgressLogTable.id,
      })
      .from(this.taskProgressLogTable)
      .where(
        and(
          inArray(this.taskProgressLogTable.assignmentId, uniqueAssignmentIds),
          sql`${this.taskProgressLogTable.eventCode} IS NOT NULL`,
        ),
      )

    const result = new Map<
      number,
      {
        rowId: number
        summary: TaskAssignmentEventProgressSummary
      }
    >()
    for (const row of rows) {
      const current = result.get(row.assignmentId)
      const candidate = {
        rowId: row.id,
        summary: {
          eventCode: row.eventCode,
          eventBizKey: row.eventBizKey,
          eventOccurredAt: row.eventOccurredAt,
        },
      }

      if (
        current &&
        !this.shouldReplaceLatestTaskEventProgressSummary(current, candidate)
      ) {
        continue
      }
      result.set(row.assignmentId, {
        rowId: row.id,
        summary: candidate.summary,
      })
    }

    return new Map(
      Array.from(result.entries(), ([assignmentId, value]) => [
        assignmentId,
        value.summary,
      ]),
    )
  }

  /**
   * 判断候选事件摘要是否应该覆盖当前“最近一次事件”。
   *
   * 统一按 `eventOccurredAt` 作为主排序键；若发生时间相同，再用日志 ID 兜底，
   * 避免对账页把“晚写入的旧事件”误判成最近一次业务事件。
   */
  protected shouldReplaceLatestTaskEventProgressSummary(
    current: {
      rowId: number
      summary: Pick<TaskAssignmentEventProgressSummary, 'eventOccurredAt'>
    },
    candidate: {
      rowId: number
      summary: Pick<TaskAssignmentEventProgressSummary, 'eventOccurredAt'>
    },
  ) {
    const currentOccurredAt = current.summary.eventOccurredAt?.getTime()
    const candidateOccurredAt = candidate.summary.eventOccurredAt?.getTime()

    if (
      typeof currentOccurredAt === 'number' &&
      typeof candidateOccurredAt === 'number'
    ) {
      if (candidateOccurredAt !== currentOccurredAt) {
        return candidateOccurredAt > currentOccurredAt
      }
      return candidate.rowId > current.rowId
    }

    if (typeof candidateOccurredAt === 'number') {
      return true
    }
    if (typeof currentOccurredAt === 'number') {
      return false
    }

    return candidate.rowId > current.rowId
  }

  /**
   * 查询 assignment 最近一次奖励到账提醒结果。
   */
  protected async getAssignmentRewardReminderMap(assignmentIds: number[]) {
    const uniqueAssignmentIds = [
      ...new Set(assignmentIds.filter((id) => id > 0)),
    ]
    if (uniqueAssignmentIds.length === 0) {
      return new Map<number, TaskAssignmentRewardReminderSummary>()
    }

    const assignmentIdSql = sql<number>`(${this.domainEventTable.context} -> 'payload' ->> 'assignmentId')::int`
    const reminderKindSql = sql<
      string | null
    >`${this.domainEventTable.context} -> 'payload' ->> 'reminderKind'`
    const rows = await this.db
      .select({
        assignmentId: assignmentIdSql,
        bizKey: this.notificationDeliveryTable.projectionKey,
        status: this.notificationDeliveryTable.status,
        failureReason: this.notificationDeliveryTable.failureReason,
        lastAttemptAt: this.notificationDeliveryTable.lastAttemptAt,
        id: this.notificationDeliveryTable.id,
      })
      .from(this.notificationDeliveryTable)
      .leftJoin(
        this.domainEventTable,
        eq(this.notificationDeliveryTable.eventId, this.domainEventTable.id),
      )
      .where(
        and(
          eq(this.notificationDeliveryTable.categoryKey, 'task_reminder'),
          inArray(assignmentIdSql, uniqueAssignmentIds),
          eq(reminderKindSql, TaskReminderKindEnum.REWARD_GRANTED),
        ),
      )
      .orderBy(desc(this.notificationDeliveryTable.id))

    const result = new Map<number, TaskAssignmentRewardReminderSummary>()
    for (const row of rows) {
      if (!row.assignmentId || result.has(row.assignmentId)) {
        continue
      }
      result.set(row.assignmentId, {
        bizKey: row.bizKey ?? '',
        status: row.status as TaskAssignmentRewardReminderSummary['status'],
        failureReason: row.failureReason,
        lastAttemptAt: row.lastAttemptAt,
      })
    }
    return result
  }

  // ==================== 通用工具 ====================

  /**
   * 判断任务是否配置了真实奖励。
   *
   * 只有 points/experience 任一项大于 0，才认为完成态需要展示奖励结算状态。
   */
  protected hasConfiguredTaskReward<T>(rewardItems: T) {
    const rewardItemArray = this.asArray(rewardItems)
    if (!rewardItemArray) {
      return false
    }

    return rewardItemArray.some((item) => {
      const rewardRecord = this.asRecord(item)
      return (this.readSnapshotPositiveInt(rewardRecord?.amount) ?? 0) > 0
    })
  }

  /**
   * 从快照字段读取有效字符串。
   */
  protected readSnapshotString<T>(value: T) {
    return typeof value === 'string' && value.trim() !== '' ? value : undefined
  }

  /**
   * 从快照字段读取正整数。
   */
  protected readSnapshotPositiveInt<T>(value: T) {
    return typeof value === 'number' && Number.isInteger(value) && value > 0
      ? value
      : undefined
  }

  /**
   * 计算真实到账的奖励项列表。
   *
   * 仅统计本次真实落账成功的奖励；幂等命中、失败或未配置奖励都会被过滤掉。
   */
  protected getAppliedRewardItems(
    rewardResult: TaskRewardSettlementResult,
  ) {
    return rewardResult.rewardResults.flatMap((reward) => {
      if (!reward.success || reward.duplicated || reward.skipped) {
        return []
      }
      return [{
        assetType: reward.assetType,
        assetKey: reward.assetKey,
        amount: reward.configuredAmount,
      }]
    })
  }

  /**
   * 时间加减辅助方法
   * 支持按小时平移时间，供提醒窗口计算复用。
   */
  protected addHours(date: Date, hours: number) {
    const next = new Date(date)
    next.setHours(next.getHours() + hours)
    return next
  }

  /**
   * 统一序列化提醒链路异常
   * 仅用于 warning 日志，避免 sidecar 通知失败影响主业务链路。
   */
  protected stringifyError<T>(error: T) {
    if (error instanceof Error) {
      return error.message
    }
    if (typeof error === 'string') {
      return error
    }
    try {
      return JSON.stringify(error)
    } catch {
      return 'unknown error'
    }
  }

  /**
   * 把弱结构输入收敛成对象记录。
   */
  protected asRecord<T>(input: T) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      return null
    }
    return input as Record<string, unknown>
  }

  /**
   * 把弱结构输入收敛成数组。
   */
  protected asArray<T>(input: T) {
    return Array.isArray(input) ? input : null
  }

  /**
   * 归一化并校验任务时区。
   *
   * 仅接受合法 IANA 时区标识，非法值统一回退为 undefined。
   */
  protected normalizeTaskTimezone(timezone?: string | null) {
    if (!timezone || typeof timezone !== 'string') {
      return undefined
    }

    const normalizedTimezone = timezone.trim()
    if (normalizedTimezone === '') {
      return undefined
    }

    try {
      Intl.DateTimeFormat('zh-CN', {
        timeZone: normalizedTimezone,
      })
      return normalizedTimezone
    } catch {
      return undefined
    }
  }

  /**
   * 解析周期计算使用的任务时区。
   */
  protected getTaskRepeatTimezone(taskRecord: Pick<TaskSelect, 'repeatRule'>) {
    const repeatRule = this.asRecord(taskRecord.repeatRule)
    return (
      this.normalizeTaskTimezone(
        typeof repeatRule?.timezone === 'string'
          ? repeatRule.timezone
          : undefined,
      ) ?? this.defaultTaskTimezone
    )
  }

  /**
   * 获取任务当前周期的时区锚点。
   */
  protected getTaskCycleAnchor(
    taskRecord: Pick<TaskSelect, 'repeatRule'>,
    now: Date,
  ) {
    return dayjs(now).tz(this.getTaskRepeatTimezone(taskRecord))
  }

  /**
   * 统一判断任务是否落在发布时间窗口内。
   *
   * 发布时间窗口对 claim / progress / complete 共用，避免不同入口出现边界漂移。
   */
  protected getTaskAvailabilityError(
    taskRecord: Pick<TaskSelect, 'publishStartAt' | 'publishEndAt'>,
    now: Date,
  ) {
    if (taskRecord.publishStartAt && taskRecord.publishStartAt > now) {
      return '任务未开始'
    }
    if (taskRecord.publishEndAt && taskRecord.publishEndAt < now) {
      return '任务已结束'
    }
    return undefined
  }

  /**
   * 断言任务当前可执行 claim / progress / complete。
   *
   * 任务配置存在不代表当前仍处在有效发布窗口，调用方需要在读到任务后立即校验。
   */
  protected assertTaskInPublishWindow(
    taskRecord: Pick<TaskSelect, 'publishStartAt' | 'publishEndAt'>,
    now: Date,
  ) {
    const availabilityError = this.getTaskAvailabilityError(taskRecord, now)
    if (availabilityError) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        availabilityError,
      )
    }
  }

  /**
   * 比较可空时间字段是否语义一致。
   */
  protected isSameNullableDate(left?: Date | null, right?: Date | null) {
    if (!left && !right) {
      return true
    }
    if (!left || !right) {
      return false
    }
    return left.getTime() === right.getTime()
  }

  /**
   * 计算 assignment 的真实过期时间。
   *
   * 一次性任务只受 publishEndAt 约束；重复任务则取“当前周期结束时间”和
   * publishEndAt 中更早的那个，确保旧周期 assignment 能被稳定关闭。
   */
  protected buildAssignmentExpiredAt(
    taskRecord: Pick<TaskSelect, 'publishEndAt' | 'repeatRule'>,
    now: Date,
  ) {
    const cycleExpiredAt = this.getCycleExpiredAt(taskRecord, now)
    const publishEndAt = taskRecord.publishEndAt ?? undefined

    if (!cycleExpiredAt) {
      return publishEndAt
    }
    if (!publishEndAt) {
      return cycleExpiredAt
    }
    return cycleExpiredAt.getTime() <= publishEndAt.getTime()
      ? cycleExpiredAt
      : publishEndAt
  }

  /**
   * 计算当前周期的结束时间。
   *
   * 周期边界统一按 UTC 计算，保持 cycleKey 与 expiredAt 的口径一致。
   */
  protected getCycleExpiredAt(
    taskRecord: Pick<TaskSelect, 'repeatRule'>,
    now: Date,
  ) {
    const repeatType = this.getTaskRepeatType(taskRecord)
    const cycleAnchor = this.getTaskCycleAnchor(taskRecord, now)
    if (repeatType === TaskRepeatTypeEnum.DAILY) {
      return cycleAnchor.startOf('day').add(1, 'day').toDate()
    }
    if (repeatType === TaskRepeatTypeEnum.WEEKLY) {
      return this.getWeekStart(cycleAnchor).add(1, 'week').toDate()
    }
    if (repeatType === TaskRepeatTypeEnum.MONTHLY) {
      return cycleAnchor.startOf('month').add(1, 'month').toDate()
    }
    return undefined
  }

  /**
   * 构建任务完成事件 envelope。
   * 当前任务域尚未进入统一事件定义表，先使用稳定字符串编码承载最小事件语义。
   */
  protected buildTaskCompleteEventEnvelope(
    params: BuildTaskCompleteEventEnvelopeInput,
  ) {
    return createEventEnvelope({
      code: TASK_COMPLETE_EVENT_CODE,
      key: TASK_COMPLETE_EVENT_KEY,
      subjectType: EventDefinitionEntityTypeEnum.USER,
      subjectId: params.userId,
      targetType: EventDefinitionEntityTypeEnum.TASK_ASSIGNMENT,
      targetId: params.assignmentId,
      occurredAt: params.occurredAt,
      governanceStatus: EventEnvelopeGovernanceStatusEnum.NONE,
      context: {
        taskId: params.taskId,
        assignmentId: params.assignmentId,
      },
    })
  }
}
