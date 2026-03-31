import { DrizzleService } from '@db/core'
import { MessageOutboxService } from '@libs/message/outbox'
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { and, asc, eq, inArray, isNull } from 'drizzle-orm'
import { UserGrowthRewardService } from '../growth-reward/growth-reward.service'
import {
  TaskAssignmentRewardStatusEnum,
  TaskAssignmentStatusEnum,
} from './task.constant'
import { TaskServiceSupport } from './task.service.support'

/**
 * 任务奖励服务。
 *
 * 负责已完成 assignment 的奖励补偿与后台手动重试入口，不处理普通进度推进。
 */
@Injectable()
export class TaskRewardService extends TaskServiceSupport {
  constructor(
    drizzle: DrizzleService,
    userGrowthRewardService: UserGrowthRewardService,
    messageOutboxService: MessageOutboxService,
  ) {
    super(drizzle, userGrowthRewardService, messageOutboxService)
  }

  /**
   * 重试单条已完成任务的奖励结算。
   *
   * 该入口依赖 assignment 快照重放完成事件，避免模板变更后补偿语义漂移。
   */
  async retryTaskAssignmentReward(assignmentId: number) {
    const assignment = await this.db.query.taskAssignment.findFirst({
      where: {
        id: assignmentId,
        deletedAt: { isNull: true },
      },
      with: {
        task: true,
      },
    })

    if (!assignment) {
      throw new NotFoundException('任务分配不存在')
    }
    if (assignment.status !== TaskAssignmentStatusEnum.COMPLETED) {
      throw new BadRequestException('仅已完成任务允许重试奖励结算')
    }
    if (assignment.rewardStatus === TaskAssignmentRewardStatusEnum.SUCCESS) {
      throw new BadRequestException('任务奖励已结算成功，无需重试')
    }

    await this.emitTaskCompleteEvent(
      assignment.userId,
      this.buildTaskRewardTaskRecord(
        assignment.taskId,
        assignment.task ?? undefined,
        assignment,
      ),
      {
        id: assignment.id,
        completedAt: assignment.completedAt,
      },
    )
    return true
  }

  /**
   * 批量扫描并重试待补偿奖励。
   *
   * 定时任务与后台手动批处理共用该入口，统一复用 assignment 快照语义。
   */
  async retryCompletedAssignmentRewardsBatch(
    limit = 100,
  ) {
    const assignments = await this.db
      .select({
        assignmentId: this.taskAssignmentTable.id,
        taskId: this.taskAssignmentTable.taskId,
        userId: this.taskAssignmentTable.userId,
        completedAt: this.taskAssignmentTable.completedAt,
        taskSnapshot: this.taskAssignmentTable.taskSnapshot,
        code: this.taskTable.code,
        title: this.taskTable.title,
        type: this.taskTable.type,
        rewardConfig: this.taskTable.rewardConfig,
      })
      .from(this.taskAssignmentTable)
      .leftJoin(
        this.taskTable,
        eq(this.taskAssignmentTable.taskId, this.taskTable.id),
      )
      .where(
        and(
          isNull(this.taskAssignmentTable.deletedAt),
          eq(
            this.taskAssignmentTable.status,
            TaskAssignmentStatusEnum.COMPLETED,
          ),
          inArray(this.taskAssignmentTable.rewardStatus, [
            TaskAssignmentRewardStatusEnum.PENDING,
            TaskAssignmentRewardStatusEnum.FAILED,
          ]),
        ),
      )
      .orderBy(asc(this.taskAssignmentTable.id))
      .limit(Math.max(1, Math.min(limit, 500)))

    for (const assignment of assignments) {
      await this.emitTaskCompleteEvent(
        assignment.userId,
        this.buildTaskRewardTaskRecord(
          assignment.taskId,
          assignment,
          assignment,
        ),
        {
          id: assignment.assignmentId,
          completedAt: assignment.completedAt,
        },
      )
    }

    return {
      scannedCount: assignments.length,
      triggeredCount: assignments.length,
    }
  }
}
