import type { TaskStepSelect } from '@db/schema'
import type { TaskStepWriteInput } from './types/task.type'
import { DrizzleService } from '@db/core'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { Injectable } from '@nestjs/common'
import { and, eq, sql } from 'drizzle-orm'
import {
  CreateTaskDefinitionDto,
  CreateTaskStepDto,
  QueryTaskDefinitionPageDto,
  UpdateTaskDefinitionDto,
} from './dto/task-admin.dto'
import { TaskEventTemplateRegistry } from './task-event-template.registry'
import {
  TaskCompletionPolicyEnum,
  TaskRepeatCycleEnum,
  TaskStepProgressModeEnum,
  TaskStepTriggerModeEnum,
} from './task.constant'
import { TaskServiceSupport } from './task.service.support'

/**
 * 新任务模型中的任务头读服务。
 *
 * 承载任务头的读写能力，不处理运行时推进。
 */
@Injectable()
export class TaskDefinitionService extends TaskServiceSupport {
  // 注入任务头读写所需的模板注册表与数据库能力。
  constructor(
    drizzle: DrizzleService,
    private readonly taskEventTemplateRegistry: TaskEventTemplateRegistry,
  ) {
    super(drizzle)
  }

  // 创建新任务头及其唯一单步骤。
  async createTaskDefinition(
    input: CreateTaskDefinitionDto,
    adminUserId: number,
  ) {
    this.ensureTaskDefinitionWriteInput(input)

    const normalizedStep = this.buildTaskStepWriteInput(input.step)
    const template = normalizedStep.templateKey
      ? this.taskEventTemplateRegistry.getTemplateByKey(
          normalizedStep.templateKey,
        )
      : null
    this.ensureTaskStepWriteInput(
      normalizedStep,
      template?.isSelectable ?? false,
      template?.eventCode,
      template?.supportedProgressModes,
    )

    await this.drizzle.withErrorHandling(
      async () =>
        this.drizzle.withTransaction(async (tx) => {
          const [taskDefinition] = await tx
            .insert(this.taskDefinitionTable)
            .values({
              code: input.code,
              title: input.title,
              description: input.description,
              cover: input.cover,
              sceneType: input.sceneType,
              status: input.status,
              priority: input.priority,
              claimMode: input.claimMode,
              completionPolicy:
                input.completionPolicy ?? TaskCompletionPolicyEnum.ALL_STEPS,
              repeatType: input.repeatType ?? TaskRepeatCycleEnum.ONCE,
              repeatTimezone: input.repeatTimezone,
              startAt: input.startAt,
              endAt: input.endAt,
              audienceSegmentId: input.audienceSegmentId,
              rewardItems: input.rewardItems ?? null,
              createdById: adminUserId,
              updatedById: adminUserId,
            })
            .returning({ id: this.taskDefinitionTable.id })

          await tx.insert(this.taskStepTable).values({
            taskId: taskDefinition.id,
            stepKey: 'step_001',
            title: normalizedStep.title,
            description: normalizedStep.description,
            stepNo: 1,
            triggerMode: normalizedStep.triggerMode,
            progressMode: normalizedStep.progressMode,
            eventCode: normalizedStep.eventCode ?? null,
            targetValue: normalizedStep.targetValue,
            templateKey: normalizedStep.templateKey ?? null,
            filterPayload: normalizedStep.filterPayload ?? null,
            uniqueDimensionKey: normalizedStep.uniqueDimensionKey ?? null,
            dedupeScope: normalizedStep.dedupeScope ?? null,
          })
        }),
      { duplicate: '任务编码已存在' },
    )

    return true
  }

