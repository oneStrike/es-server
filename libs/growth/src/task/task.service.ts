import type {
  ClaimTaskInput,
  CreateTaskInput,
  QueryAppTaskInput,
  QueryMyTaskInput,
  QueryTaskAssignmentPageInput,
  QueryTaskAssignmentReconciliationPageInput,
  QueryTaskPageInput,
  TaskCompleteInput,
  TaskEventProgressInput,
  TaskProgressInput,
  UpdateTaskInput,
  UpdateTaskStatusInput,
} from './task.type'
import { DrizzleService } from '@db/core'
import { MessageOutboxService } from '@libs/message/outbox'
import { Injectable } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { UserGrowthRewardService } from '../growth-reward/growth-reward.service'
import {
  createTask,
  deleteTask,
  getTaskAssignmentPage,
  getTaskAssignmentReconciliationPage,
  getTaskDetail,
  getTaskPage,
  updateTask,
  updateTaskStatus,
} from './task.admin.operations'
import {
  claimTask,
  completeTask,
  consumeEventProgress,
  getAvailableTasks,
  getMyTasks,
  getUserTaskSummary,
  reportProgress,
} from './task.app.operations'
import {
  expireAssignments,
  notifyExpiringSoonAssignments,
  retryCompletedAssignmentRewards,
  retryCompletedAssignmentRewardsBatch,
  retryTaskAssignmentReward,
} from './task.runtime.operations'
import { TaskServiceSupport } from './task.service.support'

/**
 * 任务服务门面。
 *
 * 对外维持既有 API、Cron 入口和单测可观测的方法名，
 * 具体实现按管理端、应用端和运行时链路拆到独立 operation 文件。
 */
@Injectable()
export class TaskService extends TaskServiceSupport {
  constructor(
    drizzle: DrizzleService,
    userGrowthRewardService: UserGrowthRewardService,
    messageOutboxService: MessageOutboxService,
  ) {
    super(drizzle, userGrowthRewardService, messageOutboxService)
  }

  /**
   * 分页查询任务列表（管理端）。
   */
  async getTaskPage(queryDto: QueryTaskPageInput) {
    return getTaskPage.call(this, queryDto)
  }

  /**
   * 获取任务详情（管理端）。
   */
  async getTaskDetail(id: number) {
    return getTaskDetail.call(this, id)
  }

  /**
   * 创建任务（管理端）。
   */
  async createTask(dto: CreateTaskInput, adminUserId: number) {
    return createTask.call(this, dto, adminUserId)
  }

  /**
   * 更新任务（管理端）。
   */
  async updateTask(dto: UpdateTaskInput, adminUserId: number) {
    return updateTask.call(this, dto, adminUserId)
  }

  /**
   * 更新任务状态（管理端）。
   */
  async updateTaskStatus(dto: UpdateTaskStatusInput) {
    return updateTaskStatus.call(this, dto)
  }

  /**
   * 删除任务（管理端）。
   */
  async deleteTask(id: number) {
    return deleteTask.call(this, id)
  }

  /**
   * 分页查询任务分配列表（管理端）。
   */
  async getTaskAssignmentPage(queryDto: QueryTaskAssignmentPageInput) {
    return getTaskAssignmentPage.call(this, queryDto)
  }

  /**
   * 分页查询任务奖励与通知对账视图（管理端）。
   */
  async getTaskAssignmentReconciliationPage(
    queryDto: QueryTaskAssignmentReconciliationPageInput,
  ) {
    return getTaskAssignmentReconciliationPage.call(this, queryDto)
  }

  /**
   * 重试单条任务奖励结算。
   */
  async retryTaskAssignmentReward(assignmentId: number) {
    return retryTaskAssignmentReward.call(this, assignmentId)
  }

  /**
   * 批量补偿已完成任务奖励。
   */
  async retryCompletedAssignmentRewardsBatch(limit = 100) {
    return retryCompletedAssignmentRewardsBatch.call(this, limit)
  }

  /**
   * 获取可领取任务列表（应用端）。
   */
  async getAvailableTasks(queryDto: QueryAppTaskInput, userId: number) {
    return getAvailableTasks.call(this, queryDto, userId)
  }

  /**
   * 获取我的任务列表（应用端）。
   */
  async getMyTasks(queryDto: QueryMyTaskInput, userId: number) {
    return getMyTasks.call(this, queryDto, userId)
  }

  /**
   * 获取用户中心任务摘要。
   */
  async getUserTaskSummary(userId: number) {
    return getUserTaskSummary.call(this, userId)
  }

  /**
   * 领取任务（应用端）。
   */
  async claimTask(dto: ClaimTaskInput, userId: number) {
    return claimTask.call(this, dto, userId)
  }

  /**
   * 上报任务进度（应用端）。
   */
  async reportProgress(dto: TaskProgressInput, userId: number) {
    return reportProgress.call(this, dto, userId)
  }

  /**
   * 完成任务（应用端）。
   */
  async completeTask(dto: TaskCompleteInput, userId: number) {
    return completeTask.call(this, dto, userId)
  }

  /**
   * 消费业务事件并推进事件型任务。
   */
  async consumeEventProgress(input: TaskEventProgressInput) {
    return consumeEventProgress.call(this, input)
  }

  /**
   * 定时过期任务分配。
   */
  @Cron('0 */5 * * * *')
  async expireAssignments() {
    return expireAssignments.call(this)
  }

  /**
   * 定时补偿已完成任务奖励。
   */
  @Cron('30 */5 * * * *')
  async retryCompletedAssignmentRewards() {
    return retryCompletedAssignmentRewards.call(this)
  }

  /**
   * 定时发送即将过期提醒。
   */
  @Cron('0 0 * * * *')
  async notifyExpiringSoonAssignments() {
    return notifyExpiringSoonAssignments.call(this)
  }
}
