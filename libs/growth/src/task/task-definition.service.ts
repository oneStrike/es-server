import { buildILikeCondition, DrizzleService } from '@db/core'

import { MessageDomainEventPublisher } from '@libs/message/eventing/message-domain-event.publisher'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { Injectable } from '@nestjs/common'
import { and, eq, inArray, isNull } from 'drizzle-orm'
import { UserGrowthRewardService } from '../growth-reward/growth-reward.service'
import {
  CreateTaskDto,
  QueryTaskDto,
  UpdateTaskDto,
  UpdateTaskStatusDto,
} from './dto/task.dto'
import {
  getTaskTypeFilterValues,
  normalizeTaskObjectiveType,
} from './task.constant'
import { TaskServiceSupport } from './task.service.support'

/**
 * 任务定义服务。
 *
 * 负责任务模板本身的生命周期与定义态读模型，包括模板新增、变更、上下线、
 * 软删除，以及后台任务列表/详情查询。
 */
@Injectable()
export class TaskDefinitionService extends TaskServiceSupport {
  constructor(
    drizzle: DrizzleService,
    userGrowthRewardService: UserGrowthRewardService,
    messageDomainEventPublisher: MessageDomainEventPublisher,
  ) {
    super(drizzle, userGrowthRewardService, messageDomainEventPublisher)
  }

  /**
   * 创建任务模板。
   *
   * 在写入前统一校验发布时间窗口、目标配置、奖励配置与重复规则，
   * 避免无效模板进入后续 claim / progress / reward 链路。
   */
  async createTask(dto: CreateTaskDto, adminUserId: number) {
    this.ensurePublishWindow(dto.publishStartAt, dto.publishEndAt)
    const objectiveType = this.parseTaskObjectiveType(dto.objectiveType)
    const eventCode = this.parseTaskEventCode(dto.eventCode)
    const objectiveConfig = this.parseTaskObjectiveConfig(dto.objectiveConfig)
    this.ensurePositiveTaskTargetCount(dto.targetCount)
    this.ensureTaskObjectiveContract({
      objectiveType,
      eventCode,
      objectiveConfig,
    })
    const rewardItems = this.parseTaskRewardItems(dto.rewardItems)
    const repeatRule = this.parseTaskRepeatRule(dto.repeatRule)

    await this.drizzle.withErrorHandling(
      () =>
        this.db.insert(this.taskTable).values({
          ...dto,
          objectiveType,
          eventCode,
          objectiveConfig,
          rewardItems,
          repeatRule,
          createdById: adminUserId,
          updatedById: adminUserId,
        }),
      { duplicate: '任务编码已存在' },
    )

    return true
  }