  // 分页查询新任务头列表。
  async getTaskDefinitionPage(params: QueryTaskDefinitionPageDto = {}) {
    const page = this.buildTaskDefinitionPage(params)
    const order = this.buildTaskDefinitionOrderBy(params)
    const where = this.buildTaskDefinitionWhere(params)
    const [primaryOrderBy, ...secondaryOrderBys] = order.orderBySql

    const [list, total] = await Promise.all([
      this.db
        .select({
          task: this.taskDefinitionTable,
          stepCount: sql<number>`count(${this.taskStepTable.id})::int`,
        })
        .from(this.taskDefinitionTable)
        .leftJoin(
          this.taskStepTable,
          and(
            sql`${this.taskStepTable.taskId} = ${this.taskDefinitionTable.id}`,
          ),
        )
        .where(where)
        .groupBy(this.taskDefinitionTable.id)
        .orderBy(primaryOrderBy, ...secondaryOrderBys)
        .limit(page.limit)
        .offset(page.offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(this.taskDefinitionTable)
        .where(where),
    ])

    const taskIds = list.map((item) => item.task.id)
    const runtimeSummaryMap =
      await this.getTaskDefinitionRuntimeSummaryMap(taskIds)

    return {
      list: list.map((item) =>
        this.toAdminTaskDefinitionListItem(
          item.task,
          Number(item.stepCount ?? 0),
          runtimeSummaryMap.get(item.task.id),
        ),
      ),
      total: Number(total[0]?.count ?? 0),
      pageIndex: page.pageIndex,
      pageSize: page.pageSize,
    }
  }

  // 查询新任务头详情。
  async getTaskDefinitionDetail(id: number) {
    const taskRecord = await this.getTaskDefinitionRecordOrThrow(id)
    const [stepSummaryMap, runtimeSummaryMap] = await Promise.all([
      this.getTaskStepSummaryMap([id]),
      this.getTaskDefinitionRuntimeSummaryMap([id]),
    ])

    return this.toAdminTaskDefinitionDetail(
      taskRecord,
      stepSummaryMap.get(id) ?? [],
      runtimeSummaryMap.get(id),
    )
  }

  // 更新新任务头及其唯一单步骤。
  async updateTaskDefinition(
    input: UpdateTaskDefinitionDto,
    adminUserId: number,
  ) {
    const existing = await this.getTaskDefinitionRecordOrThrow(input.id)
    const currentStep = await this.db.query.taskStep.findFirst({
      where: {
        taskId: input.id,
        stepNo: 1,
      },
    })

    if (!currentStep) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '任务步骤不存在',
      )
    }

    this.ensureTaskDefinitionWriteInput(input)

    const nextStep: TaskStepWriteInput | null = input.step
      ? this.buildTaskStepWriteInput(input.step, currentStep)
      : null

    const template = nextStep?.templateKey
      ? this.taskEventTemplateRegistry.getTemplateByKey(nextStep.templateKey)
      : null
    if (nextStep) {
      this.ensureTaskStepWriteInput(
        nextStep,
        template?.isSelectable ?? false,
        template?.eventCode,
        template?.supportedProgressModes,
      )
    }

    await this.drizzle.withErrorHandling(
      async () =>
        this.drizzle.withTransaction(async (tx) => {
          await tx
            .update(this.taskDefinitionTable)
            .set({
              code: input.code ?? existing.code,
              title: input.title ?? existing.title,
              description:
                input.description !== undefined
                  ? input.description
                  : existing.description,
              cover: input.cover !== undefined ? input.cover : existing.cover,
              sceneType: input.sceneType ?? existing.sceneType,
              status: input.status ?? existing.status,
              priority: input.priority ?? existing.priority,
              claimMode: input.claimMode ?? existing.claimMode,
              completionPolicy:
                input.completionPolicy ?? existing.completionPolicy,
              repeatType: input.repeatType ?? existing.repeatType,
              repeatTimezone:
                input.repeatTimezone !== undefined
                  ? input.repeatTimezone
                  : existing.repeatTimezone,
              startAt:
                input.startAt !== undefined ? input.startAt : existing.startAt,
              endAt: input.endAt !== undefined ? input.endAt : existing.endAt,
              audienceSegmentId:
                input.audienceSegmentId !== undefined
                  ? input.audienceSegmentId
                  : existing.audienceSegmentId,
              rewardItems:
                input.rewardItems !== undefined
                  ? input.rewardItems
                  : existing.rewardItems,
              updatedById: adminUserId,
            })
            .where(eq(this.taskDefinitionTable.id, input.id))

          if (nextStep) {
            await tx
              .update(this.taskStepTable)
              .set({
                title: nextStep.title,
                description: nextStep.description,
                triggerMode: nextStep.triggerMode,
                progressMode: nextStep.progressMode,
                eventCode: nextStep.eventCode ?? null,
                targetValue: nextStep.targetValue,
                templateKey: nextStep.templateKey ?? null,
                filterPayload: nextStep.filterPayload ?? null,
                uniqueDimensionKey: nextStep.uniqueDimensionKey ?? null,
                dedupeScope: nextStep.dedupeScope ?? null,
              })
              .where(
                and(
                  eq(this.taskStepTable.taskId, input.id),
                  eq(this.taskStepTable.stepNo, 1),
                ),
              )
          }
        }),
      {
        duplicate: '任务编码已存在',
        notFound: '任务不存在',
      },
    )

