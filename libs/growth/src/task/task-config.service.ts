import type {
  CreateTaskInput,
  UpdateTaskInput,
  UpdateTaskStatusInput,
} from './task.type'
import { DrizzleService } from '@db/core'
import { MessageOutboxService } from '@libs/message/outbox'
import { Injectable, NotFoundException } from '@nestjs/common'
import { and, eq, isNull } from 'drizzle-orm'
import { UserGrowthRewardService } from '../growth-reward/growth-reward.service'
import { normalizeTaskObjectiveType } from './task.constant'
import { TaskServiceSupport } from './task.service.support'

/**
 * 任务配置服务。
 *
 * 负责任务模板的新增、变更、上下线和软删除，不处理用户执行态查询与事件推进。
 */
@Injectable()
export class TaskConfigService extends TaskServiceSupport {
  constructor(
    drizzle: DrizzleService,
    userGrowthRewardService: UserGrowthRewardService,
    messageOutboxService: MessageOutboxService,
  ) {
    super(drizzle, userGrowthRewardService, messageOutboxService)
  }

  /**
   * 创建任务模板。
   *
   * 在写入前统一校验发布时间窗口、目标配置、奖励配置与重复规则，
   * 避免无效模板进入后续 claim / progress / reward 链路。
   */
  async createTask(
    dto: CreateTaskInput,
    adminUserId: number,
  ) {
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
    const rewardConfig = this.parseTaskRewardConfig(dto.rewardConfig)
    const repeatRule = this.parseTaskRepeatRule(dto.repeatRule)

    await this.drizzle.withErrorHandling(
      () =>
        this.db.insert(this.taskTable).values({
          ...dto,
          objectiveType,
          eventCode,
          objectiveConfig,
          rewardConfig,
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
  async updateTask(
    dto: UpdateTaskInput,
    adminUserId: number,
  ) {
    const existingTask = await this.db.query.task.findFirst({
      where: {
        id: dto.id,
        deletedAt: { isNull: true },
      },
    })
    if (!existingTask) {
      throw new NotFoundException('任务不存在')
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
    const rewardConfig = this.parseTaskRewardConfig(dto.rewardConfig)
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

    const result = await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.taskTable)
          .set({
            ...dto,
            objectiveType,
            eventCode,
            objectiveConfig,
            rewardConfig,
            repeatRule,
            updatedById: adminUserId,
          })
          .where(
            and(
              eq(this.taskTable.id, dto.id),
              isNull(this.taskTable.deletedAt),
            ),
          ),
      { duplicate: '任务编码已存在' },
    )

    this.drizzle.assertAffectedRows(result, '任务不存在')
    return true
  }

  /**
   * 更新任务发布状态与启用状态。
   *
   * 该接口只处理后台快速开关，不承担复杂配置变更校验。
   */
  async updateTaskStatus(dto: UpdateTaskStatusInput) {
    const result = await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.taskTable)
        .set({
          status: dto.status,
          isEnabled: dto.isEnabled,
        })
        .where(
          and(eq(this.taskTable.id, dto.id), isNull(this.taskTable.deletedAt)),
        ),
    )

    this.drizzle.assertAffectedRows(result, '任务不存在')
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
        throw new NotFoundException('任务不存在')
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
}
