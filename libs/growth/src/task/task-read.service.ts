import type {
  QueryTaskAssignmentPageInput,
  QueryTaskAssignmentReconciliationPageInput,
  QueryTaskPageInput,
} from './task.type'
import { DrizzleService, escapeLikePattern } from '@db/core'
import { MessageOutboxService } from '@libs/message/outbox'
import { Injectable, NotFoundException } from '@nestjs/common'
import { and, eq, ilike, inArray, isNull } from 'drizzle-orm'
import { UserGrowthRewardService } from '../growth-reward/growth-reward.service'
import { getTaskTypeFilterValues } from './task.constant'
import { TaskServiceSupport } from './task.service.support'

/**
 * 任务读模型服务。
 *
 * 负责后台任务列表、详情、assignment 列表与对账视图，不处理模板写入和用户推进状态机。
 */
@Injectable()
export class TaskReadService extends TaskServiceSupport {
  constructor(
    drizzle: DrizzleService,
    userGrowthRewardService: UserGrowthRewardService,
    messageOutboxService: MessageOutboxService,
  ) {
    super(drizzle, userGrowthRewardService, messageOutboxService)
  }

  /**
   * 分页查询后台任务列表。
   *
   * 任务运行态健康信息会在这里一并补齐，避免管理端为同一页数据反复跨表查询。
   */
  async getTaskPage(
    queryDto: QueryTaskPageInput,
  ) {
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
        ilike(this.taskTable.title, `%${escapeLikePattern(queryDto.title)}%`),
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
      throw new NotFoundException('任务不存在')
    }
    const runtimeHealthMap = await this.getTaskRuntimeHealthMap([taskRecord.id])
    return this.toAdminTaskView(taskRecord, runtimeHealthMap.get(taskRecord.id))
  }

  /**
   * 分页查询后台 assignment 列表。
   */
  async getTaskAssignmentPage(
    queryDto: QueryTaskAssignmentPageInput,
  ) {
    const assignmentConditions = [isNull(this.taskAssignmentTable.deletedAt)]

    if (queryDto.taskId !== undefined) {
      assignmentConditions.push(
        eq(this.taskAssignmentTable.taskId, queryDto.taskId),
      )
    }
    if (queryDto.userId !== undefined) {
      assignmentConditions.push(
        eq(this.taskAssignmentTable.userId, queryDto.userId),
      )
    }
    if (queryDto.status !== undefined) {
      assignmentConditions.push(
        eq(this.taskAssignmentTable.status, queryDto.status),
      )
    }

    const result = await this.queryTaskAssignmentPage({
      whereClause: and(...assignmentConditions),
      pageIndex: queryDto.pageIndex,
      pageSize: queryDto.pageSize,
      orderBy: queryDto.orderBy,
      includeTaskDetail: true,
    })

    return {
      ...result,
      list: result.list.map((item) => this.toAdminTaskAssignmentView(item)),
    }
  }

  /**
   * 分页查询任务奖励与通知对账视图。
   *
   * 该接口把 assignment、事件推进日志和奖励提醒状态聚合成单页结果，减少排障时的跨表切换。
   */
  async getTaskAssignmentReconciliationPage(
    queryDto: QueryTaskAssignmentReconciliationPageInput,
  ) {
    const assignmentConditions = [isNull(this.taskAssignmentTable.deletedAt)]

    if (queryDto.assignmentId !== undefined) {
      assignmentConditions.push(
        eq(this.taskAssignmentTable.id, queryDto.assignmentId),
      )
    }
    if (queryDto.taskId !== undefined) {
      assignmentConditions.push(
        eq(this.taskAssignmentTable.taskId, queryDto.taskId),
      )
    }
    if (queryDto.userId !== undefined) {
      assignmentConditions.push(
        eq(this.taskAssignmentTable.userId, queryDto.userId),
      )
    }
    if (queryDto.rewardStatus !== undefined) {
      assignmentConditions.push(
        eq(this.taskAssignmentTable.rewardStatus, queryDto.rewardStatus),
      )
    }

    const eventAssignmentIds =
      await this.queryAssignmentIdsByEventFilter(queryDto)
    if (eventAssignmentIds && eventAssignmentIds.length === 0) {
      return {
        list: [],
        total: 0,
        pageIndex: queryDto.pageIndex ?? 1,
        pageSize: queryDto.pageSize ?? 15,
      }
    }
    if (eventAssignmentIds) {
      assignmentConditions.push(
        inArray(this.taskAssignmentTable.id, eventAssignmentIds),
      )
    }

    const notificationAssignmentIds =
      await this.queryAssignmentIdsByRewardReminderFilter(queryDto)
    if (notificationAssignmentIds && notificationAssignmentIds.length === 0) {
      return {
        list: [],
        total: 0,
        pageIndex: queryDto.pageIndex ?? 1,
        pageSize: queryDto.pageSize ?? 15,
      }
    }
    if (notificationAssignmentIds) {
      assignmentConditions.push(
        inArray(this.taskAssignmentTable.id, notificationAssignmentIds),
      )
    }

    const result = await this.queryTaskAssignmentPage({
      whereClause: and(...assignmentConditions),
      pageIndex: queryDto.pageIndex,
      pageSize: queryDto.pageSize,
      orderBy: queryDto.orderBy,
      includeTaskDetail: true,
    })
    const assignmentIds = result.list.map((item) => item.id)
    const [eventMap, rewardReminderMap] = await Promise.all([
      this.getAssignmentEventProgressMap(assignmentIds),
      this.getAssignmentRewardReminderMap(assignmentIds),
    ])

    return {
      ...result,
      list: result.list.map((item) => {
        const taskView = this.buildAssignmentTaskView(item)
        const latestEvent = eventMap.get(item.id)
        const rewardReminder = rewardReminderMap.get(item.id)

        return {
          id: item.id,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          taskId: item.taskId,
          userId: item.userId,
          cycleKey: item.cycleKey,
          status: item.status,
          rewardStatus: item.rewardStatus,
          rewardResultType: item.rewardResultType,
          progress: item.progress,
          target: item.target,
          claimedAt: item.claimedAt,
          completedAt: item.completedAt,
          expiredAt: item.expiredAt,
          rewardSettledAt: item.rewardSettledAt,
          rewardLedgerIds: item.rewardLedgerIds,
          lastRewardError: item.lastRewardError,
          visibleStatus: this.resolveTaskUserVisibleStatus({
            status: item.status,
            rewardStatus: item.rewardStatus,
            rewardConfig: taskView?.rewardConfig,
          }),
          task: taskView,
          latestEventCode: latestEvent?.eventCode ?? null,
          latestEventBizKey: latestEvent?.eventBizKey ?? null,
          latestEventOccurredAt: latestEvent?.eventOccurredAt ?? null,
          rewardReminder: rewardReminder
            ? {
                bizKey: rewardReminder.bizKey,
                status: rewardReminder.status,
                failureReason: rewardReminder.failureReason,
                lastAttemptAt: rewardReminder.lastAttemptAt,
              }
            : null,
        }
      }),
    }
  }
}