    return true
  }

  // 更新新任务头状态。
  async updateTaskDefinitionStatus(id: number, status: number) {
    this.ensureTaskDefinitionStatus(status)

    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.taskDefinitionTable)
          .set({ status })
          .where(eq(this.taskDefinitionTable.id, id)),
      { notFound: '任务不存在' },
    )
    return true
  }

  // 软删除新任务头。
  async deleteTaskDefinition(id: number) {
    await this.getTaskDefinitionRecordOrThrow(id)

    await this.db
      .update(this.taskDefinitionTable)
      .set({ deletedAt: new Date() })
      .where(eq(this.taskDefinitionTable.id, id))

    return true
  }

  // 把外部单步骤写入合同归一化成内部持久化视图。
  private buildTaskStepWriteInput(
    input: Partial<CreateTaskStepDto>,
    currentStep?: TaskStepSelect,
  ): TaskStepWriteInput {
    const triggerMode =
      input.triggerMode ??
      currentStep?.triggerMode ??
      TaskStepTriggerModeEnum.MANUAL
    const progressMode =
      input.progressMode ??
      currentStep?.progressMode ??
      TaskStepProgressModeEnum.ONCE
    let templateKey: string | undefined

    if (triggerMode !== TaskStepTriggerModeEnum.MANUAL) {
      if (input.templateKey !== undefined) {
        templateKey = input.templateKey ?? undefined
      } else {
        templateKey = currentStep?.templateKey ?? undefined
      }
    }

    const currentFilters = this.taskEventTemplateRegistry.buildFilterValues(
      currentStep?.templateKey ?? undefined,
      (currentStep?.filterPayload as
      | Record<string, unknown>
      | null
      | undefined) ?? undefined,
    )
    let filters = currentFilters

    if (triggerMode === TaskStepTriggerModeEnum.MANUAL) {
      filters = []
    } else if (input.filters !== undefined) {
      filters = input.filters ?? []
    }

    const template = templateKey
      ? this.taskEventTemplateRegistry.getTemplateByKey(templateKey)
      : null
    const description =
      input.description !== undefined
        ? input.description
        : (currentStep?.description ?? undefined)
    const filterPayload = templateKey
      ? this.taskEventTemplateRegistry.normalizeFilterPayload(
          templateKey,
          filters,
        )
      : null
    let uniqueDimensionKey: string | undefined
    let dedupeScope: number | undefined

    if (progressMode === TaskStepProgressModeEnum.UNIQUE_COUNT) {
      if (input.uniqueDimensionKey !== undefined) {
        uniqueDimensionKey = input.uniqueDimensionKey ?? undefined
      } else {
        uniqueDimensionKey = currentStep?.uniqueDimensionKey ?? undefined
      }

      if (input.dedupeScope !== undefined) {
        dedupeScope = input.dedupeScope ?? undefined
      } else {
        dedupeScope = currentStep?.dedupeScope ?? undefined
      }
    }

    return {
      title: input.title ?? currentStep?.title ?? '',
      description,
      triggerMode,
      progressMode,
      eventCode: template?.eventCode,
      targetValue: input.targetValue ?? currentStep?.targetValue ?? 1,
      templateKey,
      filterPayload,
      uniqueDimensionKey,
      dedupeScope,
    }
  }
}