  /**
   * 更新任务模板。
   *
   * 已有活跃 assignment 时，只允许做不影响执行语义的字段调整；
   * 一旦涉及周期、目标、完成方式等关键配置，会在这里统一拦截。
   */
  async updateTask(dto: UpdateTaskDto, adminUserId: number) {
    const existingTask = await this.db.query.task.findFirst({
      where: {
        id: dto.id,
        deletedAt: { isNull: true },
      },
    })
    if (!existingTask) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '任务不存在',
      )
    }

    const objectiveType =
      dto.objectiveType !== undefined
        ? this.parseTaskObjectiveType(dto.objectiveType)
        : normalizeTaskObjectiveType(existingTask.objectiveType)
    const eventCode =
      dto.eventCode !== undefined
        ? this.parseTaskEventCode(dto.eventCode)
        : (existingTask.eventCode ?? undefined)
    const objectiveConfig =
      dto.objectiveConfig !== undefined
        ? this.parseTaskObjectiveConfig(dto.objectiveConfig)
        : (this.asRecord(existingTask.objectiveConfig) ??
          existingTask.objectiveConfig ??
          undefined)
    this.ensurePositiveTaskTargetCount(dto.targetCount)
    this.ensureTaskObjectiveContract({
      objectiveType,
      eventCode,
      objectiveConfig: objectiveConfig as
      | Record<string, unknown>
      | null
      | undefined,
    })
    const rewardItems = this.parseTaskRewardItems(dto.rewardItems)
    const repeatRule = this.parseTaskRepeatRule(dto.repeatRule)
    const nextPublishStartAt =
      dto.publishStartAt !== undefined
        ? (dto.publishStartAt ?? null)
        : existingTask.publishStartAt
    const nextPublishEndAt =
      dto.publishEndAt !== undefined
        ? (dto.publishEndAt ?? null)
        : existingTask.publishEndAt

    this.ensurePublishWindow(
      nextPublishStartAt ?? undefined,
      nextPublishEndAt ?? undefined,
    )
    await this.assertNoActiveAssignmentConfigMutation(
      existingTask,
      dto,
      repeatRule,
      objectiveType,
    )

    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.taskTable)
          .set({
            ...dto,
            objectiveType,
            eventCode,
            objectiveConfig,
            rewardItems,
            repeatRule,
            updatedById: adminUserId,
          })
          .where(
            and(
              eq(this.taskTable.id, dto.id),
              isNull(this.taskTable.deletedAt),
            ),
          ),
      {
        duplicate: '任务编码已存在',
        notFound: '任务不存在',
      },
    )
    return true
  }

  /**
   * 更新任务发布状态与启用状态。
   *
   * 该接口只处理后台快速开关，不承担复杂配置变更校验。
   */
  async updateTaskStatus(dto: UpdateTaskStatusDto) {
    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.taskTable)
          .set({
            status: dto.status,
            isEnabled: dto.isEnabled,
          })
          .where(
            and(
              eq(this.taskTable.id, dto.id),
              isNull(this.taskTable.deletedAt),
            ),
          ),
      { notFound: '任务不存在' },
    )
    return true
  }

  /**
   * 软删除任务模板并关闭相关 assignment。
   *
   * 删除动作会把对应活跃 assignment 统一标记为过期，避免删除后仍残留可执行实例。
   */
  async deleteTask(id: number) {
    const now = new Date()
    await this.drizzle.withTransaction(async (tx) => {
      const targetTask = await tx.query.task.findFirst({
        where: {
          id,
          deletedAt: { isNull: true },
        },
      })
      if (!targetTask) {
        throw new BusinessException(
          BusinessErrorCode.RESOURCE_NOT_FOUND,
          '任务不存在',
        )
      }

      await tx
        .update(this.taskTable)
        .set({ deletedAt: now })
        .where(and(eq(this.taskTable.id, id), isNull(this.taskTable.deletedAt)))

      await this.expireAssignmentsByWhere(tx, {
        now,
        whereClause: eq(this.taskAssignmentTable.taskId, id),
        overrideExpiredAt: now,
      })
    })
    return true
  }

  /**
   * 分页查询后台任务列表。
   *
   * 任务运行态健康信息会在这里一并补齐，避免管理端为同一页数据反复跨表查询。
   */
  async getTaskPage(queryDto: QueryTaskDto) {
    const conditions = [isNull(this.taskTable.deletedAt)]

    if (queryDto.status !== undefined) {
      conditions.push(eq(this.taskTable.status, queryDto.status))
    }
    if (queryDto.type !== undefined) {
      conditions.push(
        inArray(this.taskTable.type, getTaskTypeFilterValues(queryDto.type)),
      )
    }
    if (queryDto.isEnabled !== undefined) {
      conditions.push(eq(this.taskTable.isEnabled, queryDto.isEnabled))
    }
    if (queryDto.title) {
      conditions.push(
        buildILikeCondition(this.taskTable.title, queryDto.title)!,
      )
    }

    const result = await this.drizzle.ext.findPagination(this.taskTable, {
      where: and(...conditions),
      ...queryDto,
    })
    const runtimeHealthMap = await this.getTaskRuntimeHealthMap(
      result.list.map((item) => item.id),
    )

    return {
      ...result,
      list: result.list.map((taskRecord) =>
        this.toAdminTaskView(taskRecord, runtimeHealthMap.get(taskRecord.id)),
      ),
    }
  }

  /**
   * 获取后台任务详情。
   */
  async getTaskDetail(id: number) {
    const taskRecord = await this.db.query.task.findFirst({
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
    const runtimeHealthMap = await this.getTaskRuntimeHealthMap([taskRecord.id])
    return this.toAdminTaskView(taskRecord, runtimeHealthMap.get(taskRecord.id))
  }
}
